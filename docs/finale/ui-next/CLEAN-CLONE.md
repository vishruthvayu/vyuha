# Independent clean-clone reproducibility

Frozen source: `10a63fefba2201aa9c343d18ca1b0d3b24c0a112` on `feature/vyuha-final-hardening`. A disposable local Git clone was created with `--no-hardlinks` at `7f028a8`, then fast-forwarded through its local origin to this final source using `git fetch origin feature/vyuha-final-hardening` and `git merge --ff-only origin/feature/vyuha-final-hardening` (both exit 0). Uncommitted files and existing frontend dependencies were not copied. The clone remained Git-clean. This is committed local-history verification, not a separate GitHub network clone.

## Final-source commands and results

| Command | Exit | Seconds | Result |
| --- | ---: | ---: | --- |
| `git rev-parse HEAD` | 0 | 0.002 | Exact frozen SHA confirmed |
| `npm ci` | 0 | 3.292 | 349 packages freshly installed from package-lock |
| `npm run build` | 0 | 12.228 | Production bundle and 36 offline URLs generated |
| `npm run lint` | 0 | 4.024 | Zero warnings |
| `npm run format:check` | 0 | 2.1 | All configured source files formatted |
| `npm test` | 0 | 22.45 | 289 passed; 0 failed/skipped |
| `npm audit --json` | 0 | 1.094 | Zero reported vulnerabilities |

Commands ran from the disposable clone’s `client` directory except Git. Frontend parity tests used `VYUHA_TEST_PYTHON=/home/naveen/Vyuha-final-hardening/.venv/bin/python`; server Python modules came from the clone. The host Python environment was reused, so this does not claim fresh host backend dependency installation. Docker used the repository’s locked Python requirement build step through normal build caching.

Toolchain: Node v26.11.1, npm 12.2.0, Python 3.14.8. Exact resolved frontend versions and lock SHA-256 appear in `CLEAN-CLONE.json`.

## Production and dependency evidence

A second final-source `npm run build` passed in 11.075 seconds. All **36 generated files were byte-identical** between the two host builds, totaling **1937305 bytes**. The service worker precaches 36 URLs with cache version `771931f02a59`. All Docker-built assets also matched the host per-file SHA-256 manifest. Hashes are preserved in the adjacent JSON. The build syntax-checks the generated service worker.

`npm audit --json` reported zero known vulnerabilities across all severity categories. This is a time-specific dependency advisory result, not proof of absence of vulnerabilities.

Observed warnings: deprecated `whatwg-encoding@3.1.1` and `eslint@9.39.5`; the host environment blocked two esbuild postinstall scripts, but installed platform packages supported both successful builds. Vite warned about the lazy Scene chunk (904.37 kB minified / 245.05 kB host gzip). No dependency approvals, upgrades or renderer changes were made.

## Docker acceptance

`docker build --tag vyuha-hardening-qa:10a63fe .` passed in 22.899 seconds. Local image ID: `sha256:6040ef7822b40669f8b14e72cdaa594ba0206482cdfe8c2dd357ddb82dfba4de`. It was not published. The build used ordinary cache; base image tags are not digest-pinned, so this is not a hermetic image reproducibility claim.

An ephemeral container ran as UID 1000 with no host mounts, user credentials or external bind. It used its own database and an automatically assigned loopback port. Health, frontend entry and service worker returned 200; unauthenticated unit dashboard returned 401. After restart, health returned 200. Docker reassigns the dynamic published port on restart in this environment; the harness rediscovered that port. The container was removed successfully. This is startup/restart smoke evidence, not a complete container workflow or database-recovery audit.

## Limits

No physical Windows, native Linux, Android, separate-device LAN HTTPS or WAN-off acceptance was conducted. This check does not certify the parallel visual branch, final merged source, GitHub synchronization, or a release candidate.

Raw temporary command logs are under `/tmp/vyuha-clean-*.log`. Exit codes, timings, Docker evidence and asset hashes are preserved in `CLEAN-CLONE.json`.
