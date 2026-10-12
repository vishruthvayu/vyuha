# VYUHA finale architecture — implementation in progress

Baseline: v1.0.1 / 2ca96105044ad6a14952d74db619e20006c26eca. Candidate branch: feature/vyuha-finale-edition. No new stable tag is authorized by a component test alone.

## Historical boundary

The released engine, prioritisation and Ghost review are copied into *_v1_0_1 modules. Only dependency imports point at the corresponding frozen modules; original and adapted hashes are in legacy-source-manifest.json. An absent engine marker means the historical v1 schema. Original score markers are vyuha-0.2.0 or vyuha-0.3.0 (priority rubric), not a relabelled v0.4. Unknown contracts reject explicitly. Valid historical algorithms and score output remain unchanged. Replay horizons beyond the frozen duration now reject instead of hanging.

## Finale contract

Schema 2 / vyuha-0.4.0 combines a frozen seeded raid grammar, analytic positions in meters, and a separate SensorObservation contract. The JSON sensor/configuration parameters are illustrative training assumptions, not equipment specifications or operational calibration. Day camera, IR, radar confirmation/coasting, RF and IFF availability are distinct. Renderers consume reported positions; the instructor/AAR truth view is explicitly labelled. False radar clutter is tentative and does not become a scored canonical target.

The initial v0.4 scoring implementation retains the 25/25/15/35 rubric while using new motion and observations. Confidence scoring, finite resources, delayed effects and collateral assessment are not yet implemented or claimed complete. See audit-backlog.json.

## Ownership and persistence

One SQLite accepted event ledger, contiguous upload sequences, immutable applied commands, independently reconstructed scores, idempotent completion and four-skill outcome ledger remain the source of truth. Candidate API limits accommodate 60–180 second scenarios but enforce each frozen duration. Completed records are not rewritten. Counterfactual branches never call completion/profile persistence; later actions invalidated by a branch are reported.

White Cell reconstructs through the last recorded telemetry horizon and distinguishes client declarations from reconstructed accepted actions. Its cache is bounded and keyed by DB/session plus exact frozen inputs/horizon. It must not manufacture a later observed state.

## Authentication and deployment

Officer provisioning stores a salted PBKDF2 hash outside Git. Login returns a random expiring bearer token (eight hours, revocable, invalidated by process restart). Browser tab session storage is used; no authentication cookie or ambient credential is issued. The server protects instructor, White Cell, authoring, transfer and officer group/dashboard operations. HTTPS is needed for confidentiality and trusted service-worker caching. This is local prototype access control, not a penetration-test or military-certification claim. Windows PowerShell startup exists but actual Windows runtime verification remains pending.

## Remaining integrations

Director v2 must preserve original Beta history and show repeatable simulated learner comparisons. Fusion Assistant must accept only sanitized observations and show uncertainty/reliance exercises. Crew Mode must share this engine and accepted ledger with attributed role-specific actions, not create a second incompatible engine. Those systems and final release/media gates remain open.
