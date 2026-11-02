/** Dependency-free presentation experiment metadata. Unknown/missing values
 * retain the production finish. No URL, geometry or gameplay data is retained. */
export type AuthoredFinishVariant = "baseline" | "candidate";
export function authoredFinishVariant(search: string): AuthoredFinishVariant {
  return new URLSearchParams(search).get("authoredFinish") === "baseline"
    ? "baseline"
    : "candidate";
}
export function authoredFinishEnabled(search: string) {
  return authoredFinishVariant(search) === "candidate";
}
