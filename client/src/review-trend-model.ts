import type { GhostSkill } from "./types";
export type ReviewTrendPoint = {
  sequence: number;
  session_id: string;
  means: Record<GhostSkill, number>;
};
/** Bounded chart rendering, with exact values retained in the complete table.
 * A baseline prior is included only when the plot starts at the first ledger entry. */
export function trendWindow(points: ReviewTrendPoint[], limit = 80) {
  const visible = points.slice(-Math.max(1, limit));
  return {
    visible,
    includesPrior: points.length <= Math.max(1, limit),
    omitted: points.length - visible.length,
  };
}
export function trendCoordinates(
  points: ReviewTrendPoint[],
  skill: GhostSkill,
) {
  const { visible, includesPrior } = trendWindow(points);
  const values = includesPrior
    ? [0.5, ...visible.map((p) => p.means[skill])]
    : visible.map((p) => p.means[skill]);
  return values.map((mean, index) => ({
    x: 48 + (index / Math.max(1, values.length - 1)) * 624,
    y: 188 - mean * 160,
    value: mean * 100,
  }));
}
