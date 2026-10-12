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
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import OperatorGuide from "./OperatorGuide";
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
                    <span className="nav-count">{reviewCount}</span>
                  )}
                </a>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

export default function Navigation({
  view,
  onWorkspaceNavigate,
  footer,
  reviewCount = 0,
}: {
  view?: WorkspaceView;
  onWorkspaceNavigate?: (item: NavigationItem) => void;
  footer?: ReactNode;
  reviewCount?: number;
}) {
  const [open, setOpen] = useState(false),
    [help, setHelp] = useState(false),
    [search, setSearch] = useState(() => window.location.search);
  const toggle = useRef<HTMLButtonElement>(null),
    sidebar = useRef<HTMLElement>(null);
  const closeGuide = useCallback(() => setHelp(false), []);
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
  const closeNavigation = useCallback(() => setOpen(false), []);
  useModalFocus(sidebar, open, closeNavigation);
  const pathname = window.location.pathname,
    active = activeNavigation(pathname, search, view);
  const label =
    resolveRoute(pathname)?.policy === "SECONDARY_REACHABLE"
      ? resolveRoute(pathname)!.title
      : (navigationItems.find((n) => n.id === active)?.label ?? "Navigation");
  function navigate(
    event: MouseEvent<HTMLAnchorElement>,
    item: NavigationItem,
  ) {
    setOpen(false);
    // Plain anchors retain open-in-new-tab and full-page navigation everywhere else.
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
      <button
        ref={toggle}
        className="navigation-toggle"
        aria-label="Toggle navigation"
        aria-expanded={open}
        aria-controls="workspace-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <Menu size={19} />
        <span>{label}</span>
      </button>
      {open && (
        <button
          className="navigation-backdrop"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        className={`sidebar workspace-navigation ${open ? "navigation-open" : ""}`}
        aria-label="Workspace sidebar"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        tabIndex={-1}
      >
        <a className="brand" href="/" aria-label="VYUHA home">
          <span className="brand-mark">V</span>
          <span>
            VYUHA<small>TRAINING SYSTEM</small>
          </span>
        </a>
        <button
          className="navigation-close"
          aria-label="Close navigation"
          onClick={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
        >
          <X size={20} />
        </button>
        <NavigationLinks
          pathname={pathname}
          search={search}
          view={view}
          onNavigate={navigate}
          reviewCount={reviewCount}
        />
        <div className="sidebar-bottom">
          <button
            className="guide-button"
            onClick={() => {
              setOpen(false);
              setHelp(true);
            }}
          >
            <BookOpen size={16} aria-hidden="true" /> Operator guide
          </button>
          {footer}
        </div>
      </aside>
      {help && <OperatorGuide onClose={closeGuide} />}
    </>
  );
}
