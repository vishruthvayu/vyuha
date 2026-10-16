import type { ReactNode, Ref } from "react";
/** Decision dock plus a separate evidence region for the selected contact.
 * Evidence is supplied by the original sensor selectors; this layout never
 * creates observations or chooses an action. The dock is the focus target used
 * when a contact is chosen on small screens. */
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
    <>
      <section
        className="decision-workspace"
        ref={ref}
        tabIndex={-1}
        aria-label="Decisions for the selected contact"
      >
        <div className="decision-primary">{children}</div>
      </section>
      <aside
        className="decision-evidence"
        aria-label="Evidence for the selected contact"
      >
        {evidence}
      </aside>
    </>
  );
}
