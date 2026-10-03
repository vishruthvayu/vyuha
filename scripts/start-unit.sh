#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# No installation/download is attempted here. Prepare officer dependencies once.
if [ ! -x .venv/bin/python ]; then
  echo 'Officer setup is missing. Run scripts/start-local.sh once with internet, then stop it.' >&2; exit 1
fi
.venv/bin/python scripts/preflight.py "$@"
.venv/bin/python -c 'import fastapi,uvicorn' || { echo 'Officer dependencies missing. Run scripts/start-local.sh once with internet.' >&2; exit 1; }
if [ "${1:-}" = '--build' ]; then (cd client && npm run build); fi
if [ ! -f client/dist/index.html ]; then echo 'Build assets first: cd client && npm run build' >&2; exit 1; fi
port="${VYUHA_PORT:-8000}"
protocol=http
ssl_flags=()
if [ -n "${VYUHA_SSL_CERTFILE:-}" ] || [ -n "${VYUHA_SSL_KEYFILE:-}" ]; then
  : "${VYUHA_SSL_CERTFILE:?Set both certificate and key paths}"
  : "${VYUHA_SSL_KEYFILE:?Set both certificate and key paths}"
  protocol=https; ssl_flags=(--ssl-certfile "$VYUHA_SSL_CERTFILE" --ssl-keyfile "$VYUHA_SSL_KEYFILE")
fi
printf '\nVYUHA UNIT MODE\nStarting officer/server on all interfaces.\nLocal: %s://127.0.0.1:%s\nOfficer console: %s://127.0.0.1:%s/instructor\nUnit overview: %s://127.0.0.1:%s/unit\n' "$protocol" "$port" "$protocol" "$port" "$protocol" "$port"
while IFS= read -r address; do printf 'Candidate trainee URL: %s://%s:%s\n' "$protocol" "$address" "$port"; done < <(.venv/bin/python scripts/lan-addresses.py)
printf 'Choose the Wi-Fi/Ethernet address reachable from trainee devices; VPN/virtual interfaces may also be listed.\nRuntime architecture: no required cloud service during training; assets and services hosted locally.\nPhysical multi-device LAN operation validated. Dedicated physical WAN-off/LAN-on: NOT PERFORMED BEFORE SUBMISSION.\nTrusted LAN mode only. No production authentication is enabled. Do not expose this service to the public internet.\nPlain HTTP LAN: live training and IndexedDB recovery work; service-worker cached reload requires browser-trusted HTTPS.\n\n'
export VYUHA_UNIT_MODE=1
if [ "$protocol" = https ]; then
  exec .venv/bin/python -m uvicorn server.main:app --no-access-log --host 0.0.0.0 --port "$port" "${ssl_flags[@]}"
else
  exec .venv/bin/python -m uvicorn server.main:app --no-access-log --host 0.0.0.0 --port "$port"
fi
