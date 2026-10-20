import { useEffect, type RefObject } from "react";

const focusable = "a[href],button,input,select,textarea,[tabindex]";
export function isAvailable(element: HTMLElement): boolean {
  if (element.closest('[inert],[hidden],[aria-hidden="true"]')) return false;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}
export function focusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(focusable)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      isAvailable(element),
  );
}

/** Isolate the dialog's branch, contain keyboard/programmatic focus and restore
 * the invoking control. Inert is restored exactly, including preexisting values. */
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  fallbackSelector = ".navigation-toggle",
): void {
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const isolated = new Map<Element, string | null>();
    for (
      let branch: Element | null = dialog;
      branch?.parentElement;
      branch = branch.parentElement
    ) {
      for (const sibling of branch.parentElement.children) {
        if (
          sibling === branch ||
          ["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)
        )
          continue;
        isolated.set(sibling, sibling.getAttribute("inert"));
        sibling.setAttribute("inert", "");
      }
      if (branch.parentElement === document.body) break;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFirst = () => (focusableElements(dialog)[0] ?? dialog).focus();
    focusFirst();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== "Tab") return;
      const elements = focusableElements(dialog),
        first = elements[0],
        last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const contain = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("focusin", contain);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("focusin", contain);
      for (const [element, value] of isolated) {
        if (value === null) element.removeAttribute("inert");
        else element.setAttribute("inert", value);
      }
      document.body.style.overflow = overflow;
      if (
        previous &&
        previous !== document.body &&
        previous.isConnected &&
        isAvailable(previous)
      )
        previous.focus();
      else document.querySelector<HTMLElement>(fallbackSelector)?.focus();
    };
  }, [ref, open, onClose, fallbackSelector]);
}
