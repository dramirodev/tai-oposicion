"""Launch the authorized Gemini mission with an empty, per-run memory database."""
import os
from pathlib import Path
import sys

from dotenv import dotenv_values

root = Path(os.environ["ROOT"]).resolve()
run_directory = Path(os.environ["TAI_EXPLORER_RUN_DIR"]).resolve()
if (run_directory.parent != root / "test-results-explorer"
        or Path.cwd().resolve() != run_directory
        or os.environ.get("GCLOUD_PROJECT") != "demo-tai-auth"
        or os.environ.get("FIREBASE_AUTH_EMULATOR_HOST") != "127.0.0.1:9099"
        or os.environ.get("FIRESTORE_EMULATOR_HOST") != "127.0.0.1:8080"
        or (run_directory / "agent_memory.sqlite").exists()):
    raise SystemExit("Explorer requires a fresh isolated directory and demo-tai-auth emulators")
explorer = Path(os.environ["EXPLORER"]).resolve()
values = dotenv_values(explorer / ".env", interpolate=False)
for key in ("GOOGLE_API_KEY", "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_VISION_MODEL", "GEMINI_REPORT_MODEL"):
    if values.get(key) and not os.environ.get(key):
        os.environ[key] = values[key]
os.environ.update({
    "LLM_PROVIDER":"gemini",
    "GOOGLE_GENAI_USE_VERTEXAI":"false",
    "LANGSMITH_TRACING":"false",
    "LANGCHAIN_TRACING_V2":"false",
    "MCP_SERVERS_CONFIG":"",
    "AGENT_SKILLS_ROOT":str(run_directory / "skills"),
    "PYTHONUNBUFFERED":"1",
})
print("Starting Gemini mission with isolated synthetic memory and no external MCP tools.", flush=True)
os.execv(sys.executable, [sys.executable, "-u", str(explorer / ".venv/bin/agent-explorer"), *sys.argv[1:]])
