import { diagnosticPhase, diagnosticWorkerDelivery } from "./diagnostics";
import PerformanceDiagnostics from "./PerformanceDiagnostics";
import { PageHeader } from "./UI";
import { useEffect, useRef, useState } from "react";
import { makeScenario } from "./scenario";
import { Scene } from "./LazyScene";
import type { Vision } from "./visibility";
import {
  palettes,
  type ThermalPalette,
  type CameraPreset,
} from "./presentation";
import { Radar } from "./Radar";
import { Simulation } from "./sim";
import { qualityAfterSamples, type Quality } from "./quality";
import { defaultResponseConfig } from "./response-v2";
import type { Scenario, Snapshot } from "./types";
import { download } from "./storage";
export function scaleScenario(count: number) {
  if (![8, 25, 50, 100, 200].includes(count))
    throw new Error("Unsupported benchmark contact count");
  const s = makeScenario(62147);
  const original = s.tracks;
  return {
    ...s,
    id: `scale_${count}`,
    tracks: Array.from({ length: count }, (_, i) => ({
      ...original[i % 8],
      id: `T${i + 1}`,
      spawn: 0,
      distance: 125 + (i % 15),
      bearing: (i * 137) % 360,
    })),
  };
}
export function finaleScaleScenario(count: number, duration = 90): Scenario {
  if (![60, 90, 180].includes(duration))
    throw new Error("Unsupported stress duration");
  const legacy = scaleScenario(count);
  return {
    ...legacy,
    version: 2,
    engine_version: "vyuha-0.4.0",
    id: `finale_stress_${count}_${duration}`,
    duration,
    fog: 0.25,
    night: true,
    terrain: "rural",
    terrain_id: "rural_forward_base",
    jamStart: 120,
    jamEnd: 240,
    response_model: { ...defaultResponseConfig },
    tracks: legacy.tracks.map((t, i) => ({
      ...t,
      distance: 900 + (i % 30) * 35,
      speed: 14 + (i % 8),
      bearing: (i * 137) % 360,
      motion: {
        version: 1,
        primitive: i % 2 ? "weave" : "direct",
        phase_s: 0,
        lateral_m: 30,
        period_s: 8,
        turn_deg: 0,
      },
    })),
    terrain_boxes: [
      { x_min: 200, x_max: 260, z_min: 200, z_max: 260, height: 25 },
    ],
    doctrine: {
      id: "synthetic-stress",
      version: 1,
      name: "Synthetic stress fixture",
      description:
        "Uncalibrated simultaneous-contact workload, not a solvable training raid",
      example_values: true,
      rules: {
        rf_range: 1500,
        kinetic_range: 1000,
        restricted: { enabled: true, x_lt: -600, z_gt: 400 },
        effectors: ["hold", "rf_jam", "kinetic"],
        risk_weights: { bird: 0, quad: 1, fixed_wing: 1.2, fiber_fpv: 1.5 },
        asset_risk: 1,
      },
      defaults: { fog: 0.25, night: true, mix: [] },
      allowed_tactics: ["DIRECT"],
      rubric: { detect: 25, classify: 25, prioritise: 15, engage: 35 },
    },
  };
}
/** Authoritative box sets used by procedural raids (server/raid_v2.py). */
const RAID_BOXES = {
  urban_outpost: [
    { x_min: 120, x_max: 210, z_min: 300, z_max: 390, height: 28 },
    { x_min: -230, x_max: -130, z_min: -350, z_max: -240, height: 35 },
  ],
  rural_forward_base: [
    { x_min: -160, x_max: -90, z_min: 200, z_max: 260, height: 10 },
  ],
};
export type BenchmarkWorld = keyof typeof RAID_BOXES;
/** The finale stress fixture placed on a chosen terrain and time of day, with
 * that terrain's raid occluders, so rendering cost includes a full world. */
export function worldScaleScenario(
  count: number,
  duration: number,
  world: BenchmarkWorld,
  night: boolean,
): Scenario {
  const base = finaleScaleScenario(count, duration);
  return {
    ...base,
    id: `${base.id}_${world}_${night ? "night" : "day"}`,
    night,
    terrain: world === "rural_forward_base" ? "rural" : "urban",
    terrain_id: world,
    terrain_boxes: RAID_BOXES[world],
  };
}
export function median(values: number[]) {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  return (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2;
}
export default function Benchmark() {
  const [engine, setEngine] = useState<"finale" | "legacy">("finale");
  const [duration, setDuration] = useState(20),
    [heapSamples, setHeapSamples] = useState<
      { seconds: number; used_js_heap_bytes: number | null }[]
    >([]);
  const [count, setCount] = useState(8),
    [tier, setTier] = useState<Quality>("medium"),
    [auto, setAuto] = useState(false),
    [state, setState] = useState<Snapshot>(() =>
      new Simulation(finaleScaleScenario(8)).snapshot(),
    ),
    [running, setRunning] = useState(false),
    [samples, setSamples] = useState<number[]>([]),
    [ticks, setTicks] = useState<number[]>([]),
    [hardware, setHardware] = useState(""),
    [ram, setRam] = useState(""),
    [elapsed, setElapsed] = useState(0);
  const [world, setWorld] = useState<BenchmarkWorld>("rural_forward_base"),
    [night, setNight] = useState(true);
  const [vision, setVision] = useState<Vision>("thermal"),
    [palette, setPalette] = useState<ThermalPalette>("white"),
    [camera, setCamera] = useState<CameraPreset | "trainee">("trainee");
  const lastHeapSecond = useRef(-1);
  const worker = useRef<Worker | null>(null),
    frames = useRef<number[]>([]),
    started = useRef(0);
  useEffect(() => {
    const w = new Worker(new URL("./sim.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.type === "snapshot") {
        diagnosticWorkerDelivery();
        setState(e.data.state);
      }
      if (e.data.type === "benchmark")
        setTicks((t) => [...t, ...e.data.tick_ms]);
    };
    return () => w.terminate();
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const secs = (performance.now() - started.current) / 1000;
      setElapsed(secs);
      const second = Math.floor(secs);
      if (second > lastHeapSecond.current) {
        lastHeapSecond.current = second;
        setHeapSamples((v) => [
          ...v,
          {
            seconds: second,
            used_js_heap_bytes:
              (
                performance as Performance & {
                  memory?: { usedJSHeapSize: number };
                }
              ).memory?.usedJSHeapSize ?? null,
          },
        ]);
      }
      if (secs >= 3) diagnosticPhase("training");
      if (secs >= duration) {
        diagnosticPhase("review");
        worker.current?.postMessage({ type: "pause" });
        setRunning(false);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running, duration]);
  function resetResults() {
    setSamples([]);
    setTicks([]);
    setHeapSamples([]);
    setElapsed(0);
  }
  function start() {
    setSamples([]);
    setTicks([]);
    setHeapSamples([]);
    lastHeapSecond.current = -1;
    frames.current = [];
    setElapsed(0);
    diagnosticPhase("startup");
    setRunning(true);
    started.current = performance.now();
    worker.current?.postMessage({
      type: "init",
      scenario:
        engine === "finale"
          ? worldScaleScenario(count, duration === 180 ? 180 : 90, world, night)
          : scaleScenario(count),
      benchmark: true,
    });
    worker.current?.postMessage({ type: "play" });
  }
  function fps(n: number) {
    if (!running) return;
    setSamples((v) => [...v, n]);
    frames.current.push(n);
    if (auto) {
      const next = qualityAfterSamples(tier, frames.current);
      if (next !== tier) {
        setTier(next);
        frames.current = [];
      }
    }
  }
  const p95 =
    [...ticks].sort((a, b) => a - b)[
      Math.max(0, Math.ceil(ticks.length * 0.95) - 1)
    ] ?? null;
  const report = {
    schema_version: 3,
    requested_seconds: duration,
    simulation_tick: state.tick,
    simulation_tick_samples: ticks.length,
    heap_samples: heapSamples,
    heap_scope:
      "Browser-reported main-page JS heap only; may be coarse or unavailable; excludes Worker, GPU and total process memory",
    engine_version: engine === "finale" ? "vyuha-0.4.0" : "legacy immediate",
    workload:
      "synthetic simultaneous-contact stress fixture; not a solvable Raid Composer exercise",
    vision,
    world,
    night,
    thermal_palette: palette,
    camera_preset: camera,
    hardware_class: hardware,
    ram_gib: ram,
    browser: navigator.userAgent,
    contacts: count,
    graphics: tier,
    auto_quality: auto,
    seconds: Math.round(elapsed),
    fps_samples: samples,
    median_render_fps: median(samples),
    median_sim_tick_ms: median(ticks),
    p95_sim_tick_ms: p95,
    logical_cores: navigator.hardwareConcurrency,
    js_heap_bytes:
      (performance as Performance & { memory?: { usedJSHeapSize: number } })
        .memory?.usedJSHeapSize ?? null,
    note:
      tier === "tactical"
        ? "Tactical fallback works; this page does not measure 2D paint FPS."
        : "WebGL frame callbacks measured while running, not device certification. Auto mode may combine quality tiers. Simulation runs at 30 Hz with bounded stall handling; no scoring fidelity reductions.",
  };
  return (
    <main className="instructor-page advanced-page">
      <PageHeader
        eyebrow="LOCAL DEVICE MEASUREMENT"
        title="Device performance check"
        description="Measure synthetic rendering and worker workloads, then export the actual samples."
        actions={
          <nav className="advanced-nav">
            <a href="/system/evidence">System evidence</a>
          </nav>
        }
      />
      <PerformanceDiagnostics />
      <p>
        Bounded rendering and worker test. Choose 20, 60 or 180 seconds; a
        180-second Finale fixture remains logically active throughout the
        measurement. Run each contact count at a fixed graphics tier; export
        results with general hardware class and RAM, without device IDs. Auto
        quality can be tested separately. Synthetic stress fixtures spawn
        contacts together. Select the engine explicitly; these workloads do not
        certify human solvability or physical deployment.
      </p>
      <div className="studio-fields">
        <label>
          Simulation engine
          <select
            aria-label="Simulation engine"
            disabled={running}
            value={engine}
            onChange={(e) => {
              setEngine(e.target.value as typeof engine);
              setDuration(20);
              resetResults();
            }}
          >
            <option value="finale">Finale 0.4 · Sensor Truth</option>
            <option value="legacy">Legacy baseline</option>
          </select>
        </label>
        <label>
          Measurement duration
          <select
            aria-label="Measurement duration"
            disabled={running}
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value));
              resetResults();
            }}
          >
            {(engine === "finale" ? [20, 60, 180] : [20, 60]).map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </select>
        </label>
        <label>
          CPU / model class
          <input
            value={hardware}
            onChange={(e) => setHardware(e.target.value)}
            maxLength={70}
          />
        </label>
        <label>
          RAM (GiB)
          <input
            value={ram}
            onChange={(e) => setRam(e.target.value)}
            maxLength={8}
          />
        </label>
        <label>
          World
          <select
            aria-label="Benchmark world"
            disabled={running}
            value={`${world}:${night ? "night" : "day"}`}
            onChange={(e) => {
              const [w, t] = e.target.value.split(":");
              setWorld(w as BenchmarkWorld);
              setNight(t === "night");
              resetResults();
            }}
          >
            <option value="rural_forward_base:night">
              Rural forward base · night
            </option>
            <option value="rural_forward_base:day">
              Rural forward base · day
            </option>
            <option value="urban_outpost:day">Urban outpost · day</option>
            <option value="urban_outpost:night">Urban outpost · night</option>
          </select>
        </label>
        <label>
          View
          <select
            aria-label="Benchmark view"
            disabled={running}
            title={
              running
                ? "Finish the measurement before changing view."
                : undefined
            }
            value={vision}
            onChange={(e) => {
              setVision(e.target.value as Vision);
              resetResults();
            }}
          >
            {["thermal", "day", "night"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Thermal palette
          <select
            aria-label="Benchmark palette"
            disabled={running}
            title={
              running
                ? "Finish the measurement before changing palette."
                : undefined
            }
            value={palette}
            onChange={(e) => {
              setPalette(e.target.value as ThermalPalette);
              resetResults();
            }}
          >
            {Object.entries(palettes).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Camera
          <select
            aria-label="Benchmark camera"
            disabled={running}
            title={
              running
                ? "Finish the measurement before changing camera."
                : undefined
            }
            value={camera}
            onChange={(e) => {
              setCamera(e.target.value as typeof camera);
              resetResults();
            }}
          >
            {["trainee", "overview", "observer", "follow"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Contacts
          <select
            disabled={running}
            title={
              running
                ? "Finish the measurement before changing settings."
                : undefined
            }
            value={count}
            onChange={(e) => {
              setCount(Number(e.target.value));
              resetResults();
            }}
          >
            {[8, 25, 50, 100, 200].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Graphics tier
          <select
            disabled={running}
            title={
              running
                ? "Finish the measurement before changing settings."
                : undefined
            }
            value={tier}
            onChange={(e) => {
              setTier(e.target.value as Quality);
              resetResults();
            }}
          >
            {["high", "medium", "low", "tactical"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            disabled={running}
            title={
              running
                ? "Finish the measurement before changing settings."
                : undefined
            }
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />
          Enable auto quality
        </label>
      </div>
      <button
        className="button primary"
        disabled={running}
        title={
          running
            ? "Finish the measurement before changing settings."
            : undefined
        }
        onClick={start}
      >
        Run {duration}-second check
      </button>
      <p>
        {elapsed.toFixed(1)}s · median WebGL FPS{" "}
        {median(samples) ?? "Unmeasured"} · simulation median{" "}
        {median(ticks)?.toFixed(3) ?? "Unmeasured"} ms · p95{" "}
        {p95?.toFixed(3) ?? "Unmeasured"} ms
      </p>
      <div
        className={`scene-container ${vision} ${tier === "tactical" ? "tactical-mode" : ""}`}
        style={{ height: 400 }}
      >
        {tier === "tactical" ? (
          <Radar state={state} selected={null} onSelect={() => {}} large />
        ) : (
          <Scene
            state={state}
            terrain={world}
            terrainBoxes={engine === "finale" ? RAID_BOXES[world] : undefined}
            engineVersion={engine === "finale" ? "vyuha-0.4.0" : undefined}
            fog={0.15}
            selected={
              camera === "follow" || camera === "observer" ? "T1" : null
            }
            vision={vision}
            palette={palette}
            cameraPreset={camera === "trainee" ? undefined : camera}
            onFps={fps}
            quality={tier}
            fallback={
              <button onClick={() => setTier("tactical")}>
                Use tactical fallback
              </button>
            }
          />
        )}
      </div>
      <details>
        <summary>Measurement JSON</summary>
        <pre id="benchmark-report">{JSON.stringify(report, null, 2)}</pre>
      </details>
      <button
        className="button subtle"
        title={
          running
            ? "Finish the measurement before exporting."
            : !ticks.length
              ? "Run a measurement first."
              : undefined
        }
        disabled={running || !ticks.length}
        onClick={() => download(`vyuha-device-${count}-${tier}.json`, report)}
      >
        Export measurement JSON
      </button>
    </main>
  );
}
