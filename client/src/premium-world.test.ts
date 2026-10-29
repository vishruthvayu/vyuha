import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { testPython } from "./test-python";
import { siteArchitecture } from "./world/site-architecture";
import {
  siteGeometryBudget,
  siteShadowProfile,
} from "./world/presentation-profile";
import { siteArrivalPose, type TrainingSite } from "./training-site-contract";
import type { Quality } from "./quality";
const sites = JSON.parse(
  execFileSync(
    testPython(),
    [
      "-c",
      "import json;from server.training_sites import training_site;print(json.dumps([training_site(x) for x in ('freight_corridor','open_campus')]))",
    ],
    { cwd: "..", encoding: "utf8" },
  ),
) as TrainingSite[];
test("premium all-sided architecture has finite metric attributes and remains inside frozen volumes at every quality", () => {
  for (const site of sites) {
    let prior = 0;
    for (const quality of ["low", "medium", "high"] as Quality[]) {
      let triangles = 0,
        bytes = 0;
      for (const s of site.structures) {
        for (const g of siteArchitecture(s, quality).merged().values()) {
          g.computeBoundingBox();
          const b = g.boundingBox!,
            eps = 0.0001;
          assert.ok(
            b.min.x >= s.x_min - eps &&
              b.max.x <= s.x_max + eps &&
              b.min.z >= s.z_min - eps &&
              b.max.z <= s.z_max + eps &&
              b.min.y >= -eps &&
              b.max.y <= s.height + eps,
          );
          for (const a of Object.values(g.attributes)) {
            assert.ok([...a.array].every(Number.isFinite));
            bytes += a.array.byteLength;
          }
          triangles += g.getAttribute("position").count / 3;
          g.dispose();
        }
      }
      assert.ok(triangles > prior);
      prior = triangles;
      assert.ok(
        triangles < siteGeometryBudget[quality].triangles &&
          bytes < siteGeometryBudget[quality].bytes,
      );
      console.info(
        JSON.stringify({ site: site.id, quality, triangles, bytes }),
      );
    }
  }
});
test("site shadows cover authored extents without per-frame shadow updates or changing legacy profiles", () => {
  assert.deepEqual(siteShadowProfile(undefined, "medium"), {
    radius: 170,
    resolution: 1024,
    distance: 400,
    far: 900,
  });
  for (const site of sites) {
    const q = siteShadowProfile(site, "medium");
    assert.equal(q.resolution, 2048);
    assert.ok(q.radius <= 900);
    for (const b of site.structures)
      assert.ok(
        q.radius >
          Math.hypot(
            Math.max(Math.abs(b.x_min), Math.abs(b.x_max)),
            Math.max(Math.abs(b.z_min), Math.abs(b.z_max)),
          ),
      );
    assert.equal(siteShadowProfile(site, "low").resolution, 0);
  }
});

test("architectural arrival uses only public geometry, clamps invalid time and honors reduced motion", () => {
  for (const site of sites) {
    const frozen = JSON.stringify(site),
      first = siteArrivalPose(site, 0),
      last = siteArrivalPose(site, 7);
    for (const t of [NaN, Infinity, -5])
      assert.deepEqual(siteArrivalPose(site, t), first);
    assert.deepEqual(siteArrivalPose(site, 100), last);
    assert.deepEqual(siteArrivalPose(site, 0, true), last);
    assert.ok(
      [
        ...Object.values(first.position),
        ...Object.values(last.position),
        ...Object.values(last.target),
      ].every(Number.isFinite),
    );
    assert.ok(
      Math.hypot(
        ...Object.keys(first.position).map(
          (k) =>
            first.position[k as keyof typeof first.position] -
            last.position[k as keyof typeof last.position],
        ),
      ) < 50,
    );
    assert.equal(JSON.stringify(site), frozen);
  }
});
