# R43 bounded C01 observation-opportunity pilot

Copy these new files into the existing repository without changing other source:

| Staged path | Repository destination |
|---|---|
| `server/assessment_obligations.py` | `server/assessment_obligations.py` |
| `server/tests/test_assessment_obligations.py` | `server/tests/test_assessment_obligations.py` |
| `scripts/check_assessment_obligations.py` | `scripts/check_assessment_obligations.py` |
| `client/src/AssessmentDiagnostics.tsx` | `client/src/AssessmentDiagnostics.tsx` |
| `client/src/assessment-diagnostics.test.tsx` | `client/src/assessment-diagnostics.test.tsx` |

Apply `integration.patch` to register the router beside `controlled_study` in
`server/main.py` **before the final SPA/API catch-all**, and mount the diagnostic
inside `Evaluation.tsx`, keyed by its existing identity key. No learning.py or
ControlledStudy.tsx edit is required. Do not copy staging symlinks: only the five
regular files explicitly listed above and the two small integration edits.

The CLI and explicit officer-requested endpoint compile only
the existing frozen `C01_BASELINE-A_A`, seed 7 by default, through current learning
APIs, then runs the ordinary frozen engine with no actions and no database access.
Catalog SHA is explicitly pinned; any catalog change fails closed. `--seed` can
request another bounded seed, but it does not expand the curriculum scope.

`GET /api/v1/evaluations/assessment-diagnostics/c01?seed=7` is covered by existing
evaluations middleware and its own officer dependency. Missing/invalid/non-ASCII
authorization fails before computation. Invalid seeds return 422; frozen-catalog
drift returns 409. No startup auto-run or caching. The UI has explicit Run,
provenance/limits, error/retry and seed/context/unmount stale-response protection.

After copying, from repository root:

```sh
.venv/bin/python -m pytest server/tests/test_assessment_obligations.py -q
.venv/bin/python scripts/check_assessment_obligations.py
cd client
node --import tsx --test src/assessment-diagnostics.test.tsx
```

Staging validation used the existing repository Python/environment, appending
the staged server directory to `server.__path__`. No shared files were modified.
`targeted-tests.txt`: **27 passed in 9.95 seconds**. `frontend-targeted.txt`:
**5 DOM tests passed**. Prettier applied to both new TSX files. `pilot-report.json` contains
the actual report. The monitor sees 7,200 observation rows from one passive run;
its proposed minimum contiguous window is satisfied by T1 at ticks 60–74.

This is **not an acceptance of all R43, all assessments or Checkpoint A**. The
15-tick duration and 30-tick maximum sample age are explicit diagnostic proposals,
not established human perception limits, scoring changes or frozen assessment
requirements. The monitor confirms a narrow synthetic detection opportunity;
it establishes no classification/response opportunity, human solvability,
difficulty equivalence, empirical calibration, physical validity or learning gain.

Only delivered observation fields are projected: channel availability/signal,
sample time, finite observed position presence and an IFF ambiguity flag. Kind,
canonical identity, hidden coordinates, actions and score are not features. No
identity inference is made from no-reply. Missing frames break contiguous runs;
separate tracks cannot pool evidence; future samples/order violations fail closed;
stale samples do not count. Outputs include hashes of sanitized projections and
the compiled scenario, not the scenario answer key.

Actual negative mutation regressions operate on the real engine trace: remove
all channel availability; delay delivery by 31 ticks without refreshing samples;
truncate to fewer than 15 ticks. These all fail the proposed opportunity. Other
tests cover ambiguity, optical alternatives, duplicates/order, stale evidence,
bounds, catalog drift, immutability and deterministic reproduction.

Next slice after integrated browser verification: author a separate evidence
obligation for C02. Do not reuse detection presence as classification support.
Keep all original scorecards, catalog bytes and learning evidence unchanged.
