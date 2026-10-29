# Observation Theatre v2 + site-led instruction

Presentation/instructor implementation: `5c86f936784f55135cb05e41e478bdb8a0725b81`

Follow-up geometry-cache implementation: `1f422d8f35fc8324aa6e8ae0d148d30da77f4cfd` on `feature/vyuha-next-generation`.
Current source-input policy v2 hash: `ff9f08fb2b6ecca431e70379f2ccaca305a182e37c5a5c9d89d8f95fc2330d76`. Earlier browser timing receipts retain the preceding source hash.
This is a development milestone, not release-candidate or full-system acceptance.

## Product change

The live observation experience now uses a persistent world with a vertical instrument rail and a fixed observation console. Request/sample/publication evidence and the existing camera controls occupy predictable edges rather than competing floating panels. Changing workspace instruments preserves the acquisition component and camera state. Decisions still travel through the existing request/worker receipt path.

Both public authored sites now use an original all-sided architectural grammar: recessed wall cladding, structural bays, loading doors, upper glazing, multistorey windows, parapets, roof plant and optional High detail. Public concrete courts have metric joints; roads retain their frozen alignment and receive lane/edge cues. Every building vertex remains inside the frozen authoritative volume. These are visual recesses, not newly admitted sensor apertures. No external model or new texture download was introduced.

The public arrival camera approaches the primary structure. It uses only public geometry, clamps malformed time and honors reduced motion. Start retains the existing immediate cut to the fixed sensor origin. Public full-site survey is preserved. Foundation contact shading now includes authored structures. Medium/High shadow coverage includes the authored campus; the former ±170 m shadow extent missed distant structures. The previous shadow refresh mechanism remains in place.

The instructor can choose an existing frozen v3 site exercise in the original group-assignment workflow. Trainees receive distinct sessions and explicitly start their assignment. A new authenticated, on-demand group observation review reconstructs only completed sessions and links their evidence to officer Ghost and site-preserving next practice. It does not invent results for active sessions, change tactical scores, or award mastery.

## Architecture decision and verified references

Retain Three.js r180 WebGL, the layered observed-only renderer, existing PBR textures, and the authoritative occlusion depth pass. Geometry is batched by material. No WebGPU/engine migration, remote rendering dependency or emulator-only path was added.

The installed Three.js Lambert implementation already lights per fragment. Existing materials already used PBR/ORM/normal maps; this milestone does not claim to introduce PBR to VYUHA. The change is architectural geometry, material composition, campus shadow coverage and spatial interaction.

References examined: [r180 MeshStandardMaterial](https://github.com/mrdoob/three.js/blob/r180/src/materials/MeshStandardMaterial.js), [r180 color management](https://github.com/mrdoob/three.js/blob/r180/manual/en/color-management.html), and [r180 SMAA pass](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/postprocessing/SMAAPass.js). SMAA was considered and not introduced: the existing sensor multipass/color pipeline needs a separate measured experiment before a postprocessing migration. Existing local texture attribution remains applicable.

The three recovered agent workstreams had ended with execution-limit errors and supplied no usable implementation or findings. Their scopes were completed directly in the existing worktree; no worktree, database, branch or prior milestone was recreated.

## Focused acceptance

- 29 frontend cases passed across premium geometry/camera, frozen site boundaries, persistent console/portal, instructor review UI, optical station, acquisition UI, briefing and public survey.
- Follow-up cache validation: nine focused geometry/cache/site cases passed, then all three final cache lifecycle cases passed after the zero-byte entry limit was added. These overlap prior coverage: 32 distinct frontend cases across this milestone, not a new full-suite count.
- Four authored-site instructor backend cases passed. Two unchanged group-assignment compatibility cases also passed in the earlier combined targeted run; they were not redundantly rerun after the new review-endpoint corruption guard.
- TypeScript, changed-file ESLint, changed-file Prettier, `git diff --check`, and production build passed. Build bundled 81 local offline assets; existing large-chunk warning remains.
- Real Chrome keyboard workflow: prepare/start, select T1, request EO, pause, resume through publication, pan independently, designate, explicitly Defer, explicitly classify, respond, end early, receive server-verified Ghost. EO returned no modeled detection; the UI did not convert it into recognition.
- The intentionally unsupported QA classification/response produced a tactical score of 41/100 while the evidence assessment retained unsupported findings. Its earlier affiliation Defer remained supported. This is software evidence, not a performance score for a human participant.
- Real officer workflow: sign in to private loopback QA, choose a frozen Open Campus assessment, assign THEATRE-QA, verify explicit trainee start, pending evidence, IR detection-only publication, explicit type Defer, completion and officer evidence review. The original 0/100 and separate C03 support were preserved. The verified Ghost link opened that exact session. Next practice retained `mission_site=open_campus`.
- Responsive inspection reproduced a zero-width mobile world caused by conflicting selector specificity. Corrected source renders a 390×422 world at 390×844, a 638×556 world beside a 310 px console at 1024×768, and no horizontal overflow. Mobile keyboard pan changed only camera heading. Camera action targets are at least 44 px.
- Settings now open upward from the bottom instrument row. Intermediate captures showing the former overflow are not final acceptance screenshots.

Full backend/frontend suites, all-engine parity, stored scorecards, Transfer, Crew, XR and physical-device tests were not rerun for this presentation/instructor slice. No scoring engine, action protocol, frozen compiler, replay or assessment implementation changed. Their prior receipts remain historical evidence rather than a new full-system pass. New assignment/evidence boundaries were tested directly. Full regression remains required at the frozen release candidate.

## Three-flagship reconciliation

| Goal | Integrated now | Status and remaining work |
|---|---|---|
| A: premium simulation presentation | Authored campus architecture, surface cues, camera arrival, shadow extent, fixed observation theatre, coherent Ghost/Studio surfaces | PARTIAL. Wider environment composition, aircraft close-up, lighting/atmosphere direction and all-workspace visual acceptance remain. The changed world must meet the measured performance gate; no blanket speedup claim. |
| A: accessible interaction | Persistent instrument/camera state; keyboard acquisition/decisions; corrected mobile/tablet canvas | PARTIAL. Full focus/contrast sweep and physical touch/headset ergonomics remain. |
| B: instructor-led site exercises | Existing frozen v3 catalog admitted to existing group assignment; independent sessions; assessment/practice separation | Integrated and focused-tested. Multi-device physical validation and larger instructor cohort performance remain untested. |
| B: truthful acquisition | Existing deterministic request/sample/publication/expiry, detection vs recognition, authoritative occlusion retained | Preserved and browser exercised. No new active-acquisition engine or sensor calibration is claimed. |
| C: evidence-grounded progression | Officer group evidence → exact verified Ghost → site-preserving changed practice | Integrated and focused-tested. This is a transparent evidence heuristic, not an empirically validated adaptive teaching policy. |
| Crew / VR | Existing contracts and unsupported active-acquisition VR gate unchanged | No new Crew/XR capability claimed; physical tests pending. |
| Historical data / releases | Original database hash and protected refs checked in `evidence/preservation.json` | Preserved. No releases or tags created. |

## Evidence interpretation

Screenshots are unresized browser viewport captures at 100% Chrome zoom. The CSS viewport and actual canvas backing dimensions are recorded separately; DPR2 is not a claim that a Medium DPR1 canvas is a 2× Retina capture. Before/after world render areas differ because the new fixed console reserves space. Startup, warm paused rendering, and live interaction are separate workloads. Read PERFORMANCE.md before quoting numbers. Browser automation intermittently timed out; resulting actions were checked before retrying to avoid duplicates. Some failed selectors were locator/transport failures rather than application failures.

Remaining limitations: educational synthetic models, no empirical sensor calibration or learning-gain claim; no new physical headset/Windows/Linux/phone/LAN-HTTPS/WAN-off validation; final frozen release regression and independent review still required. The three flagships are not declared complete.

## Follow-up measured implementation

The initial geometry experiment exposed repeated façade-construction cost. Commit `1f422d8` adds an 8 MB / 32-entry public geometry cache with consumer-owned deep copies. It preserves exact geometry and has no sensor/session inputs. This is a measured startup optimization alongside the visual work, not a claimed steady-state FPS fix. The final cached source built successfully with 81 offline assets. Production browser checks restored an unfinished drill, switched Medium → High → Medium, published an EO result and recorded Defer before server completion. See the final browser receipt and source-pinned diagnostics for the exact coverage. Earlier development browser checks remain attributed to their earlier source.
