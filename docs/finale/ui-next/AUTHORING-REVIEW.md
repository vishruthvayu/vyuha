# Authoring and recorded practice refinement

Scope: `ExerciseStudio.tsx`, `RaidStudio.tsx`, `Recorded.tsx`, and scoped `platform/authoring.css`. No live drill controls, shared sensor renderer, simulation, API payloads or scoring contracts changed. Root imports the stylesheet after the platform foundation.

## Findings and changes

The composer previously presented ten unrelated controls in a single wrapping grid. It now groups exercise identity, training challenge and environment into distinct horizontal sections with brief explanations. The page has native anchors between composing and assigning. Preview and save remain separate explicit actions; stale configuration warnings, linked duration validation, frozen in-flight fields and reproducibility fingerprints remain available. Fingerprints use progressive disclosure rather than dominating the exercise summary.

The library now explains the save/select/assign workflow, identifies an empty library and reports saved exercise count plus available and selected trainees. Existing assignment retry IDs and pending-assignment locks remain intact.

Recorded practice now separates import and library selection, explains the seven-MiB limit before upload, reports missing-file, import and recording-load states, and explicitly identifies the workflow as unscored. A recording places its evidence picture beside decision controls on wide screens and stacks them on narrow screens. Missing/expired observations retain their action gate. Decisions have visible count feedback; the saved result explains its unscored scope and discloses raw reference evidence on demand. No observations or consequences are invented.

An initial actual-browser inspection exposed an inherited auto-fit grid rule crushing the new composer sections. A second refinement explicitly resets the parent grid to one column. The scoped stylesheet also increases workflow-link and checkbox-label targets and raises authoring eyebrow/footnote contrast. These are substantive layout and access refinements, not cosmetic test changes.

## Verification

- Targeted frontend regression suites: **28 passed**, 0 failed (`recorded-lifetime`, `command-workflows`, `command-composer-input`, `hardening`). This includes late recording/import/practice responses, blank selection, retained request IDs, expired observation gating, incremental duration edits, stale composer results, frozen fields and immediate library assignment after save.
- Accessibility suite: **14 passed**, 0 failed. Existing jsdom axe checks omit layout/contrast; this is not a screen-reader audit.
- ESLint on the three edited components: passed with zero warnings.
- TypeScript project build (`tsc -b`): passed.
- Actual Chromium at CSS widths 360, 768 and 1440, scale factor 1: neither route had document horizontal overflow. Captured both routes at these widths, plus populated Recorded Practice at 360 and 1440.
- Actual API interaction: Preview raid compiled a 90-second seeded exercise successfully. Recorded Practice rejected missing-file import clearly, imported the repository example, recorded designation/classification/response, and saved a reference review successfully against the isolated QA API.

Screenshots: `authoring-studio-{360,768,1440}.png`, `authoring-recorded-{360,768,1440}.png`, `authoring-recorded-populated-{360,1440}.png`. They use the running application and isolated synthetic server; the supplied recorded crossing example is training fixture data. Scoped authoring CSS was injected during browser capture pending the root-owned import. No private credentials appear in captures.

## Remaining boundaries

This scoped check does not certify all requested viewport widths, all server failure modes, physical devices, a full screen-reader review, final combined-source acceptance or real-world scientific validity. The root acceptance pass must load the imported stylesheet normally, run full-source checks and capture final evidence tied to its eventual commit. Root should preserve the other developer's entire drill ownership.
