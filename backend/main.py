from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from database import connect_db, close_db
from routes import router
from ws_manager import ws_manager

# Lifespan (DB connection)
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()

app = FastAPI(
    title="Genpact AI Hub API",
    description="Enterprise AI Operations Platform — AutoGen + LangGraph",
    version="2.0.0",
    lifespan=lifespan
)

# ✅ FINAL CORS CONFIG (stable + works with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static folder for charts
os.makedirs("generated_charts", exist_ok=True)
app.mount("/charts", StaticFiles(directory="generated_charts"), name="charts")

# API routes
app.include_router(router, prefix="/api")

# ── WebSocket: live analyst pipeline streaming ─────────────────
@app.websocket("/ws/agent/analyst/{run_id}")
async def ws_analyst(websocket: WebSocket, run_id: str):
    """
    Streams AutoGen pipeline messages to the browser in real time.
    Messages: {type: "message"|"status"|"complete"|"error", ...}
    No auth check — run_id UUID is the shared secret for this session.
    """
    await ws_manager.connect(run_id, websocket)
    try:
        while True:
            await websocket.receive_text()   # keep-alive / consume pings
    except WebSocketDisconnect:
        ws_manager.disconnect(run_id, websocket)


# Root check
@app.get("/")
async def root():
    return {
        "message": "Genpact AI Hub API is running 🚀",
        "docs": "/docs"
    }