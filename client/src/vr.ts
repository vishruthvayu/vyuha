import { controlReason } from "./presentation";
import { effectorStates } from "./GuidedDecision";
import { reportedPosition } from "./observed-contacts";
import { simulatedObservations } from "./observations";
import { SENSOR_VERSION } from "./sensors-v2";
import { ObservationVisibility, type Vision } from "./visibility";
import { renderContacts } from "./render-contacts";
import {
  KIND_LABEL,
  type Action,
  type Effector,
  type Identity,
  type Kind,
  type Scenario,
  type Snapshot,
  type Track,
} from "./types";

export type VRPhase = "ready" | "restoring" | "running" | "paused" | "complete";
export const vrKinds: Kind[] = ["quad", "fixed_wing", "fiber_fpv", "bird"];
export const vrIdentities: Identity[] = ["hostile", "friendly", "neutral"];
export const modernSensors = (s: Scenario) =>
  s.engine_version === SENSOR_VERSION || s.sensor_version === SENSOR_VERSION;
// The v2 contract never falls back to truth if an observation is missing.
export function vrObservedState(state: Snapshot, modern: boolean): Snapshot {
  return {
    ...state,
    tracks: state.tracks.filter((t) => !modern || !!t.observation),
  };
}
function targetAt(
  state: Snapshot,
  selected: string | null,
  modern: boolean,
): Track | undefined {
  const t = vrObservedState(state, modern).tracks.find(
    (t) => t.id === selected && t.active,
  );
  const p = t && reportedPosition(t);
  return t && p ? { ...t, ...p } : undefined;
}
export type VRContact = {
  id: string;
  range: number;
  designated: boolean;
  classification: Kind | null;
  declared: Identity | null;
};
export function vrContacts(state: Snapshot, modern = true): VRContact[] {
  return vrObservedState(state, modern).tracks.flatMap((t) => {
    const p = t.active && reportedPosition(t);
    return p
      ? [
          {
            id: t.id,
            range: Math.round(Math.hypot(p.x, p.z)),
            designated: t.designated !== null,
            classification: t.classification,
            declared: t.declared,
          },
        ]
      : [];
  });
}
export function vrEvidence(
  state: Snapshot,
  selected: string | null,
  modern = true,
) {
  const t = targetAt(state, selected, modern);
  if (!t) return "Select a currently reported contact";
  const o = t.observation;
  const rf = simulatedObservations({ ...state, tracks: [t] }).find(
    (x) => x.sensor === "rf",
  );
  const optical = o
    ? `EO: ${o.eo.available ? o.eo.level : "unavailable"} / IR: ${o.ir.available ? o.ir.level : "unavailable"}`
    : `Optical: ${t.thermal ? "observed" : "not observed"}`;
  return `${t.id} | ${Math.round(Math.hypot(t.x, t.z))} m reported\nRadar: ${o ? (o.radar.available ? o.radar.state : "unavailable") : state.radarStatus === "failed" ? "unavailable" : t.radar ? "contact" : "no contact"}\n${optical}\nRF: ${rf?.available ? (rf.rf_signal ? "link detected" : "no link detected") : "unavailable"} / IFF: ${rf?.iff ?? "unavailable"}\nDeclared: ${t.classification ? KIND_LABEL[t.classification] : "unknown"} / ${t.declared ?? "unknown"}`;
}
export function vrRenderContacts(
  state: Snapshot,
  scenario: Scenario,
  vision: Vision,
  visibility: ObservationVisibility,
  context: string,
) {
  return renderContacts(
    visibility.tracks(vrObservedState(state, modernSensors(scenario)), vision, {
      key: context,
    }),
  );
}
export function vrResponseReason(
  state: Snapshot,
  phase: VRPhase,
  scenario: Scenario,
  selected: string | null,
  effector: Effector,
) {
  const t = targetAt(state, selected, modernSensors(scenario));
  return effectorStates(phase, t, scenario, state.response, state.tick).find(
    (x) => x.effector === effector,
  )?.reason;
}
// One ordinary payload; App.act and its correlated worker receipt remain authoritative.
export function vrAction(
  state: Snapshot,
  phase: VRPhase,
  scenario: Scenario,
  selected: string | null,
  k: "designate" | "classify" | "engage",
  kind: Kind,
  identity: Identity,
  effector?: Effector,
): Omit<Action, "tick"> | undefined {
  const t = targetAt(state, selected, modernSensors(scenario));
  if (controlReason(k === "engage" ? "respond" : k, phase, t)) return;
  if (
    k === "engage" &&
    (!effector || vrResponseReason(state, phase, scenario, selected, effector))
  )
    return;
  return k === "classify"
    ? { k, track: t!.id, kind, identity }
    : k === "engage"
      ? { k, track: t!.id, effector }
      : { k, track: t!.id };
}
export type PendingResponse = {
  session: string;
  track: string;
  effector: Effector;
  until: number;
};
export function validConfirmation(
  p: PendingResponse | null,
  session: string,
  selected: string | null,
  phase: VRPhase,
  now: number,
  available: boolean,
) {
  return (
    !!p &&
    p.session === session &&
    p.track === selected &&
    phase === "running" &&
    now < p.until &&
    available
  );
}
export type XRSupport =
  "checking" | "available" | "insecure" | "unavailable" | "error";
export async function checkVRSupport(
  secure: boolean,
  xr: Pick<XRSystem, "isSessionSupported"> | undefined,
): Promise<XRSupport> {
  if (!secure) return "insecure";
  if (!xr) return "unavailable";
  try {
    return (await xr.isSessionSupported("immersive-vr"))
      ? "available"
      : "unavailable";
  } catch {
    return "error";
  }
}

// Kept independent from rendering so denial, suspension and teardown can be exercised without hardware.
export class VRSessionLifecycle {
  session: XRSession | null = null;
  private disposed = false;
  private entering = false;
  constructor(
    private suspend: () => void,
    private changed: (active: boolean) => void,
  ) {}
  async enter(
    xr: Pick<XRSystem, "requestSession">,
    attach: (session: XRSession) => Promise<void>,
  ) {
    if (this.disposed || this.entering || this.session) return;
    this.entering = true;
    let session: XRSession | undefined;
    try {
      // local gives a seated origin. No room movement, floor calibration or hand-tracking requirement.
      session = await xr.requestSession("immersive-vr", {
        requiredFeatures: ["local"],
      });
      if (this.disposed) {
        await session.end();
        return;
      }
      this.session = session;
      session.addEventListener("end", this.ended);
      session.addEventListener("visibilitychange", this.visibility);
      await attach(session);
      if (this.disposed || this.session !== session) return;
      this.changed(true);
    } catch (error) {
      if (session && this.session === session) {
        this.detach(session);
        this.session = null;
        await session.end().catch(() => {});
        this.suspend();
        this.changed(false);
      }
      throw error;
    } finally {
      this.entering = false;
    }
  }
  private detach = (s: XRSession) => {
    s.removeEventListener("end", this.ended);
    s.removeEventListener("visibilitychange", this.visibility);
  };
  private ended = () => {
    if (this.session) this.detach(this.session);
    this.session = null;
    this.suspend();
    this.changed(false);
  };
  private visibility = () => {
    if (this.session?.visibilityState !== "visible") this.suspend();
  };
  async exit() {
    if (this.session) {
      this.suspend();
      await this.session.end();
    }
  }
  dispose() {
    this.disposed = true;
    const s = this.session;
    if (s) {
      this.detach(s);
      this.session = null;
      this.suspend();
      void s.end().catch(() => {});
    }
  }
}
