# VYUHA premium UI — design direction

Branch `feature/vyuha-premium-ui`, started from shared baseline `7e3184b15ba38e8242efc6f80c446c9d861b032e` (15 October 2026). Frontend workstream only; engine, renderer internals, radar internals, workers, server and scoring are untouched (see `docs/finale/parallel/FRONTEND-ENGINE-CONTRACT.md`).

## What was studied

Read directly (web fetch, 15 October 2026):

| Source | What was taken from it |
|---|---|
| [Vercel Geist colours](https://vercel.com/geist/colors) | A 10-step colour scale with fixed meaning per step: 100–300 backgrounds (default, hover, active), 400–600 borders, 700–800 high-contrast fills, 900 secondary text, 1000 primary text. VYUHA's neutral scale uses the same step semantics so every surface, border and text role has one token. |
| [Vercel Geist introduction](https://vercel.com/geist/introduction) | Two-family typography (sans + mono) and named material presets instead of ad-hoc shadows. |
| [Linear: how we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui) | Generate the palette from a base, an accent and a contrast level; cut chrome colour so content leads; separate surfaces by elevation rather than outlines; align labels and icons on one grid; a more expressive display face for headings only. |
| [IBM Carbon motion](https://carbondesignsystem.com/elements/motion/overview/) | Productive vs expressive motion; duration ladder 70/110/150/240/400/700 ms; productive, entrance, exit and expressive cubic-bezier curves (adopted as VYUHA motion tokens). |
| [Motion: accessibility](https://motion.dev/docs/react-accessibility) | Under reduced motion, keep opacity/colour changes and drop transform, parallax and autoplay movement. |
| [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) | Unstyled accessible primitives with WAI-ARIA keyboard and focus behaviour. Used as the behaviour checklist for VYUHA's native controls; no package added (see below). |
| [Raycast](https://www.raycast.com) | Keyboard-first presentation: shortcuts shown as key chips next to the action they trigger; text-led hero; real UI shown rather than decoration. |
| [NASA Open MCT](https://github.com/nasa/openmct) (Apache-2.0) | Mission-operations framing: one navigated object at a time, composable views. Its time-conductor and plot pages were not readable as text, so only the README was used. |
| [motion-primitives](https://github.com/ibelick/motion-primitives) (MIT) | Depends on Motion and Tailwind CSS; VYUHA uses neither, so not adopted. |
| [dockview](https://dockview.dev) | Zero-dependency docking layouts (tabs, floating groups). Rejected: trainees should not rearrange a time-critical workstation, and instructors need a fixed, learnable layout. |

Not readable as text through web fetch, so nothing is claimed from them: Apple Human Interface Guidelines motion page, kepler.gl (both render client-side). Awwwards, Godly, Land-book, Mobbin, SiteInspire, 21st.dev, Magic UI, Aceternity and Origin UI were not studied in this pass; no claim is made about them. The earlier repository study (`docs/finale/design/REFERENCE-RESEARCH.md`: Carbon tables, Fluent spacing, Atlassian grouping, WCAG 2.2, Playwright) still applies.

## Dependencies adopted

| Added | Licence | Why | Size |
|---|---|---|---|
| Geist (variable, Latin) | SIL OFL 1.1 | UI text: crisp at 12–14 px, tabular figures, wide weight range | 29 KB woff2 |
| Geist Mono (variable, Latin) | SIL OFL 1.1 | Clocks, ranges, seeds, codes | 23 KB |
| Instrument Serif (regular + italic, Latin) | SIL OFL 1.1 | Editorial display headings on preparation, review and narrative pages only | 21 + 22 KB |

Fonts are vendored under `client/src/premium/fonts/` with their licences, bundled by Vite and precached by the existing offline service worker. No hosted font, script or image is requested at runtime. `package.json` and the lockfile are unchanged, to avoid lockfile conflicts with the engine branch.

Considered and not added: Motion (route changes in VYUHA are full document navigations, so CSS cross-document view transitions cover page transitions with no JavaScript; in-page motion is a few CSS transitions), Radix (native `button`, `details`, `select` and the existing tested modal focus manager already give correct semantics), dockview, Tailwind-based kits.

## Three directions, rendered

Each was built as a single layout study around a real frame of the current renderer (`studies/direction-study.html`), labelled as not live, and rendered at 1440×900.

| | A. Cinematic HUD | B. Instrument | C. Editorial field journal |
|---|---|---|---|
| Picture | [direction-A.jpg](studies/direction-A.jpg) | [direction-B.jpg](studies/direction-B.jpg) | [direction-C.jpg](studies/direction-C.jpg) |
| Idea | Full-bleed scene, floating glass panels for scenario, inspector, radar and decisions | Viewport fills the screen beside one inspector rail: contacts, evidence, decision dock | Magazine composition: serif headlines, framed viewport, narrative evidence, typographic choices |
| Visual sophistication | High at first glance; reads as a game HUD | Calm, precise; risks austerity | Most distinctive and beautiful |
| Mission usability | Panels cover ~40% of the scene; text contrast depends on what is rendered behind it | Select → evidence → act without moving the eyes off one column; nothing covers the scene | No contact list on screen; decisions far from evidence |
| Decision speed | Medium | Fastest | Slow (prose, serif labels) |
| Real 3D compatibility | Poor: blur over WebGL is costly and overlays hide contacts | Best: renderer owns its rectangle | Good |
| Accessibility | Weak (variable contrast, blur) | Strong | Good for reading, weak for scanning |
| Phone | Impossible as composed | Rail stacks under the view naturally | Workable |
| Effort / runtime cost | High / high | Medium / low | Medium / low |
| Fit across all routes | Training only | All routes | Preparation, review, guide |

**Selected: B as the structure**, with C's editorial layer for preparation, review and narrative pages (serif display, generous measure) and A's full-bleed framing for the scene (no card around the viewport, edge annotations only, no glass panels over it). Working name: **Quiet Instrument**. The judgement is qualitative, not a measured score.

## Design language — Quiet Instrument

- **Hierarchy through type and space, not outlines.** Surfaces separate by a step in the neutral scale; hairline borders are used only where two surfaces of the same step meet.
- **One accent at a time.** Champagne marks the single primary action on a screen. Cyan marks selection and focus. Sage, amber and coral are semantic only (verified, caution, danger) and always carry text or shape, never colour alone.
- **The scene is the hero during training.** Nothing permanent is drawn over it except edge annotations; the inspector sits beside it.
- **Editorial voice where people read; instrument voice where people act.** Serif display is never used on a control.
- **Numbers are instruments.** Times, ranges, seeds and codes are mono with tabular figures, so they do not jitter while changing.
- **Motion explains change.** Productive curves under 160 ms for controls; expressive curves only for page and phase transitions; nothing loops; reduced motion keeps fades and drops movement.
