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
  onAction: (action: Omit<Action, "tick">) => void;
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
  }, [gl, scene, camera, rig, ready, raycaster, rotation]);
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
}: {
  props: Props;
  buttons: Button[];
  page: number;
  setPage: (n: number) => void;
  inputStatus: string;
  contacts: (VRContact & { available: boolean })[];
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
        context={props.sessionKey}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[2, 48]} />
        <meshBasicMaterial color="#1a3039" fog={false} />
      </mesh>
      <gridHelper args={[4, 8, "#6b9395", "#31484f"]} />
      <Surface
        text={`VYUHA / VR OBSERVATION POST\n${phase.toUpperCase()} | ${(state.tick / 30).toFixed(0)} / ${scenario.duration} seconds`}
        position={[0, 2.12, -1.9]}
        width={2.8}
        height={0.19}
      />
      <Surface
        text={vrEvidence(state, selected, modernSensors(scenario))}
        position={[-0.98, 1.64, -1.9]}
        width={0.88}
        height={0.48}
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
            position={[-0.98, 1.3 - i * 0.14, -1.9]}
            width={0.88}
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
        position={[-0.98, 0.67, -1.9]}
        width={0.88}
        button={{
          id: "contact-page",
          label: "Next contacts",
          enabled: pages > 1,
          run: () => setPage((safePage + 1) % pages),
        }}
      />
      {buttons.slice(0, 8).map((b, i) => (
        <Surface
          key={b.id}
          text={b.label}
          button={b}
          position={[0, 1.83 - i * 0.15, -1.9]}
        />
      ))}
      <Surface
        text={`RADAR ${state.radarStatus.toUpperCase()}\nRF SENSOR ${state.rfAvailable ? "AVAILABLE" : "OFFLINE"}\n${vrVisionLabel(vision, scenario).toUpperCase()} VIEW\n${props.feedback?.action.track === selected ? props.feedback.status : "Training model / observed evidence"}`}
        position={[0.98, 1.68, -1.9]}
        width={0.88}
        height={0.36}
      />
      {buttons.slice(8).map((b, i) => (
        <Surface
          key={b.id}
          text={b.label}
          button={b}
          position={[0.98, 1.37 - i * 0.15, -1.9]}
          width={0.88}
        />
      ))}
      <Surface
        text={`OBSERVE → SELECT → DESIGNATE → CLASSIFY → RESPOND`}
        position={[0, 0.44, -1.9]}
        width={2.8}
        height={0.12}
      />
      <Surface
        text={`${inputStatus}\nPoint and release trigger. Stay seated. Exit VR pauses the drill.`}
        position={[0, 0.22, -1.9]}
        width={2.8}
        height={0.2}
      />
    </>
  );
}
export default function VRCockpit(props: Props) {
  const [support, setSupport] = useState<XRSupport>("checking"),
    [active, setActive] = useState(false),
    [entering, setEntering] = useState(false),
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
    action: Omit<Action, "tick">;
  } | null>(null);
  const [, refresh] = useState(0);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const suspend = () => {
    pendingRef.current = null;
    setPending(null);
    props.onSuspend();
  };

  const selectContact = (id: string) => {
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
  }, [props.selected, props.sessionKey]);
  useEffect(() => {
    setPending(null);
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
      f.seq > l.baseline &&
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
    if (action && !lock.current && !awaitingReceipt) {
      lock.current = { baseline: props.feedback?.seq ?? 0, action };
      setPending(null);
      pendingRef.current = null;
      refresh((n) => n + 1);
      props.onAction(action);
    }
  };
  const can = (k: "designate" | "classify" | "engage", effector?: Effector) =>
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
        if (props.phase === "ready") props.onStart();
        else props.onPause();
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
  const descriptions: Record<XRSupport, string> = {
    checking: "Checking this browser for a VR headset…",
    available: "WebXR headset detected. Enter VR when you are ready.",
    insecure:
      "Headset mode needs trusted HTTPS. Plain LAN HTTP supports desktop preview only.",
    unavailable:
      "No immersive WebXR headset detected. Desktop preview is available below.",
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
              : descriptions[support]}
          </p>
        </div>
        <div className="vr-entry">
          <button
            className="button primary"
            disabled={support !== "available" || entering || active}
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
            />
            <Cockpit
              props={{ ...props, onSelect: selectContact }}
              buttons={buttons}
              page={page}
              setPage={setPage}
              inputStatus={inputStatus}
              contacts={contacts}
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
        <div className="vr-button-grid">
          {buttons.map((b) => (
            <button
              key={b.id}
              data-vr-action={b.id}
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
