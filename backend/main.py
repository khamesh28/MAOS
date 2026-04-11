from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from database import connect_db, close_db
from routes import router

# Lifespan (DB connection)
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()

app = FastAPI(
    title="MAOS Enterprise API",
    description="Multi-Agent Orchestration System — Enterprise Edition",
    version="1.0.0",
    lifespan=lifespan
)

# ✅ FINAL CORS CONFIG (stable + works with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
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

# Root check
@app.get("/")
async def root():
    return {
        "message": "MAOS Enterprise API is running 🚀",
        "docs": "/docs"
    }