#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXPLORER="${AGENT_EXPLORER_DIR:-}"
if [[ -z "$EXPLORER" || ! -x "$EXPLORER/.venv/bin/agent-explorer" ]]; then
  echo "Set AGENT_EXPLORER_DIR to an Agentic Test Explorer checkout with its .venv installed." >&2
  exit 2
fi
if [[ ! -x "$EXPLORER/.venv/bin/python" ]]; then
  echo "Agentic Test Explorer .venv Python not found." >&2
  exit 2
fi

cd "$ROOT"
npm run build
CONFIG="$ROOT/dist/firebase-config.json"
BACKUP="$(mktemp)"
HAD_CONFIG=0
if [[ -f "$CONFIG" ]]; then
  cp "$CONFIG" "$BACKUP"
  HAD_CONFIG=1
fi
restore_config() {
  if [[ "$HAD_CONFIG" == 1 ]]; then cp "$BACKUP" "$CONFIG"; else rm -f "$CONFIG"; fi
  rm -f "$BACKUP"
}
trap restore_config EXIT INT TERM
cat > "$CONFIG" <<'JSON'
{"apiKey":"fake-api-key","authDomain":"localhost","projectId":"demo-tai-auth","appId":"1:123:web:local-test","taiEmulators":{"authHost":"127.0.0.1","authPort":9099,"firestoreHost":"127.0.0.1","firestorePort":8080}}
JSON

export ROOT EXPLORER
node scripts/e2e/run-supertest.mjs --explorer
