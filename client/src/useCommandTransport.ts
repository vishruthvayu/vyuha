import { useEffect, useLayoutEffect, useRef } from "react";
import { api } from "./storage";
import { consumeStream, abortableDelay } from "./live-stream";
import type { InstructorCommand } from "./types";
type Options = {
  enabled: boolean;
  phase: string;
  current: () => { id: string; after: number; active: boolean };
  accept: (commands: InstructorCommand[], id: string) => void | Promise<void>;
  heartbeat: () => Promise<unknown>;
  unavailable: () => void;
};
/** Command pushes never replace the independent telemetry/acknowledgment clock. */
export function useCommandTransport(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const { enabled, phase } = options;
  const sessionId = options.current().id;
  useEffect(() => {
    if (!enabled) return;
    let stopped = false,
      streaming = false,
      pending = false;
    const controller = new AbortController();
    const deliver = async (commands: InstructorCommand[], id: string) => {
      if (!stopped && latest.current.current().id === id)
        await latest.current.accept(commands, id);
    };
    const live = async () => {
      while (!stopped) {
        const state = latest.current.current();
        if (state.active && (phase === "running" || phase === "paused")) {
          try {
            await consumeStream<{ commands: InstructorCommand[] }>(
              `/sessions/${state.id}/command-stream?after=${state.after}`,
              async (reply) => {
                if (!stopped && latest.current.current().id === state.id) {
                  streaming = true;
                  await deliver(reply.commands, state.id);
                }
              },
              controller.signal,
            );
          } catch {
            /* recover with the existing idempotent polling protocol */
          }
          streaming = false;
        }
        await abortableDelay(1000, controller.signal);
      }
    };
    const tick = async () => {
      const state = latest.current.current();
      if (stopped || pending || !state.active) return;
      pending = true;
      try {
        if (!streaming) {
          const reply = await api<{ commands: InstructorCommand[] }>(
            `/sessions/${state.id}/commands?after=${state.after}`,
          );
          if (!streaming) await deliver(reply.commands, state.id);
        }
        // Required even when the stream has no commands or no new changes.
        if (!stopped && latest.current.current().id === state.id)
          await latest.current.heartbeat();
      } catch {
        if (!stopped) latest.current.unavailable();
      } finally {
        pending = false;
      }
    };
    void live();
    const timer = setInterval(() => void tick(), 500);
    return () => {
      stopped = true;
      clearInterval(timer);
      controller.abort();
    };
  }, [enabled, phase, sessionId]);
}
