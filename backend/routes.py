from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from bson import ObjectId
from datetime import datetime
from typing import List, Optional
import os, shutil, uuid, asyncio, time

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

@router.post("/agent/run")
async def run_agent_pipeline(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    db = get_db()
    run_id = str(uuid.uuid4())
    
    # Save uploaded CSV
    csv_path = f"{CHARTS_DIR}/{run_id}_data.csv"
    with open(csv_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Log run start in DB
    await db.agent_runs.insert_one({
        "run_id": run_id,
        "user_id": ObjectId(current_user["_id"]),
        "status": "running",
        "started_at": datetime.utcnow(),
        "charts": [],
        "report": "",
        "data_quality": ""
    })

    # Run pipeline in background
    asyncio.create_task(run_pipeline_task(run_id, csv_path, db, current_user))
    
    return {"run_id": run_id, "status": "running", "message": "Pipeline started"}

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

async def run_pipeline_task(run_id: str, csv_path: str, db, current_user):
    """
    Exact same 3-agent pipeline as app.py using pyautogen 0.2.35:
    Phase 1 — Executive Manager (UserProxyAgent) + Senior Data Analyst (AssistantAgent)
    Phase 2 — Report Manager (UserProxyAgent) + Business Report Writer (AssistantAgent)
    """

    def _run_sync():
        import autogen
        import pandas as pd
        import matplotlib
        matplotlib.use('Agg')
        import glob
        import time

        groq_key = os.getenv("GROQ_API_KEY")

        # ── Exact same llm_config as app.py ──────────────────
        llm_config = {
            "config_list": [{
                "model": "llama-3.3-70b-versatile",
                "api_key": groq_key,
                "api_type": "groq"
            }],
            "temperature": 0.0,
        }

        # ── PHASE 1: DATA ANALYST AGENT (exact app.py logic) ─
        analyst = autogen.AssistantAgent(
            name="Senior_Data_Analyst",
            system_message="""You are a senior data analyst. Your ONLY job is to write complete, executable Python code.
Always wrap code in a ```python block.
NEVER write the word TERMINATE in any message. Ever.
Save all charts to the current working directory.""",
            llm_config=llm_config,
        )

        manager = autogen.UserProxyAgent(
            name="Executive_Manager",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=2,
            is_termination_msg=lambda x: "exitcode: 0" in x.get("content", ""),
            code_execution_config={"work_dir": ".", "use_docker": False},
            system_message="Execute the code provided. Stop after first successful execution.",
        )

        # Build manager prompt exactly like app.py default_task
        manager_prompt = f"""You are analyzing a raw, uncleaned enterprise sales dataset saved as '{csv_path}'.

Read the CSV and detect column names automatically.
The data is messy — expect missing values, duplicates, formatting inconsistencies,
invalid entries (like 'abc' in numeric columns), negative values, and outliers.
Handle all of it professionally before analysis.
Print a data quality report showing exactly what was fixed and how many records were affected.

IMPORTANT: Use matplotlib with Agg backend:
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

After cleaning, generate these business intelligence charts:
1. Pie chart of primary numeric column share by top categorical column → save as '{CHARTS_DIR}/{run_id}_revenue_share.png'
2. Horizontal bar chart of totals by category → save as '{CHARTS_DIR}/{run_id}_units_by_category.png'
3. Cumulative primary metric Over Time (line chart) → save as '{CHARTS_DIR}/{run_id}_cumulative_trend.png'
4. Side by side bar chart comparing top 2 numeric columns by category → save as '{CHARTS_DIR}/{run_id}_comparison.png'
5. Boxplot showing spread across categories → save as '{CHARTS_DIR}/{run_id}_boxplot.png'

Use plt.style.use('dark_background') for all charts.
Save each with: plt.savefig(path, bbox_inches='tight', facecolor='#0d1320', dpi=120)
Do NOT use plt.show().
Do not include TERMINATE."""

        manager.initiate_chat(analyst, message=manager_prompt)
        time.sleep(1)

        # Extract data quality log from chat (same as app.py)
        data_quality = ""
        for msg in manager.chat_messages.get(analyst, []):
            content = msg.get("content", "")
            if "exitcode: 0" in content:
                data_quality = content[:3000]
                break

        # ── PHASE 2: REPORT WRITER AGENT (exact app.py logic) ─
        df_analysis = pd.read_csv(csv_path)

        # Auto-detect columns (agnostic, like app.py)
        numeric_cols = df_analysis.select_dtypes(include='number').columns.tolist()
        cat_cols = [c for c in df_analysis.select_dtypes(include='object').columns
                    if df_analysis[c].nunique() < 20]

        for col in numeric_cols:
            df_analysis[col] = pd.to_numeric(df_analysis[col], errors='coerce')
            df_analysis[col] = df_analysis[col].fillna(df_analysis[col].mean())

        regional = {}
        total_val = 0
        top_region = "N/A"
        top_category = "N/A"
        category_avg = {}

        if cat_cols and numeric_cols:
            primary_num = numeric_cols[0]
            primary_cat = cat_cols[0]
            try:
                regional = df_analysis.groupby(primary_cat)[primary_num].sum().round(2).to_dict()
                total_val = df_analysis[primary_num].sum()
                top_region = max(regional, key=regional.get) if regional else "N/A"
            except Exception:
                pass
            if len(cat_cols) > 1:
                try:
                    category_avg = df_analysis.groupby(cat_cols[1])[primary_num].mean().round(2).to_dict()
                    top_category = max(category_avg, key=category_avg.get) if category_avg else "N/A"
                except Exception:
                    pass

        report_writer = autogen.AssistantAgent(
            name="Business_Report_Writer",
            system_message="""You are a senior business intelligence analyst.
You write concise, professional executive summary reports based on data insights.
Format your report with clear sections: Executive Summary, Key Findings, and Recommendations.
Be specific with numbers. Write in a formal business tone.
Do NOT write any code. Just write the report as plain text.""",
            llm_config=llm_config,
        )

        report_manager = autogen.UserProxyAgent(
            name="Report_Manager",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=0,
            code_execution_config=False,
            is_termination_msg=lambda x: True,
        )

        # Exact same report_task structure as app.py
        report_task = f"""
Based on the following sales data analysis, write a professional business intelligence report:

DATASET SUMMARY:
- Total {numeric_cols[0] if numeric_cols else 'Value'}: {total_val:,.2f}
- Top Performing Segment: {top_region} ({regional.get(top_region, 0):,.2f})
- Breakdown by {cat_cols[0] if cat_cols else 'Category'}: {regional}
- Average by {cat_cols[1] if len(cat_cols) > 1 else 'Sub-Category'}: {category_avg}
- Top Sub-Category: {top_category}
- Dataset had missing values (filled with column mean)

Write a 3-section report: Executive Summary, Key Findings, and Strategic Recommendations.
"""
        report_manager.initiate_chat(report_writer, message=report_task)
        time.sleep(1)

        # Extract report text (exact same as app.py)
        chat_history = report_manager.chat_messages.get(report_writer, [])
        report_text = ""
        for msg in chat_history:
            if msg.get("role") == "assistant":
                report_text = msg.get("content", "")
                break

        # Collect all generated charts
        charts = [os.path.basename(f)
                  for f in sorted(glob.glob(f"{CHARTS_DIR}/{run_id}_*.png"))]

        return charts, report_text, data_quality

    # Run blocking AutoGen in thread executor (keeps FastAPI async loop free)
    loop = asyncio.get_event_loop()
    try:
        charts, report_text, data_quality = await loop.run_in_executor(None, _run_sync)

        await db.agent_runs.update_one(
            {"run_id": run_id},
            {"$set": {
                "status": "completed",
                "charts": charts,
                "report": report_text,
                "data_quality": data_quality,
                "completed_at": datetime.utcnow()
            }}
        )
        print(f"✅ Agent run {run_id} completed — {len(charts)} charts, report written")

    except Exception as e:
        import traceback
        traceback.print_exc()
        await db.agent_runs.update_one(
            {"run_id": run_id},
            {"$set": {"status": "failed", "error": str(e), "completed_at": datetime.utcnow()}}
        )
        print(f"❌ Agent run {run_id} failed: {e}")
