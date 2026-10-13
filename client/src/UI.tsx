import type { ReactNode } from "react";
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading ui-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="ui-header-actions">{actions}</div>}
    </header>
  );
}
export function Panel({
  title,
  description,
  children,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ui-panel ${className}`}>
      <header className="ui-panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </header>
      <div className="ui-panel-body">{children}</div>
    </section>
  );
}
export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  return <span className={`ui-status ui-status-${tone}`}>{children}</span>;
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <span className="ui-empty-mark" aria-hidden="true">
        ◇
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function EvidenceDisclosure({
  summary = "Evidence and limitations",
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="evidence-disclosure">
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}
export function LoadingWorkspace({
  title = "Loading workspace",
}: {
  title?: string;
}) {
  return (
    <section className="ui-loading" aria-busy="true">
      <p className="eyebrow">VYUHA · LOCAL WORKSPACE</p>
      <h1>{title}</h1>
      <p role="status">Loading locally bundled controls and evidence…</p>
      <div className="ui-skeleton" aria-hidden="true" />
      <div className="ui-skeleton ui-skeleton-short" aria-hidden="true" />
    </section>
  );
}
