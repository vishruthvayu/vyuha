import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Search, X } from "lucide-react";
import { navigationItems } from "./routes";
import { useModalFocus } from "./useModalFocus";
export default function WorkspaceSearch({
  onRequestOpen,
}: {
  onRequestOpen?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const dialog = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useModalFocus(dialog, open, close);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (document.querySelector('[aria-modal="true"]') && !open) return;
        event.preventDefault();
        setOpen((v) => !v);
        setQuery("");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  const items = navigationItems.filter((i) =>
    (i.label + " " + i.section).toLowerCase().includes(query.toLowerCase()),
  );
  function show() {
    const modal = document.querySelector('[aria-modal="true"]');
    if (modal && !modal.classList.contains("workspace-navigation")) return;
    if (modal) {
      flushSync(() => onRequestOpen?.());
      if (document.querySelector('[aria-modal="true"]')) return;
    } else onRequestOpen?.();
    setOpen(true);
    setQuery("");
  }
  return (
    <>
      <button className="workspace-search-button" onClick={show}>
        <Search size={16} aria-hidden="true" />
        <span>Find workspace</span>
        <kbd>⌘ / Ctrl K</kbd>
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
                {items.map((i) => (
                  <a key={i.id} href={i.href} onClick={close}>
                    <strong>{i.label}</strong>
                    <small>{i.section}</small>
                  </a>
                ))}
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
