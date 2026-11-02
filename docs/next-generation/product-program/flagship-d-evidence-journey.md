# Flagship D: longitudinal evidence journey v1

The Academy observation path now connects verified mission evidence to a reviewable next exercise. It uses the existing authored mission compilers and frozen assessment contracts; it creates no scoring or mastery engine.

## Working learner behavior

- Academy shows four individual competency lanes. Select a lane to inspect its latest assessable practice and independent result separately, then expand the underlying versioned observations.
- Each source links to the existing personal Ghost session and displays exact decision ID, logical tick/order, frozen scenario ID, mission/criterion version, site, and reconstructed report hash. These are session review links; they do not promise automatic decision seeking.
- The proposed exercise explains its intent, source observations, template-context coverage, frozen contract/site, and reproducible seed. Expand selection to inspect every eligible candidate and its deterministic rank.
- Supported practice never clears a prior independent finding. A newer supported independent observation can supersede an older practice gap for next-task selection while preserving both records.
- Missing and unassessable observations are distinct from unsupported decisions. Unassessable sessions remain in history and never erase earlier assessable evidence.
- Exercise preparation follows the existing `mission_template`/`mission_mode`/`mission_version`/`mission_site` path and original compiler/brief. No exercise auto-starts and no historical report is rewritten.

## Contract and policy

`GET /api/v1/observation-learning/trainees/{trainee}/journey` is attached to the existing router. `observation-journey-v1` and `longitudinal-evidence-policy-v1` are separate from unchanged `evidence-assessment-v1/v2` and existing progression/follow_up APIs.

The read-only query selects at most 32 own completed authored-mission sessions, ordered by completion timestamp (creation timestamp fallback for legacy records) and session ID descending. Each source retains its original `created_at`, nullable `completed_at`, effective `evidence_at`, and `evidence_time_source`; the ordering rule is disclosed in the response and UI. It returns total/included counts and a truncation flag. Active, queued, unrelated-engine sessions and Crew aggregate owners are excluded/rejected. Existing cached authoritative reconstruction generates every included report; persisted scores/profiles are untouched.

Each competency retains the latest assessable observation in each mode plus all bounded source observations. Candidate priority, lowest first:

1. Unresolved latest independent evidence without later supported practice.
2. Latest practice gap, unless newer independent evidence has superseded it.
3. No assessable independent evidence and no supported practice ready for separate sampling.
4. Supported practice followed by a proposed independent sampling opportunity.
5. Another scenario-bound opportunity when available evidence is supported.

Within one priority, ranking prefers a context without previous supported evidence, fewer prior attempts, then a documented stable competency/template order. The context key is deliberately conservative: template + mission version + site. Seed changes and authored parameter variations do not create independent contexts. Distinct context counts are descriptive; they do not prove transfer, retention or independent demonstrations.

The latest completed session's mission contract and authored site are retained. With no history, cold start uses mission-v3/Freight Corridor. New seeds skip all seeds in the bounded history and wrap within the existing uint32 compiler contract. Repeated contexts are explicitly labeled repetition once preferred alternatives are exhausted. The policy does not allocate a calibrated assessment form or infer readiness.

## Focused behavior comparison

Synthetic fixtures are software-policy evidence, not participant results.

| Fixture | Existing frozen `follow_up` | Longitudinal policy |
| --- | --- | --- |
| Civil-restraint declaration with unsupported affiliation | C02 → civil restraint again | Same C02 need; selects an uncovered eligible template, preserving original report hash |
| New supported practice after unresolved independent C02 | Per-session follow-up cannot retain both mode histories | Independent finding remains visible; next C02 candidate requests separate independent sampling |
| New supported independent result after old unsupported practice | Single-session follow-up has no cross-session recency rule | Older practice remains inspectable but does not reopen the resolved selection gap |
| Same template/site/version with changed seeds | Follow-up changes seed without diversity accounting | One context; repeated seeds do not become independent demonstrations |

This is a deterministic explainable heuristic, not an ML learning-state estimate. No human learning efficacy, calibrated difficulty or mastery claim is made.

## Verification

Focused Python tests cover mode separation, immutable input, exact provenance, unassessable history, site/version handoff (v1/v2/v3), deterministic ties, seed collision/wrap, baseline follow-up comparison, API learner isolation, no writes, and Crew rejection. Existing frozen assessment tests provide affected compatibility coverage.

Focused client tests cover stale and wrong-identity responses, independent-mode intent, exact source metadata and Ghost links, bounded-history disclosure, and learner-switch isolation. The existing learning-v1 Academy harness explicitly isolates the nested observation endpoints so its request-index assertions still exercise curriculum preparation rather than unrelated child fetches.

Physical human learning outcomes and browser visual acceptance are separate: no participant study is claimed. Root performs the connected browser review and screenshots.

## Visibility and evidence limits

This route retains the existing trusted-LAN personal trainee-ID visibility boundary used by progression and personal Ghost. A trainee ID is not authenticated identity. It introduces no global/cohort listing, instructor-only rehearsal data, canonical contact truth or raw sensor stream. Only the own bounded reconstructed assessment references/criteria already reviewable through personal Ghost are returned. Shared Crew aggregate ownership is rejected through the existing `is_shared_owner` helper.

Reconstructed availability does not establish attention, gaze, noticing, understanding or cognitive reliance. Practice and independent status are scenario-bound observations, not certification, readiness or mastery. Differing criterion versions remain attached to their sources; counts do not establish equivalent difficulty or historical score comparability. Older history outside the 32-session window can change what this bounded policy recommends and is disclosed as truncation.

### Recorded targeted result

Final owned-slice verification against the integrated worktree:

- `.venv/bin/python -m pytest server/tests/test_observation_journey.py -q -p no:cacheprovider`: **11 passed**. Only the existing Starlette/httpx deprecation warning was emitted.
- `node --import tsx --test src/observation-journey.test.tsx src/learning-journey.test.tsx src/academy-journey.test.tsx`: **12 passed**, including both Academy preparation and expanded longitudinal-panel axe audits.
- ESLint over Academy, ObservationMissionJourney, CompetencyEvidenceJourney, learning-journey and their affected tests: **passed**, zero warnings.
- Existing frozen observation-assessment compatibility tests: **13 passed** in the earlier combined targeted run. That run initially exposed a missing required designation in the new baseline-comparison fixture; the fixture was corrected and all 11 new tests passed on the final run.
- No-write TypeScript validation reported no D-slice diagnostics; its initial integrated run was blocked by the separately owned graphics fixture's shader-parameter typing. Root owns the final integrated type/build gate.

No full suite was run by this workstream. Browser screenshots, responsive visual acceptance and physical-headset checks are not claimed by these unit/DOM checks.


### Completion-time recency correction

A previously assigned or paused mission can finish after a newer-created mission. Evidence recency therefore uses `completed_at`, falling back to `created_at` only for legacy records without a completion timestamp; session ID breaks ties deterministically. The window is selected using that order before aggregation. Original timestamps and the effective timestamp/source remain inspectable in each frozen source receipt. No assessment, score, profile or stored timestamp is rewritten by this read-only view.

A parametrized database fixture covers both practice and independent modes with creation and completion orders deliberately reversed, plus a legacy null-completion record between them. It asserts source selection, policy provenance, effective recency, disclosed fallback and unchanged database rows.

Completion-time refinement verification: all **13** backend journey tests passed, including the two real-database recency cases. The tests load the staged policy against the integrated server/router/storage implementation. The pre-existing frozen assessment/scoring contracts remain unchanged.
