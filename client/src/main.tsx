import React, { Suspense } from "react";
import CapabilityTour from "./CapabilityTour";
import { createRoot } from "react-dom/client";
import "./style.css";
import "./design-system.css";
import "./mission-navigation.css";
import "./spatial-training.css";
import { LoadingWorkspace } from "./UI";
import { UnitGateway } from "./Unit";
import Navigation from "./Navigation";
import { pageComponents } from "./RoutePages";
import { resolveRoute, officerReviewRequested } from "./routes";
import OfficerGate from "./OfficerGate";
const route = resolveRoute(window.location.pathname);
const Page = route && pageComponents[route.id];
const officerReview = officerReviewRequested(
  window.location.pathname,
  window.location.search,
);
const rendered =
  route && Page ? (
    officerReview ? (
      <Page reviewOnly />
    ) : route.identity ? (
      <UnitGateway
        fallbackNavigation={
          route.id === "training" ? <Navigation /> : undefined
        }
      >
        {(identity) => <Page identity={identity} />}
      </UnitGateway>
    ) : (
      <Page />
    )
  ) : (
    <main className="instructor-page">
      <h1>Page not found</h1>
      <p>This URL is not a VYUHA workspace.</p>
      <a href="/">Return to Training ground</a>
    </main>
  );
const content =
  route &&
  (officerReview ||
    [
      "unit",
      "instructor",
      "exercises",
      "transfer",
      "evaluation",
      "analytics",
    ].includes(route.id)) ? (
    <OfficerGate
      fallbackNavigation={officerReview ? <Navigation /> : undefined}
    >
      {rendered}
    </OfficerGate>
  ) : (
    rendered
  );
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CapabilityTour />
    {route?.id === "training" ? (
      <Suspense
        fallback={
          <>
            <Navigation />
            <main id="workspace-content" tabIndex={-1}>
              <LoadingWorkspace />
            </main>
          </>
        }
      >
        {officerReview ? (
          <div className="officer-review-shell">{content}</div>
        ) : (
          content
        )}
      </Suspense>
    ) : (
      <div className="app-shell route-shell">
        <Navigation />
        <div className="route-content" id="workspace-content" tabIndex={-1}>
          <header className="topbar">
            <div className="breadcrumb">
              {route?.section ?? "SUPPORT"}{" "}
              <span> / {route?.title ?? "PAGE NOT FOUND"}</span>
            </div>
          </header>
          <Suspense
            fallback={
              <main>
                <LoadingWorkspace />
              </main>
            }
          >
            {content}
          </Suspense>
        </div>
      </div>
    )}
  </React.StrictMode>,
);
function offlineStatus(value: string) {
  document.documentElement.dataset.offlineStatus = value;
  window.dispatchEvent(new Event("vyuha-offline-status"));
}
if (import.meta.env.PROD) {
  const register = async () => {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) {
      offlineStatus("unsupported");
      return;
    }
    offlineStatus("preparing");
    try {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      offlineStatus("ready");
    } catch (error) {
      console.warn("Offline cache unavailable", error);
      offlineStatus("failed");
    }
  };
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
} else offlineStatus("development");
