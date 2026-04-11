from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum

# ─── ENUMS ───────────────────────────────────────────────
class TeamRole(str, Enum):
    admin = "admin"
    manager = "manager"
    member = "member"
    viewer = "viewer"

class ProjectType(str, Enum):
    kanban = "kanban"
    sprint = "sprint"

class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    review = "review"
    done = "done"

class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class WorkItemType(str, Enum):
    epic = "epic"
    feature = "feature"
    story = "story"
    task = "task"
    bug = "bug"

# ─── AUTH ────────────────────────────────────────────────
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str = "user"
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ─── TEAM ────────────────────────────────────────────────
class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner_id: str
    created_at: datetime

class TeamMemberAdd(BaseModel):
    email: str
    role: TeamRole = TeamRole.member

# ─── PROJECT ─────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#6366f1"
    type: ProjectType = ProjectType.kanban

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    color: str
    type: str
    team_id: str
    created_by: str
    created_at: datetime

# ─── TASK ────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    work_item_type: WorkItemType = WorkItemType.task
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    project_id: str
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    story_points: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    story_points: Optional[int] = None

class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    work_item_type: str
    status: str
    priority: str
    project_id: str
    team_id: str
    created_by: str
    assigned_to: Optional[str]
    due_date: Optional[datetime]
    story_points: Optional[int]
    created_at: datetime

# ─── ACTIVITY ────────────────────────────────────────────
class MeetingLog(BaseModel):
    title: str
    duration: int  # minutes
    summary: Optional[str] = ""

class TaskLog(BaseModel):
    title: str
    hours: float
    description: Optional[str] = ""

class ActivityCreate(BaseModel):
    date: str  # YYYY-MM-DD
    meetings: List[MeetingLog] = []
    tasks: List[TaskLog] = []
    notes: Optional[str] = ""
    mood: Optional[int] = 3  # 1-5

class ActivityResponse(BaseModel):
    id: str
    user_id: str
    date: str
    meetings: List[dict]
    tasks: List[dict]
    notes: Optional[str]
    mood: Optional[int]
    total_work_hours: float
    created_at: datetime

# ─── AGENT PIPELINE ──────────────────────────────────────
class AgentRunCreate(BaseModel):
    prompt: Optional[str] = None

class AgentRunResponse(BaseModel):
    run_id: str
    status: str
    charts: List[str] = []
    report: str = ""
    data_quality: str = ""
    started_at: datetime
