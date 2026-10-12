#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/python-runtime.sh
if ! vyuha_find_venv_python; then
 if [ -e .venv ]; then
  echo 'VYUHA startup: .venv has no usable interpreter. A virtual environment copied from another OS must be recreated locally; preserve data/, then prepare a new .venv.' >&2
  exit 1
 fi
 vyuha_find_system_python
 "${VYUHA_SYSTEM_PYTHON[@]}" scripts/preflight.py --build
 "${VYUHA_SYSTEM_PYTHON[@]}" -m venv .venv
 vyuha_find_venv_python || { echo 'VYUHA startup: virtual environment creation did not produce a usable Python interpreter.' >&2; exit 1; }
fi
"$VYUHA_PYTHON" scripts/preflight.py --build
if ! "$VYUHA_PYTHON" -c 'import fastapi,uvicorn,httpx' 2>/dev/null; then
 "$VYUHA_PYTHON" -m pip install -r server/requirements.lock.txt || { echo 'Dependency setup failed. First installation requires internet; retry when connected.' >&2; exit 1; }
fi
if [ ! -d client/node_modules ]; then
 (cd client && npm ci --cache "${TMPDIR:-/tmp}/vyuha-npm-cache" --no-audit --no-fund) || { echo 'Frontend setup failed. First installation requires internet.' >&2; exit 1; }
fi
if ! "$VYUHA_PYTHON" -c 'from server.auth import credential_path; raise SystemExit(0 if credential_path().is_file() else 1)'; then
 "$VYUHA_PYTHON" scripts/setup-auth.py
fi
(cd client && npm run build)
port="${VYUHA_PORT:-8000}"
printf '\nVYUHA is available at http://127.0.0.1:%s\n\n' "$port"
exec "$VYUHA_PYTHON" -m uvicorn server.main:app --host 127.0.0.1 --port "$port"
