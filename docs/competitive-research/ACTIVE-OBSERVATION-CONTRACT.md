# Active observation: the next authoritative training contract

Research handoff, 26 October 2026. Inspected baseline: `56baab6` on
`feature/vyuha-next-generation`; Optical Station runtime `7729c40`, configured
optics runtime `ab92f69`. This is a **proposed contract, not implemented engine
functionality**. It narrows the next active-evidence slice rather than repeating
the completed scanning / A/B capture work or competitive inventory. No engine,
scoring, action schema or historical fixture was changed for this research.

## Actual source findings

| Source | Verified source behavior | Consequence |
| --- | --- | --- |
| `client/src/sim.ts`, `server/engine.py` | Explicit v0.4/schema-2 dispatch versus frozen legacy paths; unknown versions fail closed. | Request-gated observations require a new opt-in dispatch. `vyuha-0.5.0` below is a proposed identifier, not registered software. |
| `client/src/sim-v2.ts`, `server/engine_v2.py` | `observe()` automatically samples every track. Accepted trainee actions are designate/classify/engage. First modeled visibility supplies detection timing. | A report pin or camera control cannot become an acquisition event by relabeling it. Gating changes admissibility, timing and potentially review/scoring. |
| `client/src/sensors-v2.ts`, `server/config/sensors-v2.json` | Seeded channel draws, cadence, availability, LOS, range and resolution-shaped probabilities exist. Radar/optical have sample ticks; RF/IFF do not. | Version scheduling/release and any new timing fields. Never infer RF/IFF sample time from report tick. |
| `client/src/sim.worker.ts` | 30 Hz logical time; decisions and instructor commands share tick/order. Request IDs are transport metadata. Hidden tabs suspend local time. | Acquisition joins one ordered history with scoped acknowledgments; wall-clock dwell breaks replay and outage recovery. |
| `client/src/action-evidence.ts`, `client/src/types.ts` | Fusion evidence associates to dispatched decisions through correlated accepted/rejected results. | Query/result IDs must be distinct; later advice must not attach retroactively. |
| `server/crew.py`, `server/crew_metrics.py` | Server-owned Crew clock, durable paused restart, expiring/revocable role capabilities and attribution. Creation explicitly permits v0.4 library raids. | New-engine Crew admission is an implementation task, not automatic compatibility. Inquiry success never becomes shared individual mastery. |
| `client/src/finale-parity.test.ts` | Existing parity checks 544 checkpoints across 32 v0.4 scenarios, including a pre-action same-tick boundary. | Keep unchanged and add separate new-engine schedule/result fixtures. Old sensor tests alone do not validate request timing. |

An additional frozen-model caveat matters: `configuredOpticalObservation()`
computes the track geometry/probability at the supplied tick, but quantizes the
random-draw key and reported `sample_tick` to optical cadence. It does not store
a frozen optical position from that earlier cadence tick. New requests must
therefore either align the actual sampling tick to the cadence or use a new
versioned snapshot policy; do not call the old helper at arbitrary completion
time and claim its older timestamp proves that geometry was sampled then.
Preserve the old behavior in old replay rather than correcting it retroactively.

These are static source findings, not newly executed test results.

## New primary evidence and bounded inference

| Primary source inspected | Finding used | Design inference and limit |
| --- | --- | --- |
| [Petitet et al., The computational cost of active information sampling before decision-making under uncertainty, Nature Human Behaviour (2021)](https://www.nature.com/articles/s41562-021-01116-6) | The authors study information seeking under time/economic constraints and effort-related trade-offs. | Make acquisition alternatives and time/opportunity cost visible. This does not establish VYUHA-optimal dwell/budget, a diagnostic score or learning gains. No experimental parameter is copied. |
| [W3C PROV-DM Recommendation](https://www.w3.org/TR/prov-dm/) | Separates entities, activities, generation, use and attribution; data must exist before use. | Link immutable results to accepted requests, sample/release boundaries and decisions. Conceptual mapping only; no RDF/PROV conformance or cryptographic assurance. |

Earlier inquiry research already covered NASA stale-data guidance and
comparison-based reflection. Those conclusions remain useful, not new research.
The contribution here is a concrete contract grounded in current source seams.

## Selected vertical slice

Create opt-in **evidence-acquisition exercises** with passive radar discovery
and trainee-requested EO/IR cross-checks on an already reported contact. A useful
case presents radar with insufficient identity evidence, EO unavailable at
night, and IR that may return none/detection/recognizable shape. A second case
changes the surface and evidence conditions so memorized button sequences fail.

The task loop is **state the unresolved proposition → request a cross-check →
wait logical time → inspect the returned report and age → decide or retain
uncertainty → review the causal history**. Manual pointing/display FOV remains
presentation; it cannot improve IFOV/range/probability or task priority.

Start with two channels and one shared simulated optical task slot. Do not add
RF request semantics until its sampling/age contract exists. Do not query
arbitrary hidden IDs, coordinates or canonical identity. This is an educational
simulator, without a real sensor/control interface or operational tactic.

## Proposed versioned rules

1. **Frozen scenario policy:** a new schema/engine identifier and
   `acquisition_policy` version/hash define permitted channels, positive integer
   dwell ticks, capacity, cooldown, expiry and event limits. Values are explicit
   illustrative settings, not empirical calibration. Old scenarios keep old
   observation and score behavior.
2. **Accepted intent:** proposed `inspect` event carries accepted tick/order,
   observed contact alias, channel and stable event ID. Server owns actor/session
   authorization; clients cannot overwrite accepted tick/order/actor. Transport
   deduplication ID, authoritative event ID and returned result ID are distinct.
3. **Eligibility from the observed prefix:** accept only a current/retained
   reported contact under the frozen age policy. One general unavailable/stale
   rejection must not reveal whether a guessed hidden ID exists. Historical
   detection cannot grant indefinite request eligibility.
4. **No early result:** accepted query reserves the slot.
   `eligible_tick = accepted_tick + dwell_ticks`; if reusing the frozen
   cadence-shaped sensor helper, choose the first cadence-aligned sample tick
   at or after `eligible_tick`. Sample at that logical tick
   under then-current environment/LOS/active state. If publication latency
   differs, `released_tick >= sample_tick`. Pauses and outage wall time add
   nothing; restart preserves remaining logical dwell.
5. **One frozen draw:** seed by scenario, stable track index, channel and sample
   tick. New IDs/click counts cannot reroll the same sample. Same channel/track/
   cadence slot returns the same result or rejects as duplicate. No query
   guarantees recognition; no reply is never proof of hostile identity.
6. **Explicit failure:** result may be unavailable, absent, detection-only or
   recognizable shape. Define channel failure, LOS loss, departure and exercise
   ending before release. An accepted attempt is not a successful observation.
   No hidden position or shape in an absent/unavailable result.
7. **Immutable entity:** result has version/policy, IDs, channel,
   accepted/sample/released ticks, age/expiry, sanitized reading and reason.
   Later live updates cannot mutate it. Actor/session association is verified
   outside client payloads; a hash alone does not authorize evidence.
8. **Total order:** at a tick, finish scheduled releases before externally
   accepted events, identically in both engines. Commands, requests and
   decisions retain unique increasing order. Prohibit zero dwell initially to
   avoid an ambiguous same-tick fault/sample. Cancel/early-end records the
   outcome without deleting accepted requests. Pre-decision Ghost includes only
   results released at that exact tick/order.
9. **Bounded work:** one slot, bounded histories, no per-frame requests or
   replay resampling loops. Capacity/cooldown rejection consumes no extra draw.
   Measure replay/scheduling cost before raising bounds.

Internal engine truth remains internal. Sanitized released results feed trainee
views, Crew, Fusion and review. This proposal does not claim current browser
snapshots are a hostile-client secrecy boundary.

## Integration requirements

| Surface | Work required before claiming support |
| --- | --- |
| Training / Optical Station | Explicit request, pending logical countdown, failure/expiry, immutable result and keyboard equivalent. Clearly separate from ungraded local A/B captures. Contact changes cannot redirect pending results. |
| Ghost / Theatre | Request, sample and release chapters; what was requested/obtained/available at each decision. Explain inadequate evidence. Truth stays post-review under the existing boundary. |
| Fusion | Only already released observations; dispatch-bound receipts. Acquisition failure does not imply identity. No new calibrated-confidence claim. |
| Crew / Instructor | Explicit spotter permission and attributed shared results; responder sees same report. Fault/pause order reconstructs identically. Revocation/reconnect cannot rewrite history or permit unauthorized queries. |
| VR | Same controller/IDs/semantics, readable pending state in both eyes; controller repeat and exit/re-entry cannot duplicate acquisition. No gaze-based assessment. |
| Recovery / Transfer | Intents, receipts, pending schedule, results and roles round-trip. Reconstruct results instead of trusting uploaded readings; reject mutated/foreign/duplicate links. |
| Academy / Assessment / Analytics | Practice availability/age/insufficiency; held-out evidence conditions. Begin with descriptive useful/missing/redundant checks. No query-count mastery, shared-score copying or retrospective conversion. |

Do not graft an abstention bonus onto the old total. A new rubric requires
explicit authored cases: was a useful cross-check obtainable before deadline,
what could it resolve, and what choices remained justified? Uncertainty and
more data are not universally correct. Keep descriptive inquiry metrics apart
from legacy scores until a new reviewed/versioned rubric exists.

## Focused acceptance gates

- **TS/Python parity:** accepted/rejected intents, schedules, result payloads,
  reasons and pre-decision boundaries for seeded day/night/fog, failed channel,
  authoritative occlusion, stale reports, expiry, pause, same-tick commands and
  early completion. Equal causal inputs must yield identical results.
- **Anti-reroll:** duplicate IDs, distinct IDs in same sample slot, spam,
  queue/cooldown limits, invalid/future ticks and channels. No extra draws.
- **Integrity:** hidden-ID guesses, extra truth fields, swapped ownership,
  future release, edited results and post-decision advice cannot enter evidence.
- **Lifecycle:** rapid selection, delayed receipts, exercise replacement,
  seek/restore, XR exit/re-entry and double submit retain correct ownership.
- **Crew/auth:** both roles, wrong role, expired/revoked code, restart,
  completed immutability and individual-profile isolation.
- **Offline/transfer:** accepted-once queued intent, preserved remaining dwell,
  regenerated result check, duplicate protection, unchanged originals.
- **Historical:** unchanged 18 baseline and 22 stored scorecards, original
  v0.4 parity plus new-engine fixtures. Shared-contract changes warrant affected
  compatibility suites; full regression remains a frozen-release gate.
- **Actual browser:** keyboard/mobile and browser/VR request→pending→result→
  decision→server-verified Ghost, including a no-evidence outcome. Emulator
  checks do not establish physical headset acceptance.
- **Performance:** matched contacts, request count, logical endpoint and replay
  workload. Retain slower results; no general speed or learning claim from one
  timing pair.

## Next dependency-ready work

Implement a pure scheduler plus cross-language fixtures, then one opt-in engine
and complete live-to-verified-Ghost slice. Do not expose a partial request UI in
ordinary v0.4 training. Add Crew/XR admission only after their gates; unavailable
modes need explicit labels, not passive-observation fallback.

Subsequent candidates: an authoring feasibility oracle for obtainable evidence
windows, and causal instructor rehearsals comparing fault timing. They are not
implemented here. Participant evaluation should predeclare wrong-time inference,
unjustified certainty, useful/redundant checks and delayed transfer on held-out
cases. No VYUHA learning gain, optimal policy or empirical calibration follows
from this research.
