#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v python3 >/dev/null || { echo 'VYUHA startup: Python 3.11+ is missing. Install Python, then retry.' >&2; exit 1; }
python3 scripts/preflight.py --build
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
.venv/bin/python scripts/preflight.py --build
if ! .venv/bin/python -c 'import fastapi,uvicorn,httpx' 2>/dev/null; then
 .venv/bin/python -m pip install -r server/requirements.lock.txt || { echo 'Dependency setup failed. First installation requires internet; retry when connected.' >&2; exit 1; }
fi
if [ ! -d client/node_modules ]; then
 (cd client && npm ci --cache "${TMPDIR:-/tmp}/vyuha-npm-cache" --no-audit --no-fund) || { echo 'Frontend setup failed. First installation requires internet.' >&2; exit 1; }
fi
(cd client && npm run build)
port="${VYUHA_PORT:-8000}"
printf '\nVYUHA is available at http://127.0.0.1:%s\n\n' "$port"
exec .venv/bin/python -m uvicorn server.main:app --host 127.0.0.1 --port "$port"
