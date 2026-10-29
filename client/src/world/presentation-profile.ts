import type { Quality } from "../quality";
import type { TrainingSite } from "../training-site-contract";
/** Presentation-only revision. Sensor configuration and footprints never enter
 * artistic quality selection. Low retains the earlier small geometry budget. */
export const SITE_PRESENTATION_VERSION = "industrial-theatre-v2";
export const siteGeometryBudget = {
  low: { triangles: 5000, bytes: 1_000_000 },
  medium: { triangles: 20000, bytes: 3_000_000 },
  high: { triangles: 30000, bytes: 4_000_000 },
  tactical: { triangles: 5000, bytes: 1_000_000 },
} as const;
export function siteShadowProfile(
  site: TrainingSite | undefined,
  quality: Quality,
) {
  const radius = site
    ? Math.min(
        900,
        Math.max(
          360,
          ...site.structures.map(
            (b) =>
              Math.hypot(
                Math.max(Math.abs(b.x_min), Math.abs(b.x_max)),
                Math.max(Math.abs(b.z_min), Math.abs(b.z_max)),
              ) + 80,
          ),
        ),
      )
    : 170;
  return {
    radius,
    resolution:
      quality === "low" ? 0 : site ? 2048 : quality === "high" ? 2048 : 1024,
    distance: site ? radius * 2 : 400,
    far: site ? radius * 4 + 500 : 900,
  };
}
