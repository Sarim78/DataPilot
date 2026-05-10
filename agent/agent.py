import os
from dotenv import load_dotenv
from google.adk.agents import Agent
from google.adk.tools.mcp_tool import MCPToolset, StdioServerParameters

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Load system prompt
with open(os.path.join(os.path.dirname(__file__), "prompts/system.txt"), "r") as f:
    system_prompt = f.read()

# MongoDB MCP toolset
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

# Create the Datapilot agent
datapilot_agent = Agent(
    model="gemini-2.0-flash",
    name="datapilot",
    description="AI-powered data pipeline monitoring agent",
    instruction=system_prompt,
    tools=[mongodb_tools],
)