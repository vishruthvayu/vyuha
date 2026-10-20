export const SIMULATION_HZ = 30;
export const MAX_CATCH_UP_TICKS = 5;
export type ClockStep = { ticks: number; droppedMs: number; throttled: boolean };

/**
 * Logical fixed steps are independent of callback rate. A stalled browser catches
 * up at most five steps, then discards excess wall time rather than jumping an
 * exercise forward. Paused/hidden time never becomes a backlog on resumption.
 */
export class FixedStepClock {
  private last: number | null = null;
  private accumulated = 0;
  readonly stepMs = 1000 / SIMULATION_HZ;

  reset(now?: number) {
    this.last = now ?? null;
    this.accumulated = 0;
  }

  advance(now: number, running: boolean): ClockStep {
    const none = { ticks: 0, droppedMs: 0, throttled: false };
    if (!Number.isFinite(now)) { this.reset(); return none; }
    if (!running || this.last === null || now < this.last) {
      this.reset(now);
      return none;
    }
    this.accumulated += now - this.last;
    this.last = now;
    const available = Math.floor((this.accumulated + 1e-8) / this.stepMs);
    const ticks = Math.min(available, MAX_CATCH_UP_TICKS);
    const droppedMs = Math.max(0, available - ticks) * this.stepMs;
    this.accumulated = Math.max(0, this.accumulated - available * this.stepMs);
    return { ticks, droppedMs, throttled: droppedMs > 0 };
  }
}
