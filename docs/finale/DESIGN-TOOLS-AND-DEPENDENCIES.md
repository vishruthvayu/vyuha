# Design tools, resources and dependency decisions

Recorded 14 October 2026 for `feature/vyuha-ultimate-experience`. This distinguishes callable tools, catalog availability, reviewed source and installed product dependencies. A public repository or a catalog suggestion is not evidence that a connector was installed or invoked. The rejected 8048 palette study is historical exploration, not final design acceptance.

## Actual tool availability and use

The root's current tool/plugin discovery reported the following. Optional Figma/MagicPath suggestions had already been made recently; no duplicate installation suggestion or new account/key request was issued by this workstream.

| Capability | Observed availability | Actual use / decision | Boundary |
|---|---|---|---|
| CUA browser automation and screenshot inspection | Callable in this task | Primary actual browser route/state/interaction/viewport screenshots through the supported CUA surface | Browser locators can be Playwright-style; this does not mean standalone Playwright MCP is installed. Child reviewer did not operate CUA concurrently |
| Shell, Git and package tools | Callable, with filesystem/network sandbox boundaries | Source recovery, diff/ref checks, tests, build and local clean clone; existing Git remote retained | Child socket/tsx-CLI IPC bind EPERM was explicitly recorded; root executed the live harness in its authorized environment |
| Web access and local image inspection | Callable | Read primary resource documentation/licences; inspect genuine local screenshots | Research images/metrics are not invented product evidence |
| Independent collaborating agents | Available and explicitly authorized by the user | Command/workflow, review/analytics and engineering reviews with disjoint ownership | No fabricated independence score; actual rendered final critique remains required |
| Figma | Catalog-available, not installed/connected | Optional connection suggestion already surfaced; no Figma design/import/export tool was used | No claim that an editable Figma artifact or handoff was produced |
| MagicPath | Catalog-available, not installed/connected | Optional suggestion already surfaced; supported local React/browser exploration continues | No MagicPath-generated design claim |
| 21st MCP / legacy Magic MCP | No callable installed connector in this session | Official repository/setup docs read; not installed or called | Current hosted MCP needs authenticated access/key. No credentials requested in chat; optional hosted generation is not a training runtime dependency |
| Playwright MCP | Not installed | Official source/docs researched; equivalent supported CUA browser workflow used | No standalone MCP server claim |
| Chrome DevTools MCP | Not installed | Official source/licence researched; no DevTools MCP session used | Do not infer a trace/profile from capability discovery |
| Context7 | Not installed | Official repository/licence researched; primary documentation accessed directly | No Context7 lookup invocation claim |
| Anthropic frontend-design guidance | Public external `SKILL.md` read; not an installed local Codex skill | Distinct structure, intentional typography, content-led controls and screenshot critique inform the new brief | No claim that an unlisted local skill/plugin was installed; user brief takes precedence |

Optional connected services may need user account authorization, but unavailable services do not block independent software work. No API keys are committed, pasted into chat or stored in release receipts.

## Official resource and licence review

Each link is an authentic upstream resource consulted during the mission. Licence classifications are based on the linked primary licence files, not inferred from popularity. Public docs may describe versions beyond our lock; use installed/API-compatible behavior and freeze an exact published version before adopting anything new.

| Resource | Primary source / licence | Compatibility, cost and offline decision |
|---|---|---|
| 21st / Magic MCP | [Official repository](https://github.com/21st-dev/magic-mcp), [setup](https://21st.dev/mcp), [ISC licence](https://raw.githubusercontent.com/21st-dev/magic-mcp/main/LICENSE) | Legacy package is now a compatibility proxy for hosted 21st. Research-only here. Generated/retrieved components would need their own licence/dependency review; no cloud service added to training |
| Frontend Design | [Official guidance](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md), [Apache-2.0 terms](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/LICENSE.txt) | Apply reviewed principles to original VYUHA composition. No source-layout copying, framework migration or local skill installation claim |
| shadcn/ui | [Documentation](https://ui.shadcn.com), [MIT licence](https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md) | Useful component/focus reference; copying a dashboard kit is rejected. Not added as a runtime dependency or Tailwind migration |
| Radix UI | [Accessibility guidance](https://www.radix-ui.com/primitives/docs/overview/accessibility), [MIT licence](https://raw.githubusercontent.com/radix-ui/primitives/main/LICENSE) | Native controls and existing tested modal ownership cover present needs. No partial ARIA tabs or unnecessary primitive dependency |
| Magic UI | [Official source](https://github.com/magicuidesign/magicui), [MIT licence](https://raw.githubusercontent.com/magicuidesign/magicui/main/LICENSE.md) | Research selected interaction ideas; avoid decorative animated-card defaults and new runtime cost. Not installed |
| Motion Primitives | [Official source](https://github.com/ibelick/motion-primitives), [MIT licence](https://raw.githubusercontent.com/ibelick/motion-primitives/main/LICENCE.md) | Component patterns use Motion/Tailwind and are labelled beta upstream. Research-only; adapting a component requires semantic/accessibility/bundle review |
| Motion | [Documentation](https://motion.dev), [MIT licence](https://raw.githubusercontent.com/motiondivision/motion/main/LICENSE.md) | No new animation dependency. Existing small CSS interactions and reduced-motion handling are adequate unless measured value justifies more |
| Lucide | [Documentation](https://lucide.dev), [ISC plus inherited Feather MIT notices](https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE) | Existing locked `lucide-react` 0.468.0 is used. Preserve notices; named icons communicate controls rather than fictitious telemetry |
| Playwright MCP | [Official repository](https://github.com/microsoft/playwright-mcp), [Apache-2.0 licence](https://raw.githubusercontent.com/microsoft/playwright-mcp/main/LICENSE) | Research-only connector. No new browser control/server installation; CUA supplies current supported automation |
| Chrome DevTools MCP | [Official repository](https://github.com/ChromeDevTools/chrome-devtools-mcp), [Apache-2.0 licence](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/LICENSE) | Research-only; no invented DevTools trace or performance audit |
| Context7 | [Official repository](https://github.com/upstash/context7), [MIT licence](https://raw.githubusercontent.com/upstash/context7/master/LICENSE) | Primary APIs were read directly, so no additional connector is needed for this implementation |
| Three.js | [Pinned r180 renderer API](https://raw.githubusercontent.com/mrdoob/three.js/r180/docs/api/en/renderers/WebGLRenderer.html), [MIT licence](https://raw.githubusercontent.com/mrdoob/three.js/r180/LICENSE) | Existing locked 0.180.0 is used. Improve framing/light/material reuse with current APIs; preserve observation inputs and worker/scoring fidelity |
| React Three Fiber | [Performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [Canvas API](https://r3f.docs.pmnd.rs/api/canvas), [MIT licence](https://github.com/pmndrs/react-three-fiber/blob/master/LICENSE) | Existing locked 9.8.1 is used. Actual local peer contract accepts React/ReactDOM >=19 and <19.4, Three >=0.156; local React/DOM 19.3.0 satisfies it |
| Drei | [Official repository](https://github.com/pmndrs/drei), [MIT licence](https://github.com/pmndrs/drei/blob/master/LICENSE), [Environment](https://drei.docs.pmnd.rs/staging/environment), [Instances](https://drei.docs.pmnd.rs/performances/instances) | Not installed. Current upstream peers fit Fiber9/React19/Three>=0.159 in principle, but dependency/transitive/bundle scope must be checked for an exact release. Remote HDRI presets are rejected for offline runtime; use reviewed local assets only |

No general vulnerability-free claim is made. Licence/peer review is not a supply-chain audit. Known development warnings from locked ESLint/whatwg tooling remain recorded; a deprecation alone is not a reproduced runtime vulnerability. No dependency upgrade was made solely to remove a warning.

## Principles actually selected

The user's requested alternatives must differ in spatial structure and interaction, not just cyan/amber/sage accents. The external design guidance supports deliberate content-driven hierarchy, typography and one strong composition; decorative all-caps labels, identical cards, gradients and arbitrary numbered markers cannot replace that work. The required original functional architecture/rendered selection gate remains OPEN.

Keep all assets/services local during training. Drei's Environment documentation specifically warns that presets rely on CDNs; this mission adds no preset/font/model network dependency. Library MIT/ISC/Apache terms do not automatically cover a separate texture/HDRI/font/model: review its provenance/licence and bundle it before use. No third-party bitmap/model was acquired by this documentation workstream.

Preserve current observation filtering, modality-specific uncertainty and truthful AAR labels. Cinematic camera framing, static terrain readability and purposeful HUD organization may improve presentation; no decorative contact or hidden canonical identity may appear in a live trainee view. Runtime render optimization must not reduce the authoritative 30Hz simulation or alter score histories.

Current bundle evidence is a milestone: clean b7d0aed build produced 28 local assets, with Three/Scene deferred into an approximately 890kB chunk. Code splitting improves the critical-path opportunity; it does not prove faster first interaction, lower total offline-cache download or lower GPU memory without measurements. Final selected architecture needs same-environment before/after startup, rendering/interaction, repeated mount/cleanup and reduced-motion checks.

See [MASTER-ISSUE-CLOSURE.md](MASTER-ISSUE-CLOSURE.md) for actual and pending acceptance. The supplied RC2 89/100 is historical; no new Ultimate design score or stable approval is awarded by resource research.
