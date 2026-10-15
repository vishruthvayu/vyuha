# Owned-interface startup follow-up — 15 October 2026

**STARTUP-LAN-02 is fixed in the reviewed working source.** Exact three-file hashes are in `OWNED-INTERFACE-FOLLOWUP.json`; base commit remains `ad04797deee0ea74270c5cdc220d42957ac5e16c`. Root owns the next full-source hash, final regression and commit.

Independent local probes now reject all six occupied combinations: wildcard, localhost and the workstation's owned LAN IPv4, each with reuse off/on. The stronger coexistence reproduction still demonstrates that manually bypassing preflight allows a specifically-bound listener and wildcard listener to coexist and sends the LAN connection to the pre-existing service; the repaired preflight now rejects that state before startup. The original two missed LAN cases remain preserved in the earlier receipt.

Independently ran **10 targeted tests /0 failures /3 deselected in1.68s**: occupied-listener cases, five active-HTTP immediate restart cycles for each of three hosts and the expanded owned-address parser fixture. No heavy suite or browser run was performed.

Source inspection confirms POSIX reuse and bind-plus-listen behavior remain intact, with no SO_REUSEPORT. Windows exclusive handling is unchanged. The helper defaults retain private candidate-URL filtering; only the explicit preflight-owned-address mode includes nonprivate and link-local addresses. The parser reads local-address fields rather than broadcast fields and excludes loopback/unspecified/multicast/all-host broadcast. Deduplication prevents redundant probes. No outer UI source was modified by this follow-up.

No further reproduced blocker was found in this scoped review. Enumeration remains best effort and preflight does not reserve a port after closing the probes; network-interface changes and ordinary bind races remain practical limitations rather than promises of universal detection. Native Windows/Linux/phone execution is not established here. Final root-owned exact-source suites, actual process recovery, clean clone, friend integration and physical acceptance remain separate gates. No whole-product numerical score is assigned.
