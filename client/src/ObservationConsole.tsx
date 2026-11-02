import type { ReactNode, RefObject } from "react";
import { ContextDock } from "./product/ContextDock";
import {
  observationDockStatus,
  type ObservationDockSnapshot,
} from "./product/observation-status";

/** One persistent instrument edge. Closing or unpinning only changes its
 * disclosure; neither instrument children nor the camera portal are remounted. */
export default function ObservationConsole({
  children,
  controlsHost,
  visible,
  snapshot,
}: {
  children: ReactNode;
  controlsHost: RefObject<HTMLDivElement | null>;
  visible: boolean;
  snapshot?: ObservationDockSnapshot;
}) {
  return (
    <ContextDock
      id="vyuha-observation-console"
      visible={visible}
      title="Observation console"
      eyebrow="Sensor operations"
      description="EO / IR evidence · camera controls"
      status={observationDockStatus(snapshot)}
    >
      <div className="theatre-console-body">{children}</div>
      <div className="theatre-camera-dock" ref={controlsHost} />
    </ContextDock>
  );
}
