# Controlled pilot lifecycle and frozen analysis contract

This is software infrastructure for a controlled participant evaluation. Synthetic API tests, prepared exercises and generated evidence do not demonstrate human learning gains, form equivalence, adequate statistical power or operational readiness.

## Protocol compatibility

New protocols use `controlled-pilot-v2` and embed the frozen `controlled-analysis-v1` contract. The contract is included in the existing protocol SHA-256 calculation. It prespecifies the registered competency, primary baseline/immediate descriptive change, retention/transfer comparisons, eligible observation denominators, minimum exposure exclusions, available paired phases, missingness reporting, no imputation and no score-driven exclusion. Full versus faded guidance is the existing randomized contrast. This is not an adaptive-policy effectiveness study and does not calculate inferential statistics.

Stored `controlled-pilot-v1` protocol JSON, hashes, request bodies, participant allocation and phase evidence are not upgraded or rewritten. A retried original request returns its original protocol. The protocol report retains the stored version. Lifecycle records can also be added to a historical protocol without changing its frozen analysis contract or original hash.

## Officer API

`POST /api/v1/evaluations/controlled/{study}/participants/{participant}/dispositions`

Body:

```json
{
  "request_id": "officer-event-unique-id",
  "disposition": "withdrawn",
  "reason": "Participant withdrew from further pilot sessions"
}
```

`request_id` accepts 8–80 ASCII letters/digits/underscore/hyphen. `disposition` accepts only `withdrawn` or `dropout`. The reason accepts 1–400 characters, is trimmed and rejects blank values and control characters. A server UTC timestamp is authoritative; client-supplied time fields are rejected. Existing officer authentication protects all controlled-evaluation paths. It is the existing shared officer role, not attribution to an individual researcher account.

A successful response has the original three body fields plus `id` and `recorded_at`, status 201. Repeating an identical request returns the same immutable record and timestamp; a changed body or different participant with that request ID returns 409. New request IDs append records in insertion order. Both statuses remain terminal; later records cannot reactivate a participant. There are no edit/delete endpoints. Up to 100 records per participant bound accidental repeated entry. Reasons are officer-only evaluation data; use brief pseudonymous process explanations rather than medical or personal details.

`GET /api/v1/evaluations/controlled/{study}` adds, for each participant:

- `lifecycle_status`: `active`, `withdrawn` or `dropout` (last append-only event).
- `dispositions`: insertion-ordered records, each with `id`, `request_id`, `disposition`, `reason`, `recorded_at`.

The existing attempts, observed ticks, eligibility, original scorecard and competency evidence remain available.

## Enforcement and in-flight policy

A terminal disposition blocks all further registered phase preparation, including retries of a previously prepared phase. Controlled preparation, ticket creation and attempt mapping run inside one `BEGIN IMMEDIATE` transaction, serializing them with disposition writes.

A previously prepared but unstarted controlled ticket cannot create a new training session after a terminal disposition. This gate runs inside the existing session-creation write transaction; a rejected launch leaves no orphan session or learning attempt. Fetching a stored ticket remains possible for inspection and existing-session recovery.

An already-created active exercise may recover, record actions and complete normally after a terminal disposition. A lost initial create response may still recover its same active session through the existing idempotency behavior. Its score, learning evidence and original action history are retained; the pilot report labels the participant's disposition separately. Independent Academy training is not banned by leaving a particular protocol.

The software does not delete participant evidence on disposition, silently replace missing or short attempts, retroactively rewrite historical hashes, or claim that available participant data constitutes an ethical/legal research approval. Any separate retention or withdrawal-data policy must be decided before real participant enrollment.

## Verification scope

`server/tests/test_controlled_lifecycle.py` covers hash-covered new contracts, v1 byte/hash compatibility, both terminal dispositions, immutable retry/cross-participant conflicts, timestamp validation, reason bounds, authorization, no reactivation/edit/delete path, prepared-ticket launch rejection and rollback, independent Academy continuity, active-session recovery/completion preservation, and atomic preparation/mapping rollback.

The initial integrated targeted lifecycle/study/learning run passed 31 tests in 28.60 seconds. After explicit authentication and populated backup/restore tests were added, the same suite passed 33 tests in 34.85 seconds. The final run, including actual concurrent prepare/terminal, launch/terminal and duplicate-terminal API requests, passed **36 tests in 32.05 seconds**, with zero failures; its exact source-file hashes are recorded in the targeted receipt. These runs are synthetic software checks with zero participant outcomes. The existing Starlette/httpx deprecation warning is unchanged.

Integrated browser acceptance, the full final-source backend/frontend regression and a separate independent product review remain acceptance gates. No human learning or operational readiness result is included in this handoff.


Independent review found a uint32 seed overflow in accepted protocols at the upper seed boundary. Practice seeds now use `(registered seed + practice ordinal) modulo 2^32`; assessments retain the registered seed. The schedule is explicit in new v2 frozen protocols. Existing in-range derivations and previously stored preparation/scenario bytes remain unchanged. Previously overflowing phases could not successfully prepare, so no completed scorecards are reinterpreted. Three actual boundary protocol workflows cover all baseline/practice phases, retries and unchanged protocol hashes.
