#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${VYUHA_SSL_CERTFILE:-}" ] || [ -z "${VYUHA_SSL_KEYFILE:-}" ]; then
  cat >&2 <<'HELP'
VYUHA headset mode needs trusted HTTPS.
Set VYUHA_SSL_CERTFILE and VYUHA_SSL_KEYFILE to your server certificate and private key.
The certificate must cover the LAN hostname/IP and be trusted by the headset browser.
See client/public/vr-guide.html, section 05, for setup instructions.
For laptop preview without certificates, use: bash scripts/start-local.sh
HELP
  exit 2
fi
if [ ! -r "$VYUHA_SSL_CERTFILE" ] || [ ! -r "$VYUHA_SSL_KEYFILE" ]; then
  echo 'VYUHA VR: the configured certificate or key file is not readable.' >&2
  exit 2
fi
exec bash scripts/start-unit.sh "$@"
