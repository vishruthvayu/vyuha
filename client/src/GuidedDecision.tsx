import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronRight,
  Crosshair,
  Lightbulb,
  Radio,
  Shield,
  Target,
} from "lucide-react";
import { controlReason } from "./presentation";
import { engagementRule } from "./sim";
import type { Observation } from "./observations";
import type { PublicResponseAttempt } from "./response-v2";
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
import type { Vision } from "./visibility";

/** Guided Observe → Select → Designate → Classify → Respond → Outcome flow.
 * Reads only trainee-visible evidence (reported position, optical observation,
 * RF/IFF cues, public response state) and the trainee's own recorded decisions.
 * It never reads a track's hidden kind, identity or RF truth and never chooses. */

export type Phase = "ready" | "restoring" | "running" | "paused" | "complete";
export type DecisionAction = Omit<Action, "tick">;
export type ActionFeedback = {
  seq: number;
  action: DecisionAction;
  status: "submitted" | "accepted" | "rejected";
  tick?: number;
  reason?: string;
};
export type DecisionStep =
  "select" | "designate" | "classify" | "respond" | "outcome";
export const DECISION_STEPS: { id: DecisionStep; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "designate", label: "Designate" },
  { id: "classify", label: "Classify" },
  { id: "respond", label: "Respond" },
  { id: "outcome", label: "Outcome" },
];

export const KIND_HELP: Record<Kind, string> = {
  bird: "Flapping flight; no radio link, no IFF.",
  quad: "Multirotor flown over a radio link.",
  fixed_wing: "Wings and a propeller; faster, steadier.",
  fiber_fpv: "Multirotor with no radio link (e.g. fibre).",
};
export const IDENTITY_HELP: Record<Identity, string> = {
  hostile: "A threat to the protected site.",
  friendly: "Own or allied aircraft.",
  neutral: "Not a threat, not ours: wildlife, civil.",
};
export const EFFECTOR_INFO: Record<
  Effector,
  { label: string; what: string; Icon: typeof Shield }
> = {
  hold: {
    label: "Hold / monitor",
    what: "Keep the contact under observation. No effector is used.",
    Icon: Shield,
  },
  rf_jam: {
    label: "RF jammer",
    what: "Disrupts a radio control link. Has no effect on aircraft without one.",
    Icon: Radio,
  },
  kinetic: {
    label: "Kinetic",
    what: "Engages the contact directly. Not permitted in the restricted zone.",
    Icon: Target,
  },
};

export const clock = (tick: number) => {
  const s = Math.max(0, Math.floor(tick / 30));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Trainee's own decisions for a contact. Deliberately a narrow projection. */
export type DecisionRecord = Pick<
  Track,
  "id" | "designated" | "classification" | "declared" | "attempts"
>;
export function decisionRecord(track?: Track): DecisionRecord | undefined {
  return track
    ? {
        id: track.id,
        designated: track.designated,
        classification: track.classification,
        declared: track.declared,
        attempts: [...track.attempts],
      }
    : undefined;
}

export function decisionStep(
  selected: string | null,
  target: Track | undefined,
  record: DecisionRecord | undefined,
  revisit: "classify" | "respond" | null,
): DecisionStep {
  if (!selected || !record) return "select";
  if (!target) return record.attempts.length ? "outcome" : "select";
  if (record.designated === null) return "designate";
  if (!record.classification || revisit === "classify") return "classify";
  if (!record.attempts.length || revisit === "respond") return "respond";
  return "outcome";
}

/** What the current optical channel shows. Observation fields only. */
export function shapeEvidence(target: Track | undefined, vision: Vision) {
  const channel = vision === "day" ? "DAY TV" : "IR";
  if (!target) return { text: "No current report", detail: "" };
  const o = target.observation;
  if (o) {
    const optical = vision === "day" ? o.eo : o.ir;
    if (!optical.available)
      return {
        text: `${channel} unavailable`,
        detail:
          vision === "day" && !o.ir.available ? "" : "Try the other camera",
      };
    if (optical.level === "none")
      return { text: `Not seen by ${channel}`, detail: "Radar only" };
    if (optical.level === "detect" || !optical.silhouette)
      return { text: "Unresolved shape", detail: `${channel} · detect only` };
    const label =
      optical.silhouette === "multirotor"
        ? "Multirotor"
        : optical.silhouette === "fixed_wing"
          ? "Fixed-wing"
          : "Bird";
    return { text: label, detail: `${channel} · ${optical.level}` };
  }
  return target.thermal
    ? { text: "Seen by camera", detail: "Legacy optical cue" }
    : { text: "Not seen by camera", detail: "Radar only" };
}

export type EffectorState = {
  effector: Effector;
  disabled: boolean;
  reason?: string;
  facts: string[];
  reach?: number;
  range?: number;
};
/** Eligibility shown to the trainee. Reach and the restricted zone come from the
 * engine's own `engagementRule`, applied to the *reported* position; only its
 * `maximum`, `inRange` and `restricted` fields are read (never `effective` or
 * `success`, which depend on hidden truth). Resources come from the public
 * response state. The engine still decides every result. */
export function effectorStates(
  phase: string,
  target: Track | undefined,
  scenario: Pick<Scenario, "doctrine" | "response_model">,
  response: Snapshot["response"],
  tick: number,
): EffectorState[] {
  const rules = target?.rules ?? scenario.doctrine?.rules;
  const range = target ? Math.round(Math.hypot(target.x, target.z)) : undefined;
  return (["hold", "rf_jam", "kinetic"] as const).map((effector) => {
    const allowed = !rules || rules.effectors.includes(effector);
    const reason = controlReason("respond", phase, target, allowed);
    const rule = target ? engagementRule(target, effector) : undefined;
    const facts: string[] = [];
    let reach: number | undefined = rule?.maximum;
    let extra: string | undefined;
    if (effector === "hold") {
      if (rules?.hold_any_range) {
        reach = undefined;
        facts.push("Any range");
      }
    } else if (effector === "rf_jam") {
      const channels = scenario.response_model?.jammer_channels;
      if (response && channels !== undefined) {
        const free = channels - response.jammer_channels_in_use;
        facts.push(`${free}/${channels} channels free`);
        if (free <= 0) extra = "All jammer channels are busy.";
      }
      if (scenario.response_model)
        facts.push(
          `Effect decided after ~${Math.round(scenario.response_model.jammer_duration_ticks / 30)} s`,
        );
    } else {
      if (response) {
        facts.push(`${response.kinetic_ammo_remaining} rounds`);
        if (response.kinetic_ammo_remaining <= 0) extra = "No rounds remain.";
        else if (tick < response.kinetic_ready_tick)
          extra = `Reloading until ${clock(response.kinetic_ready_tick)}.`;
      }
      if (rule?.restricted) extra = "Contact is inside the restricted zone.";
    }
    if (rule && !rule.inRange && reach !== undefined)
      extra ??= "Beyond reach at the last observed position.";
    if (!allowed) extra = "Not available in this exercise.";
    return {
      effector,
      disabled: !!reason,
      reason: reason ?? extra,
      facts,
      reach,
      range,
    };
  });
}

export function attemptOutcome(a: PublicResponseAttempt): {
  tone: "pending" | "good" | "neutral" | "warn";
  text: string;
} {
  const label = EFFECTOR_INFO[a.effector].label;
  switch (a.status) {
    case "pending":
      return {
        tone: "pending",
        text: `${label} under way · effect decided at ${clock(a.due_tick ?? a.tick)}`,
      };
    case "resolved":
      return {
        tone: "good",
        text: `${label} took effect at ${clock(a.result_tick ?? a.tick)}: contact neutralised`,
      };
    case "no_effect":
      return {
        tone: "warn",
        text: `${label} had no observable effect (${clock(a.result_tick ?? a.tick)})`,
      };
    case "hold":
      return { tone: "neutral", text: "Holding: monitoring continues" };
    case "blocked_ammo":
      return { tone: "warn", text: "Not fired: no rounds remained" };
    case "blocked_cooldown":
      return {
        tone: "warn",
        text: "Not fired: kinetic effector was reloading",
      };
    case "blocked_channels":
      return {
        tone: "warn",
        text: "Not started: all jammer channels were busy",
      };
    case "unavailable":
      return {
        tone: "warn",
        text: `${label} is not available in this exercise`,
      };
    case "target_inactive":
      return {
        tone: "neutral",
        text: "The contact was no longer active when the effect was due",
      };
  }
}

function describeAction(a: DecisionAction) {
  return a.k === "designate"
    ? `Designation of ${a.track}`
    : a.k === "classify"
      ? `Classification of ${a.track} as ${a.kind ? KIND_LABEL[a.kind] : "?"} · ${a.identity ?? "?"}`
      : `${a.effector ? EFFECTOR_INFO[a.effector].label : "Response"} on ${a.track}`;
}
export function feedbackText(f: ActionFeedback) {
  const what = describeAction(f.action);
  return f.status === "submitted"
    ? `${what}: submitted…`
    : f.status === "accepted"
      ? `${what}: accepted at ${clock(f.tick ?? 0)}`
      : `${what}: not accepted. ${f.reason ?? "The exercise engine rejected it."}`;
}

const COACH: Record<DecisionStep, string> = {
  select:
    "Contacts reach the radar before the cameras can see them. Select one on the radar or in the track list; the camera slews to it.",
  designate:
    "Designating says you have detected this contact and are working it. It does not commit you to a response.",
  classify:
    "Compare what the sensors show with each option. Shape comes from the camera; link and IFF come from the RF sensor. Missing evidence is not proof.",
  respond:
    "Pick the response your classification supports. Check reach, the restricted zone and resources before committing.",
  outcome:
    "Effects take time and can fail. Keep watching this contact, then move to the next one.",
};

function ChoiceGroup<T extends string>({
  legend,
  evidence,
  name,
  options,
  value,
  onChange,
  disabled,
}: {
  legend: string;
  /** Evidence that bears on this choice, shown beside its legend. */
  evidence?: ReactNode;
  name: string;
  options: { value: T; label: string; help: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="choice-group" disabled={disabled}>
      <legend>
        {legend}
        {evidence && <span className="choice-evidence">{evidence}</span>}
      </legend>
      <div className="choice-options">
        {options.map((o) => (
          <label
            key={o.value}
            className="choice-card"
            data-checked={value === o.value}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <strong>{o.label}</strong>
            <small>{o.help}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="guided-fact">
      <small>{label}</small>
      <strong>{children}</strong>
    </span>
  );
}

export function GuidedDecision({
  phase,
  selected,
  target,
  record,
  state,
  scenario,
  vision,
  rf,
  feedback,
  guidance,
  onGuidance,
  onAct,
  onNext,
}: {
  phase: Phase;
  selected: string | null;
  /** The selected contact while it is currently reported by any sensor. */
  target?: Track;
  /** The trainee's recorded decisions on the selected contact. */
  record?: DecisionRecord;
  state: Pick<Snapshot, "tick" | "rfAvailable" | "response">;
  scenario: Pick<Scenario, "doctrine" | "response_model">;
  vision: Vision;
  rf?: Observation;
  feedback: ActionFeedback | null;
  guidance: boolean;
  onGuidance: (on: boolean) => void;
  onAct: (action: DecisionAction) => void;
  onNext?: () => void;
}) {
  const uid = useId();
  const dock = useRef<HTMLDivElement>(null);
  const stepBody = useRef<HTMLDivElement>(null);
  const keyboardIntent = useRef<{
    selected: string | null;
    step: string;
  } | null>(null);
  const [revisit, setRevisit] = useState<"classify" | "respond" | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  // A new selection starts with no answer chosen; an earlier own classification
  // is shown so it can be confirmed again or changed.
  useEffect(() => {
    setRevisit(null);
    setKind(record?.classification ?? null);
    setIdentity(record?.declared ?? null);
    // Only the selected contact resets the draft, not each snapshot.
  }, [selected]);
  useEffect(() => {
    if (feedback?.status === "accepted" && feedback.action.track === selected)
      setRevisit(null);
  }, [feedback, selected]);
  const step = decisionStep(selected, target, record, revisit);
  const running = phase === "running";
  const ownFeedback =
    feedback && feedback.action.track === selected ? feedback : null;
  const lastAttempt = state.response?.attempts
    .filter((a) => a.track === selected)
    .at(-1);
  const shape = shapeEvidence(target, vision);
  const range = target ? Math.round(Math.hypot(target.x, target.z)) : null;
  const link = !state.rfAvailable
    ? "RF sensor offline"
    : !target
      ? "—"
      : rf?.rf_signal
        ? "Detected"
        : "Not detected";
  const iff = !state.rfAvailable
    ? "Unavailable"
    : !target
      ? "—"
      : rf?.iff === "friendly_reply"
        ? "Friendly reply"
        : rf?.iff === "registered_civil"
          ? "Registered civil"
          : rf?.iff === "unavailable"
            ? "Unavailable"
            : "No reply";
  const designateWhy = controlReason("designate", phase, target);
  const classifyWhy =
    controlReason("classify", phase, target) ??
    (!kind || !identity ? "Choose a type and an identity." : undefined);
  const effectors = effectorStates(
    phase,
    target,
    scenario,
    state.response,
    state.tick,
  );
  const stepIndex = DECISION_STEPS.findIndex((s) => s.id === step);
  function submit(
    event: MouseEvent<HTMLButtonElement>,
    action: DecisionAction,
  ) {
    keyboardIntent.current = event.detail === 0 ? { selected, step } : null;
    onAct(action);
  }
  useEffect(() => {
    const intent = keyboardIntent.current;
    if (!intent) return;
    if (
      intent.selected !== selected ||
      ownFeedback?.status === "rejected" ||
      phase !== "running"
    ) {
      keyboardIntent.current = null;
      return;
    }
    if (step === intent.step || ownFeedback?.status !== "accepted") return;
    keyboardIntent.current = null;
    // Preserve deliberate navigation outside the dock while awaiting a receipt.
    if (
      document.activeElement === document.body ||
      dock.current?.contains(document.activeElement)
    )
      stepBody.current?.focus();
  }, [step, selected, phase, ownFeedback]);
  const statusText = ownFeedback
    ? feedbackText(ownFeedback)
    : phase === "paused"
      ? "Exercise paused. Resume to make decisions."
      : phase === "ready"
        ? "Start the exercise to make decisions."
        : phase === "complete"
          ? "Exercise complete. Review your decisions in the after-action review."
          : "";
  return (
    <div ref={dock} className="guided" data-step={step}>
      <div className="guided-head">
        <ol className="guided-steps" aria-label="Decision steps">
          {DECISION_STEPS.map((s, i) => (
            <li
              key={s.id}
              data-state={
                i < stepIndex ? "done" : i === stepIndex ? "current" : "todo"
              }
              aria-current={i === stepIndex ? "step" : undefined}
            >
              <span aria-hidden="true">
                {i < stepIndex ? <Check size={11} /> : i + 1}
              </span>
              <span className="guided-step-label">{s.label}</span>
            </li>
          ))}
        </ol>
        <div className="guided-target">
          {selected ? (
            <>
              <strong>{selected}</strong>
              <span>
                {range !== null ? `${range} m observed` : "no current report"}
                {record?.classification
                  ? ` · ${KIND_LABEL[record.classification]} · ${record.declared}`
                  : record?.designated !== null && record
                    ? " · designated"
                    : ""}
              </span>
            </>
          ) : (
            <span>No contact selected</span>
          )}
        </div>
        <button
          type="button"
          className="text-button guided-toggle"
          aria-pressed={guidance}
          onClick={() => onGuidance(!guidance)}
        >
          <Lightbulb size={14} aria-hidden="true" />
          Guidance
        </button>
      </div>
      {guidance && running && <p className="guided-coach">{COACH[step]}</p>}
      <div
        ref={stepBody}
        className="guided-body"
        tabIndex={-1}
        role="group"
        aria-label={`${DECISION_STEPS[stepIndex]?.label ?? step}${selected ? ` ${selected}` : ""}`}
      >
        {step === "select" && (
          <div className="guided-prompt">
            <Crosshair size={18} aria-hidden="true" />
            <p>
              {selected && !target
                ? `${selected} has no current sensor report. The camera holds its last bearing; select another contact or wait for reacquisition.`
                : "Select a contact on the radar or in the track list."}
            </p>
            {onNext && running && (
              <button type="button" className="button subtle" onClick={onNext}>
                Nearest undesignated contact <ChevronRight size={14} />
              </button>
            )}
          </div>
        )}
        {step === "designate" && (
          <div className="guided-prompt">
            <div className="guided-facts">
              <Fact label="Shape">{shape.text}</Fact>
              <Fact label="Range">{range} m</Fact>
            </div>
            <button
              type="button"
              className="button designate"
              disabled={!!designateWhy}
              aria-describedby={`${uid}-designate`}
              onClick={(event) =>
                target && submit(event, { k: "designate", track: target.id })
              }
            >
              <Crosshair size={16} aria-hidden="true" />
              Designate {selected}
            </button>
            <p id={`${uid}-designate`} className="guided-why">
              {designateWhy ??
                "Marks the contact as detected and being worked. Your designation time is recorded."}
            </p>
          </div>
        )}
        {step === "classify" && (
          <div className="guided-classify">
            <ChoiceGroup
              legend="Type"
              evidence={
                <>
                  Camera: <strong>{shape.text}</strong>
                  {shape.detail && ` (${shape.detail})`} · Link:{" "}
                  <strong>{link}</strong>
                </>
              }
              name={`${uid}-kind`}
              disabled={!running || !target}
              value={kind}
              onChange={setKind}
              options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({
                value: k,
                label: KIND_LABEL[k],
                help: KIND_HELP[k],
              }))}
            />
            <ChoiceGroup
              legend="Identity"
              evidence={
                <>
                  IFF: <strong>{iff}</strong>
                </>
              }
              name={`${uid}-identity`}
              disabled={!running || !target}
              value={identity}
              onChange={setIdentity}
              options={(["hostile", "friendly", "neutral"] as const).map(
                (i) => ({
                  value: i,
                  label: i[0].toUpperCase() + i.slice(1),
                  help: IDENTITY_HELP[i],
                }),
              )}
            />
            <div className="guided-commit">
              <button
                type="button"
                className="button primary"
                disabled={!!classifyWhy}
                aria-describedby={`${uid}-classify`}
                onClick={(event) =>
                  target &&
                  kind &&
                  identity &&
                  submit(event, {
                    k: "classify",
                    track: target.id,
                    kind,
                    identity,
                  })
                }
              >
                <Check size={16} aria-hidden="true" /> Confirm classification
              </button>
              <p id={`${uid}-classify`} className="guided-why">
                {classifyWhy ??
                  "Shape alone cannot show the control method or intent. You can change this later."}
              </p>
              {revisit === "classify" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRevisit(null)}
                >
                  Keep current classification
                </button>
              )}
            </div>
          </div>
        )}
        {step === "respond" && (
          <div className="guided-respond">
            <p className="guided-summary">
              Classified{" "}
              <strong>
                {record?.classification && KIND_LABEL[record.classification]} ·{" "}
                {record?.declared}
              </strong>
              <button
                type="button"
                className="text-button"
                onClick={() => setRevisit("classify")}
              >
                Change
              </button>
              {revisit === "respond" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRevisit(null)}
                >
                  Back to outcome
                </button>
              )}
            </p>
            <div className="effector-cards">
              {effectors.map((e) => {
                const { label, what, Icon } = EFFECTOR_INFO[e.effector];
                const reachText =
                  e.reach !== undefined && e.range !== undefined
                    ? `${e.range} m observed · reach ${e.reach} m`
                    : undefined;
                return (
                  <button
                    key={e.effector}
                    type="button"
                    className={`effector-card ${e.effector}`}
                    disabled={e.disabled}
                    aria-describedby={`${uid}-${e.effector}`}
                    onClick={(event) =>
                      target &&
                      submit(event, {
                        k: "engage",
                        track: target.id,
                        effector: e.effector,
                      })
                    }
                  >
                    <span className="effector-title">
                      <Icon size={16} aria-hidden="true" />
                      {label}
                    </span>
                    <span className="effector-what">{what}</span>
                    <span
                      className="effector-facts"
                      id={`${uid}-${e.effector}`}
                    >
                      {reachText && (
                        <span
                          className="reach"
                          data-beyond={e.range! > e.reach!}
                          style={{
                            ["--reach" as string]: Math.min(
                              1,
                              e.range! / Math.max(1, e.reach!),
                            ),
                          }}
                        >
                          {reachText}
                          {e.range! > e.reach! ? " · beyond reach" : ""}
                        </span>
                      )}
                      {e.facts.map((f) => (
                        <span key={f}>{f}</span>
                      ))}
                      {e.reason && <span className="why">{e.reason}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="guided-why">
              Effects are simulated and not guaranteed. The engine decides the
              result.
            </p>
          </div>
        )}
        {step === "outcome" && (
          <div className="guided-outcome">
            {lastAttempt ? (
              <p
                className="outcome-line"
                data-tone={attemptOutcome(lastAttempt).tone}
              >
                {attemptOutcome(lastAttempt).text}
              </p>
            ) : (
              <p className="outcome-line" data-tone="neutral">
                Response recorded
                {record?.attempts.length
                  ? ` (${EFFECTOR_INFO[record.attempts.at(-1)!].label})`
                  : ""}
                .{" "}
                {target
                  ? "The contact is still reported by the sensors."
                  : "The contact is no longer reported by any sensor."}
              </p>
            )}
            <div className="guided-commit">
              {target && running && (
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => setRevisit("respond")}
                >
                  Respond again
                </button>
              )}
              {onNext && running && (
                <button
                  type="button"
                  className="button primary"
                  onClick={onNext}
                >
                  Next contact <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="guided-status" role="status" aria-live="polite">
        {statusText}
      </p>
    </div>
  );
}
