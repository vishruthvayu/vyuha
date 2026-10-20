import test from "node:test";
import assert from "node:assert/strict";
import {
  trendCoordinates,
  trendWindow,
  type ReviewTrendPoint,
} from "./review-trend-model";
function point(sequence: number, mean: number): ReviewTrendPoint {
  return {
    sequence,
    session_id: `synthetic-${sequence}`,
    means: {
      detection: mean,
      classification_iff: mean,
      effector_choice: mean,
      degraded_sensor_response: mean,
    },
  };
}
test("Trend coordinates retain actual persisted means and separately declared prior, without mutating history", () => {
  const points = [point(1, 0.625), point(2, 0.75)];
  const before = structuredClone(points);
  const plotted = trendCoordinates(points, "detection");
  assert.deepEqual(
    plotted.map((p) => p.value),
    [50, 62.5, 75],
  );
  assert.equal(plotted[2].y, 68);
  assert.deepEqual(points, before);
});
test("Long trend plot bounds rendering and does not join truncated history to the original prior", () => {
  const points = Array.from({ length: 100 }, (_, i) =>
    point(i + 1, (i + 1) / 101),
  );
  const bounded = trendWindow(points);
  assert.equal(bounded.visible.length, 80);
  assert.equal(bounded.omitted, 20);
  assert.equal(bounded.includesPrior, false);
  const plotted = trendCoordinates(points, "effector_choice");
  assert.equal(plotted.length, 80);
  assert.equal(plotted[0].value, points[20].means.effector_choice * 100);
});
