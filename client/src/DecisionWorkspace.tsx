import type { ReactNode, Ref } from "react";
/** One contextual decision surface. Evidence is supplied by the original sensor
 * selectors; this layout never creates observations or chooses an action. */
export function DecisionWorkspace({
  children,
  evidence,
  ref,
}: {
  children: ReactNode;
  evidence: ReactNode;
  ref?: Ref<HTMLElement>;
}) {
  return (
    <section
      className="decision-workspace"
      ref={ref}
      tabIndex={-1}
      aria-label="Selected contact evidence and decisions"
    >
      <div className="decision-primary">{children}</div>
      <div className="decision-evidence">{evidence}</div>
    </section>
  );
}
