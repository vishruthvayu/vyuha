# Controlled pilot lifecycle focused security review

This is an author-performed focused review of the integrated backend change. It is not an independent external audit or a final whole-product security sign-off.

| Area | Finding | Evidence |
|---|---|---|
| Officer authorization | New disposition writes and protocol preparation remain under the existing protected `/api/v1/evaluations/` prefix. Missing and invalid bearer tokens are rejected before request-body validation. | `server/auth.py:protected`, `test_new_lifecycle_routes_authenticate_before_body_validation`, `test_disposition_authorization_participant_scope_and_immutable_request_owner` |
| Scope and input handling | The participant must belong to the addressed study. All dynamic SQL values use bound parameters. Strict request bodies reject forged timestamps and unsupported status changes. Reason size/control characters and request IDs are bounded. | `record_disposition`, request-validation tests |
| Idempotency and append-only behavior | Same request and normalized body recover the same record/time. Cross-participant or changed-body reuse is rejected. New IDs append; no edit/delete/active status is exposed. A 100-event bound limits accidental flooding. | Immutable retry, scope, cap, and concurrent-identical-disposition tests |
| Preparation/withdrawal race | Ticket preparation and protocol attempt mapping share one SQLite write transaction with terminal-state validation. A failed mapping stage rolls back the ticket. | `prepare_phase`, `prepare_in_transaction`, atomic rollback and concurrent preparation tests |
| Launch/withdrawal race | The terminal check runs inside the existing session-creation transaction. Whichever write acquires the lock first determines whether a session already exists; no new session appears after a terminal state wins the lock. | `learning.attach`, concurrent launch/terminal and prepared-ticket rejection tests |
| In-flight preservation | Existing active-session recovery/completion is intentionally permitted; no completed scorecard, learning context, evidence or action history is deleted or revised. | Active recovery/completion and original AAR equality test |
| Historical protocol compatibility | New analysis contracts apply to new v2 protocols. Stored v1 protocol bytes/hash and request retries remain unchanged. | Legacy v1 byte/hash test |
| Durability | Online backup and explicit restore preserve populated protocol, participant, attempt, terminal history and learning evidence tables. Restored lifecycle gates still reject a withdrawn unstarted ticket. | Populated backup/restore test |

No reproduced release-blocking defect was found in this focused pass. The existing trust limits remain explicit: joined trainee IDs are local LAN identifiers, the officer credential represents a shared role, and append-only applies to application operations rather than protection against an administrator editing SQLite files. No encryption, tamper-proof research record, individual researcher attribution, participant efficacy result or final-source platform certification is claimed.

The frozen descriptive analysis/exclusion contract is implemented metadata. A complete computed statistical analysis interface, empirical form equivalence, participant evaluation and an adaptive-policy-versus-baseline efficacy comparison are not implemented by this patch.
