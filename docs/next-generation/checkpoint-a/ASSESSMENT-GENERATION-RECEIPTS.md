# R06/R43 C01 bounded generation receipts

This implements the narrow generated-family receipt proposed in
[Continuation A](../../competitive-research/CONTINUATION-2026-10-23-A.md), above
the existing [C01 observation diagnostic](ASSESSMENT-OBLIGATIONS.md). The gap was
that one passing passive trace did not explain bounded candidate selection,
rejection, frozen assignments, preview overrides or exhausted generation.

The catalog, learning compiler, simulation, scoring and study allocation are
unchanged. This is an authoring diagnostic for the existing frozen
`C01_BASELINE-A_A` item, not an expanded item bank, learning preparation,
participant assignment or evidence of fairness. R06/R43 remain partial.

## Request and bounds

`GET /api/v1/evaluations/assessment-diagnostics/c01/generation?seed=7&max_attempts=2`
uses the existing officer-protected diagnostic router. No trainee endpoint or
UI is added. Invalid seeds/bounds return 422 before generation; frozen input
conflicts return 409. Authorization failures occur before generation. No DB,
score, preparation or study writes occur.

The outer attempt limit is 1–3, default 2. Candidate seeds are
`(seed + zero_based_attempt * 0x9E3779B9) modulo 2^32`; selection stops at the
first accepted candidate. Each request uses the existing compiler, whose
unchanged inner limit is 24 candidates per outer attempt. Each successful
compilation can supply exactly 7,200 passive observation rows for this frozen
60-second/four-contact item. Thus one uncached request runs at most three
passive traces and at most 72 existing compiler candidates. Normal acceptance
runs one trace. No arbitrary family, item, source scenario or observation
contract can be supplied through this route.

An in-process LRU retains at most eight generation results, keyed by seed,
outer bound, obligation and frozen-input JSON. Defensive copies prevent callers
from mutating cached results. Source/config drift is checked before cache use
and after computation; a computation with changed inputs cannot enter the
cache. This is a bounded cache, not a durable artifact store or rate limiter.

## What the receipt freezes

The `receipt` and `receipt_sha256` are deterministic for identical inputs.
Measured timings are outside this hash. The receipt records:

- Generation/content versions, the pinned catalog SHA, assessment mode,
  `study_mode: not-enrolled`, assistance and the proposed observation contract.
- SHA-256 hashes of the effective learning/generator/engine/sensor/helper source
  files and the threat/effector/sensor input files, plus Python/Pydantic versions.
  Source/config hashes are captured at module import; changed files require a
  process restart, avoiding a receipt that labels stale loaded code as new code.
- Requested and compiled seeds, public environmental/family assignments, an
  opaque hash of the frozen item scenario specification, the compiled scenario
  hash, and the existing compiler's rejected-candidate count.
- Each outer attempt's disposition/reasons, accepted/rejected counts and the
  accepted delivery manifest. The manifest contains frozen public item copy,
  mode/form/assistance, source identity and hashes. It excludes roster, canonical
  identities/kinds, hidden geometry, answer keys and scenario `mix`.

The input manifest identifies files needed for reproduction; it is not a
hermetic deployment bundle. The current compiler does not retain the individual
reasons for its internal 24-candidate search. Those reasons are not invented;
outer compiler failure and its bounded disposition are reported instead.

## Dispositions and failing mutations

An outer candidate is `invalid` for a compiler constraint failure, malformed
observation contract, absent time-valid passive window, delivery schema/copy
mismatch, or a known answer-cue field. These have separate reason codes. A
rejected candidate never returns its mutated content. Success is `valid` or
`valid-ambiguous`; the latter means the trace contains visible identity ambiguity
that this C01 detection contract permits. No-reply is not interpreted as hostile.
When no candidate succeeds within the declared bound, the receipt is
`generation-exhausted`; that alone is not proof of unsolvability.

The offline function also accepts the existing proposed `ObservationObligation`.
A minimum contiguous duration longer than its inclusive window is explicitly
`unsatisfiable-under-declared-window`, recorded as invalid attempts through the
declared bound without unnecessary engine execution. This finite contradiction
concerns the diagnostic obligation, not human solvability of the original item.
The public route uses the default frozen obligation.

Known structured cue fields such as `answer_key`, `expected_action` and `hint`
are rejected, and changes to frozen public copy are rejected. This is a schema
and exact-copy check, **not semantic answer-leak detection in the original
catalog prose**. Missing evidence is tested separately from leaked cue fields.

Optional `preview_seed=91` separately compiles an author-only fixed preview.
Its assignment/hash are returned under `preview`, explicitly marked as having
no observation-validity evaluation. This seed never enters delivery candidate
selection, the accepted delivery manifest or the deterministic receipt hash.
Successful preview compilation is not evidence that delivery generation passes.

## Targeted evidence, 23 October 2026

Validation used the existing repository virtual environment and a staged module
overlay because the agent lacked direct checkout write permission. The first
combined run of new generation tests and existing obligation tests passed
**48 tests in 80.40 s**. After distinguishing compiler/observation failures and
hardening concurrent cache insertion, **5 affected tests passed in 15.61 s**;
these include two additional tests, for 50 distinct tests covered across the
runs. No broad suite was run. The existing Starlette/httpx deprecation warning
remained. Coverage includes uncached deterministic reproduction, preview
isolation, bounded exhaustion, precise failing mutations, immutable inputs,
cache isolation/drift, officer authorization, route bounds and zero DB mutation.

The final source's declared offline seed list `[0, 7, 19]`, outer bound 2,
accepted 3 candidates, rejected 0 outer candidates and exhausted 0 requests.
Each accepted candidate had 7,200 observation rows and `valid-ambiguous` status.
Compiler-plus-monitor wall times were approximately 1.169, 0.961 and 2.170 s;
nearest-rank p95 and maximum were both 2.170 s. These are three descriptive
engineering timings under current machine load, not a performance guarantee or
item-difficulty measurement. Timings are not part of the receipt hash.

| Seed | Deterministic receipt SHA-256 |
|---|---|
| 0 | `ead2b88cae3a73fe4b9e14584bc547d5f0d5e155e09554afa40e4fb94489c8b6` |
| 7 | `aa47a1be352350a8f2a5be141ba98ae67118326235cae286a044c57785928ceb` |
| 19 | `873b668d46299a2a7e27c157770cbc234cf0624dbfe09c9ddda549c3d68740db` |

After integration, targeted commands from repository root are:

```sh
.venv/bin/python -m pytest server/tests/test_assessment_generation.py server/tests/test_assessment_obligations.py -q
.venv/bin/python -c 'import json; from server.assessment_obligations import generation_seed_report; print(json.dumps(generation_seed_report(), indent=2))'
```

Human solvability, classification/response opportunity, semantic novelty,
difficulty equivalence, empirical fairness, participant learning benefit and
semantic cues in frozen prose remain explicitly **not evaluated**. A passive
trace without the proposed window does not establish that all possible action
policies fail. There is no new competency credit, engine behavior or claim of
calibrated assessment quality.
