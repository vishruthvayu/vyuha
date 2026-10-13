# Precision Command design system

Implementation: client/src/design-system.css and UI.tsx. Legacy CSS remains as a compatibility baseline; a single centralized semantic layer governs allroutes. Components are native React/HTML using locally bundled Lucide icons and system fonts. No network font/script/asset dependency.

Foundations: graphite background; navy surface/raised/strong layers; ice-cyan action and focus; mint positive, amber caution and coral negative with text labels. Token families cover color,4/8/12/16/24/32/48spacing,6/10/16radii, typography, motion and dialog elevation. Aliases --lime/--border preserve existing callers. Motion140/220ms is event-based; prefers-reduced-motion disables transitions and animation. No continuous decorative radar/glow.

Reusable primitives: PageHeader, Panel, StatusPill, EmptyState, EvidenceDisclosure, LoadingWorkspace; existing Navigation/useModalFocus, SensorBadges, Radar, Ghost evidence and command lifecycle remain authoritative components. Native pressed buttons implement view selection; native details provide disclosures. Forms/buttons44px, focus3px, explicit states. Tables scroll within boundedcontainers; evidence values are never silently clipped. Charts include semantic labels, distinct series patterns and full numerical tables.

Layouts: persistent desktop navigation and optical/evidence workstation; tablet split layouts; phone contact/actions prioritized and stacked. Target widths360/390/428/768/1024/1280/1440/1920 require actual browser verification. Instructor is desktop-first; primary controls still wrap on phones. Decision path uses4/2/1columns. No major route is exempt.

Training default is adaptive unless explicitmode=scripted/legacy/library. Deep-linked AAR, assigned sessions and recovery are preserved. Unprepared adaptive entry shows a real empty state, not the legacy preview relabelled as a new raid. The heavy 3D renderer is lazy; Worker/scoring fidelity stays unchanged. Palette and camera interpolation affect rendering only; the filtered observed-state boundary remains intact.

Components may use documented layout geometry, but new spacing/color/radius values should use semantic tokens. New complex widgets require real focus/keyboard behavior, not decorative mock controls. Acceptance evidence is recorded separately; this specification does not itself certify implementation or cross-device usability.
