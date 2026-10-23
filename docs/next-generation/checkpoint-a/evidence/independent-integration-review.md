# Integrated-source review — 23 October 2026

Read-only review of current uncommitted `feature/vyuha-next-generation` source
above HEAD `7379f771ef1c1620147ee1b958a8a243628cf65f`. Files were changing during
review; this is not a final frozen-source acceptance. No source edits, full suites,
production build or performance workload were run by this reviewer.

Independence: registry/proof download, controlled lifecycle and benchmark report
changes were reviewed independently of their authorship. R43 was **self-review**
because this reviewer authored that slice. Browser execution/visual acceptance is
outside this source review.

## Actionable findings

| Severity / status | Finding and exact source | Evidence / remedy |
|---|---|---|
| P2 — reported, root has implemented fix; regression pending in root | Valid uint32 protocol seeds overflowed practice seeds. `server/controlled_study.py`, `ProtocolRequest.seed` accepts up to 4294967295; `prepare_phase` formerly added practice ordinal without bounding before `PrepareLearning`. Seeds max/max-1/max-2 eventually raised uncaught validation errors after valid enrollment/baseline. | Root replaced derivation with modulo 2^32 at current line170, added hash-covered `seed_schedule` for new v2 protocols and reports three boundary workflow regressions underway. I verified the replacement in current source, not the regression execution. Existing stored protocols/scores must remain unchanged. |
| P2 — open at review time | Prepared registered-attempt link is bound to the currently joined identity rather than the participant who owns the returned preparation. `client/src/ControlledStudy.tsx:480`–484 sets `ready.trainee=identity?.trainee_id`; lines496–508 compare that same value and expose the link. Selecting another participant's Prepare button therefore presents an unlaunchable link as ready. | Isolated temporary DB/function reproduction: prepare baseline for P02/JOINED-B while UI identity is JOINED-A. Preparation response lacks owner field; `learning.get_preparation(ticket, JOINED-A)` returns404 while JOINED-B succeeds. Receipt: `/private/tmp/vyuha-independent-review-owner.json`. Return actual owner in protected report/preparation metadata, bind readiness to that owner and show explicit switch-identity guidance or disable the link for mismatch. Add two-participant owner regression. This is fail-closed functionality/UX, not an authorization bypass or evidence contamination. |

The separate ordinary `Evaluation.tsx` identity race is assigned to another agent;
it was not counted as this reviewer's discovery or duplicate work.

## Reviewed without further blocker findings

- `server/capabilities.py`: contiguous extension IDs preserve R01–R40; cycles and
  unsupported states fail validation. Receipt freshness compares runtime hash;
  historical passes remain historical. Public proof URLs resolve receipt-indexed
  artifacts, verify bytes and constrain resolved paths to repository docs. No
  arbitrary request-supplied filesystem path or new authorization bypass found.
- `client/src/CapabilityRegistry.tsx` and `Compliance.tsx`: downloadable artifact
  links retain scope/revision/limitations; roadmap count no longer hardcodes40.
  Partial/planned implementation is not displayed as accepted functionality.
- Controlled lifecycle: append-only terminal dispositions, transaction-scoped
  preparation/launch checks and allowed completion of pre-existing sessions are
  consistent with the documented policy. Export retains dispositions and missing
  outcomes; ordinary training transfer does not claim to transfer consent.
- `client/src/Benchmark.tsx`: schema6 adds source/run-start viewport; full receipt
  serialization is suspended during measurement. Current labels distinguish
  synthetic workloads, advancing/retained contacts, GPU/worker heap limits,
  auto-quality and incomplete timing. No measured startup/smoothness improvement
  follows merely from this serialization change; exact-source trial reruns remain
  necessary. Run-start viewport is explicitly that, not proof of fixed size
  throughout a run.
- R43 self-review: router is registered before main's catch-all; prefix middleware
  and route dependency protect it. Explicit run, bounded seed, no DB/cache writes,
  observation-only projection and stale-response guards are preserved. It remains
  one C01 passive-window diagnostic with proposed thresholds, not grading,
  classification support, human solvability, calibration or learning efficacy.

This report does not close Checkpoint A, all R43, physical acceptance or the full
R01–R48 backlog. Final combined regression and actual browser verification must
follow the last integrated source modification.
