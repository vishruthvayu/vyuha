# Independent review of the shell correction

Reviewed 2026-10-16 against the working tree based on `0c9fc45c73a717b321b32274d9df42d1fda6f541`. The inspected runtime correction is limited to removal of `PlatformRail.tsx`, removal of its import/use from `main.tsx`, and changes to `platform/fieldwork.css`. This is a corrective review, not final visual acceptance or a review of the parallel drill work.

## Actual comparisons

Inspected the established premium screenshots `07-instructor-1440.webp`, `12-analytics-trend-1440.webp` and `14-exercise-studio-1440.webp` in `docs/premium-ui/screenshots/`, then the actual Analytics, Instructor and Exercise Studio routes at 360 and 1440px using isolated synthetic QA data and refreshed officer authentication.

The competing fixed sidebar is gone. The existing top navigation and workspace catalogue are again the single application navigation system. Computed page-heading font is `Instrument Serif` with the established serif fallbacks. Computed shell background is `rgb(11, 13, 14)`. Neutral surfaces, gold accents and typography now correspond to the premium reference screenshots; the preceding separate green-tinted shell direction is no longer present on the inspected routes. Functional route improvements such as Instructor search, honest Analytics evidence states and grouped authoring remain visible.

These observations establish consistency with the inspected premium baseline. They do not establish that every route is visually complete or that the resulting experience satisfies the owner's final visual standard. Historical sidebar screenshots and earlier approval language must not be used as evidence for this corrected composition.

## Browser interaction checks

- Analytics, Instructor and Exercise Studio had document width equal to viewport width at 360 and 1440px.
- Desktop top navigation showed the correct `aria-current="page"` on Analytics and Instructor. Exercise Studio is accessed through the catalogue rather than being duplicated into the short primary navigation.
- Workspaces opened the existing dialog and placed focus on Close navigation. Escape closed it and restored focus to the Workspaces trigger at both tested widths.
- Catalogue selection of Training analytics navigated from Exercise Studio to `/analytics`.
- Ctrl+K opened workspace search and focused its search input. Typing `analytics` reduced the catalogue to the expected destination.
- Typing `exercise`, pressing Tab to the matching Exercise Studio result and pressing Enter navigated to `/exercises`.

No live drill or Crew controls were operated. No application source was changed by this reviewer. The implementation owner's separate eight-width matrix remains the source for broader responsive and axe evidence.

## Remaining weaknesses and recommendations

1. **Workspace search does not activate a single result directly from the search field.** With `analytics` entered and one destination shown, Enter leaves the current route unchanged at both 360 and 1440px. Tab followed by Enter works, and the dialog explicitly describes Tab navigation. This is a remaining interaction limitation rather than a correction regression. Consider activating the single/selected result from Enter if the owner wants command-palette behavior.
2. **Phone navigation is coherent but top-of-page overhead remains substantial.** The app bar, breadcrumb and wrapped officer-session expiry/sign-out band occupy roughly the first 200px. The Analytics selectors and five view buttons then consume much of the next screen. Essential actions remain available, but the evidence investigation begins after substantial scrolling. Condensing session details is a future density improvement that can preserve the established navigation.
3. **The initial Instructor workspace leaves a large unselected detail area.** Three synthetic records are visible in the roster, while the main pane only asks for a selection. A default selection or a more compact unselected state could improve first use. Selection must remain explicit and safe for instructor commands; this is not a reason to dispatch actions automatically.
4. **Mobile tables still depend on horizontal scrolling.** Analytics evidence fits inside a bounded table region, but score and AAR links initially sit beyond the visible columns. This avoids document overflow while still adding an interaction step. Retain keyboard-scrollable labelled regions and consider a compact mobile evidence row later.

The correction resolves the concrete inconsistency of a second shell, different palette and different page-heading typography. No blocking navigation or viewport defect was reproduced in this targeted check. Direct owner acceptance and combined-source visual review remain necessary; the parallel drill's M3 work remains protected and was not inspected or merged here.
