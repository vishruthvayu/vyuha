import { Component, type ErrorInfo, type ReactNode } from "react";

/** A failed lazy chunk or page must leave navigation and recovery usable. */
export default class WorkspaceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace could not open", error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="instructor-page workspace-recovery">
        <p className="eyebrow">WORKSPACE RECOVERY</p>
        <h1>This workspace could not open.</h1>
        <p role="alert">
          A page or one of its local assets failed to load. Reconnect to your
          VYUHA server, then reload this workspace.
        </p>
        <p>
          Saved server records remain on the server. Keep other training tabs
          open if they have decisions waiting to synchronize.
        </p>
        <div className="review-controls">
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Reload workspace
          </button>
          <a className="button subtle" href="/">
            Return to training
          </a>
        </div>
      </main>
    );
  }
}
