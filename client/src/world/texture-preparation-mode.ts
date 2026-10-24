/** Explicit research option only. Production default stays synchronous until qualification. */
export function texturePreparationMode(
  search: string,
): "synchronous" | "chunked" {
  return new URLSearchParams(search).get("texturePreparation") === "chunked"
    ? "chunked"
    : "synchronous";
}
