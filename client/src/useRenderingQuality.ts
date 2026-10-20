import { useCallback, useEffect, useRef, useState } from "react";
import { qualityAfterSamples, type Quality } from "./quality";

/** Rendering adaptation changes presentation only; it never alters simulation
 * clocks, observations or scoring. Clear the sample window after each change. */
export function useRenderingQuality(onTactical: () => void) {
  const [fps, setFps] = useState(0);
  const [quality, setQuality] = useState<Quality>("medium");
  const [autoQuality, setAutoQuality] = useState(true);
  const samples = useRef<number[]>([]);
  useEffect(() => {
    samples.current = [];
  }, [quality, autoQuality]);
  const renderFps = useCallback(
    (value: number) => {
      setFps(value);
      if (!autoQuality) return;
      samples.current = [...samples.current.slice(-2), value];
      const next = qualityAfterSamples(quality, samples.current);
      if (next !== quality) {
        setQuality(next);
        samples.current = [];
        if (next === "tactical") onTactical();
      }
    },
    [autoQuality, quality, onTactical],
  );
  return { fps, quality, setQuality, autoQuality, setAutoQuality, renderFps };
}
