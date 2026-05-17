"""
Datapilot ADK agent (Gemini + MongoDB MCP).

Environment (repo `.env` or `agent/.env`):

  Vertex AI via Application Default Credentials (org blocks API keys):
    GOOGLE_GENAI_USE_VERTEXAI=TRUE
    GOOGLE_CLOUD_PROJECT=your-gcp-project-id
    GOOGLE_CLOUD_LOCATION=us-central1
    GEMINI_MODEL=gemini-2.5-flash

  Vertex AI Express Mode (API key issued by Vertex, not AI Studio):
    GOOGLE_GENAI_USE_VERTEXAI=TRUE
    GOOGLE_GENAI_API_KEY=your_express_mode_key

  Google AI Studio (personal account — bypasses org Vertex policy):
    GOOGLE_GENAI_USE_VERTEXAI=FALSE
    GOOGLE_API_KEY=your_aistudio_key
    GEMINI_MODEL=gemini-2.0-flash

  MongoDB:
    MONGODB_URI=...

Model IDs for Vertex must match an enabled model in your project/region.
See https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from google.adk.agents import Agent
from google.adk.tools.mcp_tool import MCPToolset
from mcp import StdioServerParameters

_AGENT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _AGENT_DIR.parent

for _env_path in (_AGENT_DIR / ".env", _REPO_ROOT / ".env"):
    if _env_path.is_file():
        load_dotenv(_env_path, override=False)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _configure_genai() -> str:
    """
    Configure google-genai for Vertex AI or Google AI Studio.

    Returns the model id for the ADK Agent.
    """
    api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()
    express_key = (os.getenv("GOOGLE_GENAI_API_KEY") or "").strip()
    project = (os.getenv("GOOGLE_CLOUD_PROJECT") or "").strip()

    # Default: Vertex when a GCP project is set; otherwise AI Studio if an API key exists.
    use_vertex = _env_bool(
        "GOOGLE_GENAI_USE_VERTEXAI",
        default=bool(project or express_key) and not bool(api_key),
    )

    # Prefer gemini-2.5-flash on Vertex (gemini-2.0-flash-001 often 404s on new/hackathon projects).
    default_model = "gemini-2.5-flash" if use_vertex else "gemini-2.0-flash"
    model = (os.getenv("GEMINI_MODEL") or default_model).strip()

    if use_vertex:
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE"
        if not project:
            raise RuntimeError(
                "GOOGLE_CLOUD_PROJECT is required when GOOGLE_GENAI_USE_VERTEXAI=TRUE. "
                "Use your GCP project id (e.g. my-project-123), not the project number."
            )
        os.environ["GOOGLE_CLOUD_PROJECT"] = project
        location = (os.getenv("GOOGLE_CLOUD_LOCATION") or "us-central1").strip()
        os.environ["GOOGLE_CLOUD_LOCATION"] = location

        if express_key:
            # Vertex Express Mode — org policy may still allow this key type.
            os.environ["GOOGLE_GENAI_API_KEY"] = express_key
        # ADC: do not force GOOGLE_API_KEY; org policy often blocks AI Studio keys on GCP.
    else:
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "FALSE"
        if not api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is required when GOOGLE_GENAI_USE_VERTEXAI=FALSE. "
                "Create one at https://aistudio.google.com/apikey (use a personal Google account "
                "if your organization blocks API keys on corporate projects)."
            )
        os.environ["GOOGLE_API_KEY"] = api_key

    return model


MONGODB_URI = (os.getenv("MONGODB_URI") or "").strip()
if not MONGODB_URI:
    raise RuntimeError(
        "MONGODB_URI is not set. Add it to the repo .env (MongoDB Atlas connection string)."
    )

_MODEL = _configure_genai()

with open(_AGENT_DIR / "prompts" / "system.txt", encoding="utf-8") as f:
    system_prompt = f.read()

mongodb_tools = MCPToolset(
    connection_params=StdioServerParameters(
        command="npx",
        args=[
            "-y",
            "@mongodb-js/mongodb-mcp-server",
            "--connectionString",
            MONGODB_URI,
        ],
    )
)

root_agent = Agent(
    model=_MODEL,
    name="datapilot",
    description="AI-powered data pipeline monitoring agent",
    instruction=system_prompt,
    tools=[mongodb_tools],
)
