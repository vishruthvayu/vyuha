# Flagship A — connected product foundation

This source slice extends the existing Quiet Instrument palette and persistent workstation architecture. It changes Training/Ghost composition without introducing a second simulation store, evidence source, transport, or camera owner.

## Implemented

- `product/WorkspaceHeader.tsx` provides the common route and Ghost task hierarchy. `UI.PageHeader` delegates to it; Ghost uses a compact heading and explicit server-verified/local provenance.
- The shared application navigation exposes Academy beside Training and Review. Existing navigation interception, modifier semantics, catalogue, search, modal isolation and officer routing remain in use.
- `product/ContextDock.tsx` is a nonmodal, keyboard-operable local disclosure. Observation console starts collapsed; open/close, Escape and an explicit desktop pin control are reachable. Close returns focus to its launcher. Its content remains mounted beneath `hidden`, including the camera portal host. Open/pin state survives switching workstation instruments while the mission is active.
- The unpinned Training canvas fills its frame to the right and bottom, behind the existing restrained lower controls. The 72 px instrument rail and collapsed sensor launcher replace the permanently reserved 354 px edge. At >=1280 px only an open, explicitly pinned console reserves 376 px using parent `:has`. On smaller screens it uses overlay/vertical task composition.
- Ghost offers a local evidence disclosure that preserves its evidence nodes, contact selection, lens, source record and playhead. Collapsing it gives more horizontal space to reconstruction; mobile reflows it beneath the world.
- Semantic surface/text/status/evidence roles, 12 px microcopy floor in migrated surfaces, 44 px primary controls, visible 3 px focus and reduced-motion overrides live in the final `product/product.css` layer. Existing bundled fonts and license files remain authoritative.

## Research → implementation

The prior fixed-width console consumed scene space even when unused. The supplied product blueprint requests a world-first view, contextual instruments, local disclosures and deliberate pinning. [W3C APG disclosure guidance](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) supports native button activation plus `aria-expanded` and `aria-controls`; these are used by the Training and Ghost disclosures. [WCAG 2.2 target-size enhanced guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) supplies the 44 × 44 CSS px engineering target (AAA; this does not redefine AA requirements). The supplied Open MCT/Apple/flight-deck research is reused, without adding unverified product claims.

## Focused validation

Actual shared repository command:

```
node --import tsx --test src/observation-theatre.test.tsx src/mission-navigation.test.tsx src/review-theatre.test.tsx
```

14/14 passed. This covers camera portal and instrument node identity across pin/close/reopen/workspace changes, instrument state, Escape focus restoration, exact Ghost seeks, immutable source records, reference lens persistence, catalogue/search modal handoff, native navigation semantics and the populated Ghost axe audit (contrast excluded by jsdom).

ESLint passed for the ten owned TypeScript/TSX files. Final full typecheck and browser evidence belong to integrated acceptance; initial parallel typecheck found only a sibling graphics shader-test mock typing issue, already reported for correction.

## Integrated visual acceptance still required

Use matched mission/site/seed/tick/selection/camera/quality/DPR at 1440×900, 1024×768, 768×1024 and 390×844. Measure usable canvas area with the console unpinned and closed (target >=70%); verify opening overlays the scene and pinning on a wide desktop reserves exactly 376 px. Check the complete report→request→publication→decision/Defer journey through the drawer, then open Ghost at the exact boundary. Check no horizontal overflow, readable wrapped labels, touch targets, 200% zoom, keyboard order, reduced motion, and portal/instrument state after switching Observe/Radar/Reports/Evidence/Decide.

The collapsed sensor ribbon consumes the authoritative acquisition snapshot passed by App. It announces pending/publication/unavailability/expiry boundaries, retaining the original task subject across selection changes. It rejects future or malformed publication boundaries and never infers identity from optical shape. It does not announce every logical tick or auto-open the drawer. Physical VR visual and input acceptance is separate from this DOM presentation slice.
