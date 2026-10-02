#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/python -m pip install -r server/requirements.lock.txt
fi
if [ ! -d client/node_modules ]; then
  (cd client && npm ci --cache /private/tmp/vyuha-npm-cache --no-audit --no-fund)
fi
(cd client && npm run build)
printf '\nVYUHA is available at http://127.0.0.1:8000\n\n'
exec .venv/bin/python -m uvicorn server.main:app --host 127.0.0.1 --port 8000
