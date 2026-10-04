# VYUHA navigation/discoverability audit

## Repository

Date: 2026-10-04. Branch: `fix/navigation-discoverability`, created from exact competitive-polish parent `20e8642782cd13cf6779e5ebd650c2f55c851b37`. This is a focused frontend navigation fix. The sealed v1.0.0 object/peeled commit remain unchanged; no v1.0.1 tag or release was created. The audit is committed locally; it is not a claim that GitHub has this new branch.

Changed implementation: App, Unit UI wrappers, main entry, scoped styles, Recorded/Transfer headings; new routes, typed renderer map, shared Navigation, extracted OperatorGuide and navigation tests. Operator docs: README, UNIT-MODE and STAGE-6-HARDENING. Evidence/check tooling lives in this directory. No dependencies, schema, API, simulation/scoring/Director/Ghost/reconstruction/worker code changed. Exact protected-file comparison: [architecture-preservation.json](architecture-preservation.json).

## Files changed

- `README.md`
- `client/src/App.tsx`
- `client/src/Navigation.tsx`
- `client/src/OperatorGuide.tsx`
- `client/src/Recorded.tsx`
- `client/src/RoutePages.tsx`
- `client/src/Transfer.tsx`
- `client/src/Unit.tsx`
- `client/src/main.tsx`
- `client/src/navigation.test.tsx`
- `client/src/routes.ts`
- `client/src/style.css`
- `docs/STAGE-6-HARDENING.md`
- `docs/UNIT-MODE.md`
- `docs/qa-navigation/NAVIGATION-AUDIT.md`
- `docs/qa-navigation/ROUTE-MATRIX.md`
- `docs/qa-navigation/architecture-preservation.json`
- `docs/qa-navigation/backend.txt`
- `docs/qa-navigation/browser-walkthrough.json`
- `docs/qa-navigation/build.txt`
- `docs/qa-navigation/check-history.py`
- `docs/qa-navigation/desktop-transfer.png`
- `docs/qa-navigation/frontend.txt`
- `docs/qa-navigation/history.json`
- `docs/qa-navigation/mobile-transfer.png`
- `docs/qa-navigation/regression.json`

## Complete route inventory

See [ROUTE-MATRIX.md](ROUTE-MATRIX.md) for all eleven canonical pages, component/title/purpose/audience/status, before/after links, prerequisites, embedded views and technical routes. Nine pages belong to main navigation; two are secondary. All intended user-facing pages now have a natural UI path.

## Bugs found and fixes

1. **Data transfer and Recorded practice were missing from the sidebar.** Both existed and had Instructor header links, so neither was strictly manual-only. They were poorly discoverable from the training workspace. Added Data / operations → Data transfer and Exercises → Recorded practice, with existing icon/style conventions.
2. **Top-level pages lacked persistent shared navigation.** Their ad hoc header links did not expose the whole product, current workflow or Operator guide. Added the same small Navigation component and contextual breadcrumb to every page, loading state and join screen.
3. **Root views were state-only; internal review selections were not consistently refreshable.** Added `view=aar` and `view=unit` aliases, retained existing adaptive/session URLs, synchronized internal view changes, and made history selection push a distinct review URL. Popstate reloads the chosen session safely, cancels obsolete requests, resets replay playback, and returns to parent history. Training clears stale session parameters.
4. **Unknown URLs silently rendered Training ground.** Replaced the fallback with a client Page not found and usable return link; normalize only trailing slashes. No valid page path removed, no guessed nested routes or prefix matching.
5. **Narrow sidebar hid text and Operator guide; long navigation had no scroll region.** Added labelled Toggle navigation, current-page label, a scrollable drawer, close/backdrop/Escape, keyboard focus handling and a visible guide. Kept desktop design language. Short 360 × 500 and 900 × 800 views do not create horizontal overflow.
6. **Active state and naming drifted across pages/embedded modes.** Centralized canonical routes and nav policy; active pages use `aria-current=page`, secondary tools highlight their parent with `location`. Transfer/Recorded headings now match their main entries. Retained “Unit training overview” rather than an unsupported readiness label.
7. **Brand was a dead `#` link and Instructor forced a new tab.** Brand now returns home; main navigation follows normal same-tab anchors while native modifier/new-tab behavior remains available.
8. **Route and navigation definitions could drift silently.** Added a small typed registry/renderer map and eleven focused frontend tests. No external router or large routing rewrite.

Existing embedded Unit navigation still stays inside App so its worker/session state is retained. A paused synthetic drill → Unit overview → Back returned to the same paused exercise; it completed and produced a server-verified refreshable AAR. Separate top-level pages retain their existing full-page navigation/recovery behavior; this fix does not make them persist a live worker across documents.

## Intentionally hidden routes

No normal frontend page is hidden or manual-only. Informal evaluation is intentionally secondary through Rapid ID → Evaluation protocol; engineering benchmark through System evidence → Device benchmark. Both are browser validated and retain parent highlighting. Framework `/docs`, `/redoc`, `/openapi.json`, `/docs/oauth2-redirect` remain outside product navigation because they are developer/API infrastructure. API endpoints/static files are not pages. No deprecated or callback product path was found.

## Final navigation structure

- Workspace: Training ground; After-action review; Rapid ID; Adaptive Director.
- Unit: Unit training overview; Instructor console; Training analytics.
- Exercises: Exercise studio; Recorded practice.
- Data / operations: Data transfer.
- System / evidence: System evidence.
- Separate button: Operator guide.

The menu has eleven unique anchors across five groups. Review and Director select existing embedded views; Unit also stays embedded when clicked inside App. There is no duplicate benchmark/evaluation/debug entry.

## Tests

Baseline was 139 backend / 53 frontend / 312 parity. Final frontend is **64 passed**, including **11 new navigation tests**, zero skipped/failing; all **312** tactical checkpoints are still exercised (51 original + 72 Director + 135 advanced + 54 rural). Backend **139 passed**, one existing Starlette/httpx deprecation warning. TypeScript/Vite production build passed; **23 locally cached assets**, fingerprint `1ee85a2f1bdb`. Existing 899.30 kB shared 3D chunk warning remains.

Receipts: [backend.txt](backend.txt), [frontend.txt](frontend.txt), [build.txt](build.txt), [regression.json](regression.json), [browser-walkthrough.json](browser-walkthrough.json).

Commands from repository: `.venv/bin/python -m pytest server/tests -q`; from client: `npm test`, `npm run build`. Tests use disposable databases. Actual start-local/start-unit scripts were also exercised with disposable ports/databases; final browser checks used fresh loopback origins serving the final production build to avoid treating a stale PWA cache as the new bundle.

Historical compatibility: the original 18 completed records are an exact unchanged subset of the current 21 (three additional legitimate completions). On a disposable SQLite backup, all **18/18 baseline** and **21/21 current** verified stored cards, AAR/Ghost timelines, four-skill profiles and heatmap inclusion were readable; immutable stored fields matched before/after. No history was restored, removed or rewritten. Aggregate-only [history.json](history.json); reproducible local-only [check-history.py](check-history.py) requires the ignored production and Stage 5 baseline databases. No private raw history enters Git.

## Browser and final UI-only walkthrough

Final built script: `index-CcqsOdFC.js`. Each of all eleven canonical pages was directly loaded and refreshed in both local and Unit Mode, then checked through Back/Forward: **22 route/mode checks**, no blank page, expected heading and one correct current navigation item. Main workflow links were clicked from home without any typed route during the final workflow sequence: Training ground → After-action review → Rapid ID → Adaptive Director → Instructor console → Training analytics → Exercise studio → Recorded practice → Data transfer → System evidence → Device benchmark; then Unit training overview → Rapid ID → Evaluation protocol → Operator guide. Unit overview was also exercised from inside App during the paused-drill/history checks. This proves `/transfer` is reached by UI, not address-bar entry.

Safe data: one disposable NAV-QA identity, two early-ended synthetic drills across this audit to populate review/history and prove worker retention. Zero score is expected when ending without trainee decisions; these are navigation fixtures, not learner/efficacy evidence. No evaluation agreement or human study was created. Recorded import/transfer forms were checked for navigation and clear prerequisites, not used to change private data.

Secondary details: verified Unit history selection, refresh, parent Back and detail Forward; AAR embedded Ghost/replay; existing analytics scenario × skill section. Unit join/gateway is navigable. Unknown `/unit-other` shows Page not found and returns home. Operator guide keyboard Shift+Tab wraps to Ready to train; Escape restores Toggle navigation when its former drawer button is hidden. Primary mobile links were keyboard-activated at actual **360 × 500**; all eleven choices closed the drawer and produced no horizontal overflow. Data transfer is accessible at the bottom of the scrollable drawer. Tablet actual **900 × 800**: 235 px labelled drawer, 632 px navigation region, no overflow. Desktop actual **1440 × 900**. No console errors were captured during final browser checks.

Screenshots: [desktop-transfer.png](desktop-transfer.png), [mobile-transfer.png](mobile-transfer.png). The mobile screenshot intentionally shows the short drawer scrolled to Data transfer and the reachable Operator guide.

## Performance / regressions

No fresh FPS or field-performance claim is made from a navigation audit. Existing 30 Hz worker, rendering-quality rules and parity behavior are unchanged byte for byte. Build passes with the existing large 3D chunk warning. Added shell/guide code is shared and page components remain lazy except Unit's previously shared import. The source manifest correctly reports changed source: older competitive-polish counts/FPS remain historical. This QA directory supplies current navigation regression evidence; it does not restamp release evidence or certify a new release.

## Remaining issues and limitations

No intended frontend page remains manual-only. Developer/API documentation is intentionally direct-access infrastructure. No live transfer without its shared key, recording playback without data, pilot creation without participant agreement, or operational authentication/efficacy claim is implied by page-navigation validation.

Physical multi-device LAN training was validated previously. Runtime assets and services are hosted locally; dedicated WAN-disconnected physical validation remains pending. Physical WAN disconnected + LAN retained + separate physical trainee device: **NOT PERFORMED BEFORE SUBMISSION**. Reason: **Required physical/network setup unavailable during final validation window.** This is a known validation limitation, not a failed architectural test.

Dedicated physical WAN-off/LAN-on validation was not completed before submission. Multi-device LAN operation, local asset serving, process-outage recovery and queued-event resynchronization were validated separately.

The final browser work is loopback navigation QA, not another physical-device or WAN test. The sealed release, old submission PDF/video and existing measured evidence are untouched. A future release must separately package/revalidate this branch before claiming its old release artifacts include the navigation fix.

## Final verdict

NAVIGATION AUDIT COMPLETE — ALL INTENDED USER-FACING PAGES DISCOVERABLE
