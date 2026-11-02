import {
  VR_SPATIAL,
  spatialSurface,
  vrContactSurface,
  vrActionSurface,
  vrInstrumentSurface,
} from "./vr-layout";
import { newId } from "./unit-state";
import { isAcquisitionEngine } from "./engine-contracts";
import {
  vrInspectAction,
  vrDeferAction,
  vrDeferReasons,
  vrObservationEvidence,
  vrObservationStatus,
} from "./vr-observation";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useContactMemory } from "./useContactMemory";
import { RenderFrameMeter } from "./render-contacts";
import { VRWorld } from "./VRWorld";
import type { Vision } from "./visibility";
import type { ActionFeedback } from "./GuidedDecision";
import type { Quality } from "./quality";
import {
  KIND_LABEL,
  type Action,
  type Effector,
  type Identity,
  type Kind,
  type Scenario,
  type Snapshot,
} from "./types";
import {
  checkVRSupport,
  VRSessionLifecycle,
  vrAction,
  vrObservedState,
  vrContacts,
  vrVisionLabel,
  type VRContact,
  vrEvidence,
  vrResponseReason,
  vrIdentities,
  vrKinds,
  modernSensors,
  supportedVRInput,
  validConfirmation,
  type PendingResponse,
  type VRPhase,
  type XRSupport,
} from "./vr";

type Button = { id: string; label: string; enabled: boolean; run: () => void };
type Props = {
  state: Snapshot;
  scenario: Scenario;
  phase: VRPhase;
  selected: string | null;
  sessionKey: string;
  feedback: ActionFeedback | null;
  quality: Quality;
  vision: Vision;
  busy: boolean;
  startLabel: string;
  onStart: () => void;
  onPause: () => void;
  onSuspend: () => void;
  onSelect: (id: string) => void;
  onVision: (vision: Vision) => void;
  onAction: (action: Omit<Action, "tick">) => number | void;
  onEnd?: () => void;
  reducedMotion?: boolean;
  onClose: () => void;
};
class VRBoundary extends Component<
  { children: ReactNode; onClose: () => void; onSuspend: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onSuspend();
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>
          VR rendering could not start. Your exercise can continue in the
          ordinary workspace.
        </p>
        <button className="button primary" onClick={this.props.onClose}>
          Return to training
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
// Each label is a real scene surface: it remains visible in immersive mode without DOM-overlay support.
function Surface({
  text,
  position,
  width = 0.86,
  height = 0.12,
  button,
}: {
  text: string;
  position: [number, number, number];
  width?: number;
  height?: number;
  button?: Button;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * 1024);
    canvas.height = Math.round(height * 1024);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = button
      ? button.enabled
        ? "#183b3f"
        : "#17252d"
      : "#0c1b25";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = button?.enabled ? "#a8d879" : "#42606b";
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    const lines = text.split("\n"),
      size = Math.min(
        button ? 46 : 38,
        ((canvas.height - 28) / lines.length) * 0.7,
      );
    ctx.font = `${button ? "600" : "400"} ${size}px system-ui, sans-serif`;
    ctx.fillStyle = button && !button.enabled ? "#8c9ca7" : "#f1f6f7";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) =>
      ctx.fillText(
        line,
        28,
        canvas.height / 2 + (i - (lines.length - 1) / 2) * size * 1.35,
        canvas.width - 56,
      ),
    );
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, width, height, button?.enabled, !!button]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={position}
      renderOrder={20}
      name={button?.id ?? "readout"}
      userData={{ vrButton: button }}
      onClick={(e) => {
        if (button) {
          e.stopPropagation();
          if (button.enabled) button.run();
        }
      }}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        fog={false}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
function Runtime({
  ready,
  onSuspend,
  onStatus,
  onFault,
  onInput,
  onMetrics,
  heading,
}: {
  ready: (
    renderer: THREE.WebGLRenderer | null,
    lifecycle: VRSessionLifecycle | null,
  ) => void;
  onSuspend: () => void;
  onStatus: (active: boolean) => void;
  onFault: (message: string) => void;
  onInput: (message: string) => void;
  onMetrics: (message: string) => void;
  heading: number;
}) {
  const { gl, scene, camera } = useThree();
  const latest = useRef({ onSuspend, onStatus, onFault, onInput, onMetrics });
  latest.current = { onSuspend, onStatus, onFault, onInput, onMetrics };
  const surfaces = useRef<THREE.Object3D[]>([]);
  const meter = useRef(new RenderFrameMeter());
  const rayCost = useRef(0);
  const pointers = useRef<
    { controller: THREE.XRTargetRaySpace; ray: THREE.Line; dot: THREE.Mesh }[]
  >([]);
  const raycaster = useMemo(() => new THREE.Raycaster(), []),
    rotation = useMemo(() => new THREE.Matrix4(), []);
  const rig = useMemo(() => new THREE.Group(), []);
  useEffect(() => {
    gl.xr.enabled = true;
    gl.xr.setReferenceSpaceType("local");
    gl.xr.setFramebufferScaleFactor(0.85);
    gl.xr.setFoveation(1);
    rig.position.set(0, 2, 0);
    rig.rotation.y = heading;
    scene.add(rig);
    rig.add(camera);
    camera.position.set(0, 0, 0);
    camera.rotation.set(-0.12, 0, 0);
    const lifecycle = new VRSessionLifecycle(
      () => latest.current.onSuspend(),
      (active) => {
        if (!active) {
          camera.position.set(0, 0, 0);
          camera.rotation.set(-0.12, 0, 0);
        }
        latest.current.onStatus(active);
        const session = gl.xr.getSession();
        const inputs = () => {
          const count = Array.from(session?.inputSources ?? []).filter((s) =>
            supportedVRInput(s),
          ).length;
          latest.current.onInput(
            active
              ? count
                ? `${count} controller ray(s) available. Hands are unsupported.`
                : "No supported controller rays. Use system exit or desktop controls."
              : "Desktop preview / mouse and keyboard controls",
          );
        };
        inputs();
        session?.addEventListener("inputsourceschange", inputs);
        session?.addEventListener(
          "end",
          () => session.removeEventListener("inputsourceschange", inputs),
          { once: true },
        );
      },
    );
    const reset = () => {
      camera.position.set(0, 0, 0);
      camera.rotation.set(-0.12, 0, 0);
    };
    gl.xr.addEventListener("sessionend", reset);
    const hit = (controller: THREE.XRTargetRaySpace) => {
      controller.updateWorldMatrix(true, false);
      rotation.extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
      raycaster.near = 0.02;
      raycaster.far = 6;
      return raycaster.intersectObjects(surfaces.current, false)[0];
    };
    const cleanups: (() => void)[] = [];
    for (let i = 0; i < 2; i++) {
      const controller = gl.xr.getController(i);
      rig.add(controller);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(0, 0, -1),
      ]);
      const material = new THREE.LineBasicMaterial({
        color: "#aee985",
        depthTest: false,
      });
      const ray = new THREE.Line(geometry, material);
      ray.scale.z = 3;
      ray.renderOrder = 10;
      controller.add(ray);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 8, 6),
        new THREE.MeshBasicMaterial({ color: "#d9fa98", depthTest: false }),
      );
      dot.renderOrder = 11;
      scene.add(dot);
      dot.visible = false;
      const connected = (event: { data: XRInputSource }) => {
        controller.userData.supportedRay = supportedVRInput(event.data);
      };
      const disconnected = () => {
        controller.userData.supportedRay = false;
      };
      controller.addEventListener("connected", connected);
      controller.addEventListener("disconnected", disconnected);
      const select = () => {
        if (
          !gl.xr.isPresenting ||
          !controller.userData.supportedRay ||
          lifecycle.session?.visibilityState !== "visible"
        )
          return;
        const h = hit(controller);
        const b = h?.object.userData.vrButton as Button | undefined;
        if (b?.enabled) b.run();
      };
      controller.addEventListener("select", select);
      pointers.current.push({ controller, ray, dot });
      cleanups.push(() => {
        controller.removeEventListener("select", select);
        controller.removeEventListener("connected", connected);
        controller.removeEventListener("disconnected", disconnected);
        controller.remove(ray);
        rig.remove(controller);
        scene.remove(dot);
        geometry.dispose();
        material.dispose();
        dot.geometry.dispose();
        (dot.material as THREE.Material).dispose();
      });
    }
    ready(gl, lifecycle);
    const lost = (e: Event) => {
      e.preventDefault();
      latest.current.onFault(
        "Graphics context lost. The exercise is paused. Close and reopen the cockpit to recover.",
      );
      latest.current.onSuspend();
      void lifecycle.exit().catch(() => {});
      latest.current.onStatus(false);
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      ready(null, null);
      lifecycle.dispose();
      gl.xr.removeEventListener("sessionend", reset);
      gl.domElement.removeEventListener("webglcontextlost", lost);
      cleanups.forEach((f) => f());
      pointers.current = [];
      rig.remove(camera);
      scene.remove(rig);
    };
  }, [gl, scene, camera, rig, ready, raycaster, rotation, heading]);
  useFrame(({ clock }) => {
    const fps = meter.current.sample(clock.elapsedTime);
    if (fps !== null)
      latest.current.onMetrics(
        JSON.stringify({
          mode: gl.xr.isPresenting
            ? "emulated-or-physical-XR"
            : "desktop-preview",
          fps,
          frameIntervals: meter.current.frameIntervals(),
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          buttonSurfaces: surfaces.current.length,
          raycastAndCollectionMs: rayCost.current,
          shaderPrograms: gl.info.programs?.length ?? 0,
          requestedFramebufferScale: 0.85,
          foveation: gl.xr.getFoveation() ?? null,
          scope:
            "previous WebGL render / callback intervals, not GPU timings or total process memory",
        }),
      );
    const rayStart = performance.now();
    surfaces.current = [];
    scene.traverse((o) => {
      if (o.userData.vrButton) surfaces.current.push(o);
    });
    for (const { controller, ray, dot } of pointers.current) {
      if (
        !gl.xr.isPresenting ||
        !controller.visible ||
        !controller.userData.supportedRay
      ) {
        dot.visible = false;
        continue;
      }
      rotation.extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
      raycaster.near = 0.02;
      raycaster.far = 6;
      const h = raycaster.intersectObjects(surfaces.current, false)[0];
      ray.scale.z = h?.distance ?? 3;
      dot.visible = !!h;
      if (h) {
        dot.position.copy(h.point);
        (dot.material as THREE.MeshBasicMaterial).color.set(
          h.object.userData.vrButton.enabled ? "#d9fa98" : "#ffb679",
        );
      }
    }
    rayCost.current = performance.now() - rayStart;
  });
  return null;
}
function Cockpit({
  props,
  buttons,
  page,
  setPage,
  inputStatus,
  contacts,
  instrument,
  setInstrument,
}: {
  props: Props;
  buttons: Button[];
  page: number;
  setPage: (n: number) => void;
  inputStatus: string;
  contacts: (VRContact & { available: boolean })[];
  instrument: VRInstrument;
  setInstrument: (mode: VRInstrument) => void;
}) {
  const { state, scenario, phase, selected, vision } = props;
  const pages = Math.max(1, Math.ceil(contacts.length / 4)),
    safePage = Math.min(page, pages - 1);
  return (
    <>
      <VRWorld
        state={state}
        scenario={scenario}
        selected={selected}
        vision={vision}
        quality={props.quality}
        reducedMotion={props.reducedMotion}
        context={props.sessionKey}
      />
      <group
        rotation={[
          0,
          isAcquisitionEngine(scenario.engine_version) ? Math.PI : 0,
          0,
        ]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[2, 48]} />
          <meshBasicMaterial color="#1a3039" fog={false} />
        </mesh>
        <gridHelper args={[4, 8, "#6b9395", "#31484f"]} />
        <Surface
          text={`VYUHA / VR OBSERVATION POST\n${phase.toUpperCase()} | ${(state.tick / 30).toFixed(0)} / ${scenario.duration} seconds`}
          {...spatialSurface(VR_SPATIAL.header)}
        />
        <Surface
          text={vrEvidence(state, selected, modernSensors(scenario))}
          {...spatialSurface(VR_SPATIAL.evidence)}
        />
        {contacts.slice(safePage * 4, safePage * 4 + 4).map((t, i) => {
          const b = {
            id: `contact-${t.id}`,
            label: `${selected === t.id ? "> " : ""}${t.id} | ${t.range} m${t.available ? "" : " / last report"}`,
            enabled: t.available,
            run: () => props.onSelect(t.id),
          };
          return (
            <Surface
              key={t.id}
              text={b.label}
              button={b}
              {...spatialSurface(vrContactSurface(i))}
            />
          );
        })}
        {!contacts.length && (
          <Surface
            text="No detected contacts yet"
            position={[-0.98, 1.25, -1.9]}
            width={0.88}
          />
        )}
        <Surface
          text={`Contacts ${safePage + 1}/${pages} | next page`}
          {...spatialSurface(VR_SPATIAL.contactPage)}
          button={{
            id: "contact-page",
            label: "Next contacts",
            enabled: pages > 1,
            run: () => setPage((safePage + 1) % pages),
          }}
        />
        {(["observe", "decide", "session"] as VRInstrument[]).map((mode, i) => (
          <Surface
            key={mode}
            text={`${instrument === mode ? "> " : ""}${mode === "observe" ? "Observe" : mode === "decide" ? "Decide" : "Session"}`}
            button={{
              id: `instrument-${mode}`,
              label: mode,
              enabled: true,
              run: () => setInstrument(mode),
            }}
            {...spatialSurface(vrInstrumentSurface(i))}
          />
        ))}
        {buttons
          .filter(
            (b) =>
              vrControlGroup(b.id) === instrument && b.id !== "start-pause",
          )
          .map((b, i) => (
            <Surface
              key={b.id}
              text={b.label}
              button={b}
              {...spatialSurface(vrActionSurface(i))}
            />
          ))}
        <Surface
          text={`RADAR ${state.radarStatus.toUpperCase()}\nRF SENSOR ${state.rfAvailable ? "AVAILABLE" : "OFFLINE"}\n${vrVisionLabel(vision, scenario).toUpperCase()} VIEW\n${props.feedback?.action.track === selected ? props.feedback.status : "Training model / observed evidence"}`}
          {...spatialSurface(VR_SPATIAL.status)}
        />
        {state.acquisition && (
          <Surface
            text={[
              vrObservationStatus(state),
              ...vrObservationEvidence(state, selected),
            ].join("\n")}
            {...spatialSurface(VR_SPATIAL.acquisition)}
          />
        )}
        {buttons
          .filter((b) => b.id === "start-pause")
          .map((b) => (
            <Surface
              key={b.id}
              text={b.label}
              button={b}
              {...spatialSurface(VR_SPATIAL.pause)}
            />
          ))}
        <Surface
          text={
            state.acquisition
              ? "OBSERVE → REQUEST → EVIDENCE → DECIDE / DEFER"
              : "OBSERVE → SELECT → DESIGNATE → CLASSIFY → RESPOND"
          }
          {...spatialSurface(VR_SPATIAL.legend)}
        />
        <Surface
          text={`${inputStatus}\nPoint and release trigger. Stay seated. Exit VR pauses the drill.`}
          {...spatialSurface(VR_SPATIAL.notes)}
        />
      </group>
    </>
  );
}
type VRInstrument = "observe" | "decide" | "session";
function vrControlGroup(id: string): VRInstrument {
  return [
    "request-eo",
    "request-ir",
    "defer-reason",
    "defer",
    "vision",
  ].includes(id)
    ? "observe"
    : ["start-pause", "finish", "confirm-finish", "exit"].includes(id)
      ? "session"
      : "decide";
}
export default function VRCockpit(props: Props) {
  const [instrument, setInstrument] = useState<VRInstrument>(
    props.phase === "ready"
      ? "session"
      : isAcquisitionEngine(props.scenario.engine_version)
        ? "observe"
        : "decide",
  );
  const [deferReason, setDeferReason] = useState<Action["reason"] | null>(null);
  const endArm = useRef<{ session: string; until: number } | null>(null);
  const [endConfirm, setEndConfirm] = useState(false);
  const latestProps = useRef(props);
  latestProps.current = props;
  const intent = useRef({
    session: props.sessionKey,
    selected: props.selected,
    propSelected: props.selected,
    phase: props.phase,
    suspended: props.phase !== "running",
  });
  if (intent.current.session !== props.sessionKey) {
    intent.current = {
      session: props.sessionKey,
      selected: props.selected,
      propSelected: props.selected,
      phase: props.phase,
      suspended: props.phase !== "running",
    };
  }
  if (intent.current.propSelected !== props.selected) {
    intent.current.propSelected = props.selected;
    intent.current.selected = props.selected;
  }
  if (intent.current.phase !== props.phase) {
    intent.current.phase = props.phase;
    intent.current.suspended = props.phase !== "running";
  }
  const [support, setSupport] = useState<XRSupport>("checking"),
    [active, setActive] = useState(false),
    [entering, setEntering] = useState(false),
    [rendererReady, setRendererReady] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [pending, setPending] = useState<PendingResponse | null>(null);
  const [metrics, setMetrics] = useState("");
  const [inputStatus, setInputStatus] = useState(
    "Desktop preview / mouse and keyboard controls",
  );
  const [kind, setKind] = useState<Kind | null>(null),
    [identity, setIdentity] = useState<Identity | null>(null);
  const lock = useRef<{
    baseline: number;
    request?: number;
    action: Omit<Action, "tick">;
  } | null>(null);
  const [, refresh] = useState(0);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const suspend = () => {
    intent.current.suspended = true;
    pendingRef.current = null;
    setPending(null);
    props.onSuspend();
  };

  const selectContact = (id: string) => {
    intent.current.selected = id;
    pendingRef.current = null;
    setPending(null);
    props.onSelect(id);
  };
  const runtime = useRef<{
    renderer: THREE.WebGLRenderer | null;
    lifecycle: VRSessionLifecycle | null;
  }>({ renderer: null, lifecycle: null });
  // Stable callback avoids recreating the XR runtime when the worker publishes snapshots.
  const ready = useMemo(
    () =>
      (
        renderer: THREE.WebGLRenderer | null,
        lifecycle: VRSessionLifecycle | null,
      ) => {
        runtime.current = { renderer, lifecycle };
        setRendererReady(Boolean(renderer && lifecycle));
      },
    [],
  );
  useEffect(() => {
    let cancelled = false;
    void checkVRSupport(window.isSecureContext, navigator.xr).then((s) => {
      if (!cancelled) setSupport(s);
    });
    const change = () => {
      void checkVRSupport(window.isSecureContext, navigator.xr).then((s) => {
        if (!cancelled) setSupport(s);
      });
    };
    navigator.xr?.addEventListener("devicechange", change);
    return () => {
      cancelled = true;
      navigator.xr?.removeEventListener("devicechange", change);
    };
  }, []);
  useEffect(() => {
    setPending(null);
    const own = vrContacts(props.state, modernSensors(props.scenario)).find(
      (t) => t.id === props.selected,
    );
    setKind(own?.classification ?? null);
    setIdentity(own?.declared ?? null);
    setDeferReason(null);
    endArm.current = null;
    setEndConfirm(false);
  }, [props.selected, props.sessionKey]);
  useEffect(() => {
    setPending(null);
    endArm.current = null;
    setEndConfirm(false);
  }, [props.phase]);
  useEffect(() => {
    lock.current = null;
    refresh((n) => n + 1);
  }, [props.sessionKey]);
  useEffect(() => {
    const l = lock.current,
      f = props.feedback;
    if (
      l &&
      f &&
      (l.request === undefined ? f.seq > l.baseline : f.seq === l.request) &&
      JSON.stringify(f.action) === JSON.stringify(l.action) &&
      f.status !== "submitted"
    ) {
      lock.current = null;
      refresh((n) => n + 1);
    }
  }, [props.feedback]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) suspend();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  });
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(
      () => {
        pendingRef.current = null;
        setPending(null);
      },
      Math.max(0, pending.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    if (!endConfirm) return;
    const armed = endArm.current;
    if (!armed) return;
    const timer = setTimeout(
      () => {
        if (endArm.current === armed) {
          endArm.current = null;
          setEndConfirm(false);
          setError(
            "End confirmation expired. Choose End exercise again if intended.",
          );
        }
      },
      Math.max(0, armed.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [endConfirm, props.sessionKey]);
  async function enter() {
    const { renderer, lifecycle } = runtime.current;
    if (!renderer || !lifecycle || !navigator.xr) return;
    setEntering(true);
    setError("");
    try {
      await lifecycle.enter(navigator.xr, (session) =>
        renderer.xr.setSession(session),
      );
    } catch (e) {
      setError(
        `VR could not start: ${e instanceof Error ? e.message : "permission or headset unavailable"}. You can retry or use desktop preview.`,
      );
    } finally {
      setEntering(false);
    }
  }
  const exit = () => {
    suspend();
    void runtime.current.lifecycle
      ?.exit()
      .catch((e) =>
        setError(
          `Could not exit VR: ${String(e)}. Use the headset system menu.`,
        ),
      );
  };
  // App owns in-flight requests across cockpit unmount/re-entry. The local
  // latch also blocks repeated input events before React publishes feedback.
  const awaitingReceipt = props.feedback?.status === "submitted";
  const send = (
    k: "designate" | "classify" | "engage",
    effector?: Effector,
  ) => {
    const action = vrAction(
      props.state,
      props.phase,
      props.scenario,
      props.selected,
      k,
      kind,
      identity,
      effector,
    );
    if (action) dispatch(action);
  };
  const dispatch = (action: Omit<Action, "tick">) => {
    if (
      lock.current ||
      awaitingReceipt ||
      props.busy ||
      intent.current.suspended ||
      intent.current.selected !== action.track ||
      latestProps.current.sessionKey !== props.sessionKey ||
      latestProps.current.phase !== "running"
    )
      return;
    const owned = {
      baseline: props.feedback?.seq ?? 0,
      action,
      request: undefined as number | undefined,
    };
    lock.current = owned;
    setPending(null);
    pendingRef.current = null;
    refresh((n) => n + 1);
    const request = props.onAction(action);
    if (typeof request === "number") owned.request = request;
  };
  const can = (k: "designate" | "classify" | "engage", effector?: Effector) =>
    !props.busy &&
    !lock.current &&
    !awaitingReceipt &&
    !!vrAction(
      props.state,
      props.phase,
      props.scenario,
      props.selected,
      k,
      kind,
      identity,
      effector,
    );
  const armed = validConfirmation(
    pending,
    props.sessionKey,
    props.selected,
    props.phase,
    Date.now(),
    !!pending && can("engage", pending.effector),
    pending
      ? vrResponseReason(
          props.state,
          props.phase,
          props.scenario,
          props.selected,
          pending.effector,
        )
      : undefined,
  )
    ? pending
    : null;
  useEffect(() => {
    if (pending && !armed) {
      pendingRef.current = null;
      setPending(null);
    }
  }, [pending, armed]);
  const observedState = useMemo(
    () => vrObservedState(props.state, modernSensors(props.scenario)),
    [props.state, props.scenario],
  );
  const memory = useContactMemory(
    observedState,
    props.sessionKey,
    props.selected,
  );
  // List-only frozen reports. Never feed this memory to VRWorld or vrAction.
  const contacts = memory.map(({ track, available }) => ({
    id: track.id,
    range: Math.round(Math.hypot(track.x, track.z)),
    designated: track.designated !== null,
    classification: track.classification,
    declared: track.declared,
    available,
  }));
  const pages = Math.max(1, Math.ceil(contacts.length / 4));
  const safePage = Math.min(page, pages - 1);
  const buttons: Button[] = [
    {
      id: "designate",
      label: "1 / Designate contact",
      enabled: can("designate"),
      run: () => send("designate"),
    },
    {
      id: "kind",
      label: `Type: ${kind ? KIND_LABEL[kind] : "choose"} / cycle`,
      enabled:
        !lock.current &&
        !awaitingReceipt &&
        !!vrAction(
          props.state,
          props.phase,
          props.scenario,
          props.selected,
          "classify",
          "quad",
          "neutral",
        ),
      run: () => {
        pendingRef.current = null;
        setPending(null);
        setKind(
          vrKinds[((kind ? vrKinds.indexOf(kind) : -1) + 1) % vrKinds.length],
        );
      },
    },
    {
      id: "identity",
      label: `Identity: ${identity ?? "choose"} / cycle`,
      enabled:
        !lock.current &&
        !awaitingReceipt &&
        !!vrAction(
          props.state,
          props.phase,
          props.scenario,
          props.selected,
          "classify",
          "quad",
          "neutral",
        ),
      run: () => {
        pendingRef.current = null;
        setPending(null);
        setIdentity(
          vrIdentities[
            ((identity ? vrIdentities.indexOf(identity) : -1) + 1) %
              vrIdentities.length
          ],
        );
      },
    },
    {
      id: "classify",
      label: "2 / Confirm classification",
      enabled: can("classify"),
      run: () => send("classify"),
    },
    ...(["hold", "rf_jam", "kinetic"] as const).map((e) => ({
      id: e,
      label: `3 / ${e === "hold" ? "Hold fire" : e === "rf_jam" ? "RF jammer" : "Kinetic response"}${vrResponseReason(props.state, props.phase, props.scenario, props.selected, e) ? "\n" + vrResponseReason(props.state, props.phase, props.scenario, props.selected, e) : lock.current ? "\nWaiting for receipt" : ""}`,
      enabled: can("engage", e),
      run: () =>
        props.selected &&
        setPending({
          session: props.sessionKey,
          effector: e,
          track: props.selected,
          until: Date.now() + 8000,
          reason: vrResponseReason(
            props.state,
            props.phase,
            props.scenario,
            props.selected,
            e,
          ),
        }),
    })),
    {
      id: "confirm",
      label: armed
        ? `CONFIRM ${armed.effector.replace("_", " ")} on ${armed.track}`
        : "Select response, then confirm",
      enabled: !!armed && can("engage", armed.effector),
      run: () => {
        const candidate = pendingRef.current;
        if (
          candidate &&
          validConfirmation(
            candidate,
            props.sessionKey,
            props.selected,
            props.phase,
            Date.now(),
            can("engage", candidate.effector),
            vrResponseReason(
              props.state,
              props.phase,
              props.scenario,
              props.selected,
              candidate.effector,
            ),
          )
        ) {
          pendingRef.current = null;
          send("engage", candidate.effector);
          setPending(null);
        }
      },
    },
    {
      id: "start-pause",
      label: props.busy
        ? "Please wait…"
        : props.phase === "ready"
          ? props.startLabel
          : props.phase === "running"
            ? "Pause exercise"
            : "Resume exercise",
      enabled: !props.busy && props.phase !== "complete",
      run: () => {
        pendingRef.current = null;
        setPending(null);
        if (props.phase === "ready") {
          props.onStart();
          setInstrument(
            isAcquisitionEngine(props.scenario.engine_version)
              ? "observe"
              : "decide",
          );
        } else {
          if (props.phase === "running") intent.current.suspended = true;
          props.onPause();
        }
      },
    },
    {
      id: "vision",
      label: `View: ${vrVisionLabel(props.vision, props.scenario)} / cycle`,
      enabled: true,
      run: () =>
        props.onVision(
          props.vision === "thermal"
            ? "day"
            : props.vision === "day"
              ? "night"
              : "thermal",
        ),
    },
    {
      id: "cancel",
      label: "Cancel pending response",
      enabled: !!armed,
      run: () => {
        pendingRef.current = null;
        setPending(null);
      },
    },
    { id: "exit", label: "Exit headset / pause", enabled: active, run: exit },
  ];
  if (isAcquisitionEngine(props.scenario.engine_version)) {
    for (const channel of ["eo", "ir"] as const)
      buttons.push({
        id: `request-${channel}`,
        label: `Request ${channel.toUpperCase()} observation`,
        enabled:
          !props.busy &&
          !lock.current &&
          !awaitingReceipt &&
          !!vrInspectAction(
            props.state,
            props.phase,
            props.scenario,
            props.selected,
            channel,
            "eligibility",
          ),
        run: () => {
          const action = vrInspectAction(
            props.state,
            props.phase,
            props.scenario,
            props.selected,
            channel,
            newId(),
          );
          if (action) dispatch(action);
        },
      });
    if (props.scenario.engine_version === "vyuha-0.6.0") {
      buttons.push({
        id: "defer-reason",
        label: `Uncertainty: ${deferReason ? deferReason.replaceAll("_", " ") : "choose reason"} / cycle`,
        enabled: !props.busy && !lock.current && !awaitingReceipt,
        run: () =>
          setDeferReason(
            vrDeferReasons[
              ((deferReason ? vrDeferReasons.indexOf(deferReason) : -1) + 1) %
                vrDeferReasons.length
            ],
          ),
      });
      buttons.push({
        id: "defer",
        label: "Record Defer / retain uncertainty",
        enabled:
          !props.busy &&
          !lock.current &&
          !awaitingReceipt &&
          !!vrDeferAction(
            props.state,
            props.phase,
            props.scenario,
            props.selected,
            deferReason,
          ),
        run: () => {
          const action = vrDeferAction(
            props.state,
            props.phase,
            props.scenario,
            props.selected,
            deferReason,
          );
          if (action) dispatch(action);
        },
      });
    }
  }
  if (props.onEnd) {
    buttons.push({
      id: "finish",
      label: "End exercise / review",
      enabled: !props.busy && ["running", "paused"].includes(props.phase),
      run: () => {
        const current = latestProps.current;
        if (
          current.sessionKey !== props.sessionKey ||
          current.phase !== props.phase ||
          current.busy ||
          !["running", "paused"].includes(current.phase)
        )
          return;
        endArm.current = {
          session: props.sessionKey,
          until: Date.now() + 8000,
        };
        setEndConfirm(true);
      },
    });
    buttons.push({
      id: "confirm-finish",
      label: "Confirm end exercise",
      enabled:
        endConfirm &&
        !props.busy &&
        !!endArm.current &&
        endArm.current.session === props.sessionKey &&
        ["running", "paused"].includes(props.phase),
      run: () => {
        const armed = endArm.current;
        endArm.current = null;
        setEndConfirm(false);
        if (
          armed &&
          armed.session === props.sessionKey &&
          latestProps.current.sessionKey === props.sessionKey &&
          latestProps.current.phase === props.phase &&
          Date.now() < armed.until &&
          !latestProps.current.busy &&
          ["running", "paused"].includes(latestProps.current.phase)
        ) {
          intent.current.suspended = true;
          props.onEnd?.();
        } else if (armed)
          setError(
            "End confirmation expired or context changed. Choose End exercise again if intended.",
          );
      },
    });
  }
  const descriptions: Record<XRSupport, string> = {
    checking: "Checking this browser for a VR headset…",
    available:
      "This browser reports immersive VR is available. Enter when ready; physical device validation is separate.",
    unsupported:
      "This browser has no WebXR API. Use desktop preview or a compatible WebXR browser.",
    insecure:
      "Headset mode needs trusted HTTPS. Plain LAN HTTP supports desktop preview only.",
    unavailable:
      "No compatible immersive VR session is currently available. Connect a supported headset and check browser permissions, or use desktop preview.",
    error:
      "The browser could not check VR support. Check permissions and retry by reopening this cockpit.",
  };
  return (
    <section className="vr-workspace" aria-label="VR observation cockpit">
      <div className="vr-heading">
        <div>
          <div className="eyebrow">IMMERSIVE TRAINING / SOFTWARE PREVIEW</div>
          <h2>VR observation post</h2>
          <p role="status">
            {active
              ? "Headset session active. All exercise controls are inside VR."
              : support === "available" && !rendererReady
                ? "Preparing the local VR renderer…"
                : descriptions[support]}
          </p>
        </div>
        <div className="vr-entry">
          <button
            className="button primary"
            disabled={
              support !== "available" || !rendererReady || entering || active
            }
            onClick={() => void enter()}
          >
            {entering ? "Starting VR…" : "Enter VR"}
          </button>
          <button
            className="button subtle"
            onClick={() => {
              suspend();
              props.onClose();
            }}
          >
            Close cockpit
          </button>
        </div>
      </div>
      <p className="vr-note">
        A stationary seated cockpit. Point a controller and release its trigger
        to select. On a laptop, click the cockpit or use the controls below.
        Experimental integration; physical headset validation pending.
        Controller target rays only; hand-only input is unsupported.
      </p>
      <p role="status">{inputStatus}</p>
      {error && <p role="alert">{error}</p>}
      <VRBoundary onClose={props.onClose} onSuspend={suspend}>
        <div className="vr-canvas">
          <Canvas
            dpr={1}
            camera={{ position: [0, 0, 0], fov: 65, near: 0.05, far: 20000 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            fallback={
              <p>
                WebGL is required for this preview. Close the cockpit to use the
                tactical workspace.
              </p>
            }
          >
            <Runtime
              ready={ready}
              onSuspend={suspend}
              onStatus={setActive}
              onFault={setError}
              onInput={setInputStatus}
              onMetrics={setMetrics}
              heading={
                isAcquisitionEngine(props.scenario.engine_version) ? Math.PI : 0
              }
            />
            <Cockpit
              props={{ ...props, onSelect: selectContact }}
              buttons={buttons}
              page={page}
              setPage={setPage}
              inputStatus={inputStatus}
              contacts={contacts}
              instrument={instrument}
              setInstrument={setInstrument}
            />
          </Canvas>
        </div>
      </VRBoundary>
      <details>
        <summary>Local renderer measurements</summary>
        <output aria-label="VR renderer measurements">{metrics}</output>
      </details>
      <details className="vr-desktop-controls" open>
        <summary>Desktop preview controls</summary>
        <p>
          {vrEvidence(
            props.state,
            props.selected,
            modernSensors(props.scenario),
          )
            .split("\n")
            .join(" · ")}
        </p>
        <div className="vr-contact-picker">
          {contacts.slice(safePage * 4, safePage * 4 + 4).map((t) => (
            <button
              key={t.id}
              className="button subtle"
              disabled={!t.available}
              aria-pressed={t.id === props.selected}
              onClick={() => selectContact(t.id)}
            >
              {t.id}
              {t.available ? "" : " · last report"}
            </button>
          ))}
        </div>
        <button
          className="button subtle"
          disabled={pages === 1}
          onClick={() => setPage((safePage + 1) % pages)}
        >
          Next contacts · {safePage + 1}/{pages}
        </button>
        <div className="vr-instrument-tabs" aria-label="Cockpit instruments">
          {(["observe", "decide", "session"] as VRInstrument[]).map((mode) => (
            <button
              key={mode}
              className="button subtle"
              aria-pressed={instrument === mode}
              onClick={() => setInstrument(mode)}
            >
              {mode === "observe"
                ? "Observation instruments"
                : mode === "decide"
                  ? "Decision instruments"
                  : "Session controls"}
            </button>
          ))}
        </div>
        {props.state.acquisition && (
          <section
            className="vr-observation-evidence"
            aria-label="VR released observation evidence"
          >
            <strong role="status">{vrObservationStatus(props.state)}</strong>
            {vrObservationEvidence(props.state, props.selected).map(
              (line, i) => (
                <p key={i}>{line}</p>
              ),
            )}
          </section>
        )}
        <div className="vr-button-grid">
          {buttons.map((b) => (
            <button
              key={b.id}
              data-vr-action={b.id}
              hidden={
                b.id !== "start-pause" && vrControlGroup(b.id) !== instrument
              }
              className="button subtle"
              disabled={!b.enabled}
              onClick={b.run}
            >
              {b.label}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
