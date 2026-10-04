# VYUHA v1.0.1 final software validation

Validated UTC: 2026-10-04T10:34:10.214072+00:00. Release branch: `release/v1.0.1`. Source lineage: sealed v1.0.0 `14a38ad9f8dd6d895f87fd568f0c5865b727e3a4` → competitive polish `20e8642782cd13cf6779e5ebd650c2f55c851b37` → navigation implementation `b88faa92b8455708a98b05723939168e0207d8ee` → documentation-only final seal commit. The exact final commit, annotated tag object and remote refs are recorded after publishing in `/Users/seemalanaveenyadav/Desktop/SIH/vyuha/outputs/release-v1.0.1/FINAL-RELEASE-RECEIPT.md` and `release-receipt.json`; keeping the post-tag receipt outside Git avoids a circular commit reference or changes to the sealed source.

Source-tree SHA256: `cd48ae78643b2862b69dd82161aa0d717a50af03e072d524a03017df7177f4c2`. Runtime evidence reports a matching source hash. Metadata is separately fixed by the tagged Git commit.

## Actual executed regression

- Backend: **139 passed**, one existing Starlette/httpx deprecation warning, 12.38 seconds. [backend.txt](backend.txt).
- Frontend: **64 passed**, zero failing/skipped, 5026.153917 ms. [frontend.txt](frontend.txt).
- Parity: **312 checkpoints**, actually executed by npm test: original 51, Director 72, advanced 135, rural 54. Five cross-language tests include original and commanded cases, all current Director templates, advanced pack/tactic fixtures and rural/fog/recorded observations. Counts derived from current seed/tick arrays and fresh fixture outputs, not old manifests. [parity.json](parity.json).
- Production: TypeScript/Vite/offline build **passed**, 4.92 seconds; **23 local cached assets**, fingerprint `1ee85a2f1bdb`. Existing 899.30 kB shared 3D chunk warning retained. [build.txt](build.txt).
- History: **18/18 baseline** exact unchanged subset and **21/21 current** completed cards/AAR/Ghost/profile/heatmap compatibility on a disposable SQLite backup. Immutable stored fields unchanged; private raw data remains ignored. [history.json](history.json). Reproduction: `.venv/bin/python docs/qa-navigation/check-history.py` with the existing ignored databases.

Commands: repository `.venv/bin/python -m pytest server/tests -q`; client `npm test`, then `npm run build`. No test removed or skipped. Source code/dependencies and protected tactical files unchanged. Sealed v1.0.0 submission media, screenshots and release manifest unchanged. [validation.json](validation.json) and [claim audit](CLAIM-AUDIT.md).

## Final UI-only walkthrough

Entered only local/Unit app-root origins; all feature paths then reached through visible UI. Training ground → After-action review → Rapid ID → Adaptive Director → Unit training overview → Instructor console → Training analytics → Exercise studio → Recorded practice → Data transfer → System evidence. Canonical `/unit` also reached from instructor. Evaluation protocol through Rapid ID; Device benchmark through Evidence; Operator guide in both modes and mobile. Refresh and Back/Forward passed for all main entries in both modes and both secondary pages in local mode. Expected page/parent aria-current observed. No console runtime errors. [browser-walkthrough.json](browser-walkthrough.json).

Desktop 1440 × 900; tablet 900 × 800 with 235 px labelled drawer; mobile 360 × 500: all eleven main choices reachable by keyboard, correct active labels, drawer closes, no horizontal overflow. Short drawer scroll height 622 vs client 332, scrollTop 290; Operator guide remains reachable. Shift+Tab wraps within guide; Escape returns to Toggle navigation. Disposable release-QA identity only; no physical device, participant study or private-history mutation. [mobile-navigation.png](mobile-navigation.png).

Eleven canonical frontend pages: nine NAVIGATED (`/`, `/rapid-id`, `/unit`, `/instructor`, `/analytics`, `/exercises`, `/recorded`, `/transfer`, `/system/evidence`); two SECONDARY_REACHABLE (`/evaluation`, `/system/benchmark`). No hidden normal frontend workflow. Framework API docs/assets remain technical infrastructure. Full inventory: [ROUTE-MATRIX.md](../qa-navigation/ROUTE-MATRIX.md).

Affected metadata checks: two existing manifest-precedence/staleness tests passed after the documentation update; actual HTTP evidence/health requests in both modes returned the current matching source and permanent WAN limitation. The visible refreshed Evidence page also displayed 64 frontend tests and the exact limitation. [metadata-tests.txt](metadata-tests.txt), [metadata-validation.json](metadata-validation.json), [system-evidence.png](system-evidence.png).

## Provenance, source instructions and freeze

Necessary final changes are documentation/evidence only: refresh the served manifest so its 64-test software source is current, preserve historical measurements explicitly, and point recording instructions to v1.0.1. The long demo source is `release/v1.0.1` / `v1.0.1`; obtain the exact final commit from the external seal receipt or `git rev-list -n 1 v1.0.1`. Original short-video storyline/media remain historical. No PPT, PDF, long/short video or submission ZIP regenerated. External knowledge-transfer receives a short release addendum, keeping its inspected candidate provenance.

Freeze after verified publication: no features, UI redesign or tactical/database changes. A critical blocker requires a new commit, full regression and an explicit patch-release decision; never retag the sealed release.

## Limitations

Physical WAN-off/LAN-on: **NOT PERFORMED BEFORE SUBMISSION**. Required physical/network setup unavailable during final validation window. Known validation limitation, not a failed architectural test. No other mandatory software release check waived.

Dedicated physical WAN-off/LAN-on validation was not completed before submission. Multi-device LAN operation, local asset serving, process-outage recovery and queued-event resynchronization were validated separately.

All other material limitations are retained in [CLAIM-AUDIT.md](CLAIM-AUDIT.md) and the served evidence manifest. Old performance/device/network/media/deployment records are historical, not new v1.0.1 measurements.
