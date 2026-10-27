/** Presentation-only mission conductor. No simulation, scoring, DB or truth input.
 * The caller must supply the current correlated worker scope and accepted receipts.
 * A matching caller-supplied scope is not an authorization or secrecy guarantee. */
export type MissionScope = {
  attemptId: string;
  scenarioId: string;
  engineVersion: "vyuha-0.4.0";
};
export type MissionPlan = {
  version: "episode-plan-v1";
  scope: MissionScope;
  identities: {
    objective: string;
    world: string;
    episode: "passive-observation-v1";
    evaluation: "guidance-only-v1";
  };
  assistance: "full" | "faded" | "none";
  durationTicks: number;
  maximumSampleAgeTicks: 30;
};
export type ReportedContact = {
  scope: MissionScope;
  id: string;
  reportTick: number;
  channels: {
    channel: "radar" | "eo" | "ir";
    available: boolean;
    level: "none" | "detect" | "shape";
    sampleTick: number | null;
  }[];
  iff: "friendly_reply" | "registered_civil" | "no_reply" | "unavailable";
};
export type AcceptedDecision = {
  scope: MissionScope;
  tick: number;
  order: number;
  trackId: string;
  action: "designate" | "classify" | "engage";
  status: "accepted";
};
export type MissionFrame = {
  version: "mission-frame-v1";
  scope: MissionScope;
  tick: number;
  selectedTrackId: string | null;
  contacts: ReportedContact[];
  accepted: AcceptedDecision[];
  completed: boolean;
};
type Obj = Record<string, unknown>;
function object(value: unknown, keys: string[], label: string): Obj {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()
  )
    throw new Error(`Invalid ${label} fields`);
  return value as Obj;
}
function integer(v: unknown, min: number, max: number, label: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max)
    throw new Error(`Invalid ${label}`);
  return v;
}
function text(v: unknown, label: string): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v))
    throw new Error(`Invalid ${label}`);
  return v;
}
function scope(value: unknown): MissionScope {
  const o = object(
    value,
    ["attemptId", "scenarioId", "engineVersion"],
    "scope",
  );
  if (o.engineVersion !== "vyuha-0.4.0")
    throw new Error("Unsupported mission engine");
  return {
    attemptId: text(o.attemptId, "attemptId"),
    scenarioId: text(o.scenarioId, "scenarioId"),
    engineVersion: "vyuha-0.4.0",
  };
}
function sameScope(v: unknown, expected: MissionScope) {
  const s = scope(v);
  if (
    s.attemptId !== expected.attemptId ||
    s.scenarioId !== expected.scenarioId
  )
    throw new Error("Mixed mission scope");
}
function freeze<T>(v: T): T {
  if (v && typeof v === "object") {
    for (const x of Object.values(v)) freeze(x);
    Object.freeze(v);
  }
  return v;
}
export function createMissionPlan(
  context: MissionScope,
  options: {
    worldId: string;
    assistance: "full" | "faded" | "none";
    durationTicks: number;
    objectiveId?: string;
  },
): MissionPlan {
  const s = scope(context),
    keys = [
      "worldId",
      "assistance",
      "durationTicks",
      ...(Object.hasOwn(options, "objectiveId") ? ["objectiveId"] : []),
    ];
  const o = object(options, keys, "mission options");
  if (!["full", "faded", "none"].includes(String(o.assistance)))
    throw new Error("Unknown assistance policy");
  return freeze({
    version: "episode-plan-v1",
    scope: s,
    identities: {
      objective: text(
        o.objectiveId ?? "reported-evidence-cycle-v1",
        "objectiveId",
      ),
      world: text(o.worldId, "worldId"),
      episode: "passive-observation-v1",
      evaluation: "guidance-only-v1",
    },
    assistance: o.assistance as MissionPlan["assistance"],
    durationTicks: integer(o.durationTicks, 1800, 5400, "durationTicks"),
    maximumSampleAgeTicks: 30,
  });
}
function validatePlan(value: MissionPlan): MissionPlan {
  const p = object(
    value,
    [
      "version",
      "scope",
      "identities",
      "assistance",
      "durationTicks",
      "maximumSampleAgeTicks",
    ],
    "plan",
  );
  const ids = object(
    p.identities,
    ["objective", "world", "episode", "evaluation"],
    "plan identities",
  );
  if (
    p.version !== "episode-plan-v1" ||
    ids.episode !== "passive-observation-v1" ||
    ids.evaluation !== "guidance-only-v1" ||
    p.maximumSampleAgeTicks !== 30
  )
    throw new Error("Unsupported mission plan contract");
  return createMissionPlan(scope(p.scope), {
    worldId: text(ids.world, "world"),
    objectiveId: text(ids.objective, "objective"),
    assistance: p.assistance as MissionPlan["assistance"],
    durationTicks: p.durationTicks as number,
  });
}
export function projectMission(plan: MissionPlan, input: MissionFrame) {
  const p = validatePlan(plan),
    f = object(
      input,
      [
        "version",
        "scope",
        "tick",
        "selectedTrackId",
        "contacts",
        "accepted",
        "completed",
      ],
      "mission frame",
    );
  if (f.version !== "mission-frame-v1" || typeof f.completed !== "boolean")
    throw new Error("Unsupported mission frame");
  sameScope(f.scope, p.scope);
  const tick = integer(f.tick, 0, p.durationTicks, "frame tick");
  const selected =
    f.selectedTrackId === null
      ? null
      : text(f.selectedTrackId, "selectedTrackId");
  if (
    !Array.isArray(f.contacts) ||
    f.contacts.length > 200 ||
    !Array.isArray(f.accepted) ||
    f.accepted.length > 10000
  )
    throw new Error("Mission input bounds exceeded");
  const actions: AcceptedDecision[] = [],
    byOrder = new Map<number, string>();
  let previousTick = -1,
    previousOrder = -1;
  for (const value of f.accepted) {
    const a = object(
      value,
      ["scope", "tick", "order", "trackId", "action", "status"],
      "accepted receipt",
    );
    sameScope(a.scope, p.scope);
    const at = integer(a.tick, 0, tick, "accepted tick"),
      order = integer(a.order, 0, 100000, "accepted order"),
      track = text(a.trackId, "trackId");
    if (
      a.status !== "accepted" ||
      !["designate", "classify", "engage"].includes(String(a.action))
    )
      throw new Error("Unaccepted mission action");
    const signature = `${at}:${track}:${a.action}`;
    if (byOrder.has(order)) {
      if (byOrder.get(order) !== signature)
        throw new Error("Conflicting accepted order");
      continue;
    }
    if (at < previousTick || order <= previousOrder)
      throw new Error("Accepted receipts out of order");
    previousTick = at;
    previousOrder = order;
    byOrder.set(order, signature);
    actions.push(a as unknown as AcceptedDecision);
  }
  const seen = new Set<string>();
  const contacts = f.contacts
    .map((value) => {
      const c = object(
        value,
        ["scope", "id", "reportTick", "channels", "iff"],
        "reported contact",
      );
      sameScope(c.scope, p.scope);
      const id = text(c.id, "contact id"),
        reportTick = integer(c.reportTick, 0, tick, "report tick");
      if (seen.has(id)) throw new Error("Duplicate reported contact");
      seen.add(id);
      if (
        ![
          "friendly_reply",
          "registered_civil",
          "no_reply",
          "unavailable",
        ].includes(String(c.iff)) ||
        !Array.isArray(c.channels) ||
        c.channels.length !== 3
      )
        throw new Error("Invalid reported channels");
      const channelNames = new Set<string>(),
        available: string[] = [],
        fresh: string[] = [];
      let positive = false,
        shape = false;
      for (const value of c.channels) {
        const channel = object(
            value,
            ["channel", "available", "level", "sampleTick"],
            "reported channel",
          ),
          name = String(channel.channel);
        if (
          !["radar", "eo", "ir"].includes(name) ||
          channelNames.has(name) ||
          typeof channel.available !== "boolean" ||
          !["none", "detect", "shape"].includes(String(channel.level)) ||
          (name === "radar" && channel.level === "shape")
        )
          throw new Error("Invalid reported channel semantics");
        channelNames.add(name);
        const sample =
          channel.sampleTick === null
            ? null
            : integer(channel.sampleTick, 0, reportTick, "sample tick");
        if (!channel.available && channel.level !== "none")
          throw new Error("Unavailable channel cannot contain a signal");
        if (channel.available) available.push(name);
        if (channel.available && channel.level !== "none") {
          positive = true;
          if (sample !== null && tick - sample <= p.maximumSampleAgeTicks) {
            fresh.push(name);
            shape ||= channel.level === "shape";
          }
        }
      }
      const recorded = actions.filter((a) => a.trackId === id);
      return {
        id,
        reportTick,
        reportAgeTicks: tick - reportTick,
        evidenceState: fresh.length
          ? shape
            ? "shape"
            : "reported"
          : positive
            ? "stale_or_undated"
            : available.length
              ? "none"
              : "unavailable",
        availableChannels: available,
        freshChannels: fresh,
        identityCue: c.iff as ReportedContact["iff"],
        designated: recorded.some((a) => a.action === "designate"),
        classified: recorded.some((a) => a.action === "classify"),
        responseRecorded: recorded.some((a) => a.action === "engage"),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const contact = contacts.find((c) => c.id === selected) ?? null;
  const stage = f.completed
    ? "reconstruct"
    : !contact || !contact.freshChannels.length
      ? "observe"
      : !contact.designated
        ? "investigate"
        : "decide";
  const guidanceVisible = p.assistance !== "none";
  let task =
    stage === "reconstruct"
      ? "Reconstruct the available evidence and recorded decisions."
      : !contact || !contact.freshChannels.length
        ? "Inspect report timing and sensor availability. An old or undated sample does not by itself establish whether a contact is present."
        : !contact.designated
          ? "Compare the available channels, then designate the reported contact when ready."
          : !contact.classified
            ? "Classify only what the available cues support. No reply does not establish hostile identity."
            : !contact.responseRecorded
              ? "Choose a response using your classification and the available evidence."
              : "Monitor the recorded outcome or inspect another reported contact.";
  if (p.assistance === "faded")
    task = {
      observe: "Observe the reported picture.",
      investigate: "Inspect the available evidence.",
      decide: "Make and monitor your decision.",
      reconstruct: "Review the recorded evidence.",
    }[stage];
  return freeze({
    version: "mission-projection-v1" as const,
    scope: { ...p.scope },
    identities: { ...p.identities },
    tick,
    stage,
    guidanceVisible,
    task: guidanceVisible ? task : null,
    selectedTrackId: selected,
    contacts,
    reportedContacts: contacts.length,
    acceptedDecisions: actions.length,
    completed: f.completed,
    limitation:
      "Derived mission guidance only; activity is not correctness, mastery, gaze, active acquisition or proof of learning.",
  });
}
