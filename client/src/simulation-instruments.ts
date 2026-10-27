/** Presentation actions are deliberately distinct from simulation Actions.
 * A view change cannot designate, classify, engage, pause or advance time. */
export type SimulationInstrument =
  "observe" | "reports" | "evidence" | "decide" | "radar";
export type InstrumentState = { scope: string; view: SimulationInstrument };
export function instrumentFor(
  state: InstrumentState | null,
  scope: string,
): SimulationInstrument {
  return state?.scope === scope ? state.view : "observe";
}
export function openInstrument(
  scope: string,
  view: SimulationInstrument,
): InstrumentState {
  if (
    !scope ||
    !["observe", "reports", "evidence", "decide", "radar"].includes(view)
  )
    throw new Error("Invalid simulation instrument context");
  return { scope, view };
}
