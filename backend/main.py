"""
Datapilot FastAPI entrypoint.

Run from the `backend/` directory:

    uvicorn main:app --reload

Environment variables (see repo `.env.example`):

    MONGODB_URI       — required
    MONGODB_DB_NAME   — optional, default `datapilot`
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo import MongoClient

from db.mongo import ensure_indexes
from routes import pipelines, reports


class Settings(BaseSettings):
    """Loads from environment and optional `.env` next to this file or repo root."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_uri: str
    mongodb_db_name: str = "datapilot"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    client: MongoClient[Any] = MongoClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]
    app.state.mongo_client = client
    app.state.db = db
    ensure_indexes(db)
    yield
    client.close()


app = FastAPI(
    title="Datapilot API",
    description="Pipeline monitoring backend (Week 1).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipelines.router, prefix="/api/pipelines", tags=["pipelines"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


class AgentMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class AgentReply(BaseModel):
    reply: str


@app.post("/api/agent", response_model=AgentReply, tags=["agent"])
def agent_stub(body: AgentMessage) -> AgentReply:
    """Temporary stub until the ADK agent is wired to HTTP."""
    snippet = body.message.strip()
    if len(snippet) > 280:
        snippet = snippet[:277] + "…"
    return AgentReply(
        reply=(
            "Datapilot agent (stub): received your message. "
            f"When the live agent is connected, I will answer about pipelines and incidents. "
            f"You asked: {snippet!r}"
        )
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    """Liveness probe for deploy targets."""
    return {"status": "ok"}
