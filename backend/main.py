"""
Datapilot FastAPI entrypoint.

Run from the `backend/` directory:

    uvicorn main:app --reload

Environment variables (see repo `.env.example`):

    MONGODB_URI       — required
    MONGODB_DB_NAME   — optional, default `datapilot`
"""

from __future__ import annotations

import importlib.util
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import InMemoryRunner
from google.adk.utils.context_utils import Aclosing
from google.genai import types
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

from config import Settings
from db.mongo import ensure_indexes
from routes import pipelines, reports

logger = logging.getLogger(__name__)

# Local dev + Vercel preview/production frontends.
_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"

_MONGO_TIMEOUT_MS = 5_000
_AGENT_APP_NAME = "datapilot"
_REPO_ROOT = Path(__file__).resolve().parent.parent
_AGENT_MODULE_PATH = _REPO_ROOT / "agent" / "agent.py"
_root_agent: Any | None = None


def _get_root_agent() -> Any:
    """Load `root_agent` from agent/agent.py (lazy, once)."""
    global _root_agent
    if _root_agent is not None:
        return _root_agent
    if not _AGENT_MODULE_PATH.is_file():
        raise RuntimeError(f"Agent module not found at {_AGENT_MODULE_PATH}")
    spec = importlib.util.spec_from_file_location("datapilot_agent", _AGENT_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load agent module from {_AGENT_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _root_agent = module.root_agent
    return _root_agent


def _text_from_event_content(content: types.Content | None) -> str:
    if not content or not content.parts:
        return ""
    return "\n".join(
        part.text
        for part in content.parts
        if part.text and not getattr(part, "thought", False)
    )


async def _run_agent_message(message: str) -> str:
    """Run the ADK agent and return the final text response."""
    root_agent = _get_root_agent()
    runner = InMemoryRunner(agent=root_agent, app_name=_AGENT_APP_NAME)
    user_id = "datapilot-api"
    session = await runner.session_service.create_session(
        app_name=_AGENT_APP_NAME,
        user_id=user_id,
        session_id=str(uuid.uuid4()),
    )
    new_message = types.Content(
        role="user",
        parts=[types.Part.from_text(text=message)],
    )
    response_text = ""
    last_content_text = ""
    try:
        async with Aclosing(
            runner.run_async(
                user_id=user_id,
                session_id=session.id,
                new_message=new_message,
            )
        ) as event_stream:
            async for event in event_stream:
                if event.content:
                    chunk = _text_from_event_content(event.content)
                    if chunk:
                        last_content_text = chunk
                if event.is_final_response() and event.content:
                    final = _text_from_event_content(event.content)
                    if final:
                        response_text = final
        if not response_text:
            response_text = last_content_text
        if not response_text.strip():
            raise RuntimeError("Agent returned an empty response.")
        return response_text.strip()
    finally:
        await runner.close()


def _connect_mongodb(settings: Settings) -> tuple[MongoClient[Any] | None, Any | None, bool]:
    """Return (client, database, connected). Does not raise on connection failure."""
    client: MongoClient[Any] | None = None
    try:
        client = MongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=_MONGO_TIMEOUT_MS,
            connectTimeoutMS=_MONGO_TIMEOUT_MS,
        )
        client.admin.command("ping")
        db = client[settings.mongodb_db_name]
        ensure_indexes(db)
        logger.info("Connected to MongoDB database %r", settings.mongodb_db_name)
        return client, db, True
    except (ServerSelectionTimeoutError, PyMongoError, OSError) as exc:
        logger.warning("MongoDB unavailable at startup: %s", exc)
        if client is not None:
            client.close()
        return None, None, False


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    client, db, mongo_connected = _connect_mongodb(settings)
    app.state.settings = settings
    app.state.mongo_client = client
    app.state.db = db
    app.state.mongo_connected = mongo_connected
    yield
    if client is not None:
        client.close()


app = FastAPI(
    title="Datapilot API",
    description="Pipeline monitoring backend (Week 1).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_origin_regex=_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipelines.router, prefix="/api/pipelines", tags=["pipelines"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


class AgentMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class AgentResponse(BaseModel):
    response: str
    timestamp: str


@app.post("/api/agent", response_model=AgentResponse, tags=["agent"])
async def run_agent(body: AgentMessage) -> AgentResponse:
    """Run the Datapilot ADK agent with the user's message."""
    try:
        text = await _run_agent_message(body.message.strip())
    except Exception as exc:
        logger.exception("Agent invocation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent failed: {exc}",
        ) from exc
    return AgentResponse(
        response=text,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/health")
def health_check(request: Request) -> dict[str, str]:
    """Liveness probe for deploy targets."""
    mongo_connected = bool(getattr(request.app.state, "mongo_connected", False))
    return {
        "status": "ok" if mongo_connected else "degraded",
        "mongodb": "connected" if mongo_connected else "unavailable",
    }
