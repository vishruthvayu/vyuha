import { useEffect, useState } from "react";
import { api } from "./storage";
import { consumeStream, abortableDelay } from "./live-stream";
import type { InstructorSession } from "./types";
export function useInstructorFeed() {
  const [sessions, setSessions] = useState<InstructorSession[]>([]),
    [transport, setTransport] = useState("connecting"),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false,
      streaming = false,
      pending = false;
    const controller = new AbortController();
    const publish = (r: { sessions: InstructorSession[] }) => {
      if (!stopped) {
        setSessions(r.sessions);
        setError("");
      }
    };
    const poll = async () => {
      if (stopped || streaming || pending) return;
      pending = true;
      try {
        const result = await api<{ sessions: InstructorSession[] }>(
          "/instructor/sessions",
        );
        if (!streaming) publish(result);
      } catch {
        if (!stopped)
          setError("Local server unavailable. Session state may be stale.");
      } finally {
        pending = false;
      }
    };
    const live = async () => {
      while (!stopped) {
        try {
          await consumeStream<{ sessions: InstructorSession[] }>(
            "/instructor/stream",
            (r) => {
              if (!stopped) {
                streaming = true;
                setTransport("stream");
                publish(r);
              }
            },
            controller.signal,
          );
        } catch {
          /* bounded polling is an ordinary transport fallback */
        }
        streaming = false;
        if (!stopped) {
          setTransport("polling fallback");
          void poll();
          await abortableDelay(1000, controller.signal);
        }
      }
    };
    void poll();
    void live();
    const timer = setInterval(() => void poll(), 500);
    return () => {
      stopped = true;
      clearInterval(timer);
      controller.abort();
    };
  }, []);
  return { sessions, transport, error };
}
