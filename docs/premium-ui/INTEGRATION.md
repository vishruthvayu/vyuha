# Premium UI — integration notes and contract proposal

Branch `feature/vyuha-premium-ui`, cut from shared baseline `7e3184b15ba38e8242efc6f80c446c9d861b032e`. This document is the frontend side of `docs/finale/parallel/FRONTEND-ENGINE-CONTRACT.md`. It proposes amendments; it does not edit the contract (only the coordination owner does).

## 1. What did not change

Verified with `git diff 7e3184b HEAD --` on each path (no output):

- `client/src/Scene.tsx`, `scene-presentation.ts`, `visibility.ts`, `presentation.ts`, `quality.ts`, `rendering/`
- `client/src/Radar.tsx`, `observed-contacts.ts` (internals)
- `client/src/types.ts`, simulation workers, sensors / motion / response / scoring / replay
- `server/`, `scripts/`, deployment files, except one line in `Dockerfile` (below)
- `client/package.json`, `client/package-lock.json` (no dependency added; fonts are vendored files)

The `Scene` props listed in the contract are passed exactly as before. `LazyScene.tsx` is untouched. No network origin, hosted font or remote asset is introduced (a test in `client/src/premium-ui.test.tsx` fails if a premium stylesheet references a remote URL).

**One deployment change, approved by the repository owner (2026-10-15).** The `Check training build` workflow failed at `docker build` on every push since `038dd12`. The cause: `client/src/sensors-v2.ts` imports `../../server/config/sensors-v2.json`, but the Dockerfile's client stage copied only `client/`. The Dockerfile now also copies `server/config/` into that stage. Verified with a local `docker build` and a Node 22 / Python 3.12 run of the workflow's npm steps. The engine owner may prefer to carry the same line on their branch.

## 2. Frontend changes that sit next to engine components

| Area | Change | Engine impact |
|---|---|---|
| Radar container | `App.tsx` renders `.radar-panel` inside `.sensor-workspace` (an inset over the view) instead of beside it | None. `<Radar state selected onSelect large?>` props and the radar SVG are unchanged; only the container moved |
| Scene container | `.scene-container` (owned by `App.tsx`) gains surrounding chrome: mission strip, phase indicator, observation popover, camera corners | None. The container keeps its size contract; the canvas fills it |
| Decision dock | `DecisionWorkspace.tsx` now renders `section.decision-workspace` plus a sibling `aside.decision-evidence` | None. It reads the same snapshot fields as before |
| Page state hooks | `data-phase` / `data-tactical` on `.drill-page`, `data-step` on `.action-panel` | None. Presentation attributes only, derived from existing UI state |
| Animation | CSS transitions and cross-document view transitions only, all disabled under `prefers-reduced-motion` | None. No animation reads or writes the simulation clock, worker or snapshot |

## 3. Engine DOM the premium CSS styles (please keep stable)

The premium layer styles only these class names emitted by engine-owned files:

| Class | Emitted by | Used for |
|---|---|---|
| `.radar` | `Radar.tsx` root `div` | Fitting the radar into the inset (size, background) |
| `.view-annotation`, `.view-annotation.bottom-left` | `Scene.tsx` | Typography of the scene captions; moving the bottom-left caption clear of the radar inset; hiding captions on the preparation stage |

**Proposed amendment A — stable presentation hooks.** Treat the three class names above as part of the frontend/engine interface: rename or remove them only with a handoff note. The radar's internal SVG classes (`radar-ring`, `radar-line`, `radar-contact`, `radar-small`, `radar-caption`) are not styled by the premium layer and stay engine-private.

## 4. Proposed amendments that need engine or server work

**Amendment B — crew designation eligibility (finding A from the rc.2 Linux retest).** The Shared Crew spotter page enables *Designate shared contact* for a contact seen only as a tentative radar return. The server always refuses that request (HTTP 422, "Action is impossible…", `engine_v2.py`, `t['detected'] is None`). The UI cannot reproduce the server rule without duplicating engine logic. Proposal: the crew state response includes a per-contact `designatable: boolean` (engine/server-owned, conservative default `false` when unknown). The frontend will then disable the button and say why, with no client-side inference. Until then the UI keeps the current behaviour: the request is sent, the refusal is shown, and no decision is recorded.

**Amendment C — optional scene caption slot (low priority).** The premium stage hides `.view-annotation` during preparation because the editorial panel sits over the same corner. If the engine later adds captions, an optional `captions?: boolean` prop on `Scene` (default `true`) would let the UI hide them without CSS reaching into engine DOM. No change is needed for the current build.

## 5. How to integrate this branch

1. Merge `feature/vyuha-premium-ui` into the integration branch after the engine branch, or in either order. Frontend and engine files do not overlap, so conflicts are not expected outside `App.tsx` if the engine branch also edited it (the contract assigns `App.tsx` to the frontend).
2. `client/src/main.tsx` imports `premium/premium.css` last; keep it last so the premium layer stays the single visual source of truth.
3. Run `cd client && npm test && npm run lint && npm run format:check && npm run build`. Branch result: 262/262 tests, lint and format clean, build reports 32 local offline assets.
4. Spot-check the routes listed in the final report at 390 px and 1440 px, including a live Shared Crew run with two role tabs.

## 6. Files added by this branch

- `client/src/premium/` — `premium.css` (entry), `fonts.css` + `fonts/` (Geist, Geist Mono, Instrument Serif, with OFL licences), `tokens.css`, `base.css`, `components.css`, `shell.css`, `training.css`, `preparation.css`, `review.css`, `instructor.css`, `crew.css`, `analytics.css`, `studio.css`, `utility.css`
- `client/src/ReviewSections.tsx` — in-page navigator for the after-action review
- `client/src/premium-ui.test.tsx` — premium-layer tests
- `docs/premium-ui/` — design direction, studies, progress, this document

Removed: `client/src/spatial-training.css` (fully replaced by `premium/training.css`, `preparation.css` and `review.css`).
