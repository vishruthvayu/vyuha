import type { ReactNode, RefObject } from "react";
/** A fixed instrument edge, sharing the persistent simulation. The host accepts
 * the existing camera controls; no camera, action transport or evidence is copied. */
export default function ObservationConsole({
  children,
  controlsHost,
  visible,
}: {
  children: ReactNode;
  controlsHost: RefObject<HTMLDivElement | null>;
  visible: boolean;
}) {
  return (
    <section
      id="vyuha-observation-console"
      hidden={!visible}
      aria-label="Observation console"
    >
      <header className="theatre-console-header">
        <span>VYUHA / SENSOR OPERATIONS</span>
        <strong>Observation console</strong>
        <small>Reported evidence · operator decisions</small>
      </header>
      <div className="theatre-console-body">{children}</div>
      <div className="theatre-camera-dock" ref={controlsHost} />
    </section>
  );
}
