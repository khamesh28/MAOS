"""
MAOS Enterprise — Database Seeder
Run: python seed.py
Seeds MongoDB with realistic org data: teams, members, projects, tasks, activities
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timedelta
from bson import ObjectId
from dotenv import load_dotenv
import os
import random

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hp(p): return pwd_context.hash(p)
def dt(days_ago=0): return datetime.utcnow() - timedelta(days=days_ago)
def rand_date(start_days=30, end_days=0):
    return datetime.utcnow() - timedelta(days=random.randint(end_days, start_days))

async def seed():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.maos_enterprise

    print("🧹 Clearing existing seed data...")
    # Only clear collections, not indexes
    for col in ["users","teams","team_members","projects","tasks","activities","agent_runs"]:
        await db[col].delete_many({})

    print("👥 Creating users...")
    # Check if khamesh@genpact.com already exists, reuse if so
    existing = await db.users.find_one({"email": "khamesh@genpact.com"})
    if existing:
        khamesh_id = existing["_id"]
        print("   ♻️  Reusing existing khamesh@genpact.com account")
        # Update password to known value
        await db.users.update_one({"_id": khamesh_id}, {"$set": {"password": hp("password123")}})
        users_data_extra = [
            {"name": "Priya Sharma", "email": "priya.sharma@genpact.com", "role": "user"},
            {"name": "Arjun Mehta", "email": "arjun.mehta@genpact.com", "role": "user"},
            {"name": "Divya Nair", "email": "divya.nair@genpact.com", "role": "user"},
            {"name": "Rohit Verma", "email": "rohit.verma@genpact.com", "role": "user"},
            {"name": "Sneha Iyer", "email": "sneha.iyer@genpact.com", "role": "user"},
            {"name": "Vikram Rao", "email": "vikram.rao@genpact.com", "role": "user"},
            {"name": "Anjali Gupta", "email": "anjali.gupta@genpact.com", "role": "user"},
        ]
        user_ids = [khamesh_id]
        for u in users_data_extra:
            ex = await db.users.find_one({"email": u["email"]})
            if ex:
                user_ids.append(ex["_id"])
            else:
                doc = {**u, "password": hp("password123"), "created_at": dt(random.randint(60, 120))}
                res = await db.users.insert_one(doc)
                user_ids.append(res.inserted_id)
    else:
        users_data = [
            {"name": "Khamesh P", "email": "khamesh@genpact.com", "role": "admin"},
            {"name": "Priya Sharma", "email": "priya.sharma@genpact.com", "role": "user"},
            {"name": "Arjun Mehta", "email": "arjun.mehta@genpact.com", "role": "user"},
            {"name": "Divya Nair", "email": "divya.nair@genpact.com", "role": "user"},
            {"name": "Rohit Verma", "email": "rohit.verma@genpact.com", "role": "user"},
            {"name": "Sneha Iyer", "email": "sneha.iyer@genpact.com", "role": "user"},
            {"name": "Vikram Rao", "email": "vikram.rao@genpact.com", "role": "user"},
            {"name": "Anjali Gupta", "email": "anjali.gupta@genpact.com", "role": "user"},
        ]
        user_ids = []
        for u in users_data:
            doc = {**u, "password": hp("password123"), "created_at": dt(random.randint(60, 120))}
            res = await db.users.insert_one(doc)
            user_ids.append(res.inserted_id)
        khamesh_id = user_ids[0]
    print(f"   ✅ {len(user_ids)} users ready")

    # ─── TEAMS ───────────────────────────────────────────────
    print("🏢 Creating teams...")
    teams_data = [
        {"name": "AI Hub Team", "description": "Core AI/ML research and agentic systems development", "members": [0,1,2,3], "roles": ["admin","manager","member","member"]},
        {"name": "Data Engineering", "description": "Data pipelines, ETL, and infrastructure for analytics", "members": [0,4,5,6], "roles": ["admin","manager","member","member"]},
        {"name": "Product & Strategy", "description": "Product roadmap, GTM strategy, and client engagement", "members": [0,2,7,3], "roles": ["admin","manager","member","viewer"]},
    ]
    team_ids = []
    for td in teams_data:
        team_doc = {"name": td["name"], "description": td["description"], "owner_id": khamesh_id, "created_at": dt(random.randint(30, 60))}
        res = await db.teams.insert_one(team_doc)
        tid = res.inserted_id
        team_ids.append(tid)
        for i, (midx, role) in enumerate(zip(td["members"], td["roles"])):
            await db.team_members.insert_one({"team_id": tid, "user_id": user_ids[midx], "role": role, "joined_at": dt(random.randint(20, 50))})
    print(f"   ✅ {len(team_ids)} teams created")

    ai_hub_tid = team_ids[0]
    data_eng_tid = team_ids[1]
    product_tid = team_ids[2]

    # ─── PROJECTS ────────────────────────────────────────────
    print("📁 Creating projects...")
    projects_data = [
        # AI Hub Team projects
        {"name": "GitMind — Autonomous Debugger", "desc": "Multi-agent system that autonomously debugs and fixes code repositories", "color": "#4f8eff", "team": ai_hub_tid, "creator": 0},
        {"name": "RAG Knowledge Engine", "desc": "Retrieval-augmented generation pipeline for enterprise knowledge base", "color": "#7c3aed", "team": ai_hub_tid, "creator": 1},
        {"name": "LLM Eval Framework", "desc": "Automated evaluation suite for LLM outputs across Genpact use cases", "color": "#06b6d4", "team": ai_hub_tid, "creator": 2},
        # Data Engineering projects
        {"name": "Sales Analytics Pipeline", "desc": "End-to-end pipeline from CRM to BI dashboards with real-time refresh", "color": "#10b981", "team": data_eng_tid, "creator": 0},
        {"name": "Data Quality Monitor", "desc": "Automated data quality checks across 15+ enterprise data sources", "color": "#f59e0b", "team": data_eng_tid, "creator": 4},
        # Product projects
        {"name": "Q2 Go-To-Market Plan", "desc": "AI product GTM strategy for Q2 2026 enterprise clients", "color": "#ef4444", "team": product_tid, "creator": 0},
        {"name": "Client Portal v2", "desc": "Next-gen client-facing portal with AI advisor and self-serve demos", "color": "#f97316", "team": product_tid, "creator": 7},
    ]
    project_ids = []
    for p in projects_data:
        doc = {"name": p["name"], "description": p["desc"], "color": p["color"], "type": "kanban", "team_id": p["team"], "created_by": user_ids[p["creator"]], "is_archived": False, "created_at": dt(random.randint(10, 30))}
        res = await db.projects.insert_one(doc)
        project_ids.append(res.inserted_id)
    print(f"   ✅ {len(project_ids)} projects created")

    # ─── TASKS ───────────────────────────────────────────────
    print("✅ Creating tasks...")
    tasks_data = [
        # GitMind
        {"title": "Implement ReAct agent loop for code analysis", "status": "done", "priority": "critical", "type": "feature", "proj": 0, "team": ai_hub_tid, "creator": 0, "assignee": 1},
        {"title": "Build AST parser for Python/JS files", "status": "done", "priority": "high", "type": "task", "proj": 0, "team": ai_hub_tid, "creator": 1, "assignee": 2},
        {"title": "Integrate GitHub API for PR context", "status": "in_progress", "priority": "high", "type": "feature", "proj": 0, "team": ai_hub_tid, "creator": 0, "assignee": 1},
        {"title": "Write unit tests for agent orchestration", "status": "in_progress", "priority": "medium", "type": "task", "proj": 0, "team": ai_hub_tid, "creator": 2, "assignee": 2},
        {"title": "Demo prep for OpenAI Codex Hackathon", "status": "todo", "priority": "critical", "type": "task", "proj": 0, "team": ai_hub_tid, "creator": 0, "assignee": 0},
        {"title": "Dockerize agent runtime", "status": "todo", "priority": "medium", "type": "task", "proj": 0, "team": ai_hub_tid, "creator": 1, "assignee": 3},
        # RAG Engine
        {"title": "Set up Chroma vector DB", "status": "done", "priority": "high", "type": "task", "proj": 1, "team": ai_hub_tid, "creator": 1, "assignee": 1},
        {"title": "Build document ingestion pipeline", "status": "done", "priority": "high", "type": "feature", "proj": 1, "team": ai_hub_tid, "creator": 1, "assignee": 2},
        {"title": "Implement semantic chunking strategy", "status": "in_progress", "priority": "high", "type": "task", "proj": 1, "team": ai_hub_tid, "creator": 1, "assignee": 1},
        {"title": "Add re-ranking with cross-encoder", "status": "todo", "priority": "medium", "type": "feature", "proj": 1, "team": ai_hub_tid, "creator": 1, "assignee": 2},
        {"title": "Benchmark retrieval accuracy (MRR@10)", "status": "todo", "priority": "medium", "type": "task", "proj": 1, "team": ai_hub_tid, "creator": 2, "assignee": 3},
        # LLM Eval
        {"title": "Define eval metrics (BLEU, ROUGE, G-Eval)", "status": "done", "priority": "high", "type": "task", "proj": 2, "team": ai_hub_tid, "creator": 2, "assignee": 2},
        {"title": "Build test harness for 10 use cases", "status": "in_progress", "priority": "high", "type": "feature", "proj": 2, "team": ai_hub_tid, "creator": 2, "assignee": 3},
        {"title": "LLM-as-judge integration with GPT-4o", "status": "todo", "priority": "medium", "type": "task", "proj": 2, "team": ai_hub_tid, "creator": 2, "assignee": 1},
        # Sales Pipeline
        {"title": "Design star schema for sales DW", "status": "done", "priority": "high", "type": "task", "proj": 3, "team": data_eng_tid, "creator": 4, "assignee": 4},
        {"title": "Build Airflow DAG for nightly refresh", "status": "done", "priority": "high", "type": "feature", "proj": 3, "team": data_eng_tid, "creator": 4, "assignee": 5},
        {"title": "Connect Power BI to Snowflake", "status": "in_progress", "priority": "medium", "type": "task", "proj": 3, "team": data_eng_tid, "creator": 4, "assignee": 6},
        {"title": "Add anomaly detection alerts", "status": "todo", "priority": "medium", "type": "feature", "proj": 3, "team": data_eng_tid, "creator": 0, "assignee": 4},
        # Data Quality
        {"title": "Audit 15 source systems for null rates", "status": "done", "priority": "high", "type": "task", "proj": 4, "team": data_eng_tid, "creator": 4, "assignee": 5},
        {"title": "Build Great Expectations test suite", "status": "in_progress", "priority": "high", "type": "feature", "proj": 4, "team": data_eng_tid, "creator": 5, "assignee": 5},
        {"title": "Set up Slack alerting for DQ failures", "status": "todo", "priority": "low", "type": "task", "proj": 4, "team": data_eng_tid, "creator": 4, "assignee": 6},
        # GTM Plan
        {"title": "Competitive landscape analysis (5 vendors)", "status": "done", "priority": "high", "type": "task", "proj": 5, "team": product_tid, "creator": 7, "assignee": 7},
        {"title": "Draft ICP and buyer persona docs", "status": "done", "priority": "medium", "type": "task", "proj": 5, "team": product_tid, "creator": 2, "assignee": 2},
        {"title": "Build pricing model for 3 tiers", "status": "in_progress", "priority": "high", "type": "feature", "proj": 5, "team": product_tid, "creator": 7, "assignee": 7},
        {"title": "Design sales deck (10 slides)", "status": "in_progress", "priority": "medium", "type": "task", "proj": 5, "team": product_tid, "creator": 2, "assignee": 3},
        {"title": "Plan Q2 launch event logistics", "status": "todo", "priority": "medium", "type": "task", "proj": 5, "team": product_tid, "creator": 7, "assignee": 7},
        # Client Portal
        {"title": "UX audit of v1 portal", "status": "done", "priority": "medium", "type": "task", "proj": 6, "team": product_tid, "creator": 7, "assignee": 7},
        {"title": "Wireframe AI advisor chat widget", "status": "done", "priority": "high", "type": "feature", "proj": 6, "team": product_tid, "creator": 7, "assignee": 3},
        {"title": "Implement demo request flow", "status": "in_progress", "priority": "high", "type": "feature", "proj": 6, "team": product_tid, "creator": 7, "assignee": 7},
        {"title": "Integrate Stripe for billing", "status": "todo", "priority": "high", "type": "task", "proj": 6, "team": product_tid, "creator": 7, "assignee": 2},
    ]
    task_ids = []
    for t in tasks_data:
        doc = {
            "title": t["title"],
            "description": f"Implementation task for {t['title'].lower()}",
            "work_item_type": t["type"],
            "status": t["status"],
            "priority": t["priority"],
            "project_id": project_ids[t["proj"]],
            "team_id": t["team"],
            "created_by": user_ids[t["creator"]],
            "assigned_to": user_ids[t["assignee"]],
            "story_points": random.choice([1, 2, 3, 5, 8]),
            "created_at": rand_date(20, 2),
            "due_date": datetime.utcnow() + timedelta(days=random.randint(1, 14))
        }
        res = await db.tasks.insert_one(doc)
        task_ids.append(res.inserted_id)
    print(f"   ✅ {len(task_ids)} tasks created")

    # ─── ACTIVITIES ──────────────────────────────────────────
    print("📅 Creating activity logs...")
    activity_count = 0
    meeting_titles = [
        "Sprint Planning", "Daily Standup", "Tech Design Review",
        "Client Sync", "Architecture Discussion", "1:1 with Manager",
        "Backlog Grooming", "Demo Prep", "Cross-team Alignment",
        "Incident Retrospective", "OKR Review", "Pair Programming Session"
    ]
    task_titles = [
        "Code review and PR comments", "Feature implementation",
        "Bug investigation and fix", "Documentation update",
        "Unit test writing", "API integration work",
        "Data pipeline debugging", "Model fine-tuning experiments",
        "Dashboard development", "Code refactoring"
    ]

    for user_idx in range(min(4, len(user_ids))):
        uid = user_ids[user_idx]
        team_id = ai_hub_tid if user_idx < 2 else data_eng_tid

        for day_offset in range(1, 22):  # Last 3 weeks
            if datetime.utcnow().weekday() in [5, 6]:  # skip weekends roughly
                continue
            date_obj = datetime.utcnow() - timedelta(days=day_offset)
            if date_obj.weekday() >= 5:
                continue

            date_str = date_obj.strftime("%Y-%m-%d")
            num_meetings = random.randint(1, 4)
            num_tasks = random.randint(2, 5)
            meetings = [{"title": random.choice(meeting_titles), "duration": random.choice([30, 45, 60, 90]), "summary": "Productive discussion with clear action items"} for _ in range(num_meetings)]
            tasks = [{"title": random.choice(task_titles), "hours": round(random.uniform(0.5, 3.0), 1), "description": "Completed as planned"} for _ in range(num_tasks)]
            total_hours = sum(t["hours"] for t in tasks) + sum(m["duration"] / 60 for m in meetings)

            await db.activities.insert_one({
                "user_id": uid,
                "team_id": ObjectId(str(team_id)),
                "date": date_str,
                "meetings": meetings,
                "tasks": tasks,
                "notes": random.choice(["Good progress today.", "Blocked on API access.", "Productive session.", "Completed key milestone.", ""]),
                "mood": random.randint(2, 5),
                "total_work_hours": round(total_hours, 1),
                "created_at": date_obj
            })
            activity_count += 1

    print(f"   ✅ {activity_count} activity logs created")

    # ─── AGENT RUNS ──────────────────────────────────────────
    print("🤖 Creating mock agent run history...")
    run_statuses = ["completed", "completed", "completed", "completed", "failed"]
    for i in range(5):
        await db.agent_runs.insert_one({
            "run_id": str(ObjectId()),
            "user_id": khamesh_id,
            "status": random.choice(run_statuses),
            "charts": ["revenue_share.png", "units_category.png", "cumulative_revenue.png"] if random.random() > 0.2 else [],
            "report": "Executive Summary: Analysis of enterprise sales data revealed strong Q1 performance with 23% YoY revenue growth. North region leads at 34% revenue share. Electronics dominates product mix. Strategic recommendation: Increase inventory allocation to high-performing regions.",
            "data_quality": "Fixed 3 null values, removed 2 duplicates, corrected 1 type error",
            "started_at": rand_date(14, 1),
            "completed_at": rand_date(14, 1)
        })
    print("   ✅ 5 agent run history entries created")

    print("\n🎉 Seed complete! Summary:")
    print(f"   👤 Users: {len(user_ids)} (login: any email above, password: password123)")
    print(f"   🏢 Teams: {len(team_ids)} (AI Hub Team, Data Engineering, Product & Strategy)")
    print(f"   📁 Projects: {len(project_ids)}")
    print(f"   ✅ Tasks: {len(task_ids)}")
    print(f"   📅 Activity logs: {activity_count}")
    print(f"   🤖 Agent runs: 5")
    print("\n✅ Login with: khamesh@genpact.com / password123")

    client.close()

if __name__ == "__main__":
    asyncio.run(seed())
