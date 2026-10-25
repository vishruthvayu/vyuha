# Optical Investigation Station — development acceptance

25 October 2026. Runtime source `7729c406c1ac3e714065617fc4890d569b50eff8`; source-inputs-v2 hash `55bbb4f809837b7ab0fcdefdecae87f17e03892ed2361d2ff36995ff763d9ed2`. Starting milestone `91ac28d` / runtime `0ad89f4` remains intact. This is a Level 3 browser investigation upgrade, not completion of the transformation or release acceptance.

## Working capability and exact boundaries

The live station now supports fixed-origin manual pan/tilt, explicit return to the selected reported contact, display crop with correctly labelled vertical FOV, and same-contact A/B sensor-report comparison. Buttons support pointer operation; focused arrow keys use fine steps and Shift uses larger steps. Selecting another contact deliberately does not steer a manually scanning camera. Channel switches retain pointing. Normal report tracking remains the default.

The integrated task is inspect → capture A → observe/wait/change view → capture B → compare time-valid cues → return to the existing decision port. Comparison identifies changed cues and asks what remains unresolved. It does not infer an identity/response or count repeated reports as independent confirmation. This is **not** the proposed Level 4 evidence-request/delivery engine: existing sensors still sample according to their frozen rules, regardless of display pointing/crop.

Captures are clearly labelled **local ungraded reports**. They are not images, gaze recordings, accepted actions, server evidence, Fusion receipts or learning credit. They are not persisted/exported/synchronized or inserted into Ghost. RF/IFF have no separate sample timestamps in the current contract; none are invented. Completed AAR remains the existing server-verifiable record.

## Implementation

| Source | Implemented behavior |
|---|---|
| `client/src/OpticalStation.tsx` | Presentation controller, scoped notebook and comparison, focus/scroll/Escape handling. No action/network/storage/scoring APIs. One world remains mounted across phases. |
| `client/src/optical-station.ts` | Finite compass/pitch conversion with sensor-origin offsets; ownership-scoped aim; briefing/reference/preset exclusions. |
| `client/src/Scene.tsx` | Manual aim at unchanged sensor origin. Scoped actual displayed aim sampled at most 5 Hz into a ref, without per-frame React state updates. Manual view disables selected-airframe inset/cue marker. No new canvas/render pass. |
| `client/src/inquiry-evidence.ts` | Immutable five-channel whitelist; independent capture/report/sample times; future/malformed/contradictory payloads withheld; same-attempt/contact comparison. No Track/roster/reference-answer inputs. |
| `client/src/App.tsx` | Scope includes scenario, session, trainee and worker generation. Existing accepted-action/Fusion/server paths retained. No changing wrapper key; persistent Canvas preserved. Native XR keeps the existing cockpit. |
| `client/src/optical-station.css`, `main.tsx` | Scoped instrument/comparison composition before the existing premium import. No new dependencies/assets. |

[Active inquiry research](../../../competitive-research/ACTIVE-INQUIRY-NEXT.md) and [next-world research](../../../competitive-research/WORLD-NEXT-TECHNIQUES.md) distinguish implemented capabilities from staged/proposed architecture. Primary references informed independently authored design; they establish no VYUHA learning gains, physical fidelity or certification.

## Focused evidence

| Check | Result and scope |
|---|---|
| Projection/controller + live App lifetime/Fusion + visibility/scene compatibility | **62 passed, 0 failed**, 11.617949917 s. This combined run preceded final comparison focus/scroll correction. |
| Final changed comparison UI/focus | **7 passed, 0 failed**, 4.178084209 s. Includes one-world lifetime, owner isolation, lost-report manual entry, immutable comparison, keyboard, structural axe (contrast excluded in JSDOM), region focus and Escape return. Six cases overlap the earlier run. |
| Affected browser/XR observation/replay lifecycle | **5 passed, 0 failed**, 1.3502645 s. No physical headset qualification. |
| Sensor channel compatibility | Included above: **723 actual model reports** across availability/loss/day/night/fog. Four malformed-channel regressions reproduced before correction. |
| Types / changed-file lint / formatting | Passed. Capability registry validated14 capabilities /48 recommendations. |
| Full backend/frontend, build, Docker, historical campaign | Not repeated for this derived-client slice, per development testing policy. Engine/scoring/transport/history fixture files were unchanged. Full acceptance remains a frozen-release gate. |

**68 distinct targeted tests** were selected across these runs (62 + one new final UI case +5 XR), not a full-suite total. Repeats are not added. `ui-final.log` was interrupted after six successes during diagnosis of a missing focus binding; only `ui-final-corrected.log` closes that check. A TypeScript test-harness typo was fixed before the successful final type check. Earlier helper/UI logs remain development evidence.

## Independent critique and resolutions

Independent optics review identified manual-entry jumps from held/slewing views and contradictory channel descriptions. Manual entry now seeds from scoped displayed camera aim; malformed optical/radar payloads are withheld with regression fixtures. The root browser walkthrough found mobile comparison opening above the viewport; explicit region focus/nearest scrolling and Escape return now pass. These are scoped engineering reviews, not a product audit score.

## Actual browser workflow

Loopback development application, disposable QA database, synthetic callsign ACADEMY-BROWSER:

- Restored a queued drill twice. Each restore started with a fresh local notebook/manual view.
- Selected T2, used focused keyboard pan, reacquired its report and switched EO/IR while manually scanning. Manual mode did not display an off-axis close-up.
- Final-source capture A:45.27 s; EO/IR sample45.20, radar sample45.00. Capture B:56.30 s; optical sample56.30, radar sample56.00. A stayed unchanged. Comparison showed11.03 s and the IR-level change. RF/IFF sample times stayed unrecorded.
- Returned to the original decision port; explicit type/identity choices and designation45.57/classification56.13 were accepted. The drill completed naturally at90.00 and Ghost displayed **Server verified**. Its0/100 result reflects missed/incorrect synthetic decisions; this verifies the workflow, not expert reasoning or learning.
- Pan/capture were absent from the two accepted training actions. Local notebook disappears on completion/review and does not rewrite the authoritative record.
- Responsive geometry: desktop1280×720, tablet820×900 and phone390×844 CSS pixels. Body matched viewport; comparison had no horizontal overflow. Mobile opening focused the named region with its heading visible. IAB retained90% zoom (DPR0.9); viewport overrides obtained these CSS dimensions. This is **not a 100%-zoom or physical-device qualification**. Native Codex controls were unavailable to automation; no security workaround was used.

Final-source screenshots have `final-` names in `evidence/`; initial/intermediate captures are retained separately. Browser/performance source receipts are sealed alongside this document.

## Limits and next work

The live investigation is browser-only; XR retains its native flow. Local captures intentionally do not survive modality/page/session replacement. No physical headset, phone, native-platform, trusted separate-device HTTPS or WAN test occurred. No participant learning, calibrated confidence or sensor-fidelity claim is made.

The next major graphics dependency is an authored world with a public configuration-derived observation envelope and task-aware image qualification. Research found that fixed1700m flat terrain and default inspection IFOV/haze are not a proof for every supported long-range custom configuration. This is a source-level invariant gap, not a reproduced failure of every current scene. The staged envelope helper and earlier renderer-readiness work remain unpromoted support prototypes. Neither is a shipped world transformation.

## Matched performance observation

One20-second fixed-Medium200-contact retained urban/day/trainee-camera pair in the same IAB at1280×720CSS/DPR0.9: baseline91ac28d and candidate7729c40 both60medianFPS. Baseline worker median/p95 were0.600/3.100ms; candidate0.500/0.900ms. Both delivered599/599 timings, retained200contacts, had0visibility interruptions/clock drops and no measurement issue. Raw samples and matching settings are retained. Worker differences are not attributed to this UI/renderer change; no general speedup claim. This benchmark has no manual/compare controls active and does not qualify their latency or close-up/headset/frame-tail/cold-start/memory behavior. It is not matched to earlier Chrome/DPR2 results.

The archived baseline has no Git/venv metadata, so its raw build-provenance fields remain honestly unavailable. Its full source archive was independently hashed to93f5e36512c6c7e3abb0431357efdce38d4bff6456a63a43e314eadafd7d8ad2. An initial duplicate-React issue in the shared-cache temporary Vite harness was corrected with an isolated cache/resolver before measuring; no application defect/fix is claimed. Candidate raw JSON self-identifies clean7729c40/55bbb4f source.

The final UI workflows used full source hashd3be70b; subsequent capability-registry metadata changes produced55bbb4f. All browser implementation files were unchanged and are byte-identical to7729c40. This mapping is explicit; unchanged valid evidence is reused rather than relabelled as a new whole-system run.
