# Portable transfer correctness — finale candidate

The v1.0.1 browser defect was reproduced with actual API exports from a disposable database containing an ordinary reconstructed tactical session, a recognition session and a recording. No private training history was read or modified.

## Reproduction and result

The pre-fix export returned HTTP 200. Sending the untouched original JSON returned HTTP 200 (`skipped_sessions: 2`). Passing that same export through standard JavaScript `JSON.parse` then `JSON.stringify` returned **HTTP 422**, with the exact response:

```json
{"detail":"Bundle integrity check failed; no data imported"}
```

Python HMAC input retained integral floating point values such as `9.0` in SQLite-derived Beta profiles. The browser's export/download/import path serialized the same JSON number as `9`. The original signature therefore no longer matched despite the training data remaining numerically unchanged. The before and after receipts are `transfer-reproduction-before.json` and `transfer-reproduction-after.json` in this folder.

New exports declare `canonicalization: "vyuha-json-number-v2"`. Signing and verification normalize integral floating point values and negative zero, sort object keys and reject non-finite numbers or integers beyond JavaScript's exact safe range. Strings and booleans retain distinct types. The version is included in the signed byte domain. This is a documented VYUHA canonical format, not a claim of RFC 8785 compliance.

After the fix the same ordinary JavaScript round trip returns HTTP 200, with `inserted_sessions: 0`, `skipped_sessions: 2`. A clean destination also imports both sessions and reconstructs profiles; repeating the import does not duplicate outcomes.

## Historical bundles

Unversioned historical signatures still use the original direct digest algorithm. The upload validates JSON locally, then sends the original text unchanged through the shared API error/timeout/authentication path. Thus genuine original legacy files remain verifiable. A legacy file already rewritten by the old browser may have a broken signature: its HMAC cannot be recovered without its signing key and original numeric representation. The UI directs users to the original file or a current re-export. Verification is never bypassed and supplied signatures are never silently rewritten.

## Safety checks retained

The tests exercise wrong keys, modified unsigned payloads, unknown canonicalization, duplicate session IDs, malformed payload/schema, signed but incorrect score/reconstruction, invalid command history, rapid evidence/summary, scenario version conflicts, atomic rollback and idempotent imports. Existing historical reconstruction checks remain unchanged. HMAC attests integrity under a shared key, not donor identity or genuine trainee conduct.

Validation scope: programmatic real API operations and the browser's exact JSON number conversion on macOS. This is not a new physical LAN, Windows, Linux or human training certification. Final browser UI evidence and all-suite receipts belong to the overall candidate validation.

## Frozen Finale history

Version 2 snapshots require the exact `vyuha-0.4.0` engine and sensor markers, a full bounded sensor configuration, typed contact motion and expiry, complete versioned threat/effector configurations, bounded terrain geometry, frozen doctrine, wave membership and reconstructable response-window metadata. The raid feature signature, fingerprint and content hash are checked. Unknown fields and future engine markers are rejected rather than accepted through an untyped escape. Completion and observation horizons must agree with the frozen 60–180 second scenario duration. Historical version 1 engines continue their original reconstruction path.

The real 180-second API round trip exercised accepted trainee events beyond tick 2250, exact reconstructed scores/AAR/actions, the 5400-tick horizon, a fresh receiving database, idempotent repetition and a forwarded export. Ordinary JavaScript number conversion is checked using actual SQLite REAL posterior values, not a fabricated payload. Mixed historical and Finale records use their own engine markers.

Director v2 metadata is also typed and freezes the selection evidence. Its installation-local HMAC owner binding survives transfer; direct trainee identifiers can be pseudonymized without breaking the scenario content hash or allowing equal-prior trainees to share an owner-bound scenario. Selection snapshots exclude raw session identifiers and dates. The preserved binding is a stable pseudonymous link, not an anonymity guarantee or an assertion that the donor's history is authentic.

The focused Finale suite uses temporary databases only. It checks integrity/schema/score/config/motion/fingerprint/horizon rejection and atomic rollback; results are recorded in `TRANSFER-FINALE-RECEIPT.json`. This receipt does not replace the overall release regression or the pending physical deployment checks.

Focused Finale result: **30 passed, 0 failed** across the 24-case base run and six Director-bound cases. See the focused receipt for selections, durations and validation scope.
