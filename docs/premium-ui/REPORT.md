# VYUHA premium UI — completion report

| | |
|---|---|
| Branch | `feature/vyuha-premium-ui` |
| Baseline | `7e3184b15ba38e8242efc6f80c446c9d861b032e` (shared baseline) |
| Commits | 13 on top of the baseline (milestones 1–8, an accessibility pass and refinement passes), each tested, pushed and verified on the remote |
| Scope | Frontend-owned files only. No change to `Scene.tsx`, rendering, `Radar.tsx` internals, `types.ts`, workers, simulation, scoring, `server/`, `scripts/`, `package.json` or the lockfile (`git diff 7e3184b HEAD` on those paths is empty) |
| Checks | 262/262 frontend tests, ESLint (0 warnings), Prettier, production build (32 local offline assets) |

Companion documents: [DESIGN-DIRECTION.md](DESIGN-DIRECTION.md) (research, three rendered directions, selection), [PROGRESS.md](PROGRESS.md) (milestone log), [INTEGRATION.md](INTEGRATION.md) (engine interface, contract amendments, merge steps).

## 1. Research and direction

Sources read directly: Vercel Geist (colour-step semantics, two-family type), Linear's redesign write-up (palette from base/accent/contrast, elevation over outlines), IBM Carbon motion (duration ladder and easing curves), Motion's accessibility guidance, Radix (behaviour checklist), Raycast (keyboard-first presentation), NASA Open MCT README (mission-operations framing). motion-primitives and dockview were evaluated and rejected. Apple HIG motion and kepler.gl were not readable as text, and galleries such as Awwwards or Mobbin were not studied, so nothing is claimed from them. Details and the A/B/C study renders are in DESIGN-DIRECTION.md.

Selected direction: **Quiet Instrument**. B's instrument structure for every working screen, C's editorial serif for preparation, review and narrative pages, A's full-bleed framing for the 3D view without glass panels over it. The reference images were used as a bar to clear, not copied.

## 2. Design system

- **Tokens** (`premium/tokens.css`): a 13-step neutral scale with fixed roles (background, hover, border, secondary and primary text), one champagne accent for the single primary action, cyan for selection and focus, and sage / amber / coral used only with text or shape. Spacing on a 4 px grid, radii, elevation presets, a duration ladder (70–420 ms) with productive, entrance, exit and expressive curves.
- **Type**: Geist for UI, Geist Mono for clocks, ranges, seeds and codes, and Instrument Serif for editorial headings only. All three are vendored under the SIL OFL with their licences. No hosted fonts.
- **Components** (`premium/components.css`): buttons, fields, segmented controls, status chips, disclosures, panels and tables, with legacy light-theme rules mapped onto the tokens.
- **Shell** (`premium/shell.css`): compact app bar with primary links, workspace search (Ctrl/⌘ K), the guide and the Workspaces catalogue, breadcrumb and page frame.
- **Route layers**: `training.css`, `preparation.css`, `review.css`, `instructor.css`, `crew.css`, `analytics.css`, `studio.css`, `utility.css`. All are imported last from `main.tsx` through `premium/premium.css`.

## 3. Route by route

| Route | What changed |
|---|---|
| Training ground (exercise) | One-screen workstation at ≥1024×660: mission strip with live phase, view with the radar as an inset, contact tracks and RF/IFF evidence in a rail, a stepped decision dock under the view, exercise log. Phones stack view → contacts → dock → evidence; the sensor header is one row. |
| Preparation / Adaptive Director | Full-width stage (real scene, or an original illustration before a drill is prepared), editorial headline, one primary action. Drill settings open by default. The Director's selection is one flat card: metrics band, rationale, scenario conditions as chips. |
| After-action review | Verdict band (score ring, verdict, verification seal, metrics), sticky section navigator with scroll-spy (`ReviewSections.tsx`), sticky replay beside the Ghost decision review, restyled timeline / path / comparison / score table, editorial empty state and a history list with one fact per line. |
| Instructor / White Cell | Slim officer session strip, compact header with transport chip, sticky scrollable roster ordered live-first with status chips, command groups open and side by side on wide screens. White Cell chooser text no longer overlaps. |
| Shared Crew | Two visually distinct stations, spotter (cyan) and responder (brass), on one exercise. Role banner with the shared clock and elapsed track. Auto-scaled scope of reported contacts marked observed / designated / classified. Console with next task, evidence grid and role-only actions. Always-visible, keyboard-scrollable coordination timeline. The join card collapses to a strip once connected. Officer setup with issued codes and clock transport. |
| Training analytics | Scope bar, underline view tabs that scroll on phones, a trend chart with readable axes at every width, a compact scenario × skill matrix (one cyan ramp, quiet zero cells), left-aligned captions. |
| Exercise studio | Raid Composer as an authoring bench, a ruled preview card, a padded library, and an honest empty state when no trainee in the unit reports presence. |
| Rapid ID | Two-column recognition round: thermal viewer beside the briefing, evidence grid and large answer targets. |
| Recorded practice, Data transfer, Informal evaluation | Ruled scope notice, form cards with readable field widths, styled file pickers. |
| Unit overview | Metric tiles and consistent panel padding; diagnostics status in mono. |
| PS compliance, System evidence, Benchmark | Checked; already consistent under the shared layer. Compliance's stand-alone links meet the 24 px target size. |
| Operator guide, search, sign-in | Numbered stepper in the guide; dialogs and the officer sign-in card on the shared tokens. |

## 4. Screenshots

All are real browser captures (headless Chrome on Linux) of the running app with live server data. Stored as WebP in [screenshots/](screenshots/).

| | |
|---|---|
| ![Training exercise, 1440](screenshots/01-training-exercise-1440.webp) Training exercise, 1440 | ![Training exercise, 390](screenshots/02-training-exercise-390.webp) Training exercise, 390 |
| ![Preparation, 1440](screenshots/03-preparation-adaptive-1440.webp) Preparation (adaptive), 1440 | ![Director selection](screenshots/04-director-selection-1440.webp) Director selection, 1440 |
| ![AAR, 1440](screenshots/05-after-action-review-1440.webp) After-action review, 1440 | ![AAR, 390](screenshots/06-after-action-review-390.webp) After-action review, 390 |
| ![Instructor](screenshots/07-instructor-1440.webp) Instructor console, 1440 | ![Crew responder](screenshots/08-crew-responder-1440.webp) Crew responder station (running), 1440 |
| ![Crew spotter 1920](screenshots/09-crew-spotter-1920.webp) Crew spotter station (completed), 1920 | ![Crew responder 390](screenshots/10-crew-responder-390.webp) Crew responder, 390 |
| ![Crew officer](screenshots/11-crew-officer-setup-1440.webp) Crew officer setup, 1440 | ![Analytics trend](screenshots/12-analytics-trend-1440.webp) Analytics trend, 1440 |
| ![Analytics matrix](screenshots/13-analytics-matrix-1440.webp) Scenario × skill, 1440 | ![Exercise studio](screenshots/14-exercise-studio-1440.webp) Exercise studio with raid preview, 1440 |
| ![Rapid ID](screenshots/15-rapid-id-round-1440.webp) Rapid ID round, 1440 | ![Data transfer](screenshots/16-data-transfer-1440.webp) Data transfer, 1440 |
| ![Unit](screenshots/17-unit-overview-1440.webp) Unit overview, 1440 | ![Compliance](screenshots/18-compliance-1440.webp) PS compliance, 1440 |
| ![Guide](screenshots/19-operator-guide-1440.webp) Operator guide, 1440 | ![Sign-in](screenshots/20-officer-sign-in-1440.webp) Officer sign-in, 1440 |

Before and after (baseline captures are the files named `before-*`):
[training exercise](screenshots/before-training-exercise-1440.webp) → [after](screenshots/01-training-exercise-1440.webp) ·
[crew responder](screenshots/before-crew-responder-1440.webp) → [after](screenshots/08-crew-responder-1440.webp) ·
[analytics trend](screenshots/before-analytics-trend-1440.webp) → [after](screenshots/12-analytics-trend-1440.webp)

## 5. Motion

CSS only: cross-document view transitions between routes, and short transitions on hover, selection, disclosure and dialog entry, using the token durations and curves. The live-status dot pulses only while an exercise or crew clock is running. Every premium stylesheet with motion has a `prefers-reduced-motion` block, and a test enforces that. Animation never reads or writes the simulation clock, worker, snapshot or scoring. The crew clock track and scope only render the server state they receive.

## 6. Accessibility (target: WCAG 2.2 AA)

- **axe-core** (the local copy in `node_modules`, injected over CDP; WCAG 2.0/2.1/2.2 A and AA rules):
  - Routes: all 15 routes report no violations at 1440×900 and 390×844, and the instructor, analytics, AAR and home routes also at 360×780.
  - Interactive states, also no violations: a running exercise with a contact selected, a joined crew station, the guide dialog, workspace search, the Workspaces menu and the signed-out officer sign-in.
  - Fixed during the pass:
    - Label-in-name: workspace search, the Workspaces menu (renamed from "Toggle navigation"), the Review link with its count (now a description) and compliance "Show me" links.
    - Target size: stand-alone list links now have a 24 px hit area.
    - Contrast: the selected contact row's secondary line was 4.37:1 and now passes.
- **Keyboard**: tab walks on six routes (crew, analytics, studio, Rapid ID, AAR, compliance; 38–40 stops each) found a drawn focus indicator at every stop. The coordination timeline and wide tables are focusable scroll regions.
- **Not done**: no screen-reader session (NVDA, VoiceOver, TalkBack) and no test on physical devices. The 3D canvas content cannot be audited by axe.

## 7. Responsive

Every route was captured at 360, 390, 428, 768, 1024, 1280, 1440 and 1920 px: 17 routes × 8 widths = 136 captures with no horizontal overflow. Two refinement passes followed:
- **Phones**: the sensor header went to one row (111 → 77 px). The instructor roster rows no longer collapse into each other and the roster scrolls in place. Analytics tabs scroll instead of wrapping. AAR history rows no longer run text together.
- **Tablet and wide**: re-checked at 768 and 1920 px after the fixes.

## 8. Tests

262/262 frontend tests pass (`npm test`). New: 13 tests in `client/src/premium-ui.test.tsx`:
- no remote assets;
- font licences ship;
- reduced-motion coverage;
- stylesheet import order;
- decorative preparation art carries no contacts;
- one primary action on preparation;
- drill settings open;
- AAR navigator semantics, with and without IntersectionObserver;
- live-first roster order;
- crew scope scaling and stages;
- heatmap shading through a CSS variable.

Changed: 5 selectors in `mission-navigation.test.tsx` and `workspace-recovery.test.tsx` follow the menu's new accessible name, "Workspaces". Backend tests were not re-run, since `server/` is untouched.

## 9. Remaining issues

1. **Crew designation of tentative radar-only contacts** (finding A from the rc.2 retest). The spotter can press Designate; the server always refuses and the UI shows the refusal. This needs a server-provided `designatable` flag (INTEGRATION.md, amendment B).
2. **Engine DOM styling**: the premium layer styles `.radar` and `.view-annotation` from engine files. Amendment A asks that these stay stable.
3. **Legacy stylesheets** (`style.css`, `design-system.css`, `mission-navigation.css`, `crew-officer-polish.css`) are still imported, with the premium layer overriding them. Retiring them route by route is follow-up work (only `spatial-training.css` was retired).
4. **3D scene presentation**: in thermal mode a dark terrain block from the renderer can sit behind the ready-overlay headline at some viewports. This is renderer output, not CSS, so it was left for the engine owner.
5. **Phone instructor page** is long once a session is selected, because its full control set stacks in one column.
6. **Validation limits**: captures are from headless Chrome on Linux only. No physical phone, tablet, Windows or Safari check, and no screen-reader session.
7. **Officer crew setup** loses issued role codes on reload. This is pre-existing behaviour; the page tells the officer to save codes before leaving.

## 10. Engine interfaces and integration

Unchanged: `Scene` props, `Radar` props, `LazyScene`, all shared types. Container-only changes: the radar panel sits inside the sensor workspace as an inset; `DecisionWorkspace` renders a decision section plus a sibling evidence aside. Merge steps, the list of engine DOM hooks and the three contract-amendment proposals are in [INTEGRATION.md](INTEGRATION.md).
