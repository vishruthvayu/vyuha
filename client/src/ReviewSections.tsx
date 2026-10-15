import { useEffect, useState } from "react";

export type ReviewSection = { id: string; label: string };

/** In-page navigator for the after-action review. Plain anchor links (work
 * without JavaScript); where IntersectionObserver exists, the section in view
 * is marked aria-current="location". Presentation only: no review data. */
export function ReviewSections({ sections }: { sections: ReviewSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const key = sections.map((s) => s.id).join("|");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        const best = [...visible.entries()]
          .filter(([, r]) => r > 0)
          .sort((a, b) => b[1] - a[1])[0];
        if (best) setActive(best[0]);
      },
      { rootMargin: "-120px 0px -45% 0px", threshold: [0, 0.15, 0.4, 0.75] },
    );
    for (const id of key.split("|")) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);
  return (
    <nav className="review-sections" aria-label="Review sections">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? "location" : undefined}
          onClick={() => setActive(s.id)}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
