export type TrainingMode = "scripted" | "adaptive" | "library";
export function initialTrainingMode(search: string): TrainingMode {
  const mode = new URLSearchParams(search).get("mode");
  return mode === "scripted" || mode === "legacy"
    ? "scripted"
    : mode === "library"
      ? "library"
      : "adaptive";
}

export function nextTrainingSeed(seed: number) {
  return (seed + 1) >>> 0;
}
