import WorkspaceSearch, {
  WORKSPACE_SEARCH_OPEN_EVENT,
} from "./WorkspaceSearch";
import { createPortal, flushSync } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  Crosshair,
  Eye,
  Film,
  Layers,
  Menu,
  Shield,
  Search,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import OperatorGuide from "./OperatorGuide";
import { startTour } from "./CapabilityTour";
import { useModalFocus } from "./useModalFocus";
import {
  activeNavigation,
  navigationItems,
  navigationSections,
  resolveRoute,
  type NavigationId,
  type NavigationItem,
  type WorkspaceView,
} from "./routes";

const icons: Partial<Record<NavigationId, LucideIcon>> = {
  training: Crosshair,
  review: Activity,
  rapid: Eye,
  director: Target,
  unit: Users,
  instructor: Users,
  analytics: Activity,
  exercises: Layers,
  recorded: Film,
  transfer: ArrowLeftRight,
  evidence: Shield,
};
export function NavigationLinks({
  pathname,
  search = "",
  view,
  onNavigate,
  reviewCount = 0,
}: {
  pathname: string;
  search?: string;
  view?: WorkspaceView;
  onNavigate?: (
    event: MouseEvent<HTMLAnchorElement>,
    item: NavigationItem,
  ) => void;
  reviewCount?: number;
}) {
  const active = activeNavigation(pathname, search, view),
    secondary = resolveRoute(pathname)?.policy === "SECONDARY_REACHABLE";
  return (
    <nav aria-label="Main navigation" className="navigation-scroll">
      {reviewCount > 0 && (
        <span id="catalog-review-count" hidden>
          {reviewCount} reviews in history
        </span>
      )}
      {navigationSections.map((section) => (
        <div className="navigation-group" key={section}>
          <div className="nav-label">{section}</div>
          {navigationItems
            .filter((item) => item.section === section)
            .map((item) => {
              const Icon = icons[item.id] ?? BookOpen;
              const href =
                view && item.workspaceHref ? item.workspaceHref : item.href;
              return (
                <a
                  key={item.id}
                  className={`nav-item ${active === item.id ? "active" : ""}`}
                  href={href}
                  aria-label={item.label}
                  aria-describedby={
                    item.id === "review" && reviewCount > 0
                      ? "catalog-review-count"
                      : undefined
                  }
                  aria-current={
                    active === item.id
                      ? secondary
                        ? "location"
                        : "page"
                      : undefined
                  }
                  onClick={(event) => onNavigate?.(event, { ...item, href })}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.id === "review" && reviewCount > 0 && (
                    <span aria-hidden="true" className="nav-count">
                      {reviewCount}
                    </span>
                  )}
                </a>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

const primaryIds: NavigationId[] = [
  "training",
  "review",
  "crew",
  "instructor",
  "analytics",
];
const primaryLabels: Partial<Record<NavigationId, string>> = {
  training: "Training",
  review: "Review",
  crew: "Crew",
  instructor: "Instructor",
  analytics: "Analytics",
};
export function PrimaryNavigationLinks({
  pathname,
  search = "",
  view,
  onNavigate,
  reviewCount = 0,
}: {
  pathname: string;
  search?: string;
  view?: WorkspaceView;
  onNavigate?: (
    event: MouseEvent<HTMLAnchorElement>,
    item: NavigationItem,
  ) => void;
  reviewCount?: number;
}) {
  const active = activeNavigation(pathname, search, view);
  return (
    <nav className="mission-primary-navigation" aria-label="Primary workspaces">
      {reviewCount > 0 && (
        <span id="primary-review-count" hidden>
          {reviewCount} reviews in history
        </span>
      )}
      {primaryIds.map((id) => {
        const item = navigationItems.find((candidate) => candidate.id === id)!;
        const href =
          view && item.workspaceHref ? item.workspaceHref : item.href;
        const nestedTraining = id === "training" && active === "director";
        const selected = active === id || nestedTraining;
        return (
          <a
            key={id}
            href={href}
            title={item.label}
            aria-describedby={
              id === "review" && reviewCount > 0
                ? "primary-review-count"
                : undefined
            }
            aria-current={
              selected
                ? nestedTraining ||
                  resolveRoute(pathname)?.policy === "SECONDARY_REACHABLE"
                  ? "location"
                  : "page"
                : undefined
            }
            className={`mission-primary-link ${selected ? "active" : ""}`}
            onClick={(event) => onNavigate?.(event, { ...item, href })}
          >
            {primaryLabels[id]}
            {id === "review" && reviewCount > 0 && (
              <span aria-hidden="true" className="nav-count">
                {reviewCount}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

export default function Navigation({
  view,
  onWorkspaceNavigate,
  footer,
  reviewCount = 0,
  immersive = false,
}: {
  view?: WorkspaceView;
  onWorkspaceNavigate?: (item: NavigationItem) => void;
  footer?: ReactNode;
  reviewCount?: number;
  immersive?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [help, setHelp] = useState(false),
    [search, setSearch] = useState(() => window.location.search);
  const toggle = useRef<HTMLButtonElement>(null),
    catalogue = useRef<HTMLElement>(null);
  const closeGuide = useCallback(() => setHelp(false), []);
  const closeNavigation = useCallback(() => setOpen(false), []);
  useModalFocus(catalogue, open, closeNavigation);
  useEffect(() => {
    if (!open) return;
    // The catalogue is portalled, so the focus hook isolates the root branch.
    // Mark nested workspace landmarks explicitly too, preserving any inert
    // value owned by another component or already set by the modal hook.
    const workspaces = [...document.querySelectorAll("main")].filter(
      (element) =>
        !element.hasAttribute("inert") && !catalogue.current?.contains(element),
    );
    workspaces.forEach((element) => element.setAttribute("inert", ""));
    return () =>
      workspaces.forEach((element) => element.removeAttribute("inert"));
  }, [open]);
  useEffect(() => {
    const update = () => {
      setSearch(window.location.search);
      setOpen(false);
    };
    window.addEventListener("popstate", update);
    window.addEventListener("vyuha-workspace-navigation", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("vyuha-workspace-navigation", update);
    };
  }, []);
  const pathname = window.location.pathname;
  function navigate(
    event: MouseEvent<HTMLAnchorElement>,
    item: NavigationItem,
  ) {
    setOpen(false);
    // Keep native modifier/new-tab semantics. Embedded navigation preserves the
    // running simulator and its queued local evidence.
    if (
      onWorkspaceNavigate &&
      (item.id === "training" || item.workspace) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.button === 0
    ) {
      event.preventDefault();
      onWorkspaceNavigate(item);
      if (open) toggle.current?.focus();
    }
  }
  function openGuide() {
    const modal = document.querySelector('[aria-modal="true"]');
    if (modal && !modal.classList.contains("workspace-navigation")) return;
    if (open) flushSync(closeNavigation);
    setHelp(true);
  }
  function toggleCatalogue() {
    const modal = document.querySelector('[aria-modal="true"]');
    if (modal && !modal.classList.contains("workspace-navigation")) return;
    setOpen((value) => !value);
  }
  function startWalkthrough() {
    const modal = document.querySelector('[aria-modal="true"]');
    if (modal && !modal.classList.contains("workspace-navigation")) return;
    if (open) flushSync(closeNavigation);
    startTour();
  }
  return (
    <>
      <a
        className="skip-link"
        href="#workspace-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("workspace-content")?.focus();
        }}
      >
        Skip to workspace
      </a>
      <header
        className="mission-navigation"
        data-immersive={immersive || undefined}
      >
        <a
          className="mission-navigation-brand"
          href="/"
          aria-label="VYUHA home"
          onClick={(event) =>
            navigate(
              event,
              navigationItems.find((item) => item.id === "training")!,
            )
          }
        >
          <svg viewBox="0 0 32 32" width="29" height="29" aria-hidden="true">
            <path d="M3 5h6l7 18 7-18h6L18 30h-4Z" fill="currentColor" />
            <path d="M11 3h10l-5 12Z" fill="currentColor" opacity=".4" />
          </svg>
          <strong>VYUHA</strong>
        </a>
        <PrimaryNavigationLinks
          pathname={pathname}
          search={search}
          view={view}
          onNavigate={navigate}
          reviewCount={reviewCount}
        />
        <div className="mission-navigation-tools">
          <WorkspaceSearch
            onRequestOpen={closeNavigation}
            onNavigate={navigate}
            view={view}
          />
          <button
            className="mission-guide-button"
            aria-label="Operator guide"
            title="Operator guide"
            onClick={openGuide}
          >
            <BookOpen size={18} aria-hidden="true" />
            <span>
              <span className="mission-guide-prefix">Operator </span>guide
            </span>
          </button>
          <button
            ref={toggle}
            className="navigation-toggle mission-catalog-toggle"
            aria-label="Workspaces"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            onClick={toggleCatalogue}
          >
            <Menu size={19} aria-hidden="true" />
            <span>Workspaces</span>
          </button>
        </div>
      </header>
      {open &&
        createPortal(
          <div
            className="mission-catalog-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeNavigation();
            }}
          >
            <section
              ref={catalogue}
              id="workspace-navigation"
              className="workspace-navigation navigation-open mission-catalog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="workspace-catalog-title"
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="mission-catalog-heading">
                <div>
                  <h2 id="workspace-catalog-title">Workspaces</h2>
                  <p>
                    Train in the live workspace, command an exercise, or inspect
                    its evidence. Officer workspaces require sign-in.
                  </p>
                </div>
                <button
                  className="navigation-close"
                  aria-label="Close navigation"
                  onClick={closeNavigation}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </header>
              <div className="mission-catalog-actions">
                <button
                  className="catalogue-search-trigger"
                  onClick={() =>
                    window.dispatchEvent(
                      new window.Event(WORKSPACE_SEARCH_OPEN_EVENT),
                    )
                  }
                >
                  <Search size={18} aria-hidden="true" />
                  Find workspace<kbd>⌘ / Ctrl K</kbd>
                </button>
                <button className="mission-guide-button" onClick={openGuide}>
                  <BookOpen size={18} aria-hidden="true" />
                  Operator guide
                </button>
                <button
                  className="mission-walkthrough-button"
                  onClick={startWalkthrough}
                >
                  <Target size={18} aria-hidden="true" />
                  Guided walkthrough
                </button>
              </div>
              <NavigationLinks
                pathname={pathname}
                search={search}
                view={view}
                onNavigate={navigate}
                reviewCount={reviewCount}
              />
              {footer && (
                <div
                  className="mission-catalog-context"
                  aria-label="Current training context"
                >
                  {footer}
                </div>
              )}
              <p className="mission-catalog-hint">
                Escape returns to the invoking control. Officer workspaces
                retain their sign-in requirements.
              </p>
            </section>
          </div>,
          document.body,
        )}
      {help && <OperatorGuide onClose={closeGuide} />}
    </>
  );
}
