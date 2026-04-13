from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from bson import ObjectId
from datetime import datetime, timedelta
from typing import List, Optional
import os, sys, shutil, uuid, asyncio, time, json

from database import get_db
from models import *
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()

# ─── HELPERS ─────────────────────────────────────────────
def doc(d: dict) -> dict:
    """Convert MongoDB doc to JSON-serializable dict"""
    if d is None:
        return None
    d["id"] = str(d.pop("_id"))
    for k, v in d.items():
        if isinstance(v, ObjectId):
            d[k] = str(v)
    return d

# ═══════════════════════════════════════════════════════════
# AUTH ROUTES
# ═══════════════════════════════════════════════════════════

@router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    db = get_db()
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "Email already registered")
    
    user_doc = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": "user",
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    token = create_token(user_id)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": data.name,
            "email": data.email,
            "role": "user",
            "created_at": user_doc["created_at"]
        }
    }

@router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")
    
    user_id = str(user["_id"])
    token = create_token(user_id)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": user["name"],
            "email": user["email"],
            "role": user.get("role", "user"),
            "created_at": user["created_at"]
        }
    }

@router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user.get("role", "user"),
        "created_at": current_user["created_at"]
    }

# ═══════════════════════════════════════════════════════════
# TEAM ROUTES
# ═══════════════════════════════════════════════════════════

@router.post("/teams")
async def create_team(data: TeamCreate, current_user=Depends(get_current_user)):
    db = get_db()
    team_doc = {
        "name": data.name,
        "description": data.description,
        "owner_id": ObjectId(current_user["_id"]),
        "created_at": datetime.utcnow()
    }
    result = await db.teams.insert_one(team_doc)
    team_id = result.inserted_id

    # Auto-add creator as admin member
    await db.team_members.insert_one({
        "team_id": team_id,
        "user_id": ObjectId(current_user["_id"]),
        "role": "admin",
        "joined_at": datetime.utcnow()
    })

    return {"id": str(team_id), "name": data.name, "message": "Team created"}

@router.get("/teams")
async def get_teams(current_user=Depends(get_current_user)):
    db = get_db()
    memberships = await db.team_members.find(
        {"user_id": ObjectId(current_user["_id"])}
    ).to_list(100)
    
    team_ids = [m["team_id"] for m in memberships]
    teams = await db.teams.find({"_id": {"$in": team_ids}}).to_list(100)
    
    result = []
    for t in teams:
        membership = next((m for m in memberships if m["team_id"] == t["_id"]), None)
        result.append({
            "id": str(t["_id"]),
            "name": t["name"],
            "description": t.get("description", ""),
            "owner_id": str(t["owner_id"]),
            "role": membership["role"] if membership else "member",
            "created_at": t["created_at"]
        })
    return result

@router.get("/teams/{team_id}")
async def get_team(team_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(404, "Team not found")
    return doc(team)

@router.post("/teams/{team_id}/members")
async def add_member(team_id: str, data: TeamMemberAdd, current_user=Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(404, "User not found with that email")
    
    existing = await db.team_members.find_one({
        "team_id": ObjectId(team_id),
        "user_id": user["_id"]
    })
    if existing:
        raise HTTPException(400, "User already in team")
    
    await db.team_members.insert_one({
        "team_id": ObjectId(team_id),
        "user_id": user["_id"],
        "role": data.role,
        "joined_at": datetime.utcnow()
    })
    return {"message": f"{user['name']} added to team"}

@router.get("/teams/{team_id}/members")
async def get_members(team_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    memberships = await db.team_members.find(
        {"team_id": ObjectId(team_id)}
    ).to_list(100)
    
    result = []
    for m in memberships:
        user = await db.users.find_one({"_id": m["user_id"]})
        if user:
            result.append({
                "id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"],
                "role": m["role"],
                "joined_at": m["joined_at"]
            })
    return result

# ═══════════════════════════════════════════════════════════
# PROJECT ROUTES
# ═══════════════════════════════════════════════════════════

@router.post("/teams/{team_id}/projects")
async def create_project(team_id: str, data: ProjectCreate, current_user=Depends(get_current_user)):
    db = get_db()
    project_doc = {
        "name": data.name,
        "description": data.description,
        "color": data.color,
        "type": data.type,
        "team_id": ObjectId(team_id),
        "created_by": ObjectId(current_user["_id"]),
        "is_archived": False,
        "created_at": datetime.utcnow()
    }
    result = await db.projects.insert_one(project_doc)
    return {"id": str(result.inserted_id), "name": data.name, "message": "Project created"}

@router.get("/teams/{team_id}/projects")
async def get_projects(team_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    projects = await db.projects.find({
        "team_id": ObjectId(team_id),
        "is_archived": False
    }).to_list(100)
    
    result = []
    for p in projects:
        task_count = await db.tasks.count_documents({"project_id": p["_id"]})
        result.append({
            "id": str(p["_id"]),
            "name": p["name"],
            "description": p.get("description", ""),
            "color": p.get("color", "#6366f1"),
            "type": p["type"],
            "team_id": team_id,
            "created_by": str(p["created_by"]),
            "task_count": task_count,
            "created_at": p["created_at"]
        })
    return result

# ═══════════════════════════════════════════════════════════
# TASK ROUTES
# ═══════════════════════════════════════════════════════════

@router.post("/teams/{team_id}/projects/{project_id}/tasks")
async def create_task(team_id: str, project_id: str, data: TaskCreate, current_user=Depends(get_current_user)):
    db = get_db()
    task_doc = {
        "title": data.title,
        "description": data.description,
        "work_item_type": data.work_item_type,
        "status": data.status,
        "priority": data.priority,
        "project_id": ObjectId(project_id),
        "team_id": ObjectId(team_id),
        "created_by": ObjectId(current_user["_id"]),
        "assigned_to": ObjectId(data.assigned_to) if data.assigned_to else None,
        "due_date": data.due_date,
        "story_points": data.story_points,
        "created_at": datetime.utcnow()
    }
    result = await db.tasks.insert_one(task_doc)
    return {"id": str(result.inserted_id), "title": data.title, "message": "Task created"}

@router.get("/teams/{team_id}/projects/{project_id}/tasks")
async def get_tasks(team_id: str, project_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    tasks = await db.tasks.find({"project_id": ObjectId(project_id)}).to_list(500)
    result = []
    for t in tasks:
        result.append({
            "id": str(t["_id"]),
            "title": t["title"],
            "description": t.get("description", ""),
            "work_item_type": t["work_item_type"],
            "status": t["status"],
            "priority": t["priority"],
            "project_id": project_id,
            "team_id": team_id,
            "created_by": str(t["created_by"]),
            "assigned_to": str(t["assigned_to"]) if t.get("assigned_to") else None,
            "due_date": t.get("due_date"),
            "story_points": t.get("story_points"),
            "created_at": t["created_at"]
        })
    return result

@router.patch("/teams/{team_id}/projects/{project_id}/tasks/{task_id}")
async def update_task(team_id: str, project_id: str, task_id: str, data: TaskUpdate, current_user=Depends(get_current_user)):
    db = get_db()
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(400, "No fields to update")
    
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {**update_data, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Task updated"}

@router.delete("/teams/{team_id}/projects/{project_id}/tasks/{task_id}")
async def delete_task(team_id: str, project_id: str, task_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    return {"message": "Task deleted"}

# ═══════════════════════════════════════════════════════════
# ACTIVITY ROUTES
# ═══════════════════════════════════════════════════════════

@router.post("/teams/{team_id}/activities")
async def log_activity(team_id: str, data: ActivityCreate, current_user=Depends(get_current_user)):
    db = get_db()
    total_hours = sum(t.hours for t in data.tasks) + sum(m.duration / 60 for m in data.meetings)
    
    # Upsert — one activity per user per date
    await db.activities.update_one(
        {"user_id": ObjectId(current_user["_id"]), "date": data.date, "team_id": ObjectId(team_id)},
        {"$set": {
            "meetings": [m.dict() for m in data.meetings],
            "tasks": [t.dict() for t in data.tasks],
            "notes": data.notes,
            "mood": data.mood,
            "total_work_hours": total_hours,
            "updated_at": datetime.utcnow()
        }, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )
    return {"message": "Activity logged", "total_hours": total_hours}

@router.get("/teams/{team_id}/activities/today")
async def get_today_activity(team_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    activity = await db.activities.find_one({
        "user_id": ObjectId(current_user["_id"]),
        "team_id": ObjectId(team_id),
        "date": today
    })
    if not activity:
        return {"date": today, "meetings": [], "tasks": [], "notes": "", "mood": 3, "total_work_hours": 0}
    return doc(activity)

@router.get("/teams/{team_id}/activities/stats")
async def get_activity_stats(team_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    activities = await db.activities.find({
        "user_id": ObjectId(current_user["_id"]),
        "team_id": ObjectId(team_id)
    }).sort("date", -1).limit(30).to_list(30)
    
    total_hours = sum(a.get("total_work_hours", 0) for a in activities)
    total_meetings = sum(len(a.get("meetings", [])) for a in activities)
    total_tasks = sum(len(a.get("tasks", [])) for a in activities)
    avg_mood = sum(a.get("mood", 3) for a in activities) / max(len(activities), 1)
    
    return {
        "total_days_logged": len(activities),
        "total_hours": round(total_hours, 1),
        "total_meetings": total_meetings,
        "total_tasks_logged": total_tasks,
        "avg_mood": round(avg_mood, 1),
        "recent": [{"date": a["date"], "hours": a.get("total_work_hours", 0), "mood": a.get("mood", 3)} for a in activities[:7]]
    }

# ═══════════════════════════════════════════════════════════
# AGENT PIPELINE ROUTES
# ═══════════════════════════════════════════════════════════

CHARTS_DIR = "generated_charts"
os.makedirs(CHARTS_DIR, exist_ok=True)

# ─── RATE LIMITING ────────────────────────────────────────
_last_run: dict = {}  # user_id -> datetime of last run

def check_cooldown(user_id: str, seconds: int = 30):
    key = str(user_id)
    last = _last_run.get(key)
    if last:
        elapsed = (datetime.utcnow() - last).total_seconds()
        if elapsed < seconds:
            remaining = int(seconds - elapsed)
            raise HTTPException(429, f"Please wait {remaining}s before running another agent.")
    _last_run[key] = datetime.utcnow()

@router.post("/agent/run")
async def run_agent_pipeline(
    file: UploadFile = File(...),
    manager_prompt: str = Form(""),
    current_user=Depends(get_current_user)
):
    """
    Blocking endpoint — runs the full AutoGen pipeline as a subprocess,
    waits for it to complete, and returns charts + report in one response.
    Same paradigm as the working Streamlit app.py.
    """
    check_cooldown(str(current_user["_id"]), seconds=60)
    db = get_db()
    run_id = str(uuid.uuid4())
    _start = time.time()

    # Save uploaded CSV
    csv_path = f"{CHARTS_DIR}/{run_id}_data.csv"
    with open(csv_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    await db.agent_runs.insert_one({
        "run_id": run_id,
        "user_id": ObjectId(current_user["_id"]),
        "agent_type": "analyst",
        "status": "running",
        "started_at": datetime.utcnow(),
        "charts": [], "report": "", "data_quality": ""
    })

    # Run pipeline_worker.py as isolated subprocess — blocks until done
    backend_dir   = os.path.dirname(os.path.abspath(__file__))
    worker_script = os.path.join(backend_dir, "pipeline_worker.py")
    python_exe    = os.path.join(backend_dir, "venv", "bin", "python")
    if not os.path.exists(python_exe):
        python_exe = sys.executable

    abs_csv        = os.path.abspath(csv_path)
    abs_charts_dir = os.path.abspath(CHARTS_DIR)
    done_file      = os.path.join(abs_charts_dir, f"{run_id}_done.json")

    try:
        proc = await asyncio.create_subprocess_exec(
            python_exe, worker_script, abs_csv, run_id, abs_charts_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=backend_dir,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=600)
        print(stdout.decode(errors="replace"), flush=True)

        if proc.returncode != 0:
            raise RuntimeError(f"Worker exited with code {proc.returncode}")
        if not os.path.exists(done_file):
            raise RuntimeError("Worker finished but produced no output")

        with open(done_file) as f:
            result = json.load(f)

        charts       = result.get("charts", [])
        report_text  = result.get("report", "")
        data_quality = result.get("data_quality", "")
        duration     = round(time.time() - _start, 1)

        await db.agent_runs.update_one({"run_id": run_id}, {"$set": {
            "status": "completed", "charts": charts, "report": report_text,
            "data_quality": data_quality, "completed_at": datetime.utcnow(),
            "duration_seconds": duration, "tokens_used": (len(report_text) + len(data_quality)) // 4,
        }})

        return {
            "run_id": run_id, "status": "completed",
            "charts": charts, "report": report_text,
            "data_quality": data_quality, "duration_seconds": duration,
            "started_at": datetime.utcnow(),
        }

    except Exception as e:
        import traceback; traceback.print_exc()
        await db.agent_runs.update_one({"run_id": run_id}, {"$set": {
            "status": "failed", "error": str(e), "completed_at": datetime.utcnow()
        }})
        raise HTTPException(500, f"Pipeline failed: {e}")

@router.get("/agent/run/{run_id}")
async def get_run_status(run_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    run = await db.agent_runs.find_one({"run_id": run_id})
    if not run:
        raise HTTPException(404, "Run not found")
    return {
        "run_id": run_id,
        "status": run["status"],
        "charts": run.get("charts", []),
        "report": run.get("report", ""),
        "data_quality": run.get("data_quality", ""),
        "started_at": run["started_at"]
    }

@router.get("/agent/runs")
async def get_all_runs(current_user=Depends(get_current_user)):
    db = get_db()
    runs = await db.agent_runs.find(
        {"user_id": ObjectId(current_user["_id"])}
    ).sort("started_at", -1).limit(20).to_list(20)
    
    return [{
        "run_id": r["run_id"],
        "status": r["status"],
        "charts_count": len(r.get("charts", [])),
        "started_at": r["started_at"]
    } for r in runs]

@router.get("/agent/chart/{run_id}/{chart_name}")
async def get_chart(run_id: str, chart_name: str, current_user=Depends(get_current_user)):
    from fastapi.responses import FileResponse
    path = f"{CHARTS_DIR}/{run_id}_{chart_name}"
    if not os.path.exists(path):
        raise HTTPException(404, "Chart not found")
    return FileResponse(path, media_type="image/png")

# ═══════════════════════════════════════════════════════════
# ANALYTICS ROUTES
# ═══════════════════════════════════════════════════════════

@router.get("/teams/{team_id}/analytics/overview")
async def get_analytics_overview(team_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    
    total_projects = await db.projects.count_documents({"team_id": ObjectId(team_id), "is_archived": False})
    total_tasks = await db.tasks.count_documents({"team_id": ObjectId(team_id)})
    completed_tasks = await db.tasks.count_documents({"team_id": ObjectId(team_id), "status": "done"})
    total_members = await db.team_members.count_documents({"team_id": ObjectId(team_id)})
    agent_runs = await db.agent_runs.count_documents({"user_id": ObjectId(current_user["_id"])})

    return {
        "total_projects": total_projects,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "completion_rate": round((completed_tasks / max(total_tasks, 1)) * 100, 1),
        "total_members": total_members,
        "agent_runs": agent_runs
    }

async def run_pipeline_task(run_id: str, csv_path: str, db, current_user, custom_prompt: str = None):
    """
    Runs the AutoGen pipeline as a fully isolated subprocess (pipeline_worker.py).
    This avoids all asyncio / event-loop conflicts that caused the thread-executor
    approach to hang indefinitely.
    """
    _run_start = time.time()

    # Resolve absolute paths
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    worker_script = os.path.join(backend_dir, "pipeline_worker.py")
    python_exe    = os.path.join(backend_dir, "venv", "bin", "python")
    if not os.path.exists(python_exe):
        python_exe = sys.executable  # fallback to current interpreter

    abs_csv        = os.path.abspath(csv_path)
    abs_charts_dir = os.path.abspath(CHARTS_DIR)
    done_file      = os.path.join(abs_charts_dir, f"{run_id}_done.json")

    try:
        print(f"🚀 Launching pipeline worker for run {run_id}", flush=True)

        # Run pipeline_worker.py as a subprocess — completely isolated process
        proc = await asyncio.create_subprocess_exec(
            python_exe, worker_script, abs_csv, run_id, abs_charts_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=backend_dir,
        )

        # Stream logs to console while waiting (timeout: 10 minutes)
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=600)
            output = stdout.decode(errors="replace") if stdout else ""
            print(output, flush=True)
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError("Pipeline timed out after 10 minutes")

        if proc.returncode != 0:
            raise RuntimeError(f"Worker exited with code {proc.returncode}")

        # Read results from done marker
        if not os.path.exists(done_file):
            raise RuntimeError("Worker finished but done.json not found")

        with open(done_file) as f:
            result = json.load(f)

        charts       = result.get("charts", [])
        report_text  = result.get("report", "")
        data_quality = result.get("data_quality", "")

        duration = time.time() - _run_start
        tokens   = (len(report_text) + len(data_quality)) // 4

        await db.agent_runs.update_one(
            {"run_id": run_id},
            {"$set": {
                "status": "completed",
                "charts": charts,
                "report": report_text,
                "data_quality": data_quality,
                "completed_at": datetime.utcnow(),
                "duration_seconds": round(duration, 1),
                "tokens_used": tokens,
            }}
        )
        print(f"✅ Agent run {run_id} completed — {len(charts)} charts in {duration:.1f}s")

    except Exception as e:
        import traceback
        traceback.print_exc()
        await db.agent_runs.update_one(
            {"run_id": run_id},
            {"$set": {"status": "failed", "error": str(e), "completed_at": datetime.utcnow()}}
        )
        print(f"❌ Agent run {run_id} failed: {e}")


# ─── Analyst run logs (for live terminal) ────────────────────
@router.get("/agent/run/{run_id}/logs")
async def get_run_logs(run_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    run = await db.agent_runs.find_one({"run_id": run_id})
    if not run:
        raise HTTPException(404, "Run not found")
    return {
        "run_id": run_id,
        "status": run.get("status"),
        "logs": run.get("data_quality", ""),
        "report": run.get("report", ""),
        "agent_type": run.get("agent_type", "analyst"),
    }


# ═══════════════════════════════════════════════════════════
# LANGGRAPH AGENT ROUTES
# ═══════════════════════════════════════════════════════════

@router.post("/agent/sql")
async def run_sql_agent_endpoint(
    file: UploadFile = File(...),
    question: str = Form(...),
    session_id: str = Form(""),
    current_user=Depends(get_current_user),
):
    """SQL Query Agent — natural language question → pandas → plain English answer.

    Pass session_id to enable conversation memory across questions.
    Omit or send empty string for a stateless single query.
    """
    check_cooldown(str(current_user["_id"]), seconds=30)
    db = get_db()
    run_id   = str(uuid.uuid4())
    csv_path = f"{CHARTS_DIR}/{run_id}_sql.csv"

    with open(csv_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Build thread_id for memory: user-scoped + session-scoped
    user_id   = str(current_user["_id"])
    thread_id = f"{user_id}_{session_id}" if session_id else None

    started_at = datetime.utcnow()
    await db.agent_runs.insert_one({
        "run_id":     run_id,
        "user_id":    ObjectId(current_user["_id"]),
        "agent_type": "sql",
        "status":     "running",
        "started_at": started_at,
        "question":   question,
        "session_id": session_id or None,
    })

    def _run():
        if thread_id:
            from agents_langgraph import run_sql_agent_with_memory
            return run_sql_agent_with_memory(csv_path, question, thread_id)
        else:
            from agents_langgraph import run_sql_agent
            return run_sql_agent(csv_path, question)

    loop = asyncio.get_event_loop()
    t0   = time.time()
    try:
        result   = await loop.run_in_executor(None, _run)
        duration = time.time() - t0
        tokens   = (len(question) + len(result.get("query", "")) +
                    len(result.get("result", "")) + len(result.get("explanation", ""))) // 4
        status   = "failed" if result.get("error") else "completed"

        await db.agent_runs.update_one({"run_id": run_id}, {"$set": {
            "status":           status,
            "result":           result,
            "duration_seconds": round(duration, 1),
            "tokens_used":      tokens,
            "completed_at":     datetime.utcnow(),
        }})
        return {
            "run_id":      run_id,
            "query":       result.get("query", ""),
            "result":      result.get("result", ""),
            "explanation": result.get("explanation", ""),
            "error":       result.get("error", ""),
            "status":      status,
            "session_id":  session_id or None,
        }
    except Exception as e:
        import traceback; traceback.print_exc()
        await db.agent_runs.update_one({"run_id": run_id}, {"$set": {
            "status": "failed", "error": str(e), "completed_at": datetime.utcnow()
        }})
        raise HTTPException(500, str(e))


@router.post("/agent/forecast")
async def run_forecast_agent_endpoint(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Forecasting Agent — CSV → LinearRegression → 30-day forecast + chart + insights."""
    check_cooldown(str(current_user["_id"]), seconds=30)
    db = get_db()
    run_id   = str(uuid.uuid4())
    csv_path = f"{CHARTS_DIR}/{run_id}_forecast.csv"

    with open(csv_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    started_at = datetime.utcnow()
    await db.agent_runs.insert_one({
        "run_id":     run_id,
        "user_id":    ObjectId(current_user["_id"]),
        "agent_type": "forecast",
        "status":     "running",
        "started_at": started_at,
    })

    def _run():
        from agents_langgraph import run_forecast_agent
        return run_forecast_agent(csv_path)

    loop = asyncio.get_event_loop()
    t0   = time.time()
    try:
        result   = await loop.run_in_executor(None, _run)
        duration = time.time() - t0
        tokens   = len(result.get("insights", "")) // 4
        status   = "failed" if result.get("error") else "completed"

        await db.agent_runs.update_one({"run_id": run_id}, {"$set": {
            "status":           status,
            "result":           {k: v for k, v in result.items() if k != "chart_b64"},
            "duration_seconds": round(duration, 1),
            "tokens_used":      tokens,
            "completed_at":     datetime.utcnow(),
        }})
        return {
            "run_id":    run_id,
            "forecast":  result.get("forecast", []),
            "chart_b64": result.get("chart_b64", ""),
            "insights":  result.get("insights", ""),
            "date_col":  result.get("date_col", ""),
            "value_col": result.get("value_col", ""),
            "error":     result.get("error", ""),
            "status":    status,
        }
    except Exception as e:
        import traceback; traceback.print_exc()
        await db.agent_runs.update_one({"run_id": run_id}, {"$set": {
            "status": "failed", "error": str(e), "completed_at": datetime.utcnow()
        }})
        raise HTTPException(500, str(e))


@router.post("/agent/anomaly")
async def run_anomaly_agent_endpoint(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Anomaly Detection Agent — CSV → Z-score analysis → flagged rows + chart + summary."""
    check_cooldown(str(current_user["_id"]), seconds=30)
    db = get_db()
    run_id   = str(uuid.uuid4())
    csv_path = f"{CHARTS_DIR}/{run_id}_anomaly.csv"

    with open(csv_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    started_at = datetime.utcnow()
    await db.agent_runs.insert_one({
        "run_id":     run_id,
        "user_id":    ObjectId(current_user["_id"]),
        "agent_type": "anomaly",
        "status":     "running",
        "started_at": started_at,
    })

    def _run():
        from agents_langgraph import run_anomaly_agent
        return run_anomaly_agent(csv_path)

    loop = asyncio.get_event_loop()
    t0   = time.time()
    try:
        result   = await loop.run_in_executor(None, _run)
        duration = time.time() - t0
        tokens   = (len(result.get("summary", "")) + len(result.get("llm_explanations", ""))) // 4
        status   = "failed" if result.get("error") else "completed"

        await db.agent_runs.update_one({"run_id": run_id}, {"$set": {
            "status":           status,
            "result":           {k: v for k, v in result.items() if k != "chart_b64"},
            "duration_seconds": round(duration, 1),
            "tokens_used":      tokens,
            "completed_at":     datetime.utcnow(),
        }})
        return {
            "run_id":        run_id,
            "anomalies":     result.get("anomalies", []),
            "chart_b64":     result.get("chart_b64", ""),
            "summary":       result.get("summary", ""),
            "total_flagged": result.get("total_flagged", 0),
            "error":         result.get("error", ""),
            "status":        status,
        }
    except Exception as e:
        import traceback; traceback.print_exc()
        await db.agent_runs.update_one({"run_id": run_id}, {"$set": {
            "status": "failed", "error": str(e), "completed_at": datetime.utcnow()
        }})
        raise HTTPException(500, str(e))


@router.get("/agent/{agent_type}/graph")
async def get_agent_graph(agent_type: str, current_user=Depends(get_current_user)):
    """Return the compiled LangGraph state machine as a Mermaid diagram string."""
    VALID = {"sql", "forecast", "anomaly"}
    if agent_type not in VALID:
        raise HTTPException(400, f"agent_type must be one of {VALID}")
    try:
        def _build():
            import os as _os; _os.environ.setdefault("GROQ_API_KEY", "dummy")
            from agents_langgraph import (
                _build_sql_graph, _build_forecast_graph, _build_anomaly_graph,
            )
            builders = {
                "sql":      _build_sql_graph,
                "forecast": _build_forecast_graph,
                "anomaly":  _build_anomaly_graph,
            }
            graph = builders[agent_type]()
            return graph.get_graph().draw_mermaid()

        loop = asyncio.get_event_loop()
        mermaid = await loop.run_in_executor(None, _build)
        return {"agent_type": agent_type, "mermaid": mermaid}
    except Exception as e:
        raise HTTPException(500, str(e))




@router.get("/agent/monitor")
async def get_agent_monitor(current_user=Depends(get_current_user)):
    """AI Operations Monitor — aggregated stats for all agent runs."""
    db = get_db()

    all_runs = await db.agent_runs.find(
        {"user_id": ObjectId(current_user["_id"])}
    ).sort("started_at", -1).to_list(2000)

    total_runs    = len(all_runs)
    success_count = sum(1 for r in all_runs if r.get("status") == "completed")
    success_rate  = round((success_count / max(total_runs, 1)) * 100, 1)

    today      = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    runs_today = sum(1 for r in all_runs if r.get("started_at", datetime.min) >= today)

    durations    = [r["duration_seconds"] for r in all_runs if r.get("duration_seconds")]
    avg_duration = round(sum(durations) / max(len(durations), 1), 1) if durations else 0.0

    runs_by_agent: dict = {"analyst": 0, "sql": 0, "forecast": 0, "anomaly": 0}
    for r in all_runs:
        at = r.get("agent_type", "analyst")
        runs_by_agent[at] = runs_by_agent.get(at, 0) + 1

    runs_last_7 = []
    for d in range(6, -1, -1):
        day_start = today - timedelta(days=d)
        day_end   = day_start + timedelta(days=1)
        count = sum(
            1 for r in all_runs
            if day_start <= r.get("started_at", datetime.min) < day_end
        )
        runs_last_7.append({"date": day_start.strftime("%m/%d"), "count": count})

    recent_runs = []
    for r in all_runs[:15]:
        recent_runs.append({
            "run_id":     r.get("run_id", str(r["_id"])),
            "agent_type": r.get("agent_type", "analyst"),
            "status":     r.get("status", "unknown"),
            "duration":   round(r.get("duration_seconds", 0), 1),
            "started_at": r.get("started_at", datetime.utcnow()).isoformat(),
            "est_tokens": r.get("tokens_used", 0),
        })

    return {
        "total_runs":           total_runs,
        "success_rate":         success_rate,
        "runs_today":           runs_today,
        "avg_duration_seconds": avg_duration,
        "runs_by_agent":        runs_by_agent,
        "runs_last_7_days":     runs_last_7,
        "recent_runs":          recent_runs,
    }
