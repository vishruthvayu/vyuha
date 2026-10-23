import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BenchmarkReport } from "./Benchmark";
test("running benchmark never serializes an expanded receipt or exposes a partial export as final", () => {
  const report = {
    toJSON: () => {
      throw new Error("Expensive live serialization");
    },
  };
  const html = renderToStaticMarkup(
    <BenchmarkReport running report={report} />,
  );
  assert.match(html, /available after the worker acknowledges stop/);
  assert.equal(html.includes("benchmark-report"), false);
});
test("stopped receipt includes its source and captured viewport for independent reproduction", () => {
  const report = {
    source: { commit: "a".repeat(40), source_hash: "b".repeat(64) },
    viewport_at_run: {
      css_width: 1440,
      css_height: 900,
      device_pixel_ratio: 2,
      visual_scale: 1,
    },
  };
  const html = renderToStaticMarkup(
    <BenchmarkReport running={false} report={report} />,
  );
  assert.match(html, /benchmark-report/);
  assert.match(html, /1440/);
  assert.match(html, /bbbbbbbb/);
});
