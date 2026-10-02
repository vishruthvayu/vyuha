#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
.venv/bin/python -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT
cd client
npm run dev
