# Analytics investigation context

This milestone continues the corrected premium UI. It changes only Analytics, its scoped phone table styles and navigation regressions. No live-drill, root-token, simulation, scoring or authorization code changes.

## Behavior

Analytics links accept `unit`, `trainee`, `sessionA` and `sessionB` query parameters. The existing view hash and unrelated query parameters remain intact. Explicit selection pushes a browser-history entry; Back, Forward and reload recover the requested context. Omitted session parameters retain the existing latest-pair defaults; an explicitly empty parameter stays unselected. Changing trainee or unit resets the pair to those defaults.

A linked trainee is checked against the selected unit's returned roster before fetching their history. Unavailable linked trainees receive a recovery message rather than silently displaying another trainee. Missing linked sessions remain unselected. Session comparison explains whether more completed sessions or simply a selection is needed. The scenario-skill view waits for an available selected trainee instead of temporarily rendering an aggregate as individual evidence. Loaded history is keyed by unit and trainee; old responses cannot replace the current context. These UI checks supplement the unchanged server officer authorization.

At phone widths the comparison table fits Metric, A, B and B − A together. Its full descriptive column name remains available to assistive technology. Original values and differences are unchanged. Desktop retains the existing premium hierarchy and table composition. No new dependencies or motion effects were added.

## Verification and visual refinement

- Full frontend: 300 passed, including parity. Ten Analytics navigation tests cover existing view links plus six new deep-link, traversal, missing-record and delayed-response cases. Existing regressions were retained; an interim header-copy regression was caught and corrected.
- Lint, configured formatting and production build pass. Offline asset manifest has 36 local URLs. Analytics chunk is 19.75 kB / 6.22 kB gzip versus the prior 18.04 / 5.73 kB. This is asset size, not an application-readiness benchmark.
- Actual Chromium application at eight widths: 360, 390, 428, 768, 1024, 1280, 1440 and 1920, device scale 1, default zoom. Initial phone review exposed a horizontally scrolling comparison; the second visual pass fits all values and fixes the broken difference heading. `comparison-360-before-fit.png` preserves that intermediate state.
- Fixture-backed checks explicitly label synthetic data and intercept API responses; they establish UI behavior only. Production checks use the real local server with five synthetic no-action sessions and no API interception. Both record eight axe scans with zero reported violations and no document overflow. Incomplete checks remain in receipts; this is not a screen-reader audit.
- Real-server checks make no write requests while browsing. Two trainee analytics payloads and all five AAR payloads hash identically before and after. Server-authoritative zero scores were retained, not beautified.

[Browser fixture receipt](analytics-context/browser-receipt.json), [real API receipt](analytics-context/live-api-receipt.json), [phone screenshot](analytics-context/live-comparison-360.png), [desktop screenshot](analytics-context/live-comparison-1440.png), [full frontend log](analytics-context/frontend-tests.txt), [build log](analytics-context/build.txt).

## Integration and limits

Main Codex owns merging and release preparation. Preserve the premium stylesheet entrypoint and scoped styles. The Analytics URL parameters are a UI selection contract, not access credentials; normal officer authentication remains required when opening a shared link. IDs appear in browser history, consistent with existing session review links. No secrets, private sessions or source databases are included in screenshots or receipts.

The drill branch was fetched at `6c4518c5dcff14582c368fc3d487ad42b3e0324a` during this continuation and was not merged. No readiness claim is made for that tip. Protected drill files still match the integration base. Audit inventory totals remain inherited and unchanged: 211 entries, 93 verified, 71 partial, 29 deferred, 17 externally blocked and 1 not applicable. This milestone does not close unrelated audit requirements.

Physical-device/network acceptance, private historical scorecard databases, independent combined-source review, user visual acceptance and release-candidate preparation remain with the integration process. These records certify this scoped checkpoint only.
