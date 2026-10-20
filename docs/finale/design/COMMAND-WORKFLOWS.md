# Command workflows — Ultimate experience candidate

This is a software UX improvement on the development branch. It does not
promote the candidate or extend physical platform acceptance.

## Changes and evidence boundaries

- Instructor sessions expose a pressed selection state. Live overview stays
  compact; teaching, injections, assignments and command history use native
  keyboard-operable disclosures. The existing request IDs, acknowledgement
  lifecycle and blocked-action reasons remain intact.
- White Cell shows a compact session overview and one selected detail. A
  controlled target missing from the feed gets an explicit unavailable message.
  It never substitutes a different trainee's picture while commands target the
  original session. Observed points still come exclusively from the server's
  observed picture; reference truth remains an explicit officer view.
- Crew identifies the member's server-issued callsign and role, explains the
  current handoff prerequisite, and retains the logical clock. Connection and
  officer setup are collapsed while joined. No current observation means no
  action eligibility; selecting a missing contact does not create evidence.
  Retained-request recovery, role epochs, revisions, attribution and the
  separation from individual learning profiles are unchanged.
- Raid Composer labels a previous configuration's result after any edit and
  disables inputs during compilation. Saving informs Exercise Studio, which
  inserts the frozen raid in the library immediately. A retained assignment
  prevents the callback from changing its selected exercise. Original API
  requests and frozen scenario metadata remain unchanged.
- Scenario library descriptions use available Finale metadata instead of
  printing missing legacy doctrine/version fields. Legacy authoring remains
  available under a disclosure, freezes controls while validating, and keeps
  its preview table inside a scrollable region.
- Crew history retains all persisted metrics and timeline information. Scope
  explanations are disclosed, and empty history has a concrete next action.

## Focused verification

`node --import tsx --test src/command-workflows.test.tsx src/crew.test.tsx
src/crew-recovery.test.tsx src/crew-lifetime.test.tsx src/white-cell.test.tsx`

Final focused run: **18 passed, 0 failed, 0 skipped**, 2502.329583 ms.
Five new cases cover the controlled White Cell target, stale/in-flight Composer
configuration and saved callback, immediate frozen-library integration, current-evidence Crew prerequisites, and
server-issued callsign/hidden-contact boundaries. Existing lifetime/recovery and
observation tests retain their assertions.

`npx tsc --noEmit --incremental false` and owned-file ESLint passed. The standard
tsx launcher could not bind its IPC socket in the child sandbox; Node's tsx
import executed the same test files. `tsc -b` could not write the shared
tsbuildinfo under the child's owned-file grant; nonincremental no-emit checking
passed instead. Parent performs production build and real browser acceptance.

## Shared design hooks

`command-workspace`, `command-overview`, `command-detail`, `command-lifecycle`,
`crew-role-banner`, `crew-handoff`, `composer-workbench`, `composer-preview`,
`composer-stale`, `evidence-disclosure`. Shared CSS belongs to the integration
owner. Composer fieldsets need a min-inline-size reset and their legends need a
full grid span. This workstream does not edit shared styles, App, navigation,
server code, simulation, scoring, or protected release refs.
