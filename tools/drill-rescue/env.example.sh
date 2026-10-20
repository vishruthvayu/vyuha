# Copy to env.sh (not committed) and adjust. Source it before running the harness.
export W=$HOME/vyuha-drill-rescue-work          # work folder outside the repository (shots, bench, logs, assets-src)
export REPO=$HOME/vyuha-drill-rescue             # this worktree
export H=$REPO/tools/drill-rescue
export SHOTS=$W/shots
export CDP=9351                                   # headless Chrome with vsync (see README)
export VYUHA_TEST_PYTHON=$REPO/.venv/bin/python   # backend parity tests need the server venv
