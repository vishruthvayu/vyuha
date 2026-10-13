import { useEffect, useRef, useState } from "react";
import type { Snapshot, Track } from "./types";
export function audioCue(t: Track, fog: number) {
  const d = Math.hypot(t.x, t.z);
  return t.active && t.detected !== null && t.kind !== "bird" && d < 80
    ? {
        gain: 0.025 * (1 - d / 80) * (1 - 0.5 * fog),
        pan: Math.max(-1, Math.min(1, t.x / 80)),
      }
    : null;
}
export default function LocalAudio({
  state,
  fog,
  active,
}: {
  state: Snapshot;
  fog: number;
  active: boolean;
}) {
  const [enabled, setEnabled] = useState(false),
    [error, setError] = useState("");
  const engine = useRef<{
    context: AudioContext;
    voices: { osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode }[];
  } | null>(null);
  async function toggle() {
    if (enabled) {
      setEnabled(false);
      return;
    }
    try {
      if (!engine.current) {
        const context = new AudioContext();
        const voices = Array.from({ length: 4 }, (_, i) => {
          const osc = context.createOscillator(),
            gain = context.createGain(),
            pan = context.createStereoPanner();
          osc.type = "triangle";
          osc.frequency.value = 75 + i * 11;
          gain.gain.value = 0;
          osc.connect(gain).connect(pan).connect(context.destination);
          osc.start();
          return { osc, gain, pan };
        });
        engine.current = { context, voices };
      }
      await engine.current.context.resume();
      setEnabled(true);
      setError("");
    } catch {
      setError("Audio unavailable in this browser.");
    }
  }
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const cues =
      enabled && active
        ? state.tracks
            .map((t) => audioCue(t, fog))
            .filter((c) => c !== null)
            .sort((a, b) => b.gain - a.gain)
            .slice(0, 4)
        : [];
    e.voices.forEach((v, i) => {
      v.gain.gain.setTargetAtTime(
        cues[i]?.gain ?? 0,
        e.context.currentTime,
        0.1,
      );
      v.pan.pan.setTargetAtTime(cues[i]?.pan ?? 0, e.context.currentTime, 0.1);
    });
  }, [state, enabled, active, fog]);
  useEffect(
    () => () => {
      engine.current?.voices.forEach((v) => v.osc.stop());
      void engine.current?.context.close();
    },
    [],
  );
  return (
    <div>
      <button
        className="text-button"
        aria-pressed={enabled}
        onClick={() => void toggle()}
      >
        {enabled ? "Mute local audio" : "Enable local audio"}
      </button>
      <small>
        {" "}
        Non-scoring illustrative rotor cue · previously observed drones within
        80 m · generated locally.
      </small>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
