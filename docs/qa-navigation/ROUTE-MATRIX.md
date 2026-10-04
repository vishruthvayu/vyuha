# VYUHA canonical route matrix

Audited 2026-10-04 from competitive-polish parent `20e8642782cd13cf6779e5ebd650c2f55c851b37` on `fix/navigation-discoverability`. Inventory comes from `main.tsx`, its original pathname/lazy-component switch, `App.tsx`, UnitGateway, every frontend href/location reference, and server SPA/static handling. Current canonical registry: `client/src/routes.ts`; renderer registry: `client/src/RoutePages.tsx`.

All eleven frontend pages have a discoverability policy: nine NAVIGATED and two SECONDARY_REACHABLE. No normal frontend workflow requires manually typing a URL. Status describes implementation maturity, not certification. “Before sidebar” describes the sidebar on the parent App; other pages previously had only their individual header links.

## Top-level pages

| Path | Component / title | Purpose / audience | Status | Before sidebar | Other reachability before | Main nav? | After / policy | Preconditions / decision |
|---|---|---|---|---|---|---|---|---|
| `/` | App / Training ground | Tactical training; trainee | ACTIVE | Yes | Training home links | Yes | Workspace / NAVIGATED | Unit Mode requires browser trainee identity; local mode does not. Contains drill, profile, Director and AAR. |
| `/rapid-id` | RapidID / Rapid ID | Recognition practice; trainee | ACTIVE | Yes | Evaluation pre/post link | Yes | Workspace / NAVIGATED | Unit Mode requires identity. |
| `/unit` | UnitPage / Unit training overview | Persisted profiles, history, groups; officer/instructor | ACTIVE | Embedded Unit overview button; canonical page absent | Instructor header | Yes | Unit / NAVIGATED | No auth gate; unit selector. In App the same entry uses `/?view=unit` to retain its existing worker; elsewhere canonical `/unit`. |
| `/instructor` | Instructor / Instructor console | Monitor independent sessions and issue commands; instructor | ACTIVE | Yes, new tab | Unit/header and join-page Officer console | Yes | Unit / NAVIGATED | Works with local and Unit servers; commands require an eligible session. Same-tab main link; browser modifier-click remains available. |
| `/analytics` | Analytics / Training analytics | Persisted trends and scenario × skill heatmap; trainee/instructor | ACTIVE | Yes | Instructor header | Yes | Unit / NAVIGATED | Unit Mode requires identity; empty history is valid. |
| `/exercises` | ExerciseStudio / Exercise studio | Author/save/assign frozen drills; instructor | ACTIVE | Yes | Instructor header | Yes | Exercises / NAVIGATED | No auth gate; assignment needs eligible trainees. |
| `/recorded` | Recorded / Recorded practice | Import/play bounded unscored observations; trainee/instructor | EXPERIMENTAL | **No** | Instructor header Recorded practice | Yes | Exercises / NAVIGATED | Unit Mode requires identity; playback needs an imported recording. Import controls/empty state remain available. |
| `/transfer` | Transfer / Data transfer | Portable HMAC bundle export/import; officer/data operator | ACTIVE | **No** | Instructor header Transfer | Yes | Data / operations / NAVIGATED | Page works in both modes; actual transfer needs a configured shared key. No new authentication or integrity claim. |
| `/system/evidence` | Evidence / VYUHA system evidence | Measured evidence and limitations; all/reviewer | ACTIVE | Yes | Analytics/header links | Yes | System / evidence / NAVIGATED | Existing dated manifest is preserved; source freshness correctly reports changes after its validation. |
| `/evaluation` | Evaluation / Informal evaluation | Voluntary pilot protocol; consenting participant/facilitator | EXPERIMENTAL | No | Rapid ID → Evaluation protocol | No | SECONDARY_REACHABLE, parent `/rapid-id` | Unit Mode requires identity. Explicit participant agreement required before protocol creation. Support workflow, not routine training or an efficacy claim. |
| `/system/benchmark` | Benchmark / Device performance check | Engineering measurements; operator/engineering | INTERNAL | No | System evidence → Device benchmark | No | SECONDARY_REACHABLE, parent `/system/evidence` | Both modes; user starts a measurement. Engineering tool intentionally absent from main nav, still naturally reachable. |

## Embedded views and secondary controls

| URL/control | Implemented feature | Discovery / policy | Notes |
|---|---|---|---|
| `/?view=aar` | App AAR chooser | Main After-action review / NAVIGATED view | New refreshable alias for the existing embedded view; no separate `/aar` page. |
| `/?session=<id>` and `/?view=aar&session=<id>` | Verified session AAR, replay and Ghost | Unit history or group-results row / SECONDARY_REACHABLE detail | Existing session URL preserved. Selection adds history, Back returns to parent, Forward reloads selected review. Ghost remains inside AAR. |
| `/?mode=adaptive` | App Director and trainee profile | Main Adaptive Director / NAVIGATED view | Existing drill selector, preparation and frozen Director decision remain unchanged. Heading stays Training ground because this is its adaptive mode. |
| `/?view=unit` | App embedded UnitDashboard | Main Unit training overview when in App; UnitPage → Trainee workspace overview | Avoids unloading a paused/live App worker during existing embedded navigation. Canonical `/unit` remains valid. |
| `/analytics#scenario-skill` | Scenario × four-skill heatmap | Embedded analytics section / SECONDARY_REACHABLE feature | No separate page or duplicate sidebar item. |
| `/rapid-id?session=<id>` | Evaluation pre/post recognition session | Evaluation controls / SECONDARY_REACHABLE detail | Existing protocol/session behavior unchanged. |
| Recorded page selection/playback/review | Bounded recorded practice | `/recorded` controls / embedded feature | No nested recording/detail route exists. |
| Operator guide | Guide modal | Separate sidebar button on every page and in narrow drawer | No path; keyboard Escape, focus wrap/return and scrollable dialog. |
| Start/Replay tour | Six-stop capability tour | Existing global tour controls and guide Replay tour | No path; existing tour content/behavior retained. |
| Unit profile/history/group selection | Profiles, four skills, verified history, group AAR links | `/unit` or embedded overview controls | No invented “unit readiness” or operational certification page. |

The source contains no real `/training`, `/aar`, `/aar/:id`, nested evaluation, nested recorded, legacy or deferred frontend page. Unknown paths now display a client Page not found with a return link. Exact path matching avoids `/unit-other` highlighting `/unit`; canonical trailing slashes are accepted without creating duplicate entries.

## Intentionally omitted technical routes and non-pages

| Path/family | Policy | Reason |
|---|---|---|
| `/docs` | INTENTIONALLY_HIDDEN / INTERNAL | FastAPI developer API documentation, not an operator workflow. |
| `/redoc` | INTENTIONALLY_HIDDEN / INTERNAL | Alternate developer API documentation. |
| `/openapi.json` | INTENTIONALLY_HIDDEN / INTERNAL | Machine-readable API schema. |
| `/docs/oauth2-redirect` | INTENTIONALLY_HIDDEN / INTERNAL | Framework documentation helper; not product authentication. |
| `/api/v1/*` | API endpoints, not frontend pages | JSON/service operations, including diagnostics and evidence; consumed by UI. |
| `/assets/*`, `/sw.js`, manifest/icon files | Static runtime resources, not pages | Locally served production assets/cache metadata. |
| `/examples/recorded-exercise.json` | Download resource | Bundled example linked from Recorded practice. |
| `/{path:path}` | Server SPA fallback | Infrastructure serving the client; not a canonical page. Unknown frontend paths still have HTTP 200 SPA delivery, followed by client Page not found. |

There are no INTENTIONALLY_HIDDEN frontend renderers in this revision. Benchmark is INTERNAL in maturity but SECONDARY_REACHABLE in navigation. These classifications are separate.

## Mode and coverage contract

Local and Unit Mode expose the same eleven page paths. UnitGateway gates only `/`, `/rapid-id`, `/analytics`, `/recorded`, `/evaluation` when the server reports Unit Mode; the join/loading UI now retains navigation. Officer routes have no added gate. An empty list, absent bundle key, absent recording or unaccepted evaluation agreement is a documented workflow precondition, not a broken route. This remains a trusted-LAN prototype with no production authentication.

`navigation.test.tsx` compares actual renderer keys and canonical registry, enforces policy/reason/parent, checks visible anchors for navigated pages and absence for secondary pages, and prevents duplicate canonical/nav URLs. The typed renderer map also requires every PageId. A future page cannot enter this routing implementation without registry classification; add a real parent link and coverage when choosing SECONDARY_REACHABLE. API/assets/framework routes stay outside frontend coverage.
