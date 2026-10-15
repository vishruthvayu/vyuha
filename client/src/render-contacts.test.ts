import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { replay, score } from "./sim";
import { makeScenario } from "./scenario";
import { ObservationVisibility, type VisibleTrack } from "./visibility";
import {
  ObservedPoseBuffer,
  RenderFrameMeter,
  opticalFov,
  renderContacts,
  wingAngle,
  type RenderContact,
} from "./render-contacts";
import { createAirframeParts } from "./airframe-geometry";
import {
  createSkyTexture,
  createSurfaceTexture,
  skyPixels,
  surfacePixels,
} from "./surface-textures";

const source = replay(makeScenario(812), [], 150).snapshot().tracks[0];
function visible(overrides: Partial<VisibleTrack> = {}): VisibleTrack {
  return {
    ...source,
    id: "observed",
    active: true,
    x: 20,
    z: 80,
    altitude: 15,
    visual_level: "identify",
    visual_shape: "multirotor",
    ...overrides,
  };
}
const point: RenderContact = {
  id: "sample",
  x: 0,
  y: 12,
  z: 80,
  shape: "multirotor",
};

test("Renderer descriptor strips hidden identity/type/radio/motion and preserves only the permitted silhouette", () => {
  const expected = renderContacts([visible()]);
  for (const kind of ["quad", "fiber_fpv", "fixed_wing", "bird"] as const)
    for (const identity of ["friendly", "hostile", "neutral"] as const) {
      const track = visible({
        kind,
        identity,
        rf: kind !== "fiber_fpv",
        classification: kind,
      });
      const before = structuredClone(track);
      assert.deepEqual(renderContacts([track]), expected);
      assert.deepEqual(track, before);
    }
  assert.deepEqual(Object.keys(expected[0]).sort(), [
    "id",
    "shape",
    "x",
    "y",
    "z",
  ]);
  assert.equal(
    renderContacts([
      visible({ visual_level: "detect", visual_shape: "bird" }),
    ])[0].shape,
    "unresolved",
  );
  assert.equal(
    renderContacts([visible({ visual_level: "none" })])[0].shape,
    "unresolved",
  );
  assert.equal(
    renderContacts([visible({ visual_shape: "fixed_wing" })])[0].shape,
    "fixed_wing",
  );
  assert.deepEqual(
    renderContacts([
      visible({ active: false }),
      visible({ x: NaN }),
      visible({ altitude: Infinity }),
    ]),
    [],
  );
});

test("No optical sample and optical failure cannot reach a rendered airframe, even with radar/history/selection truth", () => {
  const state = replay(makeScenario(), [], 150).snapshot();
  state.tracks = [
    {
      ...visible(),
      thermal: false,
      radar: true,
      detected: 0,
      observation: undefined,
    },
  ];
  const visibility = new ObservationVisibility();
  assert.deepEqual(
    renderContacts(visibility.tracks(state, "day", { key: "training" })),
    [],
  );
  assert.deepEqual(
    renderContacts(
      visibility.tracks(state, "thermal", {
        key: "training",
        opticalAvailable: false,
      }),
    ),
    [],
  );
  assert.equal(
    renderContacts(
      visibility.tracks(state, "day", {
        key: "labelled-qa-reference",
        groundTruth: true,
      }),
    ).length,
    1,
  );
  assert.deepEqual(
    renderContacts(visibility.tracks(state, "day", { key: "training" })),
    [],
  );
});

test("Rendered position interpolates inside consecutive observed samples and never extrapolates a missing track", () => {
  const buffer = new ObservedPoseBuffer();
  buffer.update([point], 20, "session/day");
  buffer.update([{ ...point, x: 10, y: 18, z: 100 }], 21, "session/day");
  buffer.forEachFrame(1 / 60, (p) => {
    assert.ok(p.displayX > 0 && p.displayX < 10);
    assert.ok(p.displayY > 12 && p.displayY < 18);
    assert.ok(p.displayZ > 80 && p.displayZ < 100);
  });
  for (let i = 0; i < 300; i++)
    buffer.forEachFrame(1 / 60, (p) =>
      assert.ok(p.displayX >= 0 && p.displayX <= 10),
    );
  buffer.update([], 22, "session/day");
  assert.deepEqual(buffer.snapshot(), []);
  buffer.update([{ ...point, x: -500 }], 23, "session/day");
  assert.equal(buffer.snapshot()[0].displayX, -500);
});

test("Context, vision, seek and new silhouette reset presentation instead of carrying prior transforms across evidence", () => {
  for (const [tick, context] of [
    [10, "new-session"],
    [10, "same/thermal"],
    [1, "same/day"],
    [40, "same/day"],
  ] as const) {
    const buffer = new ObservedPoseBuffer();
    buffer.update([point], 10, "same/day");
    buffer.update([{ ...point, x: 5 }], 11, "same/day");
    buffer.forEachFrame(1 / 60, () => {});
    buffer.update([{ ...point, x: 200 }], tick, context);
    assert.equal(buffer.snapshot()[0].displayX, 200);
    assert.equal(buffer.snapshot()[0].heading, 0);
  }
  const buffer = new ObservedPoseBuffer();
  buffer.update([point], 1, "a");
  buffer.update([{ ...point, x: 9, shape: "unresolved" }], 2, "a");
  assert.equal(buffer.snapshot()[0].displayX, 9);
});

test("Heading follows consecutive observed movement rather than line-of-bearing, raw motion or hidden classification", () => {
  const buffer = new ObservedPoseBuffer();
  buffer.update([point], 0, "a");
  buffer.update([{ ...point, x: 2 }], 1, "a");
  assert.equal(buffer.snapshot()[0].heading, Math.PI / 2);
  buffer.update([{ ...point, x: 2, z: 82 }], 2, "a");
  assert.equal(buffer.snapshot()[0].heading, 0);
  buffer.forEachFrame(1, (p) => assert.equal(p.displayZ, 82));
});

test("Reduced motion snaps to permitted observation and logical animation freezes on pause/repeats after seek", () => {
  const buffer = new ObservedPoseBuffer();
  buffer.update([point], 10, "a");
  buffer.update([{ ...point, x: 3 }], 11, "a");
  buffer.forEachFrame(0.016, (p) => assert.equal(p.displayX, 3), true);
  const frozen = wingAngle("bird-contact", 330);
  for (let i = 0; i < 100; i++)
    assert.equal(wingAngle("bird-contact", 330), frozen);
  assert.ok(Math.abs(wingAngle("bird-contact", 331)) <= 0.38);
  assert.equal(wingAngle("bird-contact", 330), frozen);
});

test("Optical zoom is a finite bounded crop, with default framing unchanged", () => {
  assert.ok(Math.abs(opticalFov(38) - 38) < 1e-10);
  assert.ok(opticalFov(38, 2) < 38);
  assert.equal(opticalFov(38, 99), opticalFov(38, 6));
  assert.equal(opticalFov(38, -3), opticalFov(38));
  for (const zoom of [NaN, Infinity, -Infinity])
    assert.equal(opticalFov(52, zoom), opticalFov(52));
});

test("Original airframes are finite merged geometry, bounded in scale and constant in batch count across contact workloads", () => {
  const vertexCounts: number[] = [];
  for (const quality of ["low", "medium", "high"] as const) {
    const parts = createAirframeParts(quality);
    assert.equal(parts.length, 9);
    let vertices = 0;
    for (const { geometry } of parts) {
      const positions = geometry.getAttribute("position");
      vertices += positions.count;
      assert.equal(positions.count % 3, 0);
      assert.ok([...positions.array].every(Number.isFinite));
      assert.ok(
        [...geometry.getAttribute("normal").array].every(Number.isFinite),
      );
      assert.ok(
        geometry.boundingSphere!.radius > 0 &&
          geometry.boundingSphere!.radius < 5,
      );
      assert.equal(geometry.groups.length, 0);
      geometry.dispose();
    }
    assert.deepEqual(
      parts
        .filter((p) => p.wing)
        .map((p) => p.wing)
        .sort(),
      [-1, 1],
    );
    vertexCounts.push(vertices);
  }
  assert.ok(
    vertexCounts[0] < vertexCounts[1] && vertexCounts[1] < vertexCounts[2],
  );
});

test("Paint and sky use reproducible local bounded pixels and disposable GPU textures without new terrain volumes", () => {
  const digest = (data: {
    buffer: ArrayBufferLike;
    byteOffset: number;
    byteLength: number;
  }) =>
    createHash("sha256")
      .update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
      .digest("hex");
  for (const quality of ["low", "medium", "high"] as const) {
    for (const style of ["ground", "facade"] as const) {
      const texture = createSurfaceTexture(quality, style);
      const { data, width, height } = texture.image;
      assert.ok(width === height && width <= 256);
      assert.equal(data.length, width * height * 4);
      assert.equal(digest(data), digest(surfacePixels(width, style)));
      assert.equal(texture.generateMipmaps, true);
      let disposed = false;
      texture.addEventListener("dispose", () => {
        disposed = true;
      });
      texture.dispose();
      assert.equal(disposed, true);
    }
  }
  for (const vision of ["day", "night", "thermal"] as const)
    for (const palette of ["white", "black", "amber"] as const) {
      const pixels = skyPixels(vision, true, palette);
      assert.equal(pixels.data.length, 256 * 128 * 4);
      assert.equal(
        digest(pixels.data),
        digest(skyPixels(vision, true, palette).data),
      );
      const texture = createSkyTexture(vision, true, palette);
      texture.dispose();
    }
});

test("Geometry, visibility descriptors, interpolation and crop cannot mutate historical simulation or scorecards", () => {
  const engine = replay(makeScenario(812), [], 330);
  const before = structuredClone(engine.snapshot()),
    card = structuredClone(score(engine));
  const visibility = new ObservationVisibility();
  const observed = visibility.tracks(before, "thermal", { key: "immutable" });
  const buffer = new ObservedPoseBuffer();
  buffer.update(renderContacts(observed), before.tick, "immutable");
  for (let i = 0; i < 60; i++) buffer.forEachFrame(1 / 60, () => {});
  const parts = createAirframeParts("high");
  parts.forEach((p) => p.geometry.dispose());
  opticalFov(38, 6);
  assert.deepEqual(engine.snapshot(), before);
  assert.deepEqual(score(engine), card);
});

test("Camera context remount starts a full FPS window without false zero samples or automatic-quality demotion", () => {
  for (const epoch of [0, 60, 600]) {
    const meter = new RenderFrameMeter();
    assert.equal(meter.sample(epoch), null);
    for (let i = 1; i < 60; i++)
      assert.equal(meter.sample(epoch + i / 60), null);
    assert.equal(meter.sample(epoch + 1), 60);
    assert.equal(meter.sample(epoch + 1 + 1 / 60), null);
    assert.equal(meter.sample(NaN), null);
    assert.equal(meter.sample(0), null);
  }
});

test("Frame interval diagnostics report actual bounded callback intervals and retain stalls without calling them GPU duration", () => {
  const meter = new RenderFrameMeter();
  meter.sample(60);
  for (let i = 1; i <= 60; i++) meter.sample(60 + i / 60);
  const stable = meter.frameIntervals()!;
  assert.equal(stable.samples, 60);
  assert.ok(Math.abs(stable.medianMs - 1000 / 60) < 1e-7);
  assert.ok(Math.abs(stable.p95Ms - 1000 / 60) < 1e-7);
  const stall = new RenderFrameMeter();
  stall.sample(0);
  stall.sample(0.01);
  stall.sample(0.02);
  stall.sample(1.1);
  assert.equal(stall.frameIntervals()!.samples, 3);
  assert.ok(Math.abs(stall.frameIntervals()!.maxMs - 1080) < 1e-7);
  const bounded = new RenderFrameMeter();
  bounded.sample(0);
  for (let i = 1; i <= 500; i++) bounded.sample(i / 500);
  assert.equal(bounded.frameIntervals()!.samples, 240);
});
