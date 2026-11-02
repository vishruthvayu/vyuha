import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelRightOpen, Pin, PinOff, X } from "lucide-react";

/** A non-modal disclosure: the world remains usable and children stay mounted.
 * Presentation state belongs here; simulation and camera state stay with their
 * original owners. `hidden` removes closed controls from the keyboard order. */
export function ContextDock({
  id,
  title,
  eyebrow,
  description,
  children,
  status,
  visible = true,
  className = "",
}: {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
  status?: { text: string; tone: string };
  visible?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (open) heading.current?.focus();
    else if (restoreFocus.current) {
      launcher.current?.focus();
      restoreFocus.current = false;
    }
  }, [open]);
  const close = () => {
    restoreFocus.current = true;
    setOpen(false);
  };
  return (
    <section
      id={id}
      hidden={!visible}
      aria-label={title}
      className={`product-context-dock ${className}`}
      data-open={open}
      data-pinned={open && pinned}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={launcher}
        hidden={open}
        className="product-dock-launcher"
        aria-label={`Open ${title.toLowerCase()}`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen(true)}
      >
        <PanelRightOpen size={20} aria-hidden="true" />
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
      </button>
      {status && (
        <p
          className="product-dock-status"
          data-tone={status.tone}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          hidden={open}
        >
          {status.text}
        </p>
      )}
      <div
        id={`${id}-panel`}
        className="product-context-panel"
        hidden={!open}
        role="region"
        aria-labelledby={`${id}-heading`}
      >
        <header className="product-dock-heading theatre-console-header">
          <span>{eyebrow}</span>
          <h2 id={`${id}-heading`} ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <p>{description}</p>
          <div className="product-dock-actions">
            <button
              className="product-dock-pin"
              aria-label={`Pin ${title.toLowerCase()}`}
              aria-pressed={pinned}
              title="Reserve space beside the world on wide screens"
              onClick={() => setPinned((value) => !value)}
            >
              {pinned ? (
                <PinOff size={17} aria-hidden="true" />
              ) : (
                <Pin size={17} aria-hidden="true" />
              )}
              {pinned ? "Unpin" : "Pin"}
            </button>
            <button
              className="product-dock-close"
              aria-label={`Close ${title.toLowerCase()}`}
              onClick={close}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </header>
        {children}
      </div>
    </section>
  );
}
