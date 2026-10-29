import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { testPython } from "./test-python";
import {
  trainingSiteLayout,
  validateTrainingSite,
  siteSurveyPose,
} from "./world/training-site";
import {
  siteArchitecture,
  addSiteStreetscape,
} from "./world/site-architecture";
import { facilityLayout, withoutBoxes } from "./world/layout";
import { buildFacility } from "./world/kit";
import { MATERIAL_THERMAL } from "./world/materials";
import { publicSurveyPose, surveyPosition } from "./world-survey";
import { observationEntry, loadObservationMission } from "./observation-entry";
import { siteMissionHref } from "./ObservationMissionJourney";
import TrainingSiteBrief from "./TrainingSiteBrief";
import type { Scenario } from "./types";
const fixtures = JSON.parse(
  execFileSync(
    testPython(),
    [
      "-c",
      `import json
from server.observation_missions_v3 import compile_mission
print(json.dumps([compile_mission(dict(template='timed_window',site=site)) for site in ('freight_corridor','open_campus')]))`,
    ],
    { cwd: "..", encoding: "utf8" },
  ),
) as Scenario[];

test("authored sites share exact authoritative footprints and bounded deterministic architecture", () => {
  for (const scenario of fixtures) {
    const site = scenario.training_site!;
    const before = JSON.stringify(site);
    validateTrainingSite(site, scenario.terrain_boxes!);
    let triangles = 0,
      bytes = 0,
      batches = 0;
    for (const structure of site.structures) {
      const geometry = siteArchitecture(structure).merged();
      batches += geometry.size;
      for (const [key, g] of geometry) {
        assert.ok(key in MATERIAL_THERMAL);
        g.computeBoundingBox();
        const b = g.boundingBox!;
        const e = 0.0001;
        assert.ok(
          b.min.x >= structure.x_min - e && b.max.x <= structure.x_max + e,
        );
        assert.ok(
          b.min.z >= structure.z_min - e && b.max.z <= structure.z_max + e,
        );
        assert.ok(b.min.y >= -e && b.max.y <= structure.height + e);
        for (const attr of ["position", "normal", "uv", "color"]) {
          const a = g.getAttribute(attr);
          assert.ok(a);
          assert.ok([...a.array].every(Number.isFinite));
          bytes += a.array.byteLength;
        }
        triangles += g.getAttribute("position").count / 3;
        g.dispose();
      }
    }
    assert.ok(triangles < 5000 && bytes < 1_000_000 && batches <= 24);
    console.info(
      JSON.stringify({
        site: site.id,
        structure_triangles: triangles,
        attribute_bytes: bytes,
        per_structure_material_batches: batches,
        environment_materials: "merged by material before mounting",
      }),
    );
    const l = trainingSiteLayout(
      "urban_outpost",
      scenario.terrain_boxes!,
      site,
    );
    assert.ok(l.placements.length < 120);
    const facility = buildFacility(l.placements, l.lines);
    addSiteStreetscape(facility, site);
    const merged = facility.merged();
    let facilityTriangles = 0,
      facilityBytes = 0;
    for (const g of merged.values()) {
      for (const a of Object.values(g.attributes)) {
        assert.ok([...a.array].every(Number.isFinite));
        facilityBytes += a.array.byteLength;
      }
      facilityTriangles += g.getAttribute("position").count / 3;
      g.dispose();
    }
    console.info(
      JSON.stringify({
        site: site.id,
        decorative_placements: l.placements.length,
        facility_triangles: facilityTriangles,
        facility_attribute_bytes: facilityBytes,
        facility_material_batches: merged.size,
      }),
    );
    assert.ok(
      merged.size <= 16 &&
        facilityTriangles < 100000 &&
        facilityBytes < 15_000_000,
    );
    assert.equal(JSON.stringify(site), before);
    assert.deepEqual(
      trainingSiteLayout("urban_outpost", scenario.terrain_boxes!, site),
      trainingSiteLayout("urban_outpost", scenario.terrain_boxes!, site),
    );
    assert.notDeepEqual(
      trainingSiteLayout("urban_outpost", scenario.terrain_boxes!, site),
      withoutBoxes(facilityLayout("urban_outpost"), scenario.terrain_boxes!),
    );
  }
});
test("new site validation fails closed, while historic worlds use their unchanged layout", () => {
  const s = fixtures[0],
    site = s.training_site!;
  assert.throws(() =>
    validateTrainingSite(
      { ...site, version: "future" } as never,
      s.terrain_boxes!,
    ),
  );
  assert.throws(() => validateTrainingSite(site, []));
  const bad = structuredClone(site);
  bad.structures[0].height += 1;
  assert.throws(() => validateTrainingSite(bad, s.terrain_boxes!));
  const future = structuredClone(site);
  future.surfaces[0].path[0][0] = NaN;
  assert.throws(() => validateTrainingSite(future, s.terrain_boxes!));
  assert.deepEqual(
    trainingSiteLayout("urban_outpost", s.terrain_boxes!),
    withoutBoxes(facilityLayout("urban_outpost"), s.terrain_boxes!),
  );
});
test("public site survey and plan never consume contacts or future opportunities", () => {
  for (const s of fixtures) {
    const site = s.training_site!,
      pose = siteSurveyPose(site);
    assert.deepEqual(publicSurveyPose("urban_outpost", site), pose);
    const reset = surveyPosition(
      { x: NaN, y: 0, z: 0 },
      "reset",
      "urban_outpost",
      site,
    );
    assert.deepEqual(reset, pose.position);
    const p = surveyPosition(pose.position, "closer", "urban_outpost", site);
    const r = Math.hypot(
      p.x - pose.target.x,
      p.y - pose.target.y,
      p.z - pose.target.z,
    );
    assert.ok(r >= 160 && r <= 1400);
    assert.ok(
      Math.hypot(
        pose.position.x - pose.target.x,
        pose.position.y - pose.target.y,
        pose.position.z - pose.target.z,
      ) <= 1400,
    );
    const html = renderToStaticMarkup(<TrainingSiteBrief site={site} />);
    assert.match(html, /public site plan/);
    assert.match(html, /no contacts or future reports/);
    assert.doesNotMatch(html, /T1|hostile|trajectory|request_schedule/);
  }
});
test("v3 launch admission binds site and exact version; old entries never acquire a new site", async () => {
  for (const s of fixtures) {
    const href = siteMissionHref(
      "timed_window",
      "practice",
      482913,
      s.training_site!.id,
    );
    const entry = observationEntry(href.split("?")[1]).entry!;
    assert.equal(entry.version, 3);
    let body: unknown;
    const result = await loadObservationMission(entry, async (path, b) => {
      assert.equal(path, "/observation-missions-v3/prepare");
      body = b;
      return s;
    });
    assert.equal((body as { site: string }).site, s.training_site!.id);
    assert.equal(result, s);
    const other = fixtures.find(
      (v) => v.training_site!.id !== s.training_site!.id,
    )!;
    await assert.rejects(
      () => loadObservationMission(entry, async () => other),
      /site does not match/,
    );
  }
  assert.ok(observationEntry("?mission_version=3&mission_site=future").error);
  assert.ok(
    observationEntry(
      "?mission_template=timed_window&mission_version=2&mission_site=freight_corridor",
    ).error,
  );
  assert.ok(
    observationEntry(
      "?mission_template=timed_window&mission_version=3&mission_site=freight_corridor&mission_site=open_campus",
    ).error,
  );
  assert.equal(
    observationEntry("?mission_template=timed_window").entry?.version,
    undefined,
  );
});
