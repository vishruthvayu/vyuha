# Configuration-aware world and optics — focused acceptance

25 October 2026. Runtime commit `ab92f691168dbf0a48c5040db4b55873fd1263aa`, source-inputs-v2 hash `2c8642fc99be9c4cc53394e5ec12810ecd25e1b2bcab570a17d7cf420d3780a9`. Builds on the completed [Optical Investigation Station](../optical-station/ACCEPTANCE.md), runtime7729c40 / evidence36f282b.

This is a necessary rendering-contract correction and foundation for the next authored-world upgrade. It is **not** a new environment kit, physical sensor model, active-query engine or release acceptance. The primary Level3 user-capability upgrade in this batch remains the Optical Investigation Station.

## Problem and working change

The authoritative model already permits valid frozen sensor overrides. The renderer formerly used default IFOV/visibility and a fixed1700m flat region. That default proof does not cover all supported custom configurations. Presentation now consumes the same public frozen configuration:

| Surface | Actual implementation |
|---|---|
| Training / Ghost / XR | App and Reconstruction Theatre forward `scenario.sensor_config` to Scene. VRWorld forwards it to Environment. No new scenario-origin field or authoring control. |
| Close-up | InspectionPass uses configured EO/IR IFOV. Config changes invalidate its image-cadence key. Display crop remains separate and cannot grant new sensor evidence. |
| Atmosphere | Configured clear/dense visibility and IR factor feed the existing artistic haze approximation. This is not the sensor engine's transmission equation or calibrated radiometry. |
| Terrain | Public range and optional sensor origin derive a conservative flat disc with200m margin. Default1700m stays exact. Decorative relief remains outside the tested observation footprints. |
| Bounds | Browser Scene refuses invalid/outside-budget worlds before creating Canvas. Environment rejects unsupported envelopes; existing XRBoundary owns suspension/recovery. No silent clamp to a smaller unsafe world. Supported optional offsets receive conservative sky/far clipping. |

Parameters/envelopes are memoized on configuration/origin, not simulation ticks. No contact roster enters the envelope. No scoring, sensor/worker, action/Fusion, transport, database schema or historical fixture source changed. Materials, lighting, kit, airframe and thermal sources are hash-verified unchanged. Existing authoritative boxes and decorative-obstruction semantics remain intact.

## Targeted checks against integrated source

- `world-envelope.test.ts`, `world-config-flow.test.tsx`, `inspection.test.ts`, `world-lighting.test.ts`: **29 passed, 0 failed**,3.905797s.
- Four selected world compatibility cases: **4 passed, 0 failed**,0.485032042s.
- **33 unique focused tests**; staging repeats and earlier six-helper tests are not additional tests. Forwarding tests execute actual Scene/XR/Theatre source with controlled renderer stand-ins; they do not certify WebGL/XR hardware.
- Incremental TypeScript, changed-file ESLint and Prettier passed.
- Frozen geometry fixtures from7729c40 match positions, normals and indices exactly for both terrains at both existing detail tiers. Default fog arithmetic/IFOV remain exact.
- An additional independent geometry check examined actual projected triangles in **8 cases**, including flat-ring chords, both terrains/detail tiers and default/long-range offset configurations. Every tested non-flat triangle remained outside its full optical footprint; minimum clearance184.307m. This is geometry evidence, not a human perception experiment or an extra33-test suite.

Commands:

```sh
cd client
node --import tsx --test src/world-envelope.test.ts src/world-config-flow.test.tsx src/inspection.test.ts src/world-lighting.test.ts
node --import tsx --test --test-name-pattern='visual ground|decorative scenery|thermal display|day sun heating' src/world.test.ts
node node_modules/typescript/bin/tsc -b
```

The triangle checker is retained as `evidence/check-relief-footprint.mjs.txt`; run its contents with `node --import tsx --input-type=module` from `client`. Raw logs/fixtures/hashes accompany this receipt. Full backend/frontend/parity/history/build/Docker suites were not repeated for presentation-only changes. Their final frozen-release gates remain open; historical pass totals are not relabelled as new results.

## Real WebGL / server / Ghost workflow

A new content-addressed synthetic fixture was seeded only in the existing disposable QA database. The generator/seed script and exact frozen JSON are retained. It uses the current raid validator, recomputes signature/validation/content ID, inserts new rows without replacing existing data and does not change production credentials/data. This is **not** proof of a custom-sensor authoring UI or authorization workflow.

Through real Mission controls → Scripted/Library, selected `QA configured optics 10 km` (seed67475; scenario `raid_d5a06054f4cdb59e68dfe83d`), started and paused the normal server session, then selected reported T2. The fixture uses EO range10000m, IR8000m, EO IFOV0.0003rad and IR0.00007rad plus explicit visibility settings.

At approximately201m observed range the live close-up reported **EO14pixels** and **IR58pixels** across the contact. Local capture worked; manual scan hid the off-axis close-up. Ended early at tick36/T+1.20s. The server verified the0/100 result with zero accepted trainee actions; local inspection was not converted into score/evidence credit. In verified Ghost, seeking the recorded end and selecting EO again showed14pixels. This demonstrates configuration propagation through actual Training and reconstruction, not effective training performance or physical sensor fidelity.

Session `7a556cc2-6d9c-41aa-9838-37635259d045` remains in the disposable QA store. Recorded end36 and scoring horizon2700 remain distinct. Screenshots are actual browser captures. No current8040 renderer error was observed in the retained log entries; earlier8044 duplicate-React harness errors belong to the isolated baseline experiment described in the Optical Station receipt.

## Performance and remaining gates

The earlier default benchmark remains explicitly pinned to7729c40: one paired20s200-contact retained workload, both60medianFPS. Default geometry/math preservation supports compatibility; it is **not** a fresh timing measurement of this source. No speedup, custom-config FPS, close-up latency, cold-start, GPU-memory, long-soak or physical-headset claim is made. Benchmark's current generated scenarios use defaults and do not qualify arbitrary override performance.

Supported current engine scenarios at the fixed origin fit the10km optical limit. Larger offset/footprint setups intentionally fail closed until world/sky/layout/resource budgets are redesigned together. Native headset/phone/platform and trusted separate-device HTTPS/WAN acceptance remain pending. XR configuration plumbing is software-tested; physical comfort/stereo/FPS are not.

Next major work is an authored environment kit and task-aware visual-observability qualification on this corrected contract. New active-evidence requests need their own versioned authoritative scheduling/role/replay/rubric contract; this patch does not implement them or establish participant learning gains. No RC, stable tag or merge to a protected baseline is authorized by this receipt.
