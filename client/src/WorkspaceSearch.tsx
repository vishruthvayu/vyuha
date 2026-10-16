import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Search, X } from "lucide-react";
import {
  navigationItems,
  type NavigationItem,
  type WorkspaceView,
} from "./routes";
import type { MouseEvent } from "react";
import { useModalFocus } from "./useModalFocus";
export const WORKSPACE_SEARCH_OPEN_EVENT = "vyuha-open-workspace-search";
export default function WorkspaceSearch({
  onRequestOpen,
  onNavigate,
  view,
}: {
  onRequestOpen?: () => void;
  onNavigate?: (
    event: MouseEvent<HTMLAnchorElement>,
    item: NavigationItem,
  ) => void;
  view?: WorkspaceView;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const dialog = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => {
    const modal = document.querySelector('[aria-modal="true"]');
    if (modal && !modal.classList.contains("workspace-navigation")) return;
    if (modal) {
      flushSync(() => onRequestOpen?.());
      if (document.querySelector('[aria-modal="true"]')) return;
    } else onRequestOpen?.();
    setOpen(true);
    setQuery("");
  }, [onRequestOpen]);
  useModalFocus(dialog, open, close);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const modal = document.querySelector('[aria-modal="true"]');
        if (modal && !modal.classList.contains("workspace-navigation") && !open)
          return;
        event.preventDefault();
        if (open) close();
        else show();
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener(WORKSPACE_SEARCH_OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener(WORKSPACE_SEARCH_OPEN_EVENT, show);
    };
  }, [open, close, show]);
  const items = navigationItems.filter((i) =>
    (i.label + " " + i.section).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <button
        className="workspace-search-button"
        aria-keyshortcuts="Control+K Meta+K"
        title="Find workspace (Control or Command K)"
        onClick={show}
      >
        <Search size={16} aria-hidden="true" />
        <span>Find workspace</span>
        <kbd aria-hidden="true">⌘ / Ctrl K</kbd>
      </button>
      {open &&
        createPortal(
          <div className="modal-backdrop" onClick={close}>
            <div
              className="workspace-search-dialog"
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="workspace-search-title"
              onClick={(e) => e.stopPropagation()}
            >
              <header>
                <h2 id="workspace-search-title">Find a workspace</h2>
                <button
                  className="button subtle"
                  aria-label="Close workspace search"
                  onClick={close}
                >
                  <X size={18} />
                </button>
              </header>
              <label>
                Search navigation
                <input
                  ref={input}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Training, Crew, analytics…"
                />
              </label>
              <nav aria-label="Workspace search results">
                {items.map((i) => {
                  const item = {
                    ...i,
                    href: view && i.workspaceHref ? i.workspaceHref : i.href,
                  };
                  return (
                    <a
                      key={i.id}
                      href={item.href}
                      onClick={(event) => {
                        close();
                        onNavigate?.(event, item);
                      }}
                    >
                      <strong>{i.label}</strong>
                      <small>{i.section}</small>
                    </a>
                  );
                })}
              </nav>
              {!items.length && (
                <p role="status">
                  No workspace matches. Try another feature name.
                </p>
              )}
              <p className="footnote">
                Escape closes this window. Tab moves through the matching
                destinations.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
