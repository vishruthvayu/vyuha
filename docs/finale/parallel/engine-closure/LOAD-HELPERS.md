# Authorized load-measurement tooling

During current load verification, `benchmark-unit.py` reproduced HTTP401 at the protected instructor-command route. This was stale measurement tooling after the authentication correction, not a reason to weaken the application. The original failure remains in project acceptance work evidence.

The helper now provisions a strong random officer credential in its own temporary directory, supplies that explicit auth path only to its disposable child server, signs in normally and authenticates the workload clients. It prints no passwords or bearer tokens and removes the temporary files with its normal context cleanup. Existing production credentials, databases, routes and authorization rules are unchanged. Independent review verified isolated mode0600/hash storage and an untouched ambient credential sentinel.

`benchmark-advanced.py` requires `VYUHA_BENCHMARK_OFFICER_TOKEN` only when the operator supplies an external analytics target. It fails before starting workloads when that token is missing. The missing-token CLI check was actually executed; no external target or credential transmission was tested or claimed.

Actual successful HTTP workloads against isolated databases: one client/three sessions, six concurrent clients/eighteen sessions, and advanced-mode six concurrent clients/eighteen sessions. Every card, duplicate batch/completion, profile count, AAR and session-scoped neutral-command retrieval assertion passed. The helper explicitly reports **unmarked legacy** engine inputs for these scenarios: these are current server concurrency measurements using legacy/reference scenarios, not a Finale0.4 six-client or physical-unit certification. Queued neutral commands are deliberately not applied, so command_issue latency is a server receipt metric, not trainee application latency.

In the six-client legacy run, command issue measured10.67ms median/34.74ms p95 and completion59.94ms median/243.26ms p95. The advanced-pack run measured8.46/93.80ms command issue and82.08/336.27ms completion. These loopback synthetic workloads do not measure WAN/device latency, human training, physical scalability or whole-process CPU.

Final frozen policy-v2 source hash is `7eb3dad32c506c58470b11bd72c4f95539359946b24e586fc154659b485695f5`. Complete regression is being rerun after the two tooling edits. The preceding697-backend/268-frontend result remains pinned to startup source2439f20d; it is not silently relabelled as the new source result. Outer UI ownership and protected releases are unchanged.
