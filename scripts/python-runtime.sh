#!/usr/bin/env bash
# Shared interpreter resolution for POSIX Bash and Windows Git Bash.
# Sourcing performs no installations, filesystem writes or network access.

vyuha_find_venv_python() {
  local candidate
  local candidates=(.venv/bin/python .venv/Scripts/python.exe)
  case "${OSTYPE:-}" in
    msys*|cygwin*) candidates=(.venv/Scripts/python.exe .venv/bin/python) ;;
  esac
  for candidate in "${candidates[@]}"; do
    if [ -x "$candidate" ]; then
      VYUHA_PYTHON="$candidate"
      return 0
    fi
  done
  return 1
}

vyuha_find_system_python() {
  local command
  VYUHA_SYSTEM_PYTHON=()
  for command in python3 python; do
    if command -v "$command" >/dev/null 2>&1 && "$command" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; then
      VYUHA_SYSTEM_PYTHON=("$command")
      return 0
    fi
  done
  if command -v py >/dev/null 2>&1 && py -3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; then
    VYUHA_SYSTEM_PYTHON=(py -3)
    return 0
  fi
  echo 'VYUHA startup: Python 3.11+ is missing or unusable. Install it, reopen the terminal, then retry.' >&2
  return 1
}
