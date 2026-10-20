# Product direction — 16 October 2026

## Scope and method

This is an evolution of the integrated application at db0ff23. Public pages and documentation below were opened using the web tool on 2026-10-16. Reading an index/marketing page is not access to the authenticated product. No proprietary asset/code is imported. Browser studies and application screenshots are recorded separately. The live drill, preparation and decision components remain with the other developer.

## References actually consulted

| Source | Accessible material and useful decision |
| --- | --- |
| [Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui) | Detailed redesign account, alignment/hierarchy, view types and stress testing. Adopt consistent chrome and differentiated content compositions; avoid transplanting its issue-tracker layout. |
| [Geist](https://vercel.com/geist/introduction) | Public system index: typography, color and component roles. Retain local Geist and tabular mono; preserve existing shared tokens until coordination. |
| [Raycast](https://www.raycast.com) | Public launcher/shortcut presentation. Keep keyboard workspace search and clear invoking controls; no decorative keyboard animation. |
| [Stripe](https://stripe.com), [Apple](https://www.apple.com), [Framer](https://www.framer.com) | Public product-page hierarchy. Apply concise headings and staged disclosure. Reject large marketing heroes, parallax and repeated promotional sections in a training tool. |
| [Carbon](https://carbondesignsystem.com), [Fluent 2](https://fluent2.microsoft.design), [Atlassian](https://atlassian.design) | Public design-system entry pages. Useful foundation for semantic feedback, consistent interaction and enterprise density. Component-specific behavior must be checked in implementation. |
| [Landbook](https://land-book.com), [Siteinspire](https://www.siteinspire.com) | Accessible curated index listings and style categories. Useful contrast between editorial and product work; a gallery listing is not evidence of product usability. |
| [Mobbin](https://mobbin.com) | Public page with selected screenshot previews; authenticated workflow library not accessed. No subscription-only screen study claimed. |
| [Layers](https://layers.to) | Public explore shell returned minimal content; no useful product-level observation. |
| [Awwwards](https://www.awwwards.com), [Godly](https://godly.website) | Failed fetch/redirect respectively. Not studied; no design conclusion attributed to inaccessible entries. |
| [shadcn](https://ui.shadcn.com), [Radix](https://www.radix-ui.com/primitives) | Public examples/docs. Headless accessibility patterns useful; no wholesale migration since existing focus isolation and dialog tests are valuable. |
| [21st](https://21st.dev), [Magic MCP repository](https://github.com/21st-dev/magic-mcp) | Public catalog and repository README. MCP requires separate connection/key; not connected here. No generated component service claimed. |
| [Magic UI](https://github.com/magicuidesign/magicui), [Motion primitives](https://github.com/ibelick/motion-primitives), [Motion layout](https://motion.dev/docs/react-layout-animations) | Public repositories and layout-animation documentation. Avoid broad layout animation around authoritative controls; use short CSS disclosure/selection feedback with reduced-motion override. |
| [React Bits](https://reactbits.dev), [Aceternity](https://ui.aceternity.com), [Origin UI](https://originui.com) | Public catalogs (Origin redirects to coss UI). Decorative backgrounds/effects rejected. No code imported or new license obligation. |
| [Lucide](https://lucide.dev) | Existing project icon family retained, decorative icons hidden from accessibility tree. |
| [NASA Open MCT](https://github.com/nasa/openmct), [documentation](https://nasa.github.io/openmct/documentation/) | README and public documentation overview: mission telemetry, composition, contextual data. Adopt evidence relationships; not importing its framework or claiming interactive mission-console access. |
| [kepler.gl](https://github.com/keplergl/kepler.gl), [Dockview](https://dockview.dev), [TanStack Table](https://tanstack.com/table/latest), [React Flow](https://reactflow.dev) | Public repositories/docs/feature examples. Contextual analysis and table organization useful. Docking/node editing adds complexity without a current requirement; ordinary semantic tables and split views suffice. |
| [Playwright screenshots](https://playwright.dev/docs/test-snapshots), [Playwright MCP](https://github.com/microsoft/playwright-mcp), [DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Screenshot conditions and browser automation documentation. Neither browser MCP is exposed in this session; use local Playwright with an isolated browser profile. |
| [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/), [NN/g heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | Keyboard/focus, understandable feedback, status visibility, recovery and consistency are acceptance criteria. Automated axe is a limited check, not a screen-reader audit. |

## Three directions

Scores are design judgments, 1–5, not user study or competition results. Equal weights; no claim of empirical validation.

| Criterion | A: Refined workstation | B: Editorial intelligence | C: Scientific operating system |
| --- | ---: | ---: | ---: |
| Sophistication | 4 | 5 | 4 |
| Originality | 3 | 5 | 4 |
| Clarity | 5 | 3 | 5 |
| VYUHA fit | 4 | 3 | 5 |
| Readability | 5 | 4 | 5 |
| Accessibility | 5 | 4 | 5 |
| Navigation speed | 5 | 3 | 5 |
| Cross-route coherence | 4 | 4 | 5 |
| Feasibility | 5 | 4 | 4 |
| Runtime performance | 5 | 4 | 5 |
| Total / 50 | 45 | 39 | 47 |

Selected: C with B's deliberate typography and A's restrained controls. Working name: **Fieldwork**. Persistent route index on desktop, task-oriented data operations, readable evidence surfaces, explicit provenance and selection states. Avoid a universal grid of cards. Keep the drill's existing chrome/tokens until integration coordination.

## Implementation choices

No new production dependencies. Existing React 19, semantic HTML, Lucide, self-hosted Geist/Geist Mono/Instrument Serif (existing license files) and CSS are enough. New CSS lives under `platform/` and is scoped, without changing root tokens or training styles. Preserve native links, URL history, authentication gates and authoritative backend contracts. Motion: short opacity/translation entrance and control feedback, no continuous decoration, disabled for reduced motion.

## Available tooling

Inspected session skill/tool catalog: no Frontend Design skill, Figma, MagicPath, Context7, 21st MCP, browser MCP or Chrome DevTools MCP exposed. GitHub and shell tools are available. Existing repository is not a Sites-hosted project; no hosting migration is needed. Canva/Descript are irrelevant to this software task and were not used. Local Playwright can exercise real Chromium; fixtures must be explicitly labelled and isolated from user data.
