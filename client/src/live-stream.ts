/** Bounded SSE framing with explicit headers; no credentials in URLs or cookies. */
import { officerToken, setOfficerToken } from "./storage";
export class SSEDecoder {
  private buffer = "";
  push(chunk: string): { event: string; id: string | null; data: unknown }[] {
    this.buffer = (this.buffer + chunk).replace(/\r\n/g, "\n");
    if (this.buffer.length > 1048576)
      throw new Error("Stream frame exceeds limit");
    const result = [];
    let end: number;
    while ((end = this.buffer.indexOf("\n\n")) !== -1) {
      const raw = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      const fields = raw.split("\n");
      const data = fields
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      result.push({
        event:
          fields
            .find((l) => l.startsWith("event:"))
            ?.slice(6)
            .trim() ?? "message",
        id:
          fields
            .find((l) => l.startsWith("id:"))
            ?.slice(3)
            .trim() ?? null,
        data: JSON.parse(data),
      });
    }
    return result;
  }
}
export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}
export async function consumeStream<T>(
  path: string,
  update: (data: T) => void | Promise<void>,
  signal: AbortSignal,
) {
  const token = officerToken();
  const response = await fetch("/api/v1" + path, {
    headers: token ? { Authorization: "Bearer " + token } : {},
    signal,
    credentials: "omit",
  });
  if (!response.ok || !response.body) {
    if (response.status === 401 && token) setOfficerToken("");
    throw new Error("Stream unavailable; polling retained");
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    throw new Error("Unexpected stream format");
  const reader = response.body.getReader(),
    decoder = new TextDecoder(),
    frames = new SSEDecoder();
  try {
    while (!signal.aborted) {
      const next = await reader.read();
      if (next.done) break;
      for (const frame of frames.push(
        decoder.decode(next.value, { stream: true }),
      )) {
        if (frame.event === "auth-expired") {
          if (token) setOfficerToken("");
          throw new Error("Stream authorization expired");
        }
        if (frame.event === "closed") return;
        if (frame.event === "update") await update(frame.data as T);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
