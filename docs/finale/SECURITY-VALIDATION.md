# Security validation — in progress

Officer passwords are provisioned interactively; salts/hashes use PBKDF2-HMAC-SHA256 with 600,000 iterations. Credentials live under the ignored data directory by default, with POSIX mode 0600. No password is embedded in source. Bearer tokens are random, stored only as server hashes, expire after eight hours and are revocable; process restart invalidates sessions. Sign-in attempts are rate-limited and session/attempt tables are bounded.

No auth cookie is issued, so cross-site requests do not gain ambient officer credentials. CORS only allows configured local development origins and explicitly permits Authorization; same-origin production requests use bearer authorization. HTTPS remains required for network confidentiality. Local CA/SAN generation has been verified on Mac; trust installation is device-specific, and Windows private-key/credential ACL verification remains pending.

Negative tests cover unauthenticated/forged officer requests, protected authoring/transfer/group routes, no credential cookie, expiry, logout, password hashing/file mode, rate limits and preservation of logical database state. The historical regression fixture signs in using an ephemeral generated test credential; negative security tests deliberately remain unauthenticated.

Crew roles now use hashed, session-scoped capability codes and a server-owned exercise ledger. Crew archives have no runtime permissions or individual learning credit. Independent trainee identities still use trusted callsign/UUID capabilities, not identity-proof accounts. Replay rejects forged numeric scores and impossible actions, but does not attest a named human or authentic wall times. This is not production penetration-test or operational security certification.

Actual local HTTPS service verification passed on12 October using a dedicated test CA and both hostname/IP SANs. Untrusted trust was rejected; TLS verification was never disabled. Browser/device trust and Windows ACL/native execution remain pending.
