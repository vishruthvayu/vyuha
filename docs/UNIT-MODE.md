# Stage 4 — Unit Mode

> Submission acceptance policy update: dedicated physical WAN-off/LAN-on validation is **NOT PERFORMED BEFORE SUBMISSION**. Reason: **Required physical/network setup unavailable during final validation window.** This is a known validation limitation, not a failed architectural test. The user approved proceeding; every other Stage 7 requirement remains mandatory. See [FINAL-VALIDATION.md](FINAL-VALIDATION.md).

VYUHA is a trusted local network prototype for **WhiteList&0**. One officer computer runs FastAPI, SQLite and the built React application. Trainee devices need a modern browser and the same LAN. Scenarios, Instructor commands, authoritative scoring, Ghost AAR, profiles and Director decisions remain on the officer server. Each trainee runs a separate deterministic simulation in its browser Web Worker.

## Startup

Prepare the officer dependencies and build once while package access is available. Existing `scripts/start-local.sh` performs initial setup; stop it before starting Unit Mode. For subsequent training:

```bash
bash scripts/start-unit.sh
```

The script installs/downloads nothing, requires `.venv` and `client/dist`, binds explicitly to `0.0.0.0`, and prints local officer URLs plus candidate Wi-Fi/Ethernet addresses. Choose the interface shared with trainees; VPN/virtual addresses may also appear. If no useful candidate appears, use the officer's network settings to obtain its Wi-Fi/Ethernet IPv4 address. Trainees open `http://OFFICER_IP:8000`. Permit inbound TCP 8000 on the trusted local network if the host firewall blocks it. Internet access is not needed for training.

- Trainee: `/`
- Instructor: `/instructor`
- Persisted unit overview and diagnostics: `/unit`
- Optional port: `VYUHA_PORT=8001 bash scripts/start-unit.sh`
- Rebuild with already-installed packages: `bash scripts/start-unit.sh --build`

Normal local startup and Vite development retain loopback binding. Docker's default Compose publishing remains loopback-only. The explicit LAN override is:

```bash
docker compose -f docker-compose.yml -f docker-compose.unit.yml up --build
```

This override uses `!override` and requires Compose 2.24.4 or newer. Merged configuration was validated; no new Docker image/run is claimed in Stage 4.

**Trusted LAN mode only. No production authentication is enabled. Do not expose this service to the public internet.** Pseudonymous identity/session association prevents accidental confusion; it is not access control. Users who know identifiers can call endpoints or manually open another session. Roles, passwords, authorization, encryption provisioning and hostile-client protection remain future hardening.

## Network audit and browser origins

Production APIs, Instructor polling, Director, profiles, AAR and assets use same-origin relative paths. Trainees never need to enter the officer IP into an API setting. Existing dev CORS origins do not affect same-origin LAN serving. Assets have no CDN requirement. UUID generation falls back to `crypto.getRandomValues` when `crypto.randomUUID` is unavailable on plain HTTP LAN origins.

IndexedDB, local storage and the simulation worker work on the tested Android/Chrome and desktop HTTP LAN clients. Service workers require a secure browser origin: loopback works; a plain HTTP LAN IP does **not** support cached reload when the officer server is absent. The UI says this explicitly. Reload with the LAN server present still obtains all assets from that server, independently of internet connectivity.

For cached reload on a LAN, provide a certificate trusted by every trainee browser, matching the hostname/IP used to join:

```bash
VYUHA_SSL_CERTFILE=/path/to/trusted-cert.pem \
VYUHA_SSL_KEYFILE=/path/to/private-key.pem bash scripts/start-unit.sh
```

Certificate distribution/trust setup is not supplied or tested here. Do not bypass browser security warnings. Changing scheme, hostname or port changes browser origin and therefore the stored identity, drafts and cache.

## Join, recovery and instructor workflow

Join **WhiteList Training Unit** with a pseudonymous ASCII callsign (letters, digits, underscore or hyphen, at most 24 characters). The server assigns a stable `T_...` identifier. The browser stores that identity; subsequent visits validate it with the registry. Callsigns are unique within a unit, case-insensitively. A retained join request ID makes a lost-response retry idempotent. Existing-ID recovery is available when the operator knows the original identifier; there is no authentication claim.

A browser automatically offers only its own unfinished draft. Confirmed completed drafts are removed from recovery. History, profile, adaptive selection and recent-template filtering use that trainee's own identifier. Prepared adaptive scenarios and their Director decisions are unchanged from Stage 3.

The Instructor sees real session telemetry and can select any session for the existing pause/resume, radar/RF, conditions and threat-injection controls. Commands and applied timeline order remain scoped to that session. A fresh telemetry window is six seconds; stale sessions are recoverable, not falsely live. Browser presence uses a ten-second window. Multiple tabs are counted as browser clients, not physical devices.

For a group exercise, select connected, idle trainees and choose **Assign Night Watch**. The server creates one shared group/scenario and distinct session IDs, command streams, logs and scoring. Assignments arrive through one-second polling; trainees start them explicitly. This is exercise assignment, not a guaranteed simultaneous start. Assignment acceptance and launch retries are idempotent. Results show score and hostile-contact node averages with links to individual authoritative AARs, without rankings.

## Persistence and concurrency

SQLite remains the sole database, using WAL and separate request connections. Registry, presence, groups, assignment ownership, session unit membership and cached failure counts are additive migrations. Existing session/profile/Director tables and historical data remain available.

Event upload uses a short `BEGIN IMMEDIATE` transaction around duplicate detection/insertion. Event sequence numbers cannot be reused with different content. Browser drafts retain immutable event batches before upload, so losing an ACK never changes a retried batch's payload. Completion reconstructs scoring and Ghost outside the writer lock, then revalidates the events/applied commands before atomically recording completion, profile evidence and failure counts. A changed snapshot requires retry. Repeated completion never applies a second Beta update.

The simulation engine, scoring rules, Ghost review engine, Director algorithm and worker were not rewritten.

## Unit analytics

The dashboard reads real registered trainees and persisted four-skill profiles. A unit skill value is the arithmetic mean of **all registered trainee posterior means**, including Beta(1,1)=50% for trainees with no observations. Priors and evidence counts are displayed; these are training mastery estimates, not operational competence/readiness. Empty units have no numeric estimate.

The weakest skill is the minimum mean; ties follow the existing canonical skill order. Affected trainees are those below 70% for that skill; the threshold is explicitly displayed. Current adaptive focus means the latest **started** adaptive drill, not a forced future unit assignment.

Completed-today counts use UTC completion dates. Older sessions without a stored completion timestamp use their creation date as a migration fallback. Total sessions cover all completed sessions; displayed history and the failure heatmap cover the latest 100 completed sessions. Failure counts come from authoritative Ghost `incorrect` decision reviews, deduplicated once per `(session, contact, reason)`; correct and unassessable decisions are excluded. Reconstruction exclusions are reported rather than fabricated.

Diagnostics use SQLite `quick_check`, real fresh session/presence windows and pending assignments. Disconnected clients' local queues cannot be measured by the server; pending client sync is unknown, not an invented zero.

## Offline and recovery

A loaded drill continues locally during loss of the officer server. Actions and applied commands stay in IndexedDB; completed device records remain explicitly unverified until synchronization. Instructor controls are unavailable during an outage. No command is represented as received without an actual server-issued record. A reconnect uploads retained batches, acknowledges existing applied commands and requests authoritative completion. Unverified debriefs retry every five seconds.

Internet loss and LAN/server loss are different. Production's seven assets are officer-served and training has no external API/CDN dependency. The actual browser/server-outage and physical walkthrough evidence is recorded below. The user confirmed phone reload/start over Wi-Fi; that Wi-Fi still had internet. Dedicated WAN-disconnected physical validation was not performed before submission; do not conflate a server-outage test with one.

## Validation evidence — 2026-10-03

Baseline before editing: backend **50 passed**, frontend **25 passed**; existing simulation parity **51 checkpoints**, Director parity **72 checkpoints**; production build passed with seven offline assets.

Final regression run: backend **65 passed**, one existing Starlette/httpx deprecation warning (**23.49 s**); frontend **32 passed**, zero failures (**3733.33 ms**). Production TypeScript/Vite build passed (**1609 modules**, **4.14 s**) with seven local offline assets, cache fingerprint `cb75efb6b806`. Main bundle 1207.70 KB (335.86 KB gzip); existing bundle-size warning remains. Both parity suites passed unchanged.

Backend coverage includes three independent active sessions; targeted radar/swarm commands; separate profiles and Director anti-rote history; exact unit aggregation/Ghost counts; three distinct sessions sharing a group; 24 duplicate uploads across 12 workers; six simultaneous create/upload/poll/complete/AAR/profile clients with idempotent completion; recovery across storage initialization; late log revalidation; lost join ACK; completion-date counting. Frontend coverage includes persisted identity, own-draft selection, HTTP UUID fallback, immutable retry batches, connection/sync wording and actual aggregate/failure/group rendering.

Desktop browser walkthrough: trainee **QA-U-A** in the in-app browser and **QA-U-B** in Chrome; B uses the actual LAN HTTP origin. A radar failure at tick 8 changed only A. B's six-drone swarm at tick 2 changed only B. Both adaptive drills independently completed, scored and produced authoritative Ghost/profile evidence. A deliberately misclassified friendly contact produced `FRIENDLY_MISIDENTIFIED`; B's injected quad produced `CORRECT_RF_JAM`. A/B profiles and histories remained distinct. Evidence: `qa/unit-a-radar-failed.jpg`, `qa/unit-b-swarm.jpg`, `qa/unit-b-verified-aar.jpg`.

Group browser walkthrough: A/B received `G_82151c80abe64082b185954a1fd9a7dd`, with distinct sessions `4d81a55c-348a-4b26-93d1-3a28d9f953f1` and `527daf55-5136-4ddf-b1a1-6fbf051e6e1c`. A reloaded and resumed its own assigned draft. Both independently completed with real scores and individual AARs; A retained three actions and B retained none. Instructor screenshot `qa/unit-three-clients.jpg` records A/B paused while the physical phone's separate adaptive drill was active.

Physical LAN minimum: **two physical devices** — officer Mac running macOS and a separate **Android phone / Chrome** confirmed by the user. The phone loaded officer-served assets over the same Wi-Fi at `http://OFFICER_WIFI_IP:8000`; distinct remote-client requests and subsequent heartbeats were observed. Exact personal addresses are omitted. Phone callsign **V** first completed scripted session `c16bfbfa-2d0f-4cc2-acd1-954a13cb1475`, 2250 ticks, server verified. An instructor radar jam was acknowledged at tick 1352. The phone then started adaptive session `b43c14a7-0228-4566-a959-4fc12bd6733a`; radar jam and no-RF FPV injection were both acknowledged at tick 124, orders 0/1. The user confirmed RADAR: DEGRADED and saw injected T6. The phone completed at tick 993 and the server confirmed a verified score and Ghost AAR. Its event log contains no trainee actions; therefore no phone RF-jammer decision-test claim is made. The authoritative review contains four THREAT_MISSED failures. This is one trainee phone, not two trainee laptops. At peak, three trainee browser clients plus the Instructor were observed across the two physical devices. Separate automated tests used six concurrent simulated clients.

Browser outage walkthrough: on an isolated test instance with a separate database and LAN HTTP origin, QA-OUTAGE started a drill; the server process was stopped. The loaded browser continued and recorded three actions (designate, classify, hold) while showing local continuation/events queued/instructor unavailable. Ending the drill saved a device-only unverified debrief. After restarting the same server/database, automatic retry uploaded the retained batch and verified session `f3d7f863-4639-42fb-b468-585543c069a2`, with all three events retained and authoritative Ghost review. Evidence: `qa/unit-outage-local.jpg` and `qa/unit-outage-verified.jpg`. This tests server outage, not a radio disconnect on the phone.

Persisted officer snapshot after restart: 10 registered trainees (including migrated prior-stage QA identities), 18 completed sessions, 11 completed-today using UTC/legacy fallback. Skill means: detection 40.7222%, IFF 63.4524%, effector 58.5714%, degraded response 40.6667%. Degraded sensor response is weakest; 10/10 trainees are below 70%. Ghost heatmap: THREAT_MISSED 40, DETECTION_LATE 5, NO_RF_JAM_INEFFECTIVE 4, FRIENDLY_MISIDENTIFIED 2. Historical no-RF counts include previous stages, not phone actions. Snapshot source: `qa/unit-analytics.json`. Group comparison was displayed on the unit overview.

Dedicated physical WAN-off/LAN-on validation: NOT PERFORMED BEFORE SUBMISSION. The phone successfully reloaded and started another adaptive drill on Wi-Fi, but the user confirmed its internet uplink was still available. Stage 4 is stable and its minimum physical LAN test passed; The submission policy now treats the unperformed WAN check as a disclosed limitation rather than a release blocker. Reason: Required physical/network setup unavailable during final validation window. Stage 5/6 work is documented separately; this report retains its historical Stage 4 measurements.

## HTTP performance

Run ` .venv/bin/python scripts/benchmark-unit.py` from the repository. This launches disposable loopback servers/databases, three rounds per client at 1/3/6 concurrent clients, with barriers before uploads. It verifies own-scenario scores/AARs, duplicate upload/completion behavior, profile session counts and database health. It is a transport/concurrency test, not a simulated learner benchmark. No load data enters the training database.

Measured median HTTP milliseconds:

| Concurrent clients | Event upload | Empty command poll | Command issue | Queued command response | Active list | Dashboard | Completion/scoring |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1.75 | 1.36 | 2.30 | 1.33 | 1.58 | 5.71 | 29.99 |
| 3 | 3.20 | 2.10 | 3.80 | 1.67 | 2.69 | 21.64 | 59.29 |
| 6 | 4.92 | 2.64 | 4.86 | 3.51 | 7.40 | 69.38 | 50.24 |

Full samples/counts/maxima and method: `qa/unit-load.json`. At six clients: maximum upload 213.62 ms, dashboard 264.53 ms, completion 156.35 ms. Poll cadence adds up to about 500 ms before client command application; HTTP measurements are not end-to-end phone latency. Neutral benchmark commands were queued/polled but intentionally not applied, so they do not alter the expert fixture's score. CPU was not measured; RSS was unavailable under host permissions and is explicitly null. Numbers include local request contention, not Wi-Fi/WAN transit.

## Limits and next stage

Trusted LAN only, no authentication/authorization; no secure-deployment claim. HTTP LAN lacks service-worker cached reload with the server absent. Identity is scoped to browser origin and retained storage. Unit heatmap/history have a 100-session recent window. Group assignment requires explicit trainee start. No observer stream, broadcast-all control or QR dependency was added. No hosted deployment, MongoDB, production observability or USB/HQ synchronization.

Next is **Stage 5 — Advanced Training Intelligence & Exercise System**: Red Force tactics, Rapid ID, Doctrine Packs, Scenario Authoring Lite, swarm prioritisation, session improvement analytics and optional crew training. These remain unimplemented here.
