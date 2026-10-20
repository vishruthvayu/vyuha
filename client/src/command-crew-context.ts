import type { CrewState } from "./Crew";

/** Presentation only: server eligibility and current observations remain authoritative. */
export function crewTask(state: CrewState, selected: string): string {
  if (state.status === "completed")
    return "Exercise complete. Review the shared result and accepted decisions.";
  if (state.done)
    return "Exercise ended. Waiting for the officer to score the shared result.";
  if (state.paused) return "Exercise paused. The officer controls resumption.";
  if (!selected) return "Select a currently observed contact to begin.";
  const contact = state.contacts.find((item) => item.id === selected);
  if (!contact)
    return `${selected} has no current observation. Selection is retained; wait for reacquisition.`;
  if (state.role === "spotter")
    return contact.designated === null
      ? `Designate ${selected} to hand it to the responder.`
      : `${selected} is designated. The responder can classify it; continue observing other contacts.`;
  if (contact.designated === null)
    return `Waiting for the spotter to designate ${selected}.`;
  if (!contact.classification)
    return `Classify ${selected} from the available evidence before choosing a response.`;
  return `${selected} is classified. Choose a simulated response from the current evidence.`;
}
