import { useId } from "react";
import { radarPicture } from "./radar-presentation";
import type { Snapshot } from "./types";
export function Radar({
  state,
  selected,
  onSelect,
  large = false,
}: {
  state: Snapshot;
  selected: string | null;
  onSelect: (id: string) => void;
  large?: boolean;
}) {
  const uid = `radar-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const picture = radarPicture(state);
  const v2 = state.tracks.some((t) => !!t.observation),
    range = v2 ? 3000 : 200,
    scale = 180 / range;
  const zone = state.tracks.find((t) => t.rules)?.rules?.restricted ?? {
    enabled: true,
    x_lt: -30,
    z_gt: 20,
  };
  return (
    <div className={`radar ${large ? "radar-large" : ""}`}>
      <svg
        viewBox="0 0 420 420"
        role="group"
        aria-label="Radar showing detected contacts around the protected asset"
        aria-describedby={`${uid}-description`}
      >
        <desc id={`${uid}-description`}>
          Radar{" "}
          {picture.status === "failed"
            ? "offline"
            : picture.status === "jammed"
              ? "degraded"
              : "normal"}
          . The decorative sweep is schematic, not a modeled antenna phase.
          Hollow plots are tentative or coasting reports. Color reflects the
          trainee declaration, not verified identity.
        </desc>
        <defs>
          <radialGradient id={`${uid}-bg`}>
            <stop stopColor="#1e3028" />
            <stop offset="1" stopColor="#101b18" />
          </radialGradient>
        </defs>
        <circle cx="210" cy="210" r="192" fill={`url(#${uid}-bg)`} />
        {[48, 96, 144, 192].map((r) => (
          <circle key={r} cx="210" cy="210" r={r} className="radar-ring" />
        ))}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <line
              key={i}
              x1="210"
              y1="210"
              x2={210 + Math.sin(a) * 192}
              y2={210 - Math.cos(a) * 192}
              className="radar-line"
            />
          );
        })}
        <text x="210" y="14" textAnchor="middle">
          N
        </text>
        <text x="410" y="214" textAnchor="middle">
          E
        </text>
        <text x="210" y="416" textAnchor="middle">
          S
        </text>
        <text x="9" y="214" textAnchor="middle">
          W
        </text>
        <defs>
          <clipPath id={`${uid}-sector`}>
            <circle cx="210" cy="210" r="192" />
          </clipPath>
        </defs>
        {zone.enabled && (
          <g clipPath={`url(#${uid}-sector)`}>
            <rect
              x="18"
              y="18"
              width={Math.max(0, 192 + zone.x_lt * scale)}
              height={Math.max(0, 192 - zone.z_gt * scale)}
              fill="#d9a762"
              opacity=".12"
            />
            <text x="85" y="165" className="radar-small">
              RESTRICTED
            </text>
          </g>
        )}
        <circle cx="210" cy="210" r="7" fill="#cdf46d" />
        <path d="m210 197 5 6h-10Z" fill="#cdf46d" />
        <text x="222" y="229" className="radar-small">
          BASE
        </text>
        {picture.sweep && (
          <g role="img" aria-label="Schematic radar sweep">
            <line
              x1="210"
              y1="210"
              x2={210 + Math.sin(state.tick / 70) * 192}
              y2={210 - Math.cos(state.tick / 70) * 192}
              stroke="#cdf46d"
              opacity=".4"
            />
          </g>
        )}
        {picture.contacts.map((t) => {
          const x = 210 + t.x * scale,
            y = 210 - t.z * scale;
          const color =
            t.declared === "hostile"
              ? "#f48f6b"
              : t.declared === "friendly"
                ? "#76c8eb"
                : "#cdf46d";
          const coasting = !t.fresh || t.state === "lost";
          const evidence = `${t.state}${coasting ? " / coasting" : ""} radar report${t.sampleTick === null ? "" : ` · ${Math.max(0, (state.tick - t.sampleTick) / 30).toFixed(1)}s since sample`}`;
          return (
            <g
              key={t.id}
              role="button"
              tabIndex={0}
              aria-label={`Select radar contact ${t.id}`}
              aria-description={evidence}
              aria-pressed={selected === t.id}
              onClick={() => onSelect(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(t.id);
                }
              }}
              style={{ cursor: "pointer", opacity: coasting ? 0.65 : 1 }}
            >
              <circle cx={x} cy={y} r="17" fill="transparent" />
              {selected === t.id && (
                <circle cx={x} cy={y} r="13" fill="none" stroke="#cdf46d" />
              )}
              <path
                d={`M${x} ${y - 5}l5 5-5 5-5-5Z`}
                fill={coasting || t.state === "tentative" ? "none" : color}
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray={coasting ? "3 2" : undefined}
              />
              <text x={x + 12} y={y + 4} className="radar-contact">
                {t.id}
              </text>
            </g>
          );
        })}
        {picture.tentative.map((p) => {
          return (
            <g key={p.id} opacity={0.5}>
              <circle
                cx={210 + p.x * scale}
                cy={210 - p.z * scale}
                r="4"
                fill="none"
                stroke="#d9a762"
              />
              <text
                x={216 + p.x * scale}
                y={210 - p.z * scale}
                className="radar-small"
              >
                TENTATIVE
              </text>
            </g>
          );
        })}
        {picture.status !== "normal" && (
          <>
            <circle cx="210" cy="210" r="130" fill="#8c492c" opacity=".12" />
            <text x="210" y="170" textAnchor="middle" fill="#f4ab7a">
              {picture.status === "failed" ? "RADAR OFFLINE" : "RADAR DEGRADED"}
            </text>
            <text x="210" y="188" textAnchor="middle" className="radar-small">
              Use EO / IR observations
            </text>
          </>
        )}
      </svg>
      <div className="radar-caption">
        <span>ILLUSTRATIVE RANGE</span>
        <span>{range} m</span>
      </div>
    </div>
  );
}
