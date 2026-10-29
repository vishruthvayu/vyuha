import type { BufferGeometry } from "three";
import type { MaterialKey } from "./kit";
type GeometrySet = Map<MaterialKey, BufferGeometry>;
/** CPU geometry only: public, deterministic scenery. Cached originals never
 * enter a scene. Every consumer owns deep clones and may mutate/dispose them.
 * LRU eviction bounds retained attribute memory independently of scene count. */
export class ArchitectureCache {
  private entries = new Map<string, { geometry: GeometrySet; bytes: number }>();
  private bytes = 0;
  constructor(readonly byteLimit = 8_000_000) {
    if (!Number.isFinite(byteLimit) || byteLimit < 0)
      throw new RangeError("Invalid architecture cache budget");
  }
  get(key: string, build: () => GeometrySet): GeometrySet {
    let entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    } else {
      const geometry = build();
      const bytes = [...geometry.values()].reduce(
        (sum, g) =>
          sum +
          Object.values(g.attributes).reduce(
            (n, a) => n + a.array.byteLength,
            0,
          ) +
          (g.index?.array.byteLength ?? 0),
        0,
      );
      // Oversized entries belong directly to the consumer; never retain them.
      if (bytes > this.byteLimit) return geometry;
      while (
        this.entries.size &&
        (this.bytes + bytes > this.byteLimit || this.entries.size >= 32)
      ) {
        const oldest = this.entries.keys().next().value!;
        const expired = this.entries.get(oldest)!;
        for (const g of expired.geometry.values()) g.dispose();
        this.bytes -= expired.bytes;
        this.entries.delete(oldest);
      }
      entry = { geometry, bytes };
      this.entries.set(key, entry);
      this.bytes += bytes;
    }
    return new Map([...entry.geometry].map(([key, g]) => [key, g.clone()]));
  }
  clear() {
    for (const entry of this.entries.values())
      for (const g of entry.geometry.values()) g.dispose();
    this.entries.clear();
    this.bytes = 0;
  }
  get retainedBytes() {
    return this.bytes;
  }
  get size() {
    return this.entries.size;
  }
}
