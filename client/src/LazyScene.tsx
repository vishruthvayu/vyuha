import { diagnosticSpan } from "./diagnostics";
import {
  Component,
  lazy,
  Suspense,
  type ComponentProps,
  type ReactNode,
} from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import type { Scene as SceneComponent } from "./Scene";
const Renderer = lazy(() => {
  const finish = diagnosticSpan("renderer_module");
  return import("./Scene").then(
    (m) => {
      finish();
      return { default: m.Scene };
    },
    (error) => {
      finish();
      throw error;
    },
  );
});
export class RendererBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function Scene(props: ComponentProps<typeof SceneComponent>) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <RendererBoundary fallback={props.fallback}>
      <Suspense
        fallback={
          <div className="scene-loading" role="status">
            <span className="ui-skeleton" aria-hidden="true" />
            <p>Loading local 3D renderer…</p>
            <small>
              Simulation evidence and scoring remain independent of rendering.
            </small>
          </div>
        }
      >
        <Renderer
          {...props}
          reducedMotion={props.reducedMotion ?? reducedMotion}
        />
      </Suspense>
    </RendererBoundary>
  );
}
