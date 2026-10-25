import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BufferGeometry } from "three";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Scene } from "./Scene";
import { makeScenario } from "./scenario";
import { Simulation } from "./sim";
import { sensorConfiguration, defaultSensorConfig } from "./sensors-v2";
import { createTerrainGeometry, terrainHeight } from "./world/terrain";
import {
  displayVisibility,
  displayFogDensity,
} from "./world/displayVisibility";
import { pixelsOnTarget, inspectionResolution } from "./InspectionPass";
import {
  worldPresentationEnvelope,
  WORLD_EVIDENCE_MARGIN_M,
} from "./world/world-envelope";

test("default scenario retains the exact existing world clearance", () => {
  const envelope = worldPresentationEnvelope();
  assert.equal(envelope.flatRadius, 1700);
  assert.equal(envelope.maximumOpticalRange, 1500);
  assert.equal(envelope.opticalFootprintRadius, 1500);
  assert.equal(envelope.hasRelief, true);
  assert.equal(envelope.requiresExpandedWorld, false);
});

test("full configured optical sphere fits inside the required flat disc for offset origins", () => {
  for (const origin of [
    { x: 0, z: 0, altitude: 2 },
    { x: 300, z: 400, altitude: 100 },
    { x: -700, z: -2400, altitude: -5 },
  ])
    for (const [eo, ir] of [
      [50, 50],
      [1500, 1200],
      [10000, 10000],
    ]) {
      const envelope = worldPresentationEnvelope(
        { eo_max_range_m: eo, ir_max_range_m: ir },
        origin,
      );
      const range = Math.max(eo, ir);
      for (let angle = 0; angle < Math.PI * 2; angle += 0.13) {
        const x = origin.x + Math.sin(angle) * range;
        const z = origin.z + Math.cos(angle) * range;
        assert.ok(
          Math.hypot(x, z) + WORLD_EVIDENCE_MARGIN_M <=
            envelope.flatRadius + 1e-8,
        );
      }
    }
});

test("large valid origins require explicit world expansion and cannot authorize relief", () => {
  const envelope = worldPresentationEnvelope(
    { eo_max_range_m: 10000 },
    { x: 9000, z: 12000, altitude: 2 },
  );
  assert.equal(envelope.flatRadius, 25200);
  assert.equal(envelope.hasRelief, false);
  assert.equal(envelope.requiresExpandedWorld, true);
});

test("origin altitude cannot falsely shrink the conservative horizontal footprint", () => {
  const a = worldPresentationEnvelope(undefined, { x: 3, z: 4, altitude: 2 });
  const b = worldPresentationEnvelope(undefined, {
    x: 3,
    z: 4,
    altitude: 9000,
  });
  assert.equal(a.opticalFootprintRadius, b.opticalFootprintRadius);
  assert.equal(a.flatRadius, b.flatRadius);
});

test("invalid configuration/origins fail explicitly instead of manufacturing default safety", () => {
  for (const n of [NaN, Infinity, -Infinity])
    for (const axis of ["x", "z", "altitude"] as const)
      assert.throws(() =>
        worldPresentationEnvelope(undefined, {
          x: 0,
          z: 0,
          altitude: 2,
          [axis]: n,
        }),
      );
  for (const range of [NaN, Infinity, 0, 10001])
    assert.throws(() => worldPresentationEnvelope({ eo_max_range_m: range }));
  assert.throws(() =>
    worldPresentationEnvelope(undefined, {
      x: Number.MAX_VALUE,
      z: Number.MAX_VALUE,
      altitude: 2,
    }),
  );
});

test("envelope owns immutable copies and never mutates accepted scenario configuration", () => {
  const origin = { x: 300, z: 400, altitude: 2 };
  const config = { eo_max_range_m: 3000 };
  const envelope = worldPresentationEnvelope(config, origin);
  origin.x = 999;
  config.eo_max_range_m = 5000;
  assert.equal(envelope.sensorOrigin.x, 300);
  assert.equal(envelope.maximumOpticalRange, 3000);
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.sensorOrigin));
  assert.equal(Reflect.set(envelope, "flatRadius", 0), false);
});

test("frozen default terrain vertex, normal and index buffers retain their exact prior hashes", () => {
  const baseline = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/world-presentation/default-terrain.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(baseline.source_commit, "7729c40");
  const digest = (g: BufferGeometry) => {
    const hash = createHash("sha256");
    for (const name of Object.keys(g.attributes).sort()) {
      const a = g.attributes[name];
      hash.update(name);
      hash.update(
        new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength),
      );
    }
    const a = g.index!;
    hash.update(
      new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength),
    );
    return hash.digest("hex");
  };
  for (const kind of ["urban_outpost", "rural_forward_base"] as const)
    for (const detail of [0.6, 1]) {
      const expected = baseline.geometries[`${kind}:${detail}`];
      for (const flatRadius of [
        undefined,
        worldPresentationEnvelope().flatRadius,
      ]) {
        const g = createTerrainGeometry(kind, detail, flatRadius);
        assert.equal(digest(g), expected.digest);
        assert.equal(g.attributes.position.count, expected.vertices);
        assert.equal(g.index!.count, expected.indices);
        g.dispose();
      }
    }
});

test("configured terrain is flat throughout extended/offset optical footprints and retains outer relief", () => {
  const origin = { x: 1000, z: 0, altitude: 2 };
  const envelope = worldPresentationEnvelope({ eo_max_range_m: 10000 }, origin);
  assert.equal(envelope.supported, true);
  assert.equal(envelope.flatRadius, 11200);
  for (const kind of ["urban_outpost", "rural_forward_base"] as const) {
    for (let radius = 0; radius <= 10000; radius += 500)
      for (let angle = 0; angle < Math.PI * 2; angle += 0.2)
        assert.equal(
          terrainHeight(
            origin.x + Math.sin(angle) * radius,
            Math.cos(angle) * radius,
            kind,
            envelope.flatRadius,
          ),
          0,
        );
    const g = createTerrainGeometry(kind, 1, envelope.flatRadius);
    const p = g.attributes.position;
    let relief = 0;
    for (let i = 0; i < p.count; i++) {
      if (Math.hypot(p.getX(i), p.getZ(i)) <= envelope.flatRadius)
        assert.equal(p.getY(i), 0);
      else if (p.getY(i) > 0) relief++;
    }
    assert.ok(relief > 0);
    g.dispose();
  }
});

test("default display haze retains the exact prior interpolation/density and overrides follow declared values", () => {
  for (const fog of [-1, 0, 0.15, 0.5, 1, 2, NaN]) {
    const f = Math.min(1, Math.max(0, Number.isFinite(fog) ? fog : 0));
    const expected = 20000 * Math.pow(200 / 20000, f);
    assert.equal(displayVisibility(fog), expected);
    assert.equal(displayVisibility(fog, defaultSensorConfig), expected);
    assert.equal(displayFogDensity(fog, false), 1.6 / expected);
    assert.equal(displayFogDensity(fog, true), 1.6 / (expected * (1 / 0.45)));
  }
  const config = sensorConfiguration({
    clear_visibility_m: 10000,
    dense_visibility_m: 1000,
    ir_fog_factor: 0.8,
  });
  assert.equal(displayVisibility(0, config), 10000);
  assert.equal(displayVisibility(1, config), 1000);
  assert.equal(displayVisibility(0.5, config), 10000 * Math.pow(0.1, 0.5));
  assert.equal(
    displayFogDensity(0.5, true, config),
    1.6 / (displayVisibility(0.5, config) * (1 / 0.8)),
  );
});

test("inspection uses frozen EO/IR IFOV without mistaking display zoom for new resolution", () => {
  const config = sensorConfiguration({
    eo_ifov_rad: 0.00024,
    ir_ifov_rad: 0.00009,
  });
  assert.equal(
    pixelsOnTarget("multirotor", 500, "eo", config),
    pixelsOnTarget("multirotor", 500, "eo") / 2,
  );
  assert.equal(
    pixelsOnTarget("multirotor", 500, "ir", config),
    pixelsOnTarget("multirotor", 500, "ir") * 2,
  );
  assert.ok(
    inspectionResolution(pixelsOnTarget("multirotor", 500, "eo", config)) <
      inspectionResolution(pixelsOnTarget("multirotor", 500, "eo")),
  );
  const before = JSON.stringify(config);
  pixelsOnTarget("fixed_wing", 1000, "eo", config);
  assert.equal(JSON.stringify(config), before);
});

test("far clip encloses the sky from supported offset origins; oversized public views fall back explicitly", () => {
  const shifted = worldPresentationEnvelope(
    { eo_max_range_m: 50, ir_max_range_m: 50 },
    { x: 13000, z: 0, altitude: 2 },
  );
  assert.equal(shifted.supported, true);
  assert.ok(shifted.farClip > 28000);
  const far = worldPresentationEnvelope(undefined, {
    x: 20000,
    z: 0,
    altitude: 2,
  });
  assert.equal(far.supported, false);
  assert.equal(
    worldPresentationEnvelope(undefined, { x: 0, z: 0, altitude: 20000 })
      .supported,
    false,
  );
  const props = {
    state: new Simulation(makeScenario()).snapshot(),
    vision: "day" as const,
    selected: null,
    onFps: () => {},
    fallback: createElement("p", {}, "Use tactical fallback"),
  };
  assert.equal(
    renderToStaticMarkup(
      createElement(Scene, {
        ...props,
        sensorOrigin: { x: 20000, z: 0, altitude: 2 },
      }),
    ),
    "<p>Use tactical fallback</p>",
  );
  assert.equal(
    renderToStaticMarkup(
      createElement(Scene, { ...props, sensorConfig: { eo_ifov_rad: NaN } }),
    ),
    "<p>Use tactical fallback</p>",
  );
});
