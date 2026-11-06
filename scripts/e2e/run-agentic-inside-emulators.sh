#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-$(pwd)}"
EXPLORER="${EXPLORER:?AGENT_EXPLORER_DIR is required}"
PYTHON="$EXPLORER/.venv/bin/python"
cd "$ROOT"

export TAI_FIREBASE_EMULATORS=1 TAI_AUTH_EMULATOR=1
PORT=4187 npm run serve > /tmp/tai-agentic-app.log 2>&1 &
APP_PID=$!
mkdir -p "$ROOT/test-results-explorer"
RUN_DIR="$(mktemp -d "$ROOT/test-results-explorer/run-XXXXXX")"
ATE_CONFIG="$RUN_DIR/config.yaml"
ATE_MISSIONS="$RUN_DIR/missions.yaml"
mkdir -p "$RUN_DIR/skills"
export TAI_EXPLORER_RUN_DIR="$RUN_DIR"
echo "Explorer artifacts: $RUN_DIR"
cleanup() {
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
for attempt in $(seq 1 60); do
  if curl --silent --fail http://127.0.0.1:4187/ >/dev/null; then break; fi
  if [[ "$attempt" == 60 ]]; then cat /tmp/tai-agentic-app.log >&2; exit 1; fi
  sleep 1
done

node scripts/e2e/prepare-synthetic-users.mjs
AGENT_EXPLORER_DIR="$EXPLORER" "$PYTHON" scripts/e2e/agentic-explorer-guard.py
"$PYTHON" - "$ATE_CONFIG" "$ATE_MISSIONS" "$ROOT/tests/e2e/missions/tai_auth_chaos.yaml" <<'PY'
import sys
from pathlib import Path
import yaml

with open(sys.argv[1], "w", encoding="utf-8") as config_file:
    yaml.safe_dump({"app": {"name": "TAI Emulator", "url": "http://127.0.0.1:4187"}, "paths": {"skills_root":str(Path(sys.argv[1]).parent / "skills")}}, config_file)
with open(sys.argv[3], encoding="utf-8") as mission_file:
    missions = yaml.safe_load(mission_file)
for mission in missions["missions"]:
    mission["thread_id"] += "_" + Path(sys.argv[1]).parent.name
with open(sys.argv[2], "w", encoding="utf-8") as mission_file:
    yaml.safe_dump(missions, mission_file)
PY
cd "$RUN_DIR"
export APP_URL=http://127.0.0.1:4187
export APP_CONFIG="$ATE_CONFIG"
export TAI_EXPLORER_AUTH_STATE="$RUN_DIR/auth.json"
export TAI_AGENT_EMULATOR_ONLY=1
export TAI_LOCAL_APP_URL=http://127.0.0.1:4187
export TAI_EXPLORER_HEADED=1
export TAI_EXPLORER_EMAIL="${TAI_EXPLORER_EMAIL:-tai-supertest@example.test}"
node "$ROOT/scripts/e2e/prepare-explorer-session.mjs"
if [[ "${TAI_EXPLORER_PREPARE_ONLY:-0}" == "1" ]]; then
  echo "Synthetic owner auth state verified; provider was not invoked."
  exit 0
fi
if [[ -n "${TAI_EXPLORER_SCENARIOS:-}" ]]; then
  SCENARIOS="$TAI_EXPLORER_SCENARIOS"
  if [[ "$SCENARIOS" != /* ]]; then SCENARIOS="$ROOT/$SCENARIOS"; fi
  if [[ -L "$SCENARIOS" || ! -f "$SCENARIOS" ]]; then
    echo "Scenario batch must be a regular file inside tests/e2e/missions." >&2
    exit 2
  fi
  SCENARIO_DIR="$(cd "$(dirname "$SCENARIOS")" && pwd -P)"
  SCENARIOS="$SCENARIO_DIR/$(basename "$SCENARIOS")"
  MISSIONS_DIR="$(cd "$ROOT/tests/e2e/missions" && pwd -P)"
  case "$SCENARIOS" in
    "$MISSIONS_DIR"/*.yaml) ;;
    *) echo "Scenario batch must be inside tests/e2e/missions." >&2; exit 2 ;;
  esac
  "$PYTHON" -m agentic_explorer.scenario_batch \
    --config "$ATE_CONFIG" \
    --scenarios "$SCENARIOS" \
    --output-dir "$RUN_DIR/scenario-results" \
    --profile "${TAI_EXPLORER_PROFILE:-extreme}" \
    --seed "${TAI_EXPLORER_SEED:-20261104}" \
    --storage-state "$RUN_DIR/auth.json"
  exit 0
fi
"$PYTHON" "$ROOT/scripts/e2e/launch-isolated-explorer.py" \
  --missions "$ATE_MISSIONS" --provider gemini --headed --max-steps 60
