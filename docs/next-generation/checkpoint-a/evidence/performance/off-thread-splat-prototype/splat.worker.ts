import { generate, type SplatKey } from "./kernel.ts";
type Scope = { onmessage: ((event: { data: SplatKey & { id: number } }) => void) | null; postMessage: (data: unknown, transfer?: Transferable[]) => void };
const scope = globalThis as unknown as Scope;
scope.onmessage = ({ data }) => {
  if (!Number.isSafeInteger(data.id) || data.id < 1) return;
  try {
    const result = generate(data);
    scope.postMessage({ type: "ready", id: data.id, result }, [result.base.buffer, result.patch.buffer]);
  } catch {
    scope.postMessage({ type: "failure", id: data.id });
  }
};
