import { reportedContacts } from "./observed-contacts";
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
      >
        <defs>
          <radialGradient id="radarBg">
            <stop stopColor="#1e3028" />
            <stop offset="1" stopColor="#101b18" />
          </radialGradient>
        </defs>
        <circle cx="210" cy="210" r="192" fill="url(#radarBg)" />
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
          <clipPath id="radarSector">
            <circle cx="210" cy="210" r="192" />
          </clipPath>
        </defs>
        {zone.enabled && (
          <g clipPath="url(#radarSector)">
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
        {!state.jammed && (
          <line
            x1="210"
            y1="210"
            x2={210 + Math.sin(state.tick / 70) * 192}
            y2={210 - Math.cos(state.tick / 70) * 192}
            stroke="#cdf46d"
            opacity=".4"
          />
        )}
        {state.radarStatus !== "failed" &&
          reportedContacts(state)
            .filter((t) =>
              t.observation ? t.observation.radar.position !== null : t.radar,
            )
            .map((t) => ({ ...t, ...(t.observation?.radar.position ?? {}) }))
            .map((t) => {
              const x = 210 + t.x * scale,
                y = 210 - t.z * scale;
              return (
                <g
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select radar contact ${t.id}`}
                  aria-pressed={selected === t.id}
                  onClick={() => onSelect(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(t.id);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={x} cy={y} r="17" fill="transparent" />
                  {selected === t.id && (
                    <circle cx={x} cy={y} r="13" fill="none" stroke="#cdf46d" />
                  )}
                  <path
                    d={`M${x} ${y - 5}l5 5-5 5-5-5Z`}
                    fill={
                      t.declared === "hostile"
                        ? "#f48f6b"
                        : t.declared === "friendly"
                          ? "#76c8eb"
                          : "#cdf46d"
                    }
                  />
                  <text x={x + 12} y={y + 4} className="radar-contact">
                    {t.id}
                  </text>
                </g>
              );
            })}
        {state.falseContacts?.map((c) => {
          const p = c.radar.position;
          if (!p) return null;
          return (
            <g key={c.track_id} opacity={0.5}>
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
        {(state.jammed || state.radarStatus === "failed") && (
          <>
            <circle cx="210" cy="210" r="130" fill="#8c492c" opacity=".12" />
            <text x="210" y="170" textAnchor="middle" fill="#f4ab7a">
              {state.radarStatus === "failed"
                ? "RADAR OFFLINE"
                : "RADAR DEGRADED"}
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
