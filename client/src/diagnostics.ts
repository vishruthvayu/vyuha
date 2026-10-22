/** Opt-in, bounded, local-only timing. Never reads actions, text, identities or sensor truth. */
export type TimingKind =
  | "first_frame"
  | "render_frame"
  | "worker_delivery"
  | "long_frame"
  | "long_task"
  | "script_work"
  | "layout_work"
  | "resource"
  | "interaction";
export type DiagnosticPhase =
  "preparation" | "startup" | "training" | "optics" | "review";
export type DiagnosticSource = {
  commit: string;
  source_hash: string;
  working_tree_source_dirty?: boolean;
};
declare const __VYUHA_BUILD__: DiagnosticSource;
export const buildSource: DiagnosticSource =
  typeof __VYUHA_BUILD__ === "undefined"
    ? { commit: "unavailable", source_hash: "unavailable" }
    : __VYUHA_BUILD__;
export const DIAGNOSTIC_LIMIT = 16000;
export const DIAGNOSTIC_WINDOW_MS = 240000;
const KINDS: TimingKind[] = [
  "first_frame",
  "render_frame",
  "worker_delivery",
  "long_frame",
  "long_task",
  "script_work",
  "layout_work",
  "resource",
  "interaction",
];
export function distribution(values: readonly number[]) {
  const sorted = [...values]
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  const p = (fraction: number) =>
    sorted.length
      ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
      : null;
  return {
    samples: sorted.length,
    p50_ms: p(0.5),
    p95_ms: p(0.95),
    p99_ms: p(0.99),
    max_ms: sorted.at(-1) ?? null,
    over_50_ms: sorted.filter((n) => n > 50).length,
    over_100_ms: sorted.filter((n) => n > 100).length,
  };
}
export class TimingCapture {
  readonly samples: {
    kind: TimingKind;
    phase: DiagnosticPhase;
    elapsed_ms: number;
    duration_ms: number;
  }[] = [];
  dropped = 0;
  ignored = 0;
  backgroundGap = false;
  phase: DiagnosticPhase = "preparation";
  stopped = false;
  constructor(
    readonly start: number,
    readonly source = buildSource,
    readonly limit = DIAGNOSTIC_LIMIT,
  ) {}
  sample(kind: TimingKind, duration: number, now: number) {
    if (
      this.stopped ||
      !KINDS.includes(kind) ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      !Number.isFinite(now) ||
      now < this.start
    )
      return;
    // Timers can be throttled in an embedded/background browser. Enforce the
    // window on samples too, rather than trusting a delayed setTimeout.
    if (now - this.start > DIAGNOSTIC_WINDOW_MS) {
      this.stopped = true;
      return;
    }
    if (this.samples.length >= this.limit) {
      this.dropped++;
      return;
    }
    this.samples.push({
      kind,
      phase: this.phase,
      elapsed_ms: Math.round((now - this.start) * 100) / 100,
      duration_ms: Math.round(duration * 100) / 100,
    });
  }
  frame(duration: number, now: number, visible = true) {
    if (!visible) {
      this.ignored++;
      this.backgroundGap = true;
      return false;
    }
    if (this.backgroundGap) {
      this.ignored++;
      this.backgroundGap = false;
      return false;
    }
    this.sample("render_frame", duration, now);
    return !this.stopped;
  }
  report(now: number) {
    return {
      schema_version: 1,
      source: { ...this.source },
      elapsed_ms: Math.min(DIAGNOSTIC_WINDOW_MS, Math.max(0, now - this.start)),
      stopped: this.stopped,
      dropped_samples: this.dropped,
      ignored_background_frames: this.ignored,
      complete_sample_window: this.dropped === 0,
      summary: Object.fromEntries(
        KINDS.map((k) => [
          k,
          distribution(
            this.samples.filter((s) => s.kind === k).map((s) => s.duration_ms),
          ),
        ]),
      ),
      phases: Object.fromEntries(
        (
          [
            "preparation",
            "startup",
            "training",
            "optics",
            "review",
          ] as DiagnosticPhase[]
        ).map((p) => [
          p,
          distribution(
            this.samples
              .filter((s) => s.phase === p && s.kind === "render_frame")
              .map((s) => s.duration_ms),
          ),
        ]),
      ),
      samples: this.samples.map((s) => ({ ...s })),
      scope:
        "Local opt-in browser timings. Render callbacks are not GPU time or headset FPS. Worker delivery measures wall-time between snapshots, not simulation CPU cost. No actions, identifiers, text, URLs or hidden sensor truth are recorded.",
      limitations: [
        "CPU, resource and frame timings are correlated evidence, not automatic causal attribution.",
        "Background frames are excluded; gaps and dropped samples are disclosed.",
        "Compare fixed viewport, hardware, quality, roster, warm state and workload; median alone is insufficient.",
      ],
    };
  }
}
let capture: TimingCapture | null = null;
let observers: PerformanceObserver[] = [];
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let previousWorker = 0;
let startupMark: number | null = null;
let visibilityCleanup = () => {};
function notify() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("vyuha-diagnostics"));
}
export function currentCapture() {
  return capture;
}
export function stopDiagnostics() {
  if (capture) capture.stopped = true;
  for (const observer of observers) observer.disconnect();
  observers = [];
  visibilityCleanup();
  startupMark = null;
  clearTimeout(stopTimer);
  notify();
}
export function startDiagnostics() {
  stopDiagnostics();
  capture = new TimingCapture(performance.now());
  previousWorker = 0;
  if (typeof document !== "undefined") {
    const visibility = () => {
      if (document.hidden && capture) {
        capture.backgroundGap = true;
        previousWorker = 0;
        startupMark = null;
      }
    };
    document.addEventListener("visibilitychange", visibility);
    visibilityCleanup = () =>
      document.removeEventListener("visibilitychange", visibility);
  }
  if (typeof PerformanceObserver !== "undefined") {
    const supported = PerformanceObserver.supportedEntryTypes ?? [];
    const observe = (
      type: string,
      receive: (entry: PerformanceEntry) => void,
    ) => {
      if (!supported.includes(type)) return;
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) receive(entry);
        });
        observer.observe({ type, buffered: false });
        observers.push(observer);
      } catch {
        /* Unsupported observer never breaks training. */
      }
    };
    observe("long-animation-frame", (entry) => {
      const e = entry as PerformanceEntry & {
        scripts?: { duration: number }[];
        styleAndLayoutStart?: number;
      };
      recordTiming("long_frame", e.duration);
      recordTiming(
        "script_work",
        (e.scripts ?? []).reduce(
          (sum, s) => sum + (Number.isFinite(s.duration) ? s.duration : 0),
          0,
        ),
      );
      if (e.styleAndLayoutStart && e.styleAndLayoutStart > 0)
        recordTiming(
          "layout_work",
          Math.max(0, e.startTime + e.duration - e.styleAndLayoutStart),
        );
    });
    observe("longtask", (e) => recordTiming("long_task", e.duration));
    observe("event", (e) => recordTiming("interaction", e.duration));
    observe("resource", (e) => {
      const r = e as PerformanceResourceTiming;
      // Exclude fetch/XHR/API requests and every resource name/query entirely.
      if (["script", "css", "img", "link"].includes(r.initiatorType))
        recordTiming("resource", r.duration);
    });
  }
  stopTimer = setTimeout(stopDiagnostics, DIAGNOSTIC_WINDOW_MS);
  notify();
  return capture;
}
export function recordTiming(kind: TimingKind, duration: number) {
  if (capture && !capture.stopped)
    capture.sample(kind, duration, performance.now());
}
export function diagnosticPhase(phase: DiagnosticPhase) {
  if (capture && !capture.stopped) {
    capture.phase = phase;
    if (phase === "startup") startupMark = performance.now();
  }
}
export function diagnosticFrame(milliseconds: number) {
  if (!capture || capture.stopped) return;
  const now = performance.now();
  const accepted = capture.frame(
    milliseconds,
    now,
    typeof document === "undefined" || !document.hidden,
  );
  if (accepted && startupMark !== null) {
    recordTiming("first_frame", now - startupMark);
    startupMark = null;
  }
}
export function diagnosticWorkerDelivery() {
  if (!capture || capture.stopped) return;
  const now = performance.now();
  if (previousWorker && !document.hidden)
    recordTiming("worker_delivery", now - previousWorker);
  previousWorker = now;
}
