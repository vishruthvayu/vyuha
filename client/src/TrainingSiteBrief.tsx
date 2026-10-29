import { useId } from "react";
import type { TrainingSite } from "./world/training-site";

/** Public geography only. No scenario routes, contact positions or future opportunities. */
export default function TrainingSiteBrief({ site }: { site: TrainingSite }) {
  const titleId = useId();
  const all = site.structures;
  const x0 = Math.min(-60, ...all.map((b) => b.x_min)) - 25;
  const z0 = Math.min(-45, ...all.map((b) => b.z_min)) - 25;
  const width = Math.max(60, ...all.map((b) => b.x_max)) + 25 - x0;
  const depth = Math.max(60, ...all.map((b) => b.z_max)) + 25 - z0;
  return (
    <section className="training-site-brief" aria-labelledby={titleId}>
      <header>
        <span className="eyebrow">FROZEN TRAINING SITE / PUBLIC GEOGRAPHY</span>
        <h3 id={titleId}>{site.title}</h3>
        <p>{site.summary}</p>
      </header>
      <svg
        viewBox={`${x0} ${-z0 - depth} ${width} ${depth}`}
        role="img"
        aria-label={`${site.title} public site plan; building footprints, sensor origin and landmarks only`}
      >
        <rect
          x={x0}
          y={-z0 - depth}
          width={width}
          height={depth}
          fill="var(--site-ground,#111f29)"
        />
        <g transform="scale(1,-1)">
          {site.surfaces.map((s, i) =>
            s.width ? (
              <polyline
                key={i}
                points={s.path.map((p) => p.join(",")).join(" ")}
                stroke={s.kind === "asphalt" ? "#324a56" : "#4d5e62"}
                strokeWidth={s.width}
                fill="none"
              />
            ) : (
              <polygon
                key={i}
                points={s.path.map((p) => p.join(",")).join(" ")}
                fill="#334b53"
              />
            ),
          )}
          {all.map((b) => (
            <rect
              key={b.id}
              x={b.x_min}
              y={b.z_min}
              width={b.x_max - b.x_min}
              height={b.z_max - b.z_min}
              fill={b.style === "warehouse" ? "#497584" : "#647d89"}
              stroke="#a2c9ca"
              strokeWidth="1"
            />
          ))}
          <circle cx="0" cy="0" r="5" fill="#b5f4d5" />
          {site.landmarks.map((l) => (
            <circle
              key={l.id}
              cx={l.position.x}
              cy={l.position.z}
              r="3"
              fill="#e5c687"
            />
          ))}
        </g>
      </svg>
      <p className="training-site-legend">
        ● Sensor at origin · ▰ Modeled building footprints · ● Public landmarks
        · North is up
      </p>
      <ul>
        {all.map((b) => (
          <li key={b.id}>
            <strong>{b.label}</strong> · {b.height} m modeled height
          </li>
        ))}
      </ul>
      <small>
        The buildings define synthetic line-of-sight obstructions. This plan
        shows no contacts or future reports. Decorative props do not add sensor
        occlusion.
      </small>
    </section>
  );
}
