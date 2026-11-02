import type { ReactNode, RefObject } from "react";

/** Shared task hierarchy for route workspaces and embedded review. */
export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
  level = 1,
  headingId,
  headingRef,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
  level?: 1 | 2;
  headingId?: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <header className={`product-workspace-header ${className}`}>
      <div className="product-workspace-title">
        <p className="eyebrow">{eyebrow}</p>
        <Heading
          id={headingId}
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
        >
          {title}
        </Heading>
        <p>{description}</p>
      </div>
      {actions && <div className="ui-header-actions">{actions}</div>}
    </header>
  );
}
