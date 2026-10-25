# Active inquiry: from passive sensor labels to an investigation station

Research and bounded implementation: 25 October 2026. Starting runtime is the
completed Training Ground milestone `0ad89f4`; evidence seal `91ac28d`.
This extends the current station, not the completed Academy or Reconstruction
Theatre. The helper below is staged candidate code until integrated acceptance
is recorded by the owning workstream.

## Actual current baseline and selected capability

`SensorObservation` already separates EO, IR, radar, RF and IFF. Optical and
radar channels have sample ticks; RF/IFF only have the enclosing report tick.
`FusionPanel` already uses a training-only heuristic and records advice exposure
separately from accepted actions. Do not make another type classifier or claim
that a new graphic improves the sensor model.

The useful next task is **inspect → capture → compare → articulate what remains
unknown** in the live station. A trainee can hold two same-contact observation
moments side by side while the simulation continues. Explicit report/sample
ages prevent a visually synchronized layout from implying synchronized samples.
Manual optical pointing and contact cueing can make this a coherent observation
workspace; a separate notebook panel alone is a smaller improvement.

This can be a Level 3 subsystem/user-experience upgrade. It is **not** the Level 4
active-evidence engine: pinning an already available report does not request a
new measurement, consume an inquiry budget or alter authoritative observation
availability. That future contract still requires new version-dispatched engine,
accepted-command, replay, Crew, browser/XR and offline semantics together.

## New external evidence and what is actually transferable

| Primary source, inspected 25 October 2026                                                                                                                                                               | Supported design inference                                                                                                                                                                                               | Limits                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [NASA Human Integration Design Handbook / Crew Interfaces §10.2.1](https://www.nasa.gov/reference/10-0-crew-interfaces-vol-2/) and [display appendix](https://www.nasa.gov/reference/appendix-f-vol-2/) | NASA requires visible indication of stale, missing, unavailable or unknown data; operators also need continuing time/system context. Preserve those distinctions at each channel, not only in a global connection badge. | NASA's spaceflight requirements do not certify this training product. Exact VYUHA data-age semantics come from its own model.  |
| [W3C PROV-DM Recommendation](https://www.w3.org/TR/prov-dm/)                                                                                                                                            | Provenance distinguishes entities, activities and their creation/usage time. A locally pinned observation should retain its source/report/sample boundary rather than being relabeled with click time.                   | No RDF dependency or PROV conformance is claimed. The local projection is not a signed or server-verified record.              |
| [Holmes, Wieman & Bonn, Teaching Critical Thinking, 2015](https://arxiv.org/abs/1508.04870), authors' primary manuscript, [published DOI](https://doi.org/10.1073/pnas.1505329112)                      | The physics-laboratory intervention practiced comparisons between data and models, acting on those comparisons and fading prompts. This motivates explicit comparison questions and a later unassisted task.             | Its setting and reported outcomes do not transfer to VYUHA automatically. No VYUHA learning-effect claim follows from this UI. |
| [National Academies, How People Learn II, Summary](https://www.nationalacademies.org/read/24783/chapter/2)                                                                                              | The synthesis supports learner-directed goals, targeted feedback and metacognitive support, and assessment grounded in explicit learning models. Make the unknown/question visible before another suggestion.            | A local two-capture comparison is not competency evidence or a validated assessment.                                           |

No source code, vendor artwork, aircraft assets or licensed assessment content
was copied. These references inform independently authored interaction and
contracts.

## Implemented candidate contract

`client/src/inquiry-evidence.ts` accepts an `InquiryContext` containing the
current attempt scope, selected reported contact and capture tick, plus a
`SensorObservation`. It deliberately cannot accept a `Track`, scenario roster,
reference answer, scorecard or Fusion hypothesis.

- `captureInquiryMoment(context, observation)` rejects missing, invalid,
  future-envelope and wrong-contact reports. Output contains only five
  whitelisted channel readings and time context. It copies no raw positions,
  hidden labels, registration identifier, RF band/bearing or extra properties.
- Optical/radar missing sample times remain undated; future/invalid samples
  produce a withheld invalid reading. An unavailable channel cannot leak a
  contradictory payload. Detection alone cannot inherit a recognizable shape.
- RF/IFF retain `sampleTick: null`. Their report ages are separate; the code
  does not invent a sample time or infer a hostile label from silence/no reply.
- Captures and channel rows are frozen independent copies. Later live updates
  cannot rewrite an earlier capture.
- `compareInquiryMoments(a, b)` refuses a different attempt/contact, orders
  captures chronologically and distinguishes changed cues, unchanged cues and
  incomparable undated/invalid data. Changed timestamps alone are not a new
  independent vote. Prompts ask what changed and remains unresolved.

The helper's context is **not an authorization proof**. `SensorObservation`
contains no session ID. The application controller must supply only the report
from the current correlated session/worker generation and invalidate captures
when the attempt changes; passing an old report with a new caller-supplied scope
cannot be detected by this pure helper. Persisting notebook captures into
training evidence would need a separate versioned server verification contract.
For this slice they remain local ungraded observations and must be labeled so.

## Focused tests and acceptance handoff

Staged helper tests: **15 passed, zero failed**, 334.396833 ms. Tests cover
separate capture/report/sample ages, extra-property stripping, future and
wrong-contact refusal, unavailable/missing/invalid channels, no detection-shape
leak, immutable copies, cross-attempt comparison rejection, chronological
selection order, duplicate/correlated samples and no inference of scoring/type
correctness. Follow-up review reproduced four failing integrity cases before
correction: positive optical cues without finite positions, inconsistent
silhouette/level, radar confirmation without position/detected agreement and
radar lifecycle/freshness contradictions. A compatibility test then accepted
723 current modeled sensor reports across day/night/fog and sensor-availability
transitions. Strict scoped TypeScript also passed. This is helper evidence, not
integrated application acceptance.

Owning integration must test the complete task through the real station:

1. Capture two current reported observations, switch channel/contact, compare
   the original pair without moving its times or rewriting its values.
2. Keep earlier sample ages visible while the simulation moves; lost/missing
   evidence cannot be relabeled fresh. Distinguish no-detection from unavailable.
3. Start a new attempt, restore/replace an exercise, change role or return from
   XR. Captures from another attempt must not be shown as current-session data.
4. Verify keyboard, pointer, reduced-motion and small-screen operation. No new
   sensor input can dispatch a classification/response or mutate Fusion receipts.
5. Retain current scoring/replay contracts. No full engine regression is needed
   for a derived-only UI, but affected live/session lifecycle tests are essential.

Benchmark only if the renderer changes; this bounded text projection performs
no scene rendering, loading, sensor simulation or background frame work.

## Next research experiment, not an implemented capability

Use matched, synthetic observation cases with the same visible prefix. Ask the
learner to state which proposition is unresolved, choose a useful available
cross-check or explain why it cannot settle the question, then face a changed-
surface independent case. Predeclare evidence-location correctness, wrong-time
inference, unjustified certainty and unnecessary checks. Begin with a developer
usability task, then controlled participant evaluation; do not turn preference,
click count or a synthetic score into a learning-gain claim.

Future accepted evidence requests require a versioned timing/role/idempotency
contract and must remain distinct from these ungraded local captures.
