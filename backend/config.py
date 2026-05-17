"""
Shared settings for the FastAPI app.

Loads from process environment and `.env` in `backend/` or the repo root.
"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent

# Load `.env` before pydantic-settings so os.environ is populated for all readers.
for _env_path in (_BACKEND_DIR / ".env", _REPO_ROOT / ".env"):
    if _env_path.is_file():
        load_dotenv(_env_path, override=False)


class Settings(BaseSettings):
    """Application configuration."""

    model_config = SettingsConfigDict(
        env_file=(_BACKEND_DIR / ".env", _REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_uri: str = Field(..., description="MongoDB connection URI (MONGODB_URI)")
    mongodb_db_name: str = Field(default="datapilot", description="Database name (MONGODB_DB_NAME)")
    api_host: str = Field(default="0.0.0.0", description="Bind host (API_HOST)")
    api_port: int = Field(default=8000, description="Bind port (API_PORT)")

    # Reserved for the live ADK agent (not used by the HTTP stub).
    google_api_key: str | None = Field(default=None, description="GOOGLE_API_KEY")
    google_cloud_project: str | None = Field(default=None, description="GOOGLE_CLOUD_PROJECT")
