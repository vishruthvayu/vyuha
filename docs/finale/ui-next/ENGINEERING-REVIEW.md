# Independent backend and audit review — 16 October 2026

Scope: `feature/vyuha-final-hardening`, based on `db0ff23a67692d3db5dce07a031d17ea50a409b3`. This review owns backend changes only. It does not approve the parallel drill implementation, merged product, empirical training validity, physical platforms or a release candidate. No protected refs or historical evidence were edited.

## Reproduced defect and correction

**H26-STREAM-01 — malformed command-stream cursor raised an unhandled exception.** `server/streams.py` checked `Last-Event-ID` with `str.isdigit()` before converting it using `int()`. The exact base source was loaded from Git into an isolated module against a disposable synthetic SQLite database. `²` passed `isdigit()` and then raised `ValueError`; 5,000 ASCII digits raised Python's integer conversion limit error. An HTTP request with that oversized header reached the same unhandled conversion. This is a validation/reliability defect; no officer bypass or scoring alteration was demonstrated.

The endpoint now accepts only one to three ASCII decimal digits in the existing range 0–100. Server-issued sequence IDs retain their behavior. Seven direct malformed-header cases and one actual TestClient HTTP case require a 422 response and an unchanged active-stream slot count. Non-ASCII header tests call the endpoint directly because normal HTTP clients reject some such characters before transmission. Sensor logic, scoring, historical dispatch, profile updates and command application semantics are unchanged.

A separate new regression runs three trainees concurrently, each receiving its own ordered pause/RF-degradation/restoration commands. Completing and acknowledging only trainee A leaves B/C recoverable with unapplied commands, no AAR, and no individual skill credit. This checks target isolation and attribution without pretending to measure physical-device or live-browser concurrency.

## Evidence and source boundaries

- Final targeted security/raw-ASGI authorization, command-stream, Instructor and Director-v2 run: **85 passed in 18.97 s**, including the final isolation regression. Raw log `/tmp/vyuha-hardening-targeted-backend.log`. Earlier 84/18.10 s run is superseded for this targeted group.
- Instructor suite after adding that regression: **12 passed in 3.79 s**.
- Final complete backend run: **708 passed in 246.68 s**, including the final isolation regression. Preserved raw log `backend-tests.log`; exact backend hashes and log digests are in `ENGINEERING-RECEIPT.json`. Earlier 707/250.08 s checkpoint is superseded.
- `git diff --check` passed for the backend changes and new reconciliation report.
- Interpreter: Python 3.14; tests use `/home/naveen/Vyuha/.venv/bin/python` while the dedicated worktree environment installs. All 22 installed pinned packages match `server/requirements.lock.txt`; key versions are FastAPI 0.142.2, Starlette 1.7.0, Pydantic 2.13.5, Uvicorn 0.54.0, HTTPX 0.28.1 and pytest 9.1.1.
- One dependency deprecation warning is emitted by Starlette's HTTPX TestClient integration. Dependencies were not changed to suppress it.

The final run includes every backend test after the added isolation case. All backend Python source hashes matched the inventory captured during the run. Root must retain those exact bytes, rerun affected checks if they change, complete final all-source acceptance and record the resulting Git SHA. This is backend-source acceptance, not final merged-product acceptance.

## Source and security assessment

Inspected officer provisioning/session middleware, route protection inventory, Crew session middleware and role capabilities, command acknowledgments and completion transaction, profile backfill and procedural Director snapshot, cache invalidation, teaching-note decoration, signed transfer and What-If branching. Existing executable contracts cover revoked/expired officer sessions; hashed and scoped Crew capabilities; blocked direct shared inputs; transaction rollback on failed shared commits; persisted command acknowledgments; evidence-only references; read-only counterfactuals; canonical transfer validation; atomic import conflicts; teaching-note preservation; and shared-crew exclusion from individual mastery.

No additional officer authorization bypass or cross-Crew input bypass was reproduced in this scoped review. Ordinary independent trainee/session identity remains a trusted-LAN callsign/UUID model. A known session URL is not strong user authentication, and server-authoritative reconstruction does not prove a named human originated the accepted actions. This is existing documented scope, not closed secure-examination authorization. Browser-trusted HTTPS and actual device trust remain deployment acceptance requirements.

Director-v2 remains a bounded research heuristic using accepted processed outcomes and frozen selection snapshots. Its ordinal retention gap is not a measured forgetting curve. Sensor probabilities, human learning improvement, fitted scenario difficulty, and human over-trust are not empirically calibrated by passing software tests. No scientific status was promoted.

The existing `degraded_sensor_response` attribution specifically tests radar state and RF availability in `server/director.py` and `server/review_v2.py`. EO/IR-only faults do not independently add that skill tag, because the recorded review evidence exposes optical availability without separate EO/IR fault state. Treat this as a bounded profile scope when explaining recommendations. Extending it requires an explicitly versioned evidence/outcome contract and historical compatibility decisions; this review leaves the existing learning semantics intact.

No reconstruction algorithm was optimized in this change. Prior 200-contact latency and graphics results remain historical; this review does not relabel them as current measurements.

## 211-row reconciliation

`SCOPED-RECONCILIATION.json` inventories all 211 identities and retains the historical status totals:

| Status | Rows |
| --- | ---: |
| VERIFIED COMPLETE | 93 |
| PARTIAL | 71 |
| DEFERRED | 29 |
| EXTERNALLY BLOCKED | 17 |
| NOT APPLICABLE | 1 |

These are inherited scoped implementation statuses, not a new final-product score. Each row retains its requirement, historical implementation claim, remaining work, cited source existence, tests and deferral reason. Current backend hashes are recorded separately. The new cursor defect is listed as a separate review finding rather than rewriting the identity set.

The inventory checked **220 unique implementation/test references**. One historical path, `client/src/spatial-training.css`, is absent in **16 rows**. Git commit `c746b9fa04b00ccd5e9f24e8b32d1c721aded7ae` explicitly retired it; review rules moved into `client/src/premium/review.css`, with preparation styles in `client/src/premium/preparation.css`. The overlay records that mapping. This is stale traceability, not proof of a missing runtime stylesheet or a reason to recreate protected drill CSS.

Historical audit documents contain scores and acceptance from different snapshots. In particular, the root reassessment JSON still identifies `e07a3845…` and an 84-point provisional judgement, while the 211-row ledger identifies later engine checkpoints and explicitly leaves final integration open. Those historical numbers must not be presented as a current independent product grade. The 24 audit/reconciliation paths were inventoried; the 211-row ledger, current/historical claim summaries, provisional audit, latest reassessment, prior independent reconciliation review and engine reconciliation receipt were examined as evidence inputs. This is not a claim of reperforming every historical audit procedure.

## Remaining acceptance

Main Codex retains integration and release ownership. Remaining gates include current frontend/browser accessibility and workflow acceptance; final SHA-pinned all-source backend/frontend/parity/historical/security/recovery/transfer/build checks; clean-clone reproduction; measured current performance; drill-owner integration; combined drill visual/decision usability; and direct user visual acceptance. The new branch must not merge unfinished drill work or create a stable tag.

Windows, Android, separate-device LAN HTTPS, WAN-off and native deployment/device acceptance remain pending unless actually performed against the final candidate. Execution on this hosted Linux workstation is evidence for this environment only. No physical or empirical gate is waived by this review.

The owner’s original 18-session and later stored 22-session SQLite histories are not tracked in this checkout. Fixture-based historical-dispatch/acceptance regression is covered by the backend suite, but this review does not claim to have revalidated those unavailable private databases. The integration owner must run `scripts/check-finale-history.py` against safe read-only originals/disposable backups when they are available.
