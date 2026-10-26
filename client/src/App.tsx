import { OpticalStation } from "./OpticalStation";
import { TrainingDeck } from "./TrainingDeck";
import { briefingSnapshot } from "./training-presentation";
import ReviewTheatre from "./ReviewTheatre";
import type { LearningPreparation } from "./learning";
import { LearningBanner } from "./LearningEvidence";
import PerformanceDiagnostics from "./PerformanceDiagnostics";
import {
  currentCapture,
  diagnosticPhase,
  diagnosticWorkerDelivery,
} from "./diagnostics";
import { ActionEvidenceLedger } from "./action-evidence";
import { useContactMemory } from "./useContactMemory";
import { useCommandTransport } from "./useCommandTransport";
import { reportedContacts } from "./observed-contacts";
import OfficerGate from "./OfficerGate";
import { palettes, type ThermalPalette } from "./presentation";
import { SensorBadges } from "./SensorBadges";
import Navigation from "./Navigation";
import { workspaceViewFromSearch } from "./routes";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ChevronRight,
  Crosshair,
  Layers,
  Monitor,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Shield,
  Target,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { Scene } from "./LazyScene";
import { ObservationVisibility, type Vision } from "./visibility";
import { initialTrainingMode, nextTrainingSeed } from "./training-setup";
import { TrainingWelcome } from "./TrainingWelcome";
import AARHistory from "./AARHistory";
import { Radar } from "./Radar";
import { UnitDashboard, type Assignment } from "./Unit";
import {
  ownDraft,
  newId,
  sealEvents,
  uploadBatches,
  syncMessage,
  type UnitIdentity,
} from "./unit-state";
import { launchPreparedScenario } from "./Director";
import DrillSetup from "./DrillSetup";
import { DecisionWorkspace } from "./DecisionWorkspace";
import {
  GuidedDecision,
  decisionRecord,
  type ActionFeedback,
} from "./GuidedDecision";
import { ReviewSections } from "./ReviewSections";
import type { TrainingProfile } from "./types";
import { GhostPanel, GhostTimeline, timelineSeek } from "./Ghost";
import { HZ, inCivilZone, replay, score, Simulation } from "./sim";
import { makeScenario } from "./scenario";
import LocalAudio from "./LocalAudio";
import AdvancedAAR from "./AdvancedAAR";
import FusionReview from "./FusionReview";
import ReferenceRun from "./ReferenceRun";
import ExpertComparison from "./ExpertComparison";
import { FusionPanel } from "./FusionPanel";
import type { FusionAdvice } from "./fusion";
import type { FusionExposure } from "./types";
import { simulatedObservations } from "./observations";
import type { Quality } from "./quality";
import { useRenderingQuality } from "./useRenderingQuality";
import { useOfflineStatus } from "./useOfflineStatus";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import {
  ApiError,
  RECONSTRUCTION_TIMEOUT_MS,
  mergeServerRecord,
  api,
  download,
  readRecords,
  readDrafts,
  removeLocal,
  saveDraft as storeDraft,
  saveRecord,
  type Draft,
} from "./storage";
import {
  KIND_LABEL,
  type Action,
  type AppliedCommand,
  type Kind,
  type Record as TrainingRecord,
  type Scenario,
  type ScoreCard,
  type Snapshot,
  type Track,
} from "./types";

const initial = makeScenario();
const initialState = new Simulation(initial).snapshot();
const time = (tick: number) =>
  `${Math.floor(tick / HZ / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor((tick / HZ) % 60)
    .toString()
    .padStart(2, "0")}`;
const controlPayload = (
  s: Snapshot,
  cs: AppliedCommand[],
  paused: boolean,
) => ({
  tick: s.tick,
  paused,
  active_contacts: s.tracks.filter((t) => t.active).length,
  radar_status: s.radarStatus,
  rf_available: s.rfAvailable,
  night: s.night,
  applied: cs.map(({ seq, tick, order }) => ({ seq, tick, order })),
});
/** Retrieve annotations and replay evidence without trusting a different session/scenario. */
async function completeReview(record: TrainingRecord): Promise<TrainingRecord> {
  const remote = await api<TrainingRecord>(
    `/sessions/${encodeURIComponent(record.id)}/aar`,
    undefined,
    RECONSTRUCTION_TIMEOUT_MS,
  );
  if (
    remote.id !== record.id ||
    remote.scenario.id !== record.scenario.id ||
    !remote.verified
  )
    throw new Error(
      "Detailed review does not belong to this verified exercise.",
    );
  return mergeServerRecord(record, remote);
}
type View = "drill" | "aar" | "unit";
type Phase = "ready" | "restoring" | "running" | "paused" | "complete";
const VRCockpit = lazy(() => import("./VRCockpit"));

export default function App({
  identity: unitIdentity,
  reviewOnly = false,
}: {
  identity?: UnitIdentity;
  reviewOnly?: boolean;
}) {
  const replayHeading = useRef<HTMLHeadingElement>(null);
  const decisionDock = useRef<HTMLElement>(null);
  const [view, setView] = useState<View>(() =>
    workspaceViewFromSearch(window.location.search),
  );
  const [phase, setPhase] = useState<Phase>("ready");
  useEffect(() => {
    diagnosticPhase(
      phase === "running"
        ? "startup"
        : phase === "complete"
          ? "review"
          : "preparation",
    );
    const timer =
      phase === "running"
        ? setTimeout(() => diagnosticPhase("training"), 3000)
        : undefined;
    return () => clearTimeout(timer);
  }, [phase]);
  const [scenario, setScenario] = useState<Scenario>(initial);
  const [state, setState] = useState<Snapshot>(initialState);
  const [vision, setVision] = useState<Vision>("thermal");
  const priorVision = useRef(vision);
  useEffect(() => {
    const changed = priorVision.current !== vision;
    priorVision.current = vision;
    if (
      !changed ||
      phase !== "running" ||
      currentCapture()?.phase === "startup"
    )
      return;
    diagnosticPhase("optics");
    const timer = setTimeout(() => diagnosticPhase("training"), 1500);
    return () => clearTimeout(timer);
  }, [vision, phase]);
  const [tactical, setTactical] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [vrOpen, setVROpen] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const feedbackSeq = useRef(0);
  const [guidance, setGuidanceState] = useState(() => {
    try {
      return localStorage.getItem("vyuha.guidance") !== "off";
    } catch {
      return true;
    }
  });
  const setGuidance = (on: boolean) => {
    setGuidanceState(on);
    try {
      localStorage.setItem("vyuha.guidance", on ? "on" : "off");
    } catch {
      // Guidance still toggles for this page when storage is unavailable.
    }
  };
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [current, setCurrent] = useState<TrainingRecord | null>(null);
  const [replayTick, setReplayTick] = useState(0);
  const [replayPlay, setReplayPlay] = useState(false);
  const [replayOrder, setReplayOrder] = useState<number | undefined>();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewReload, setReviewReload] = useState(0);
  const rfObservation = simulatedObservations(state).find(
    (o) => o.track_id === selected && o.sensor === "rf",
  );
  const replayEnd =
    current?.replay_metadata?.observed_end_tick ??
    current?.executionTick ??
    current?.endTick ??
    2250;
  const fusionRecords = useRef<FusionExposure[]>([]),
    latestAdvice = useRef<FusionAdvice | null>(null);
  const fusionExposure = useCallback((advice: FusionAdvice | null) => {
    latestAdvice.current = advice;
  }, []);
  const [logConfidence, setLogConfidence] = useState(false),
    [confidence, setConfidence] = useState(70);
  const pendingActionEvidence = useRef(new ActionEvidenceLedger());
  const confidenceRef = useRef<number | null>(null);
  confidenceRef.current = !vrOpen && logConfidence ? confidence : null;
  const learningRef = useRef<LearningPreparation | undefined>(undefined);
  const learningRequest = useRef(0);
  const [learning, setLearning] = useState<LearningPreparation | undefined>();
  const saveDraft = (
    id: string,
    actions: Action[],
    spec: Scenario,
    owner: string,
    tick: number,
    server = false,
    cs: AppliedCommand[] = [],
    batches: Action[][] = [],
  ) =>
    storeDraft(
      id,
      actions,
      spec,
      owner,
      tick,
      server,
      cs,
      batches,
      [...fusionRecords.current],
      learningRef.current,
    );
  const [clockNote, setClockNote] = useState("");
  const offline = useOfflineStatus();
  const [recovery, setRecovery] = useState<Draft | null>(null);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [trainee, setTrainee] = useState(
    unitIdentity?.trainee_id ?? "CADET-01",
  );
  const [mode, setMode] = useState<"scripted" | "adaptive" | "library">(
    initialTrainingMode(window.location.search),
  );
  const [night, setNight] = useState(true);
  const [seed, setSeed] = useState(482913);
  const [sync, setSync] = useState<"synced" | "syncing" | "queued">("synced");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const clientId = useRef(newId());
  const eventBatches = useRef<Action[][]>([]);
  const enterTactical = useCallback(() => setTactical(true), []);
  const { fps, quality, setQuality, autoQuality, setAutoQuality, renderFps } =
    useRenderingQuality(enterTactical);
  const [library, setLibrary] = useState<Scenario[]>([]),
    [libraryId, setLibraryId] = useState("");
  useEffect(() => {
    if (reviewOnly) return;
    void api<{ scenarios: Scenario[] }>("/scenario-library")
      .then((r) => {
        setLibrary(r.scenarios);
        setLibraryId(r.scenarios[0]?.id ?? "");
      })
      .catch(() => {});
  }, []);
  const [trainingProfile, setTrainingProfile] =
    useState<TrainingProfile | null>(null);
  const [prepared, setPrepared] = useState<Scenario | null>(null);
  useEffect(() => {
    let stopped = false;
    setTrainingProfile(null);
    if (reviewOnly) return;
    void api<TrainingProfile>(`/trainees/${trainee}/profile`)
      .then((p) => {
        if (!stopped) setTrainingProfile(p);
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [trainee, current?.id, current?.verified, phase]);
  useEffect(() => {
    if (phase !== "ready") return;
    setPrepared(null);
    learningRef.current = undefined;
    setLearning(undefined);
  }, [trainee, seed, mode]);
  useEffect(() => {
    if (phase === "ready" && mode === "scripted") {
      const spec = makeScenario(seed, "recognition", night);
      setScenario(spec);
      setState(new Simulation(spec).snapshot());
      setSelected(null);
    }
  }, [phase, mode, seed, night]);
  useEffect(() => {
    if (phase === "ready" && mode === "library") {
      const spec = library.find((s) => s.id === libraryId);
      if (spec) {
        setScenario(spec);
        setState(new Simulation(spec).snapshot());
        setNight(spec.night);
        setSelected(null);
      }
    }
  }, [phase, mode, libraryId, library]);
  useEffect(() => {
    const ticket = new URLSearchParams(window.location.search).get("learning");
    if (!ticket || reviewOnly || phase !== "ready") return;
    let cancelled = false;
    const request = ++learningRequest.current;
    void api<LearningPreparation>(
      `/learning/preparations/${encodeURIComponent(ticket)}?trainee=${encodeURIComponent(trainee)}`,
    )
      .then((p) => {
        if (cancelled || request !== learningRequest.current) return;
        if (p.session_id) {
          setNotice(
            "This Academy attempt already started. Restore its saved draft or prepare a new attempt in Academy.",
          );
          return;
        }
        learningRef.current = p;
        setLearning(p);
        setMode("adaptive");
        setPrepared(p.scenario);
        setScenario(p.scenario);
        setState(new Simulation(p.scenario).snapshot());
        setNight(p.scenario.night);
        setSelected(null);
      })
      .catch((e) => {
        if (!cancelled)
          setNotice(
            e instanceof Error ? e.message : "Academy preparation unavailable",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [trainee, phase, reviewOnly]);
  const prepare = async () => {
    learningRequest.current++;
    const url = new URL(window.location.href);
    if (url.searchParams.has("learning")) {
      url.searchParams.delete("learning");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    learningRef.current = undefined;
    setLearning(undefined);
    setClockNote("");
    setPhase("ready");
    setBusy(true);
    setPrepared(null);
    try {
      const spec = await api<Scenario>("/director-v2/prepare", {
        seed,
        trainee,
        duration: 90,
      });
      setPrepared(spec);
      setScenario(spec);
      setState(new Simulation(spec).snapshot());
      setSelected(null);
      setNight(spec.night);
      setOnline(true);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Director unavailable.",
      );
    } finally {
      setBusy(false);
    }
  };
  const commands = useRef<AppliedCommand[]>([]);
  const liveState = useRef<Snapshot | null>(null);
  const livePaused = useRef(true);
  const controlQueue = useRef(Promise.resolve());
  const worker = useRef<Worker | null>(null);
  const workerScope = useRef("");
  const workerInitialized = useRef(false);
  const restorationPending = useRef(false);
  const scenarioRef = useRef(scenario);
  const traineeRef = useRef(trainee);
  const sessionRef = useRef("");
  const serverSessionRef = useRef(false);
  const events = useRef<Action[]>([]);
  const finishLock = useRef(false);
  const finishRef = useRef<(log: Action[]) => void>(() => {});
  const draftQueue = useRef(Promise.resolve());
  const flushControls = () => {
    if (!serverSessionRef.current || !liveState.current)
      return Promise.resolve();
    const s = liveState.current;
    const id = sessionRef.current;
    const payload = controlPayload(s, commands.current, livePaused.current);
    const task = controlQueue.current
      .catch(() => {})
      .then(async () => {
        await draftQueue.current;
        eventBatches.current = sealEvents(events.current, eventBatches.current);
        const batches = eventBatches.current;
        if (!finishLock.current) {
          const queuedLog = [...events.current],
            queuedSpec = scenarioRef.current,
            queuedTrainee = traineeRef.current,
            queuedCommands = [...commands.current];
          draftQueue.current = draftQueue.current.then(() =>
            saveDraft(
              id,
              queuedLog,
              queuedSpec,
              queuedTrainee,
              s.tick,
              true,
              queuedCommands,
              batches,
            ),
          );
          await draftQueue.current;
        }
        setSync("syncing");
        await api(`/sessions/${id}/control-state`, payload);
        await uploadBatches(id, batches, api);
        setSync("synced");
        setOnline(true);
      });
    controlQueue.current = task;
    return task;
  };
  useCommandTransport({
    enabled: !reviewOnly,
    phase,
    current: () => ({
      id: sessionRef.current,
      after: commands.current.at(-1)?.seq ?? 0,
      active:
        serverSessionRef.current &&
        !!sessionRef.current &&
        !finishLock.current &&
        workerInitialized.current,
    }),
    accept: (received, id) => {
      if (
        finishLock.current ||
        sessionRef.current !== id ||
        !workerInitialized.current
      )
        return;
      for (const command of received)
        worker.current?.postMessage({
          type: "control",
          command,
          scope: workerScope.current,
        });
    },
    heartbeat: flushControls,
    unavailable: () => {
      setOnline(false);
      setSync("queued");
    },
  });
  const visible = phase === "restoring" ? [] : reportedContacts(state);
  const contactItems = useContactMemory(
    state,
    scenario.id + ":" + (sessionRef.current ?? "ready"),
    selected,
  );
  const [reviewCallsigns, setReviewCallsigns] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    if (!reviewOnly || !current?.unit_id) return;
    let stopped = false;
    setReviewCallsigns({});
    void api<{ trainees: UnitIdentity[] }>(
      `/units/${encodeURIComponent(current.unit_id)}/trainees`,
    )
      .then(({ trainees }) => {
        if (!stopped)
          setReviewCallsigns(
            Object.fromEntries(trainees.map((t) => [t.trainee_id, t.callsign])),
          );
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [reviewOnly, current?.unit_id]);
  const traineeLabel = (id: string) =>
    unitIdentity?.trainee_id === id
      ? unitIdentity.callsign
      : (reviewCallsigns[id] ?? id);
  const target = visible.find((t) => t.id === selected);
  // The view annotation reads the same held camera observation as the 3D view
  // (`Scene`), so "TRACKING" and the drawn contact never disagree during the
  // short observation hold.
  const viewVisibility = useRef(new ObservationVisibility());
  const viewed =
    phase === "restoring" || !selected
      ? undefined
      : viewVisibility.current
          .tracks(state, vision, {
            key: `${scenario.id}:${sessionRef.current || "preview"}`,
          })
          .find((t) => t.id === selected);
  const opticalPosition = viewed
    ? { x: viewed.x, z: viewed.z, altitude: viewed.altitude }
    : null;
  const running = phase === "running";
  const refresh = useCallback(async () => {
    if (reviewOnly) return;
    const saved = await readRecords().catch(() => []);
    const local = unitIdentity
      ? saved.filter((r) => r.trainee === traineeRef.current)
      : saved;
    try {
      // A fresh local callsign is not registered until its first exercise.
      // The profile route safely reports zero sessions without a failing history GET.
      const known =
        unitIdentity ||
        (await api<TrainingProfile>(`/trainees/${traineeRef.current}/profile`))
          .sessions > 0;
      const remote = known
        ? await api<{ sessions: TrainingRecord[] }>(
            `/trainees/${traineeRef.current}/sessions`,
          )
        : { sessions: [] };
      const m = new Map(local.map((r) => [r.id, r]));
      for (const r of remote.sessions)
        m.set(r.id, mergeServerRecord(m.get(r.id), r));
      setRecords(
        [...m.values()].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
      );
      setOnline(true);
    } catch {
      setRecords(local);
      try {
        await api("/health");
        setOnline(true);
      } catch {
        setOnline(false);
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = setInterval(() => {
      api("/health")
        .then(() => setOnline(true))
        .catch(() => setOnline(false));
    }, 15000);
    return () => clearInterval(poll);
  }, [refresh]);
  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);
  useEffect(() => {
    traineeRef.current = trainee;
  }, [trainee]);
  useEffect(() => {
    let stopped = false;
    if (reviewOnly) return;
    void readDrafts()
      .then(async (ds) => {
        const draft = ownDraft(ds, trainee);
        if (draft) {
          try {
            const completed = await api<TrainingRecord>(
              `/sessions/${draft.id}/aar`,
              undefined,
              RECONSTRUCTION_TIMEOUT_MS,
            );
            if (completed.verified) {
              await saveRecord({
                ...completed,
                fusionExposures: draft.fusionExposures,
              });
              await removeLocal("drafts", draft.id);
              if (!stopped) setRecovery(null);
              return;
            }
          } catch {
            /* An active session or absent LAN server remains recoverable. */
          }
        }
        if (!stopped) setRecovery(draft);
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [trainee]);
  useEffect(() => {
    if (reviewOnly || !unitIdentity) return;
    let pending = false;
    const pulse = async () => {
      if (pending) return;
      pending = true;
      try {
        await api(`/trainees/${unitIdentity.trainee_id}/presence`, {
          client_id: clientId.current,
          session_id:
            phase === "running" || phase === "paused"
              ? sessionRef.current || null
              : null,
        });
        if (phase === "ready") {
          const r = await api<{ assignment: Assignment | null }>(
            `/trainees/${unitIdentity.trainee_id}/assignment`,
          );
          setAssignment(r.assignment);
        }
      } catch {
      } finally {
        pending = false;
      }
    };
    void pulse();
    const timer = setInterval(() => void pulse(), 1000);
    return () => clearInterval(timer);
  }, [unitIdentity, phase]);
  const complete = useCallback(
    async (log: Action[]) => {
      if (finishLock.current) return;
      finishLock.current = true;
      setBusy(true);
      setPhase("complete");
      setPrepared(null);
      const spec = scenarioRef.current;
      const sim = replay(spec, log, spec.duration * HZ, commands.current);
      const preview = score(sim);
      eventBatches.current = sealEvents(log, eventBatches.current);
      let record: TrainingRecord = {
        id: sessionRef.current || newId(),
        trainee: traineeRef.current,
        scenario: spec,
        events: log,
        eventBatches: eventBatches.current,
        commands: [...commands.current],
        executionTick: liveState.current?.tick ?? spec.duration * HZ,
        endTick: spec.duration * HZ,
        scorecard: preview,
        created_at: new Date().toISOString(),
        verified: false,
        fusionExposures: [...fusionRecords.current],
      };
      let stored = false,
        fusionPending = false,
        reviewPending = false;
      setState(sim.snapshot());
      setCurrent(record);
      setReplayTick(0);
      setView("aar");
      setNotice("Saving exercise…");
      try {
        await draftQueue.current;
        await saveRecord(record);
        stored = true;
        await removeLocal("drafts", record.id);
        setRecovery(null);
        if (serverSessionRef.current) {
          await flushControls();
          await uploadBatches(record.id, record.eventBatches ?? [log], api);
          const card = await api<ScoreCard>(
            `/sessions/${record.id}/complete`,
            { end_tick: record.endTick, execution_tick: record.executionTick },
            RECONSTRUCTION_TIMEOUT_MS,
          );
          record = { ...record, scorecard: card, verified: true };
          if (record.fusionExposures?.length) {
            try {
              await api(
                `/sessions/${record.id}/fusion-exposures`,
                { exposures: record.fusionExposures },
                RECONSTRUCTION_TIMEOUT_MS,
              );
            } catch {
              fusionPending = true;
            }
          }
          try {
            record = await completeReview(record);
          } catch {
            // The verified card remains valid even if detailed annotations need a later read.
            reviewPending = true;
          }
          await saveRecord(record);
          setOnline(true);
          setSync("synced");
        }
        setCurrent((selected) =>
          selected?.id === record.id ? record : selected,
        );
        setNotice(
          record.verified
            ? [
                "Session saved and independently scored by the local server.",
                fusionPending
                  ? "Fusion receipt synchronization is pending; retained on this device."
                  : "",
                reviewPending
                  ? "Detailed review and instructor notes await a server refresh; the score remains verified."
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            : "Session saved on this device. Server verification is pending.",
        );
      } catch (error) {
        setNotice(
          stored
            ? `Saved on this device. ${error instanceof Error ? error.message : "Server unavailable."} Retry from the debrief.`
            : "Browser storage failed. Export this session before closing the page.",
        );
        setOnline(false);
        setSync("queued");
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [refresh],
  );
  useEffect(() => {
    finishRef.current = complete;
  }, [complete]);
  useEffect(() => {
    if (reviewOnly) return;
    const w = new Worker(new URL("./sim.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    const visibility = () =>
      w.postMessage({ type: "visibility", hidden: document.hidden });
    document.addEventListener("visibilitychange", visibility);
    visibility();
    w.onmessage = (
      e: MessageEvent<{
        type: string;
        scope?: string;
        scenario_id?: string;
        initialized?: boolean;
        state?: Snapshot;
        action?: Action;
        request_id?: number;
        reason?: string;
        events?: Action[];
        commands?: AppliedCommand[];
        paused?: boolean;
        note?: string;
        status?: string;
      }>,
    ) => {
      const m = e.data;
      if (
        !workerScope.current ||
        m.scope !== workerScope.current ||
        m.scenario_id !== scenarioRef.current.id
      )
        return;
      if (
        !workerInitialized.current &&
        !(m.type === "snapshot" && m.initialized && m.state)
      )
        return;
      if (m.type === "clock-status")
        setClockNote(
          m.status === "visible"
            ? ""
            : (m.note ?? "Exercise timer status changed."),
        );
      if (m.type === "snapshot") diagnosticWorkerDelivery();
      if (m.type === "snapshot" && m.state) {
        if (m.initialized) {
          workerInitialized.current = true;
          if (restorationPending.current) {
            restorationPending.current = false;
            setNotice(
              `Saved exercise restored at ${time(m.state.tick)}. Decisions use the reconstructed evidence.`,
            );
          }
        }
        if (
          m.initialized ||
          (liveState.current && liveState.current.night !== m.state.night)
        )
          setVision(m.state.night ? "thermal" : "day");
        setState(m.state);
        liveState.current = m.state;
        livePaused.current = m.paused ?? m.state.paused;
        if (sessionRef.current && !finishLock.current)
          setPhase(livePaused.current ? "paused" : "running");
        if (
          sessionRef.current &&
          !finishLock.current &&
          m.state.tick % 60 === 0
        ) {
          const id = sessionRef.current,
            log = [...events.current],
            spec = scenarioRef.current,
            t = traineeRef.current,
            tick = m.state.tick,
            server = serverSessionRef.current,
            cs = [...commands.current],
            batches = eventBatches.current;
          draftQueue.current = draftQueue.current
            .then(() => saveDraft(id, log, spec, t, tick, server, cs, batches))
            .catch(() => {});
        }
      }
      const capturedEvidence =
        (m.type === "accepted" || m.type === "rejected") && m.action
          ? pendingActionEvidence.current.take(
              m.scope ?? "",
              m.request_id,
              m.action,
            )
          : undefined;
      // A worker reply must belong to one outstanding dispatch before it can
      // change feedback, the action stream, or presentation evidence. Unknown,
      // mismatched and duplicate receipts fail closed; a mismatched payload
      // leaves the real request pending for its correct acknowledgment.
      if (
        (m.type === "accepted" || m.type === "rejected") &&
        m.action &&
        !capturedEvidence
      )
        return;
      if ((m.type === "accepted" || m.type === "rejected") && m.action) {
        const done = m.action;
        setFeedback((f) =>
          f &&
          f.status === "submitted" &&
          f.seq === m.request_id &&
          f.action.k === done.k &&
          f.action.track === done.track
            ? {
                ...f,
                status: m.type === "accepted" ? "accepted" : "rejected",
                tick: done.tick,
                reason:
                  m.type === "rejected"
                    ? m.reason === "paused"
                      ? "The exercise paused before this decision was applied. Resume, check the contact and try again."
                      : m.reason === "ended"
                        ? "The exercise ended before this decision was applied. Review the saved decisions in the AAR."
                        : "The contact changed state before the action reached the exercise engine (for example it lost its observation or stopped being active). Check the contact and try again."
                    : undefined,
              }
            : f,
        );
      }
      if (m.type === "accepted" && m.action) {
        const advice = capturedEvidence?.advice;
        if (
          advice &&
          advice.evidence.track_id === m.action.track &&
          m.action.tick - advice.evidence.tick <= 90 &&
          m.action.tick >= advice.evidence.tick
        ) {
          const distribution =
            m.action.k === "classify" &&
            m.action.kind &&
            capturedEvidence?.confidence != null
              ? (Object.fromEntries(
                  ["bird", "quad", "fixed_wing", "fiber_fpv"].map((k) => [
                    k,
                    k === m.action!.kind
                      ? capturedEvidence!.confidence! / 100
                      : (1 - capturedEvidence!.confidence! / 100) / 3,
                  ]),
                ) as { [K in Kind]: number })
              : undefined;
          const receipt: FusionExposure = {
            tick: advice.evidence.tick,
            before_order: advice.context.before_order ?? 0,
            track: m.action.track,
            exposure_id: advice.exposure_id,
            action_order: m.action.order,
            association: "unspecified",
            ...(distribution ? { distribution } : {}),
          };
          const old = fusionRecords.current.findIndex(
            (e) => e.exposure_id === receipt.exposure_id,
          );
          if (old < 0) fusionRecords.current.push(receipt);
          else if (m.action.k === "classify")
            fusionRecords.current[old] = receipt;
        }
        events.current.push(m.action);
        const copy = [...events.current],
          spec = scenarioRef.current,
          id = sessionRef.current,
          t = traineeRef.current,
          cs = [...commands.current],
          batches = eventBatches.current;
        draftQueue.current = draftQueue.current
          .then(() =>
            saveDraft(
              id,
              copy,
              spec,
              t,
              m.action!.tick,
              serverSessionRef.current,
              cs,
              batches,
            ),
          )
          .catch(() =>
            setNotice(
              "Browser storage is unavailable. Export your debrief before closing.",
            ),
          );
      }
      if (m.type === "controlled" && m.commands) {
        commands.current = m.commands;
        const s = liveState.current;
        const id = sessionRef.current,
          log = [...events.current],
          spec = scenarioRef.current,
          t = traineeRef.current,
          cs = [...m.commands],
          batches = eventBatches.current;
        draftQueue.current = draftQueue.current
          .then(() =>
            saveDraft(
              id,
              log,
              spec,
              t,
              cs.at(-1)?.tick ?? s?.tick ?? 0,
              serverSessionRef.current,
              cs,
              batches,
            ),
          )
          .catch(() =>
            setNotice(
              "Command recovery storage failed. Export the debrief before closing.",
            ),
          );
      }
      if (m.type === "finalized" && m.commands) commands.current = m.commands;
      if (m.type === "finalized" && m.events) void finishRef.current(m.events);
    };
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      w.terminate();
    };
  }, []);
  useEffect(() => {
    if (!replayPlay || !current) return;
    const id = setInterval(() => {
      setReplayTick((t) => {
        const next = t + 3;
        if (next >= replayEnd) {
          setReplayPlay(false);
          return replayEnd;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [replayPlay, current, replayEnd]);
  useEffect(() => {
    setReviewId(null);
    setReplayOrder(undefined);
  }, [current?.id]);
  useEffect(() => {
    if (!current?.verified) return;
    let stopped = false;
    const id = current.id,
      local = current;
    void api<TrainingRecord>(
      `/sessions/${id}/aar`,
      undefined,
      RECONSTRUCTION_TIMEOUT_MS,
    )
      .then((record) => {
        if (stopped) return;
        setCurrent((c) => (c?.id === id ? mergeServerRecord(c, record) : c));
        void saveRecord(mergeServerRecord(local, record)).catch(() =>
          setNotice(
            "Review loaded but browser caching failed. Export before closing.",
          ),
        );
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [current?.id, current?.verified, reviewReload]);
  const focusReplay = () => {
    replayHeading.current?.focus({ preventScroll: true });
    replayHeading.current?.scrollIntoView({ behavior: "auto", block: "start" });
  };
  const seek = (
    tick: number,
    beforeOrder: number | undefined,
    track: string | null,
  ) => {
    setReplayPlay(false);
    setReplayTick(Math.min(tick, replayEnd));
    setReplayOrder(beforeOrder);
    if (track) setSelected(track);
  };
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 10000);
    return () => clearTimeout(timer);
  }, [notice]);
  const start = async () => {
    if (
      new URLSearchParams(window.location.search).has("learning") &&
      (!learningRef.current ||
        mode !== "adaptive" ||
        prepared?.id !== learningRef.current.scenario.id)
    ) {
      setNotice(
        "Wait for the Academy preparation, restore its original draft, or return to Academy for a new attempt.",
      );
      return;
    }
    if (mode === "adaptive" && !prepared) {
      await prepare();
      return;
    }
    setBusy(true);
    setReplayPlay(false);
    let spec = makeScenario(seed, "recognition", night);
    let id: string = newId();
    serverSessionRef.current = false;
    try {
      spec =
        mode === "library"
          ? await api<Scenario>(`/scenarios/${libraryId}`)
          : mode === "adaptive"
            ? prepared!
            : await api<Scenario>("/scenarios/generate", {
                seed,
                night,
                mode,
                trainee,
              });
      const launched = await launchPreparedScenario(
        spec,
        trainee,
        (body) => api("/sessions", body),
        learningRef.current?.preparation_id,
      );
      id = launched.sessionId;
      serverSessionRef.current = true;
      setOnline(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setOnline(true);
        setBusy(false);
        setNotice(`Exercise was not started: ${error.message}`);
        return;
      }
      setOnline(false);
      if (mode === "adaptive" || mode === "library") {
        setBusy(false);
        setNotice(
          "Advanced drills require the original local server. Prepare again when connected.",
        );
        return;
      }
      setNotice(
        "Local practice mode. The session will be saved on this device.",
      );
    }
    begin(spec, id);
  };
  const begin = (spec: Scenario, id: string) => {
    fusionRecords.current = [];
    latestAdvice.current = null;
    eventBatches.current = [];
    setSync("synced");
    setAssignment(null);
    scenarioRef.current = spec;
    traineeRef.current = trainee;
    sessionRef.current = id;
    pendingActionEvidence.current.clear();
    workerScope.current = newId();
    workerInitialized.current = false;
    restorationPending.current = false;
    events.current = [];
    commands.current = [];
    liveState.current = null;
    finishLock.current = false;
    setScenario(spec);
    setState(new Simulation(spec).snapshot());
    setSelected(null);
    setCurrent(null);
    setPhase("running");
    setView("drill");
    setVision(spec.night ? "thermal" : "day");
    worker.current?.postMessage({
      type: "init",
      scenario: spec,
      scope: workerScope.current,
    });
    worker.current?.postMessage({ type: "play", scope: workerScope.current });
    setBusy(false);
  };
  const startAssigned = async () => {
    learningRef.current = undefined;
    setLearning(undefined);
    if (!assignment || busy) return;
    setBusy(true);
    try {
      await saveDraft(
        assignment.session_id,
        [],
        assignment.scenario,
        trainee,
        0,
        true,
        [],
        [],
      );
      await api(`/assignments/${assignment.session_id}/accept`, {
        trainee_id: trainee,
      });
      serverSessionRef.current = true;
      setOnline(true);
      begin(assignment.scenario, assignment.session_id);
    } catch (error) {
      setBusy(false);
      setNotice(
        error instanceof Error ? error.message : "Assignment unavailable.",
      );
    }
  };
  const act = (data: Omit<Action, "tick">) => {
    if (!running || !workerInitialized.current) return;
    const requestId = ++feedbackSeq.current;
    pendingActionEvidence.current.capture(
      workerScope.current,
      requestId,
      data,
      vrOpen ? null : latestAdvice.current,
      vrOpen ? null : confidenceRef.current,
    );
    setFeedback({
      seq: requestId,
      action: data,
      status: "submitted",
    });
    worker.current?.postMessage({
      type: "action",
      scope: workerScope.current,
      request_id: requestId,
      action: { ...data, tick: state.tick },
    });
  };
  const suspendVR = useCallback(() => {
    if (
      !workerInitialized.current ||
      finishLock.current ||
      liveState.current?.done
    )
      return false;
    worker.current?.postMessage({ type: "pause", scope: workerScope.current });
    livePaused.current = true;
    setPhase((p) => (p === "running" ? "paused" : p));
    return true;
  }, []);
  useEffect(() => {
    if (view !== "drill" || phase === "complete" || phase === "restoring")
      setVROpen(false);
  }, [view, phase]);
  const togglePause = () => {
    if (!workerInitialized.current) return;
    if (state.paused && serverSessionRef.current) {
      void api(`/instructor/sessions/${sessionRef.current}/commands`, {
        command_id: newId(),
        type: "resume",
        payload: {},
      }).catch(() =>
        setNotice(
          "The instructor must sign in and resume this exercise from the officer console.",
        ),
      );
      return;
    }
    worker.current?.postMessage({
      type: running ? "pause" : "play",
      scope: workerScope.current,
    });
    setPhase(running ? "paused" : "running");
  };
  const focusDecision = () => {
    decisionDock.current?.focus({ preventScroll: true });
    decisionDock.current?.scrollIntoView({ behavior: "auto", block: "start" });
  };
  const choose = (id: string) => {
    setSelected(id);
  };
  // Convenience only: the nearest reported contact the trainee has not designated
  // (then any reported contact without a response). Never a recommendation.
  const nextContact = () => {
    const by = (t: Track) => Math.hypot(t.x, t.z);
    const others = visible
      .filter((t) => t.id !== selected)
      .sort((a, b) => by(a) - by(b));
    const next =
      others.find((t) => t.designated === null) ??
      others.find((t) => !t.attempts.length);
    if (next) choose(next.id);
  };
  const resumeDraft = () => {
    if (!recovery) return;
    const d = recovery;
    if (d.trainee !== trainee) return;
    learningRef.current = d.learning;
    setLearning(d.learning);
    eventBatches.current = d.eventBatches ?? [];
    scenarioRef.current = d.scenario;
    traineeRef.current = d.trainee;
    sessionRef.current = d.id;
    pendingActionEvidence.current.clear();
    workerScope.current = newId();
    workerInitialized.current = false;
    restorationPending.current = true;
    liveState.current = null;
    livePaused.current = true;
    serverSessionRef.current = d.server;
    events.current = [...d.events];
    commands.current = d.commands ?? [];
    fusionRecords.current = d.fusionExposures ?? [];
    latestAdvice.current = null;
    finishLock.current = false;
    setScenario(d.scenario);
    // Only replayed evidence may become actionable. A safe empty initial
    // snapshot clears prior contacts while the worker reconstructs this draft.
    setState(new Simulation(d.scenario).snapshot());
    setVision(d.scenario.night ? "thermal" : "day");
    setClockNote("");
    setTrainee(d.trainee);
    setNight(d.scenario.night);
    setSeed(d.scenario.seed);
    setSelected(null);
    setCurrent(null);
    setPhase("restoring");
    setView("drill");
    setRecovery(null);
    worker.current?.postMessage({
      type: "init",
      scope: workerScope.current,
      scenario: d.scenario,
      events: d.events,
      commands: d.commands ?? [],
      tick: d.tick,
    });
    worker.current?.postMessage({ type: "play", scope: workerScope.current });
    setNotice(
      `Restoring saved exercise at ${time(d.tick)}. Controls unlock after reconstruction.`,
    );
  };
  const retry = async (record: TrainingRecord) => {
    setBusy(true);
    try {
      const spec = record.scenario.doctrine
        ? await api<Scenario>(`/scenarios/${record.scenario.id}`)
        : record.scenario.director_decision
          ? record.scenario
          : await api<Scenario>("/scenarios/generate", {
              seed: record.scenario.seed,
              night: record.scenario.night,
              mode: "scripted",
              focus: record.scenario.focus,
              trainee: record.trainee,
            });
      if (spec.id !== record.scenario.id)
        throw new Error(
          "Scenario version differs; this record needs its original server.",
        );
      let id = record.id;
      try {
        const existing = await api<TrainingRecord>(
          `/sessions/${id}/aar`,
          undefined,
          RECONSTRUCTION_TIMEOUT_MS,
        );
        if (existing.verified) {
          let fusionPending = false;
          if (record.fusionExposures?.length) {
            try {
              await api(
                `/sessions/${id}/fusion-exposures`,
                { exposures: record.fusionExposures },
                RECONSTRUCTION_TIMEOUT_MS,
              );
            } catch {
              fusionPending = true;
            }
          }
          const retained = mergeServerRecord(record, existing);
          await saveRecord(retained);
          setCurrent((selected) =>
            selected?.id === record.id ? retained : selected,
          );
          setNotice(
            fusionPending
              ? "Score already verified. Fusion receipt synchronization is pending; retained on this device."
              : "Session already verified.",
          );
          setSync("synced");
          setOnline(true);
          await refresh();
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Session not found") {
          if (record.commands?.length)
            throw new Error(
              "Controlled sessions need their original server command log.",
            );
          id = (
            await api<{ id: string }>("/sessions", {
              scenario_id: spec.id,
              trainee: record.trainee,
            })
          ).id;
        }
      }
      if (record.commands?.length) {
        const restored = replay(
          record.scenario,
          record.events,
          record.executionTick ?? record.endTick,
          record.commands,
        ).snapshot();
        try {
          await api(
            `/sessions/${id}/control-state`,
            controlPayload(restored, record.commands, true),
          );
        } catch (error) {
          if (error instanceof Error && error.message === "Session not found")
            throw new Error(
              "Controlled sessions need their original server command log.",
            );
          throw error;
        }
      }
      try {
        await uploadBatches(id, record.eventBatches ?? [record.events], api);
      } catch (error) {
        if (error instanceof Error && error.message === "Session not found") {
          if (record.commands?.length)
            throw new Error(
              "Controlled sessions need their original server command log.",
            );
          id = (
            await api<{ id: string }>("/sessions", {
              scenario_id: spec.id,
              trainee: record.trainee,
            })
          ).id;
          await uploadBatches(id, record.eventBatches ?? [record.events], api);
        } else throw error;
      }
      const card = await api<ScoreCard>(
        `/sessions/${id}/complete`,
        { end_tick: record.endTick, execution_tick: record.executionTick },
        RECONSTRUCTION_TIMEOUT_MS,
      );
      if (record.fusionExposures?.length) {
        try {
          await api(
            `/sessions/${id}/fusion-exposures`,
            { exposures: record.fusionExposures },
            RECONSTRUCTION_TIMEOUT_MS,
          );
        } catch {
          /* Score remains verified; retained Fusion requests can retry separately. */
        }
      }
      let verified: TrainingRecord = {
        ...record,
        id,
        scenario: spec,
        verified: true,
        scorecard: card,
      };
      let reviewPending = false;
      try {
        verified = await completeReview(verified);
      } catch {
        reviewPending = true;
      }
      await saveRecord(verified);
      if (id !== record.id) await removeLocal("records", record.id);
      setCurrent((selected) =>
        selected?.id === record.id ? verified : selected,
      );
      setSync("synced");
      setOnline(true);
      setNotice(
        reviewPending
          ? "Server verification complete. Detailed review and instructor notes await a server refresh; the score remains verified."
          : "Server verification complete.",
      );
      await refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Verification failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (reviewOnly || !current || current.verified || busy) return;
    const timer = setInterval(() => void retry(current), 5000);
    return () => clearInterval(timer);
  }, [current?.id, current?.verified, busy]);
  const { routeSearch, navigateWorkspace, openReview } = useWorkspaceNavigation(
    {
      view,
      current,
      reviewOnly,
      setView,
      setCurrent,
      setReplayPlay,
      setReplayTick,
      setMode,
    },
  );
  useEffect(() => {
    let stopped = false;
    const id = new URLSearchParams(routeSearch).get("session");
    if (id)
      void Promise.all([
        api<TrainingRecord>(
          `/sessions/${id}/aar`,
          undefined,
          RECONSTRUCTION_TIMEOUT_MS,
        ),
        readRecords().catch(() => []),
      ])
        .then(([r, local]) => {
          if (!stopped) {
            setCurrent(
              mergeServerRecord(
                local.find((x) => x.id === id),
                r,
              ),
            );
            setView("aar");
            setOnline(true);
          }
        })
        .catch(() => {
          if (!stopped) setNotice("This session review is unavailable.");
        });
    return () => {
      stopped = true;
    };
  }, [routeSearch]);
  const nextDrill = () => {
    worker.current?.postMessage({ type: "pause", scope: workerScope.current });
    pendingActionEvidence.current.clear();
    workerScope.current = "";
    workerInitialized.current = false;
    restorationPending.current = false;
    liveState.current = null;
    setClockNote("");
    if (current && !unitIdentity) setTrainee(current.trainee);
    setSeed(nextTrainingSeed);
    setPrepared(null);
    setMode("adaptive");
    setPhase("ready");
    setCurrent(null);
    setSelected(null);
    setState(new Simulation(makeScenario(nextTrainingSeed(seed))).snapshot());
    setView("drill");
    setNotice(
      "Prepare the next drill to review the server Director decision before starting.",
    );
  };
  const [palette, setPalette] = useState<ThermalPalette>("white"),
    [opticalZoom, setOpticalZoom] = useState(1);
  // Reconstruction depends on immutable evidence and seek position, not camera/FPS/notice updates.
  const replayState =
    useMemo(
      () =>
        current
          ? replay(
              current.scenario,
              current.events,
              replayTick,
              current.commands ?? [],
              replayOrder,
            ).snapshot()
          : null,
      [current, replayTick, replayOrder],
    ) ?? state;
  return (
    <div className="app-shell">
      <Navigation
        view={reviewOnly ? undefined : view}
        reviewCount={records.length}
        onWorkspaceNavigate={reviewOnly ? undefined : navigateWorkspace}
        footer={
          <>
            <div className="exercise-pack">
              <Layers size={18} />
              <div>
                {scenario.doctrine?.name ?? "Army forward post"}
                <small>
                  {scenario.doctrine
                    ? `${scenario.doctrine.id}@${scenario.doctrine.version}`
                    : mode === "scripted"
                      ? "Legacy example pack · v0.1"
                      : "Finale · adaptive raid engine"}
                </small>
              </div>
            </div>
            <div className="user">
              <span className="avatar">
                {reviewOnly
                  ? "OF"
                  : (unitIdentity?.callsign ?? trainee).slice(-2)}
              </span>
              <div>
                {reviewOnly
                  ? "Officer review"
                  : (unitIdentity?.callsign ?? trainee)}
                <small>
                  {reviewOnly
                    ? "Completed evidence · read only"
                    : unitIdentity
                      ? "Unit training profile"
                      : "Local training profile"}
                </small>
              </div>
            </div>
          </>
        }
      />
      <main
        id="workspace-content"
        tabIndex={-1}
        className={view === "drill" ? "flight-shell" : undefined}
      >
        <header className="topbar">
          <div className="breadcrumb">
            WORKSPACE <ChevronRight size={13} />{" "}
            <span>
              {view === "drill"
                ? "TRAINING GROUND"
                : view === "aar"
                  ? "AFTER-ACTION REVIEW"
                  : "UNIT TRAINING OVERVIEW"}
            </span>
          </div>
          <div className={`connection ${online ? "online" : ""}`}>
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
            {online ? "VYUHA server connected" : "VYUHA server offline"}
          </div>
        </header>
        {view === "drill" ? (
          <div
            className="page drill-page immersive-training"
            data-phase={phase}
            data-tactical={tactical ? "true" : undefined}
          >
            <p className="sync-status" role="status">
              {syncMessage(
                online,
                sync,
                phase === "running" || phase === "paused",
              )}{" "}
              · Internet not required
            </p>
            <div className="page-heading deck-workspace-heading">
              <div>
                <div className="eyebrow">COUNTER-DRONE TRAINING</div>
                <h1>Training ground</h1>
                <p>
                  Read the sensors. Identify the contact. Choose your response.
                </p>
              </div>
              <div className="mission-context">
                <span className="mission-owner">
                  Callsign {unitIdentity?.callsign ?? trainee}
                </span>
                <span className="pill">
                  <Shield size={14} /> EXERCISE / {phase.toUpperCase()}
                </span>
              </div>
            </div>
            <TrainingDeck
              mission={
                <div className="mission-bar">
                  <span className="mission-phase" data-phase={phase}>
                    <span aria-hidden="true" className="mission-phase-dot" />
                    {phase === "running"
                      ? "Live"
                      : phase === "paused"
                        ? "Paused"
                        : phase === "restoring"
                          ? "Restoring"
                          : phase === "complete"
                            ? "Complete"
                            : mode === "adaptive" && !prepared
                              ? "Orientation"
                              : "Ready"}
                  </span>
                  <div className="mission-name">
                    <span className="mission-number">01</span>
                    <div>
                      <strong>
                        {phase === "ready" && mode === "adaptive" && !prepared
                          ? "Adaptive training"
                          : phase === "ready" && prepared
                            ? prepared.title
                            : scenario.title}
                      </strong>
                      <span>
                        {phase === "ready" && mode === "adaptive" && !prepared
                          ? "Orientation · daylight scenery · mission not prepared"
                          : `${scenario.terrain_id === "rural_forward_base" ? "Rural forward base" : "Urban outpost"} · ${(phase === "ready" ? night : state.night) ? "Night" : "Day"} · Mixed contacts`}
                      </span>
                    </div>
                  </div>
                  <div className="mission-facts">
                    <span className="mission-callsign">
                      <small>CALLSIGN</small>
                      {unitIdentity?.callsign ?? trainee}
                    </span>
                    <span>
                      <small>
                        {phase === "ready" && mode === "adaptive"
                          ? learning
                            ? "CURRICULUM SEED"
                            : "DIRECTOR SEED"
                          : "SCENARIO SEED"}
                      </small>
                      {phase === "ready" && mode !== "library"
                        ? (learning?.context.seed ?? seed)
                        : scenario.seed}
                    </span>
                    <span>
                      <small>EXERCISE TIME</small>
                      <b>
                        {phase === "ready" &&
                        mode === "adaptive" &&
                        !prepared ? (
                          "Awaiting mission"
                        ) : phase === "restoring" ? (
                          "Restoring…"
                        ) : (
                          <>
                            {time(state.tick)}{" "}
                            <i>/ {time(scenario.duration * HZ)}</i>
                          </>
                        )}
                      </b>
                    </span>
                    <span>
                      <small>RENDER</small>
                      {tactical
                        ? "2D tactical"
                        : fps
                          ? `${fps} fps`
                          : "3D ready"}
                    </span>
                  </div>
                  {phase === "restoring" ? (
                    <p role="status">
                      Restoring saved exercise… Controls are unavailable until
                      the saved evidence is ready.
                    </p>
                  ) : phase === "running" || phase === "paused" ? (
                    <div className="mission-actions">
                      <button
                        className="button subtle"
                        disabled={!workerInitialized.current}
                        onClick={togglePause}
                      >
                        {running ? <Pause size={15} /> : <Play size={15} />}{" "}
                        {running ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="button subtle danger"
                        disabled={busy}
                        title={
                          busy
                            ? "A request or completion is already in progress."
                            : undefined
                        }
                        onClick={() => {
                          setBusy(true);
                          worker.current?.postMessage({
                            type: "finish",
                            scope: workerScope.current,
                          });
                        }}
                      >
                        End exercise
                      </button>
                    </div>
                  ) : phase === "complete" ? (
                    <button
                      className="button primary"
                      disabled={busy}
                      title={
                        busy
                          ? "A request or completion is already in progress."
                          : undefined
                      }
                      onClick={() => void start()}
                    >
                      <Play size={15} />
                      {busy
                        ? "Preparing…"
                        : mode === "adaptive"
                          ? prepared
                            ? "Start adaptive drill"
                            : "Prepare adaptive drill"
                          : phase === "complete"
                            ? "Repeat exercise"
                            : "Begin exercise"}
                    </button>
                  ) : (
                    <span className="mission-ready-hint">
                      Prepare and start in the exercise preview below
                    </span>
                  )}
                </div>
              }
              setup={
                <>
                  <div className="training-config">
                    {phase === "ready" && (
                      <DrillSetup
                        mode={mode}
                        onMode={setMode}
                        night={night}
                        onNight={setNight}
                        seed={learning?.context.seed ?? seed}
                        frozenLearning={!!learning}
                        onSeed={setSeed}
                        trainee={trainee}
                        onTrainee={setTrainee}
                        identity={unitIdentity}
                        profile={trainingProfile}
                        prepared={prepared}
                        onStart={() => void start()}
                        busy={busy}
                        library={library}
                        libraryId={libraryId}
                        onLibrary={setLibraryId}
                      />
                    )}
                    {scenario.red_force && (
                      <p className="footnote">
                        Threat pattern:{" "}
                        {scenario.red_force.tactic.replaceAll("_", " ")} ·{" "}
                        {scenario.doctrine?.name}@{scenario.doctrine?.version} ·
                        Illustrative training configuration
                      </p>
                    )}
                  </div>
                  <a href="/vr-guide.html" target="_blank" rel="noreferrer">
                    Experimental VR / setup guide
                  </a>
                </>
              }
              tools={
                <div className="vr-launch">
                  <button
                    aria-label="Open VR observation cockpit"
                    className="button subtle"
                    disabled={
                      busy ||
                      phase === "restoring" ||
                      phase === "complete" ||
                      (mode === "adaptive" && phase === "ready" && !prepared)
                    }
                    onClick={() => {
                      fusionExposure(null);
                      setVROpen(true);
                    }}
                  >
                    Open VR observation cockpit
                  </button>
                  <a href="/vr-guide.html" target="_blank" rel="noreferrer">
                    Experimental VR / setup guide
                  </a>
                </div>
              }
              live={running}
              onSuspend={suspendVR}
            >
              {phase === "ready" &&
                assignment &&
                recovery?.id !== assignment.session_id && (
                  <section className="panel assignment-banner">
                    <h2>Assigned group exercise</h2>
                    <p>
                      {assignment.scenario.title} · Seed{" "}
                      {assignment.scenario.seed} · Independent session
                    </p>
                    <p className="mono">{assignment.exercise_group_id}</p>
                    <button
                      className="button primary"
                      disabled={busy}
                      title={
                        busy
                          ? "A request or completion is already in progress."
                          : undefined
                      }
                      onClick={() => void startAssigned()}
                    >
                      Start assigned exercise
                    </button>
                  </section>
                )}
              {phase === "ready" && recovery && (
                <div className="recovery-banner">
                  <span>
                    Unfinished exercise · {traineeLabel(recovery.trainee)} ·{" "}
                    {time(recovery.tick)}
                  </span>
                  <button className="button subtle" onClick={resumeDraft}>
                    Resume saved drill
                  </button>
                </div>
              )}
              {vrOpen ? (
                <Suspense
                  fallback={<p role="status">Loading local VR cockpit…</p>}
                >
                  <VRCockpit
                    state={
                      phase === "ready" || phase === "restoring"
                        ? briefingSnapshot(state)
                        : state
                    }
                    scenario={scenario}
                    phase={phase}
                    selected={selected}
                    sessionKey={`${scenario.id}:${sessionRef.current || "preview"}`}
                    feedback={feedback}
                    quality={quality}
                    vision={vision}
                    busy={busy}
                    startLabel="Start exercise"
                    onStart={() => void start()}
                    onPause={togglePause}
                    onSuspend={suspendVR}
                    onSelect={choose}
                    onVision={setVision}
                    onAction={act}
                    onClose={() => {
                      suspendVR();
                      setVROpen(false);
                    }}
                  />
                </Suspense>
              ) : (
                <div className="training-grid">
                  <section className="sensor-workspace">
                    <div className="panel-header">
                      <div>
                        <Monitor size={16} />
                        <strong>EO / IR observation</strong>
                      </div>
                      <details className="evidence-disclosure observation-preferences">
                        <summary>Observation preferences</summary>
                        <div className="observation-popover">
                          <div className="setup-bar">
                            <label>
                              Graphics quality
                              <select
                                aria-label="Graphics quality"
                                value={autoQuality ? "auto" : quality}
                                onChange={(e) => {
                                  setAutoQuality(e.target.value === "auto");
                                  if (e.target.value === "auto") {
                                    setQuality("medium");
                                    setTactical(false);
                                  } else {
                                    setQuality(e.target.value as Quality);
                                    setTactical(e.target.value === "tactical");
                                  }
                                }}
                              >
                                <option value="auto">
                                  Auto · current {quality}
                                </option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                                <option value="tactical">Tactical 2D</option>
                              </select>
                            </label>
                            <small>
                              Graphics settings change rendering only;
                              simulation stays at 30 Hz.
                            </small>
                            <LocalAudio
                              state={state}
                              fog={scenario.fog}
                              active={phase === "running"}
                            />
                          </div>
                          <div className="setup-bar">
                            {vision === "thermal" && (
                              <label>
                                Illustrative thermal palette
                                <select
                                  aria-label="Thermal palette"
                                  value={palette}
                                  onChange={(e) =>
                                    setPalette(e.target.value as ThermalPalette)
                                  }
                                >
                                  {Object.entries(palettes).map(([id, p]) => (
                                    <option key={id} value={id}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <small>
                              Illustrative rendering only; sensor mechanics and
                              scoring are unchanged.
                            </small>
                          </div>
                        </div>
                      </details>
                      <div className="segmented">
                        {(["thermal", "day", "night"] as const).map((v) => (
                          <button
                            key={v}
                            aria-pressed={vision === v}
                            className={vision === v ? "selected" : ""}
                            onClick={() => setVision(v)}
                          >
                            {v === "thermal"
                              ? "THERMAL"
                              : v === "day"
                                ? "DAY TV"
                                : scenario.version === 2
                                  ? "IR NIGHT DISPLAY"
                                  : "NIGHT VISION"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <OpticalStation
                      scopeId={`${scenario.id}:${sessionRef.current ?? "preview"}:${trainee}:${workerScope.current}`}
                      enabled={phase === "running" || phase === "paused"}
                      tactical={tactical}
                      selected={selected}
                      observation={target?.observation}
                      cue={
                        opticalPosition ??
                        (target
                          ? {
                              x: target.x,
                              z: target.z,
                              altitude: target.altitude,
                            }
                          : null)
                      }
                      origin={
                        scenario.engine_version === "vyuha-0.4.0" ||
                        scenario.version === 2
                          ? { x: 0, z: 0, altitude: 2 }
                          : { x: 0, z: 4, altitude: 14 }
                      }
                      tick={state.tick}
                      vision={vision}
                      zoom={opticalZoom}
                      onZoom={setOpticalZoom}
                    >
                      {({ manualAim, onCameraAim }) => (
                        <div
                          className={`scene-container ${vision} ${tactical ? "tactical-mode" : ""}`}
                        >
                          {phase === "restoring" ? (
                            <div className="render-fallback" role="status">
                              <p>Reconstructing the saved sensor evidence…</p>
                            </div>
                          ) : tactical ? (
                            <Radar
                              state={
                                phase === "ready"
                                  ? briefingSnapshot(state)
                                  : state
                              }
                              selected={selected}
                              onSelect={choose}
                              large
                            />
                          ) : (
                            <Scene
                              presentation={
                                phase === "ready" ? "briefing" : "observation"
                              }
                              opticalZoom={opticalZoom}
                              manualAim={manualAim}
                              onCameraAim={onCameraAim}
                              cue={
                                target
                                  ? {
                                      x: target.x,
                                      z: target.z,
                                      altitude: target.altitude,
                                    }
                                  : null
                              }
                              sensorConfig={scenario.sensor_config}
                              terrainBoxes={scenario.terrain_boxes}
                              engineVersion={scenario.engine_version}
                              visibilityKey={`${scenario.id}:${sessionRef.current || "preview"}`}
                              state={
                                phase === "ready" &&
                                mode === "adaptive" &&
                                !prepared
                                  ? { ...state, night: false }
                                  : state
                              }
                              selected={selected}
                              vision={phase === "ready" ? "day" : vision}
                              onFps={renderFps}
                              palette={palette}
                              terrain={scenario.terrain_id ?? "urban_outpost"}
                              quality={quality}
                              fog={scenario.fog}
                              fallback={
                                <div className="render-fallback">
                                  <p>
                                    3D rendering is unavailable on this browser.
                                  </p>
                                  <button
                                    className="button primary"
                                    onClick={() => setTactical(true)}
                                  >
                                    Use tactical view
                                  </button>
                                </div>
                              }
                            />
                          )}
                          {!tactical &&
                            phase !== "restoring" &&
                            phase !== "ready" && (
                              <>
                                <div className="view-annotation top-left">
                                  {vision === "thermal"
                                    ? `${palettes[palette].label} / EO-IR`
                                    : vision === "day"
                                      ? "DAY TV / OPTICAL"
                                      : scenario.version === 2
                                        ? "IR NIGHT DISPLAY / ILLUSTRATIVE"
                                        : "NIGHT VISION / SIMULATED"}
                                  <span>
                                    {manualAim
                                      ? "MANUAL SCAN · SELECTION DOES NOT STEER CAMERA"
                                      : !selected
                                        ? "OBSERVATION SECTOR"
                                        : opticalPosition
                                          ? `TRACKING ${selected}`
                                          : target
                                            ? `${selected} · CUED BY ${target.observation?.radar.position ? "RADAR" : "SENSOR REPORT"} · NOT SEEN BY THIS CAMERA`
                                            : `${selected} · NO CURRENT REPORT · HOLDING BEARING`}
                                  </span>
                                </div>
                                {vision === "day" &&
                                  state.tracks.some(
                                    (t) =>
                                      t.active &&
                                      t.observation?.eo.available === false,
                                  ) && (
                                    <div
                                      className="view-annotation view-unavailable"
                                      role="note"
                                    >
                                      DAY TV HAS NO PICTURE
                                      <span>
                                        Night or sensor fault · use THERMAL or
                                        IR
                                      </span>
                                    </div>
                                  )}
                                <div className="crosshair">
                                  <span />
                                  <span />
                                </div>
                                <div className="camera-corners" />
                                <div className="view-annotation bottom-left">
                                  {scenario.terrain_id === "rural_forward_base"
                                    ? "RURAL FORWARD BASE"
                                    : "URBAN OUTPOST"}
                                  <span>
                                    {manualAim
                                      ? `AZ ${manualAim.azimuthDeg.toFixed(1)}° · EL ${manualAim.elevationDeg.toFixed(1)}° · FIXED SENSOR ORIGIN`
                                      : selected && (opticalPosition ?? target)
                                        ? `${opticalPosition ? "" : "CUE "}BEARING ${Math.round(((Math.atan2((opticalPosition ?? target)!.x, (opticalPosition ?? target)!.z) * 180) / Math.PI + 360) % 360)}° · ALT ${Math.round((opticalPosition ?? target)!.altitude)} m`
                                        : selected
                                          ? "Holding last bearing"
                                          : "Select a radar contact to focus the camera"}
                                  </span>
                                </div>
                                <div className="view-annotation bottom-right">
                                  {state.night ? "NIGHT" : "DAY"}
                                  <span>SIMULATED SENSOR VIEW</span>
                                </div>
                              </>
                            )}
                          {phase === "ready" && (
                            <TrainingWelcome
                              onPrepare={() => void start()}
                              busy={busy}
                              prepared={mode !== "adaptive" || !!prepared}
                              title={
                                mode === "adaptive" && !prepared
                                  ? "Enter the observation station."
                                  : (prepared?.title ?? scenario.title)
                              }
                              label={
                                mode === "adaptive"
                                  ? prepared
                                    ? "Start adaptive drill"
                                    : "Prepare adaptive drill"
                                  : "Begin exercise"
                              }
                              duration={scenario.duration}
                              contacts={
                                mode === "adaptive"
                                  ? prepared?.tracks.length
                                  : mode === "library"
                                    ? library.find((s) => s.id === libraryId)
                                        ?.tracks.length
                                    : 8
                              }
                            />
                          )}
                          {phase === "paused" && (
                            <div className="pause-overlay">
                              <Pause size={24} />
                              <h2>Exercise paused</h2>
                              <p>Use Resume in the exercise controls above.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </OpticalStation>
                    <section className="panel radar-panel">
                      <div className="panel-header">
                        <div>
                          <Radio size={16} />
                          <strong>Radar picture</strong>
                        </div>
                        <span
                          className={state.jammed ? "status amber" : "status"}
                        >
                          {phase === "restoring"
                            ? "RESTORING"
                            : state.radarStatus === "failed"
                              ? "OFFLINE"
                              : state.jammed
                                ? "DEGRADED"
                                : "NORMAL"}
                        </span>
                      </div>
                      {phase === "restoring" ? (
                        <p role="status">
                          Radar reports will appear after reconstruction.
                        </p>
                      ) : (
                        <Radar
                          state={state}
                          selected={selected}
                          onSelect={choose}
                        />
                      )}
                    </section>
                    <div className="scene-toolbar">
                      {phase !== "restoring" && <SensorBadges state={state} />}
                      <div>
                        {scenario.fog === 0
                          ? "Clear"
                          : scenario.fog >= 0.5
                            ? "Dense fog"
                            : "Light fog"}{" "}
                        · {scenario.fog}
                      </div>
                      <button
                        className="text-button"
                        aria-pressed={tactical}
                        onClick={() => setTactical(!tactical)}
                      >
                        <Layers size={14} />
                        {tactical ? "Use 3D view" : "2D fallback"}
                      </button>
                    </div>
                  </section>
                  <aside className="right-panels">
                    <section className="panel contacts-panel">
                      <div className="panel-header">
                        <div>
                          <Target size={16} />
                          <strong>Contact tracks</strong>
                        </div>
                        <span className="count-badge">
                          {phase === "restoring" ? 0 : contactItems.length}
                        </span>
                      </div>
                      {selected && (
                        <button
                          className="button subtle decision-jump"
                          onClick={focusDecision}
                        >
                          {selected} · Evidence and decisions{" "}
                          <ChevronRight size={14} />
                        </button>
                      )}
                      <p className="footnote">
                        Dashed rows retain a last report, not a current
                        detection. Decisions require current evidence.
                      </p>
                      <div className="contact-list">
                        {phase !== "restoring" && contactItems.length ? (
                          contactItems.map(
                            ({ track: t, available, lastTick }) => (
                              <button
                                key={t.id}
                                className={`contact-item ${selected === t.id ? "selected" : ""} ${available ? "" : "stale"}`}
                                aria-pressed={selected === t.id}
                                onPointerDown={() => choose(t.id)}
                                onClick={() => {
                                  choose(t.id);
                                  if (
                                    window.matchMedia("(max-width: 800px)")
                                      .matches
                                  ) {
                                    focusDecision();
                                  }
                                }}
                              >
                                <span
                                  className={`track-symbol ${t.declared || ""}`}
                                >
                                  <Crosshair size={16} />
                                </span>
                                <div>
                                  <strong>
                                    {t.id}{" "}
                                    <span>
                                      {t.classification
                                        ? KIND_LABEL[t.classification]
                                        : "Unknown contact"}
                                    </span>
                                  </strong>
                                  <small>
                                    {available ? "" : "Last reported "}
                                    {Math.round(Math.hypot(t.x, t.z))} m ·{" "}
                                    {!available
                                      ? `No current observation · T+${(lastTick / 30).toFixed(1)}s`
                                      : t.designated === null
                                        ? "Not designated"
                                        : t.declared || "Awaiting ID"}
                                  </small>
                                </div>
                                <ChevronRight size={15} />
                              </button>
                            ),
                          )
                        ) : (
                          <p className="empty-small">
                            No active contacts.
                            <br />
                            New contacts appear when a sensor detects them.
                          </p>
                        )}
                      </div>
                    </section>
                  </aside>
                  {phase !== "restoring" && (
                    <>
                      {learning && <LearningBanner preparation={learning} />}
                      <DecisionWorkspace
                        ref={decisionDock}
                        evidence={
                          <>
                            {" "}
                            <section className="panel rf-panel">
                              <div className="panel-header">
                                <div>
                                  <Zap size={16} />
                                  <strong>RF / IFF evidence</strong>
                                </div>
                              </div>
                              <div className="evidence-grid">
                                <span>
                                  CONTROL LINK
                                  <strong
                                    className={
                                      rfObservation?.rf_signal ? "lime" : ""
                                    }
                                  >
                                    {!state.rfAvailable
                                      ? "OFFLINE"
                                      : target
                                        ? rfObservation?.rf_signal
                                          ? "Detected"
                                          : "Not detected"
                                        : "—"}
                                  </strong>
                                </span>
                                <span>
                                  IFF RESPONSE
                                  <strong
                                    className={
                                      rfObservation?.iff === "friendly_reply"
                                        ? "blue"
                                        : ""
                                    }
                                  >
                                    {!state.rfAvailable
                                      ? "OFFLINE"
                                      : target
                                        ? rfObservation?.iff ===
                                          "friendly_reply"
                                          ? "Friendly reply"
                                          : rfObservation?.iff ===
                                              "registered_civil"
                                            ? "Registered civil"
                                            : "No reply"
                                        : "—"}
                                  </strong>
                                </span>
                              </div>
                              <p>
                                {!selected
                                  ? "Select a contact to inspect its current RF and IFF evidence."
                                  : !target
                                    ? "No current observation. Selection is retained; wait for reacquisition."
                                    : target && inCivilZone(target)
                                      ? "Restricted zone: kinetic engagement is blocked here."
                                      : !state.rfAvailable
                                        ? "RF sensor unavailable. Use EO/IR cues; link and IFF evidence are unavailable."
                                        : target &&
                                            rfObservation?.rf_signal === false
                                          ? "No detected RF link. Review the contact before selecting an effector."
                                          : "Sensor cues support classification; they do not replace your decision."}
                              </p>
                            </section>
                            {(phase === "running" || phase === "paused") &&
                              scenario.fusion && (
                                <>
                                  <FusionPanel
                                    observation={target?.observation}
                                    prior={{
                                      kind: target?.classification,
                                      identity: target?.declared,
                                    }}
                                    config={scenario.fusion}
                                    context={{
                                      session_id: sessionRef.current || "local",
                                      scenario_id: scenario.id,
                                      before_order:
                                        Math.max(
                                          -1,
                                          ...events.current.map(
                                            (a) => a.order ?? -1,
                                          ),
                                          ...commands.current.map(
                                            (c) => c.order,
                                          ),
                                        ) + 1,
                                    }}
                                    onExposure={fusionExposure}
                                  />
                                  {scenario.fusion.mode === "training" && (
                                    <details className="panel evidence-disclosure confidence-options">
                                      <summary>
                                        Optional classification confidence
                                      </summary>
                                      <label>
                                        <input
                                          type="checkbox"
                                          checked={logConfidence}
                                          onChange={(e) =>
                                            setLogConfidence(e.target.checked)
                                          }
                                        />
                                        Optional confidence · classification
                                      </label>
                                      {logConfidence && (
                                        <label>
                                          Confidence in selected type (%)
                                          <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={confidence}
                                            onChange={(e) =>
                                              setConfidence(
                                                Math.max(
                                                  0,
                                                  Math.min(
                                                    100,
                                                    Number(e.target.value) || 0,
                                                  ),
                                                ),
                                              )
                                            }
                                          />
                                        </label>
                                      )}
                                      <p className="footnote">
                                        Your selected type receives this
                                        probability; the remainder is divided
                                        equally among the other three types. A
                                        post-exercise Brier diagnostic does not
                                        change the score or mastery profile.
                                      </p>
                                    </details>
                                  )}
                                </>
                              )}
                            {state.response && (
                              <details className="panel evidence-disclosure response-resources">
                                <summary>
                                  Response resources ·{" "}
                                  {state.response.kinetic_ammo_remaining} rounds
                                  · {state.response.jammer_channels_in_use}/
                                  {scenario.response_model?.jammer_channels}{" "}
                                  jammer channels
                                </summary>
                                <p>
                                  Kinetic:{" "}
                                  {state.response.kinetic_ammo_remaining} rounds
                                  · ready{" "}
                                  {state.tick >=
                                  state.response.kinetic_ready_tick
                                    ? "now"
                                    : `at ${time(state.response.kinetic_ready_tick)}`}
                                </p>
                                <p>
                                  Jammer channels:{" "}
                                  {state.response.jammer_channels_in_use}/
                                  {scenario.response_model?.jammer_channels} in
                                  use
                                </p>
                                {state.response.attempts.slice(-3).map((a) => (
                                  <p key={a.id}>
                                    {a.track} · {a.effector} ·{" "}
                                    {a.status.replaceAll("_", " ")}
                                    {a.status === "pending" &&
                                    a.due_tick !== null
                                      ? ` · due ${time(a.due_tick)}`
                                      : ""}
                                  </p>
                                ))}
                                <p className="footnote">
                                  Illustrative resources and seeded effects. A
                                  response can be accepted but fail to resolve a
                                  contact.
                                </p>
                              </details>
                            )}
                          </>
                        }
                      >
                        <GuidedDecision
                          phase={phase}
                          selected={selected}
                          target={target}
                          record={decisionRecord(
                            state.tracks.find((t) => t.id === selected),
                          )}
                          state={state}
                          scenario={scenario}
                          vision={vision}
                          rf={rfObservation}
                          feedback={feedback}
                          guidance={
                            learning
                              ? learning.context.assistance === "full"
                              : guidance
                          }
                          guidanceLocked={!!learning}
                          onGuidance={setGuidance}
                          onAct={act}
                          onNext={nextContact}
                        />
                      </DecisionWorkspace>
                    </>
                  )}
                </div>
              )}
            </TrainingDeck>
            {clockNote && (
              <p className="recovery-banner" role="status">
                {clockNote}
              </p>
            )}
            <section className="event-strip">
              <span className="event-strip-label">
                <Activity size={15} /> EXERCISE LOG
              </span>
              {state.messages.length ? (
                state.messages
                  .slice(-2)
                  .reverse()
                  .map((m, i) => (
                    <span key={`${m.tick}-${i}`} className="log-message">
                      <b>{time(m.tick)}</b> {m.track} · {m.text}
                    </span>
                  ))
              ) : (
                <span className="log-message dim">
                  Your decisions and sensor events will appear here.
                </span>
              )}
            </section>
            <p className="footnote">
              Training prototype · Illustrative signatures, ranges and responses
              · Detection timing begins at first working-sensor observation.{" "}
              {offline === "ready"
                ? "Offline cache ready."
                : offline === "development"
                  ? "Development preview."
                  : offline === "preparing"
                    ? "Preparing offline cache…"
                    : offline === "unsupported"
                      ? "LAN HTTP: assets are served by this officer laptop. Cached reload requires trusted HTTPS."
                      : "Offline cache unavailable in this browser."}
            </p>
          </div>
        ) : view === "aar" ? (
          <div className="page reconstruction-page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">LEARN FROM EVERY DECISION</div>
                <h1>After-action review</h1>
                <p>
                  A replay of your exercise, with a traceable score and
                  reference response.
                </p>
              </div>
              {current && (
                <button
                  className="button subtle"
                  onClick={() => download(`vyuha-${current.id}.json`, current)}
                >
                  <ArrowDownToLine size={16} /> Export session
                </button>
              )}
            </div>
            {!current ? (
              <div className="empty-state">
                <Activity size={40} />
                <h2>
                  {reviewOnly
                    ? "Completed session review"
                    : records.length
                      ? "Choose an exercise to review"
                      : "Your first debrief starts here"}
                </h2>
                <p>
                  {reviewOnly
                    ? "Return to the unit overview to choose a completed session if this review is unavailable."
                    : "Complete a drill to review detection timing, classification, and responses."}
                </p>
                {records.length ? (
                  <AARHistory
                    records={records}
                    traineeLabel={traineeLabel}
                    onOpen={openReview}
                  />
                ) : reviewOnly ? (
                  <a className="button primary" href="/unit">
                    Return to unit overview
                  </a>
                ) : (
                  <button
                    className="button primary"
                    onClick={() => setView("drill")}
                  >
                    Open training ground
                  </button>
                )}
              </div>
            ) : (
              <>
                {!reviewOnly && records.length > 0 && (
                  <details className="evidence-disclosure review-history">
                    <summary>
                      Exercise history · {records.length} saved{" "}
                      {records.length === 1 ? "exercise" : "exercises"}
                    </summary>
                    <AARHistory
                      records={records}
                      selectedId={current.id}
                      traineeLabel={traineeLabel}
                      onOpen={openReview}
                    />
                  </details>
                )}
                <div className="aar-summary" id="review-verdict">
                  <div
                    className={`score-circle ${current.scorecard.passed ? "passed" : ""}`}
                    style={
                      {
                        "--score": current.scorecard.score,
                      } as React.CSSProperties
                    }
                  >
                    <strong>{current.scorecard.score}</strong>
                    <span>/ 100</span>
                  </div>
                  <div>
                    <span
                      className={`status ${current.scorecard.passed ? "" : "amber"}`}
                    >
                      {current.scorecard.passed
                        ? "STANDARD MET"
                        : "REVIEW REQUIRED"}
                    </span>
                    <h2>{current.scorecard.summary}</h2>
                    <p>
                      {traineeLabel(current.trainee)} · {current.scenario.title}{" "}
                      · Seed {current.scenario.seed}
                    </p>
                    <span className="verification">
                      {current.verified ? (
                        <>
                          <Shield size={14} /> Server verified
                        </>
                      ) : (
                        <>
                          <WifiOff size={14} /> Device score · verification
                          pending{" "}
                          {!reviewOnly && (
                            <button
                              disabled={busy}
                              title={
                                busy
                                  ? "A request or completion is already in progress."
                                  : undefined
                              }
                              onClick={() => void retry(current)}
                            >
                              Retry verification
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                  {!reviewOnly && (
                    <button
                      className="button primary next-drill"
                      onClick={nextDrill}
                    >
                      <RotateCcw size={16} /> Next drill
                    </button>
                  )}
                </div>
                <div className="metric-grid">
                  <Metric
                    label="Recognition"
                    value={`${current.scorecard.skills.recognition}%`}
                    note="Correct type and identity"
                  />
                  <Metric
                    label="Response selection"
                    value={`${current.scorecard.skills.response}%`}
                    note="Reference response, fewer errors"
                  />
                  <Metric
                    label="Asset impacts"
                    value={String(current.scorecard.leakers)}
                    note={`${current.scorecard.threats} hostile threats in exercise`}
                  />
                  <Metric
                    label="Safety flags"
                    value={String(
                      current.scorecard.roe_breaches +
                        (current.scorecard.fratricide ? 1 : 0),
                    )}
                    note={
                      current.scorecard.fratricide
                        ? "Non-hostile engagement"
                        : "Restricted-zone attempts"
                    }
                  />
                </div>
                <ReviewSections
                  sections={[
                    { id: "review-verdict", label: "Verdict" },
                    { id: "review-replay", label: "Replay & decisions" },
                    { id: "review-timeline", label: "Timeline" },
                    { id: "review-path", label: "Decision path" },
                    { id: "review-comparison", label: "Comparison" },
                    { id: "review-score", label: "Score breakdown" },
                  ]}
                />
                <ReviewTheatre
                  key={`theatre:${current.id}`}
                  record={current}
                  snapshot={replayState}
                  tick={replayTick}
                  endTick={replayEnd}
                  beforeOrder={replayOrder}
                  selected={selected}
                  decisionId={reviewId}
                  playing={replayPlay}
                  quality={quality}
                  headingRef={replayHeading}
                  onSelect={setSelected}
                  onSeek={seek}
                  onPlay={() => {
                    if (replayTick >= replayEnd) setReplayTick(0);
                    setReplayOrder(undefined);
                    setReplayPlay(!replayPlay);
                  }}
                  onDecision={(r) => {
                    setReviewId(r.decision_id);
                    seek(
                      r.tick,
                      r.trainee_action ? (r.order ?? undefined) : undefined,
                      r.track_id,
                    );
                  }}
                  inspector={
                    <GhostPanel
                      officerReview={reviewOnly}
                      viewerTrainee={trainee}
                      record={current}
                      onJump={focusReplay}
                      onReload={() => setReviewReload((n) => n + 1)}
                      selectedId={reviewId}
                      onChoose={(r, evidenceMoment) => {
                        setReviewId(r.decision_id);
                        seek(
                          evidenceMoment?.tick ?? r.tick,
                          evidenceMoment
                            ? evidenceMoment.beforeOrder
                            : r.trainee_action
                              ? (r.order ?? undefined)
                              : undefined,
                          r.track_id,
                        );
                      }}
                    />
                  }
                />
                <div id="review-timeline" className="review-anchor">
                  <GhostTimeline
                    record={current}
                    onJump={(e) => {
                      if (e.decision_id) setReviewId(e.decision_id);
                      const point = timelineSeek(e);
                      seek(point.tick, point.beforeOrder, e.track_id);
                      focusReplay();
                    }}
                  />
                </div>
                <div id="review-path" className="review-anchor">
                  <AdvancedAAR
                    key={`advanced:${current.id}`}
                    record={current}
                    onReview={(r) => {
                      setReviewId(r.decision_id);
                      seek(
                        r.tick,
                        r.trainee_action ? (r.order ?? undefined) : undefined,
                        r.track_id,
                      );
                      focusReplay();
                    }}
                  />
                </div>
                <div id="review-comparison" className="review-anchor">
                  <ExpertComparison
                    key={`expert:${current.id}`}
                    record={current}
                  />
                  <ReferenceRun
                    key={`reference:${current.id}`}
                    record={current}
                  />
                  <FusionReview key={`fusion:${current.id}`} record={current} />
                </div>
                <section className="panel score-table" id="review-score">
                  <div className="panel-header">
                    <div>
                      <Activity size={16} />
                      <strong>Decision-tree score breakdown</strong>
                    </div>
                  </div>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Original decision-tree score breakdown"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Contact</th>
                          <th>Detect / 25</th>
                          <th>Classify / 25</th>
                          <th>
                            {current.scorecard.prioritisation
                              ? "Priority ranking / 15"
                              : "Timely response / 15"}
                          </th>
                          <th>Engage / 35</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.scorecard.rows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              {r.id} · {r.identity}
                            </td>
                            <td>{r.detect}</td>
                            <td>{r.classify}</td>
                            <td>{r.prioritise}</td>
                            <td>{r.engage}</td>
                            <td>{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="footnote">
                    Session score averages hostile contacts, then subtracts 10
                    per asset impact. Non-hostile engagement fails the session.{" "}
                    {current.scorecard.prioritisation
                      ? "Ranking node = 15 × co-observed pair agreement × engagement coverage. Shared ranking points are allocated to each hostile row."
                      : "This legacy exercise uses timely resolution for its 15-point node."}
                  </p>
                </section>
              </>
            )}
          </div>
        ) : (
          <div className="page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">LOCAL UNIT / EXERCISE HISTORY</div>
                <h1>Unit training overview</h1>
                <p>
                  Observed results from completed sessions. Training measures do
                  not establish operational readiness.
                </p>
              </div>
              <button className="button subtle" onClick={() => void refresh()}>
                <RotateCcw size={15} /> Refresh
              </button>
            </div>
            <OfficerGate>
              <UnitDashboard
                unitId={unitIdentity?.unit_id ?? "local"}
                onOpen={openReview}
              />
            </OfficerGate>
          </div>
        )}
        <PerformanceDiagnostics />
      </main>
      {notice && (
        <div className="toast" role="status">
          <Shield size={17} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
