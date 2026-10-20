import { useId, useState } from "react";
import type { GhostSkill } from "./types";
import { skillLabel } from "./Ghost";
import {
  trendCoordinates,
  trendWindow,
  type ReviewTrendPoint,
} from "./review-trend-model";
const skills = Object.keys(skillLabel) as GhostSkill[];
const colors = [
  "var(--chart-detection, #8fcef1)",
  "var(--chart-classification, #8dd9bb)",
  "var(--chart-effector, #ecc17d)",
  "var(--chart-degraded, #e9a5a0)",
];
const patterns = [undefined, "8 3", "3 3", "10 3 2 3"];
export default function ReviewTrendChart({
  points,
}: {
  points: ReviewTrendPoint[];
}) {
  const [visible, setVisible] = useState<GhostSkill[]>(skills);
  const id = useId();
  const window = trendWindow(points);
  if (!points.length)
    return (
      <p>
        No completed training observations yet. The 50% Beta(1,1) prior is not
        measured performance.
      </p>
    );
  return (
    <figure className="review-trend-chart">
      <div
        className="review-chart-legend"
        role="group"
        aria-label="Displayed skill series"
      >
        {skills.map((skill, index) => (
          <label
            key={skill}
            className="review-chart-legend-item"
            style={{ "--series-color": colors[index] } as React.CSSProperties}
          >
            <input
              type="checkbox"
              checked={visible.includes(skill)}
              onChange={(e) =>
                setVisible((current) =>
                  e.target.checked
                    ? [...current, skill]
                    : current.filter((item) => item !== skill),
                )
              }
            />
            <span>{skillLabel[skill]}</span>
          </label>
        ))}
      </div>
      {visible.length ? (
        <svg
          viewBox="0 0 720 232"
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
        >
          <title id={`${id}-title`}>
            Historical Beta means by processed training sequence; exact values
            are in the accompanying table
          </title>
          {[0, 50, 100].map((value) => (
            <g key={value} className="review-chart-axis">
              <line
                x1="48"
                x2="672"
                y1={188 - value * 1.6}
                y2={188 - value * 1.6}
                stroke="currentColor"
              />
              <text
                x="40"
                y={192 - value * 1.6}
                textAnchor="end"
                fill="currentColor"
              >
                {value}%
              </text>
            </g>
          ))}
          <text x="48" y="216" fill="currentColor">
            {window.includesPrior
              ? "Prior"
              : `Sequence ${window.visible[0].sequence}`}
          </text>
          <text x="672" y="216" textAnchor="end" fill="currentColor">
            Sequence {window.visible.at(-1)!.sequence}
          </text>
          {skills
            .filter((skill) => visible.includes(skill))
            .map((skill) => {
              const index = skills.indexOf(skill),
                coordinates = trendCoordinates(points, skill);
              return (
                <g key={skill}>
                  <polyline
                    points={coordinates
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke={colors[index]}
                    strokeWidth="2.5"
                    strokeDasharray={patterns[index]}
                  />
                  {coordinates.map((point, i) => (
                    <circle
                      key={i}
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      fill={colors[index]}
                    >
                      <title>
                        {`${skillLabel[skill]} · ${window.includesPrior && i === 0 ? "Prior" : `Sequence ${window.visible[i - (window.includesPrior ? 1 : 0)].sequence}`} · ${point.value.toFixed(2)}%`}
                      </title>
                    </circle>
                  ))}
                </g>
              );
            })}
        </svg>
      ) : (
        <p>Select a skill series to display.</p>
      )}
      <figcaption id={`${id}-description`}>
        Historical model estimates, not calibrated readiness or evidence that
        training caused improvement.{" "}
        {window.omitted
          ? `Plot shows the latest ${window.visible.length} processed completions; the complete ledger remains in the exact-value table.`
          : "The baseline prior is shown separately from completed observations."}
      </figcaption>
    </figure>
  );
}
