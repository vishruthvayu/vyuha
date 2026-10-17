# Takeover audit — scope and evidence

Runtime source: `5d40a24165dff5ace27c6131318da599ad828b0d`.
This is a drill-track audit supplement, not a new certification of all 211 historical
requirements. The 211-row reconciliation remains 93 verified, 71 partial, 29 deferred,
17 externally blocked and 1 not applicable. Main Codex must reconcile it against the
combined source. No physical or scientific acceptance gate is closed by a UI fix.

## Reproduced findings closed in the takeover

| ID | Requirement / reproduced defect | Implementation | Verification | Status |
|---|---|---|---|---|
| T01 | An older action receipt must not settle a newer same-contact request | App request sequence matched to worker request_id | Actual-worker rapid-payload test; mounted App older accepted/rejected receipt tests | VERIFIED COMPLETE |
| T02 | Pause/end races must settle feedback explicitly | Worker paused/ended rejection, App reason text | Actual-worker accepted/rejected scope/order cases; saved records exclude request metadata | VERIFIED COMPLETE |
| T03 | AAR event button accessible names must include visible content | Ghost native text labels, decorative chevron hidden | Frozen desktop/phone axe, timeline tests | VERIFIED COMPLETE |
| T04 | Phone keyboard focus must clear sticky app header | Drill scroll padding | Actual keyboard/focus scan and pixel review | VERIFIED COMPLETE |
| T05 | Accepted keyboard actions must lead to the next decision step | Labelled group focus handoff | Five mounted focus regressions; actual keyboard walkthrough | VERIFIED COMPLETE |
| T06 | Phone close-up must leave main crosshair unobstructed | Responsive InspectionPass painted size; unchanged sensor sampling | Five geometry/sample checks, current live images and independent pixels | VERIFIED COMPLETE |
| T07 | Phone fog/recovery footer must contribute its wrapped height | Intrinsic toolbar height and scoped badge width | Eight-width hit-test and real 2D/3D clicks; independent pixels | VERIFIED COMPLETE |
| T08 | Range/unit must remain together on narrow inset caption | Nonbreaking range/unit separator | Final active phone/desktop close-up captures | VERIFIED COMPLETE |
| T09 | Preparation disclaimer must not collide with live-only captions | Hide bottom live captions when preparation overlay exists | Actual phone capture, DOM visibility/overflow check and independent pixels | VERIFIED COMPLETE |
| T10 | Wrapped stale reports must remain within contact rows | Prevent flex row shrinking in scrollable roster | Eight-width labelled synthetic fixture plus actual neutralised-contact frame; independent pixels | VERIFIED COMPLETE |

These are ten findings in this continuation, not ten automatically closed rows in
an older requirement spreadsheet. The original developer's earlier visual fixes
and scientific model claims are assessed separately in the report/provenance docs.

## Independent review

The safety review reproduced T01/T02 against the actual worker/App path. It also
checked bounded observed-pose retention, stale-scope handling, renderer field
stripping and observation-gated inspection. No reproduced hidden-truth leak was
reported in that reviewed scope. This is not a formal proof of the entire engine.

The pixel reviewer identified T06/T07 and independently closed them against new
images. Fresh full walkthroughs identified T09/T10; a second read-only pixel pass
confirmed corrected preparation and both synthetic/actual stale rows. Ten world
frames showed no additional major clipping/artifact identifiable from stills.
These reviews deliberately do not infer runtime performance from screenshots.

## Preserved boundaries

- Server tree is byte-identical to the common integration base; no backend scoring,
  schema, authentication, authorization or stored reference was modified here.
- Worker receipt metadata remains outside authoritative Action records. Scope and
  order isolation remain tested.
- Rendering uses reported observation fields; shared generic multirotor identity,
  bounded pose interpolation and sensor-resolution limits remain covered by tests.
- Assets remain original or CC0, locally bundled, with licences in production assets.
- Hardening's broader backend/security/offline evidence belongs to its own branch;
  it is not substituted for merged-source acceptance.

## Remaining work / limitations

| Area | Status | Reason / required work |
|---|---|---|
| Combined-source acceptance | PARTIAL | Branches individually validated; owner must merge and repeat full acceptance |
| Current graphics matrix / stability | PARTIAL |36-cell matrix,4 repeats,180-second run and12-cycle soak recorded; rare long frames and modest soak heap/program growth prevent a blanket stability sign-off |
| Rare long-frame intervals | PARTIAL | Current shared-Intel runs include 116.7/216.7/200 ms stalls despite 60 FPS medians; retain raw results, affected cells were repeated without long frames; validate on the reference device; no cause or resolution is asserted |
| Architecture and landscape realism | PARTIAL | More credible than baseline; rectangular distant massing, repetitive windows, flat in-range terrain and faceted distant hills remain |
| Physical M1, Windows, Android and separate-device LAN HTTPS/WAN-off | EXTERNALLY BLOCKED | No such physical acceptance performed on this source; Linux software/headless GPU checks do not establish a physical user walkthrough; use existing platform runbooks |
| Full screen-reader audit | NOT IMPLEMENTED in this workstream | Keyboard, axe and manual pixel checks do not replace it |
| Thermal radiometry and empirical training improvement | EXTERNALLY BLOCKED | Illustrative models need subject-matter and empirical validation |
| Private 18/22-session historical databases | EXTERNALLY BLOCKED | Not present here; owner must supply records for original stored-data reruns |
| Release candidate / stable release | NOT APPLICABLE to this developer | Explicitly retained by integration owner |
