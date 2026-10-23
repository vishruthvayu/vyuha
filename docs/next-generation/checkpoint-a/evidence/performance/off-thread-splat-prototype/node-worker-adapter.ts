import { parentPort } from "node:worker_threads";
const scope = globalThis as unknown as { onmessage: (event: { data: unknown }) => void; postMessage: (data: unknown, transfer?: ArrayBuffer[]) => void };
let started = 0;
scope.postMessage = (data, transfer) => parentPort!.postMessage({ ...(data as object), worker_cpu_ms: performance.now() - started }, transfer);
await import("./splat.worker.ts");
parentPort!.on("message", (data) => { started = performance.now(); scope.onmessage({ data }); });
