# Independent non-drill UI review

Date: 2026-10-16. Reviewer: independent UI review agent, separate from implementation agent.

## Scope and evidence

Inspected live Chromium against the isolated synthetic QA server (`127.0.0.1:5187`, API `8017`) at 360, 768 and 1440 CSS pixels with device scale 1 and default browser zoom. Routes: Analytics, Instructor, Exercise Studio and Data Transfer. Inspected first-pass screenshots and captured twelve new full-page screenshots in `/tmp/vyuha-hardening-qa/review-{analytics,instructor,studio,transfer}-{360,768,1440}.png`. These are local QA artifacts; copy selected evidence into the final package before handoff.

Reviewed a working tree based on `b0d594c2a84e7df025913a81a353c33625e091ec` with active uncommitted UI edits; findings describe observations during that work, not acceptance of a frozen commit. Rerun after fixes. No drill, renderer or live trainee-decision controls were edited or reviewed. No full screen-reader audit, populated multi-session acceptance or physical-device acceptance was performed.

## Prioritized findings

### P1: Small muted text fails contrast

Live axe-core run with `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` at 360px found Analytics `section > .eyebrow` (selected trainee/persisted evidence) at 3.91:1: `#6f7975` on `#141a1b`, 11px. Exercise Studio muted authoring eyebrows, raid fieldset legend and scenario-library footnote measured 4.49:1: `#79847f` on `#151b1c`. Raise scoped muted foreground colors with margin above 4.5:1 and rerun axe across affected panels. Do not round 4.49 up to a passing ratio.

### P1: Instructor White Cell evidence switch clips at 360px

The two-option `.segmented` control extends beyond its panel and viewport. “Instructor reference truth” clips at the right edge. Document scroll width stays 360 because the ancestor clips it; absence of document overflow does not establish usability. Give this specific White Cell control a constrained width, children `min-width: 0`, and either wrapping labels or a vertical layout. Preserve both full labels and focus rings. Avoid altering shared drill segmented styles.

### P2: Analytics invites comparison when no records can be selected

Synthetic unit has no trainees. “Inspect two recorded sessions” remains enabled. Clicking it switches away from the overview to a near-empty comparison state showing only “No trainee selected. Choose a unit and trainee…”. This creates a dead end after a promising action. Hide or disable the comparison action until an eligible trainee exists; alternatively navigate to a clear first-training action. Retain honest empty data rather than sample scores.

### P2: Mobile analytics tabs hide destination labels without an affordance

At 360px only Overview, Scenario × skill and the start of “Session comparison” are visible. Remaining tabs require horizontal scrolling with no visible indicator. Keyboard Tab reaches Session comparison while its right edge initially remains clipped; the next Tab scrolls farther. Add a small visible scroll affordance, use a compact view selector on narrow screens, or scroll the full focused tab into view. Keep the current selected state and label readable.

### P2: Studio target sizing in updated authoring layout

Live axe reported the `href="#scenario-library"` jump link as 119.8 × 18px with insufficient surrounding safe space. `.authoring-check > input[type=checkbox]` measured 13 × 16px with insufficient spacing. Increase jump-link minimum target height to at least 24px (prefer comfortable touch spacing) and make the entire checkbox label a reliable padded target. Rerun axe because a visually large label does not necessarily eliminate a target-size finding.

### P3: Officer session chrome consumes excessive phone height

At 360px, logo bar + breadcrumb + expiry/sign-out band use approximately 200px before route content. The expiry copy wraps and sign-out becomes a separate row. This materially delays Instructor discovery and authoring content on small screens. Use concise session status with expiry details in a disclosure; keep sign-out accessible without a full extra row. This is a product-density recommendation, not an authorization defect.

### P3: Empty Analytics repeats its lack of evidence

The unit selector says no trainees, overview displays a dash for sessions, a long empty evidence card explains completed training, then a final paragraph repeats that no trainee is selected. At 360px the empty route exceeds 1,300px before any productive action. Collapse the zero-data state to one explanation and one actionable next step, while preserving provenance details in a disclosure.

## Positive checks and limits

- All four reviewed routes had document scroll width equal to viewport width at 360, 768 and 1440. Nested clipping above remains a real issue.
- Mobile workspace menu moved focus to Close navigation. Escape closed the menu and restored the Workspaces trigger.
- Ctrl+K focused the command search input.
- Initial keyboard sequence included a visible Skip to workspace link and route controls in logical source order. This was a sampled focus check, not exhaustive keyboard acceptance.
- Instructor and Data Transfer returned zero axe violations in the reviewed empty authenticated states. This does not prove other states or all WCAG requirements pass.
- Existing page hierarchy, deliberate typography and quieter shell are coherent at desktop widths. The empty Instructor split roster/detail workspace is clearer than repeated metric tiles, but needs populated operational review.

## Required re-review

Recheck the listed defects after changes, capture final screenshots from a fixed source SHA, and run populated Instructor, AAR and analytics interaction acceptance separately. Do not describe this four-route review as proof that all non-drill routes were redesigned or accepted.

## Pass 2: Populated review and refinement

Repeated live review after fixes with three clearly named synthetic QA trainees: two completed sessions, one recoverable session. Each completed trainee has one completed exercise; this is not a two-session within-trainee comparison fixture. Reviewed populated Analytics, Instructor and server-verified Ghost AAR at 360/768/1440, plus updated Studio.

Verified improvements:

- Analytics and Studio contrast findings no longer reproduce in axe.
- Studio jump-link/checkbox target-size findings no longer reproduce.
- White Cell evidence switch stacks at 360px and both full labels remain visible.
- Analytics comparison CTA is replaced by an honest two-completed-exercises requirement for a one-session trainee.
- Instructor session selection exposes the selected synthetic trainee, stale-connection warning, attributable control workspace and reconstructed White Cell evidence.
- Populated Ghost AAR labels server verification, evidence available to trainee, reference truth, scoring limitations and hypothetical branches distinctly. No scoring or replay mutations were made during review.

Second-pass weaknesses reported to implementation owner:

1. **Mobile Instructor roster:** the fixed 340px overview panel left only 59px of scrolling list height, less than one 65px session row. Three saved sessions appeared as one clipped row. Implementation owner subsequently removed the phone panel cap and supplied a larger bounded roster; final matrix receipt below records the resulting dimensions.
2. **Mobile Analytics keyboard tabs:** horizontal overflow hint improved discoverability but the focused Session comparison button still extended from x264 to x428 in a 360px viewport. Implementation owner replaced the phone tabs with a two-column grid; final matrix receipt records focused button bounds.
3. **Mobile AAR heading and verdict:** first-screen screenshot shows export action beside narrow heading/subtitle and a two-column score/verdict layout. This forces severe wrapping and delays evidence. Requested stacked phone heading/action and summary. Reassess the representative final screenshot after the owner's last CSS edits.
4. **Mobile AAR density:** the synthetic populated AAR was approximately 10,065px tall at 360px. Section navigation reduces travel, but the many fully expanded analysis/reference sections remain a limitation for phone investigation. This is a product usability concern, not a data-integrity failure. Avoid calling the AAR mobile experience final solely because it fits the viewport.

Pass 2 automated scan returned zero axe violations for Analytics, Instructor, Ghost and Studio in the tested 360px states. Scope remains automated and sampled manual accessibility; no full screen-reader audit was conducted.

### Pass 2 final verification matrix

Captured 56 route/viewport cases across Analytics, Instructor, Studio, Transfer, Ghost, System Evidence and Compliance at **360, 390, 428, 768, 1024, 1280, 1440 and 1920px**. All 56 had document scroll width equal to viewport width. Fourteen axe scans (seven routes at 360 and 1440) returned zero violations for the configured WCAG A/AA tags. See [browser receipt](browser-final/browser-receipt.json); this reports automated violations and incomplete-rule counts, not full accessibility conformance.

Representative full-page screenshots for all seven routes at 360/1440 are in `browser-final/`. [Mobile AAR first screen](browser-final/ghost-firstscreen-360.png) was recaptured after the final stacking fix and shows the heading, export action and verdict using the available width. The narrow two-column heading/summary defect is resolved.

Final targeted verification confirms the Instructor roster now has **217px** of visible list area for 217px of content, displaying all three synthetic rows. Analytics phone tabs form a grid: all five focused controls remain within x16–344px, with `:focus-visible` true and a visible cyan box-shadow ring. Earlier clipping findings are resolved for the tested state. [Focused mobile Analytics](browser-final/analytics-focus-360.png).

Remaining product recommendations: reduce officer-session chrome on phones; progressively disclose long optional AAR/reference analysis; validate multi-session comparisons with multiple completed exercises belonging to the same trainee. No software blocker remains from the specific defects reproduced in this scoped review. This statement does not extend to unreviewed drill, physical devices, other identity/import/recovery states, full screen-reader behavior, or integrated release readiness.
