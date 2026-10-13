import { useEffect, useState } from "react";
import type { GhostSkill } from "./types";
import { api } from "./storage";
const labels: Record<GhostSkill, string> = {
  detection: "Detection",
  classification_iff: "Classification / IFF",
  effector_choice: "Effector Choice",
  degraded_sensor_response: "Degraded Sensor Response",
};
export type Heatmap = {
  unit_id: string;
  trainee_id: string | null;
  included_sessions: number;
  excluded_sessions: number;
  note: string;
  skills: GhostSkill[];
  rows: {
    family: string;
    sessions: number;
    cells: Record<
      GhostSkill,
      {
        successes: number;
        failures: number;
        observations: number;
        estimate: number | null;
        sessions: number;
      }
    >;
  }[];
};
export function HeatmapTable({ data }: { data: Heatmap }) {
  return (
    <>
      <p>{data.note}</p>
      <div className="table-scroll">
        <table className="skill-heatmap">
          <thead>
            <tr>
              <th>Scenario family</th>
              {data.skills.map((k) => (
                <th key={k}>{labels[k]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.family}>
                <th>
                  {row.family.replaceAll("_", " ")}
                  <small>{row.sessions} recorded sessions</small>
                </th>
                {data.skills.map((k) => {
                  const c = row.cells[k];
                  return (
                    <td
                      key={k}
                      style={{
                        background:
                          c.estimate == null
                            ? "transparent"
                            : `rgba(130,170,210,${0.06 + c.estimate * 0.23})`,
                      }}
                    >
                      <details>
                        <summary
                          aria-label={`${row.family}, ${labels[k]}, ${c.estimate == null ? "no evidence" : `${(c.estimate * 100).toFixed(1)} percent estimate`}, ${c.observations} observations`}
                        >
                          {c.estimate == null
                            ? "—"
                            : `${(c.estimate * 100).toFixed(1)}%`}
                          <small>n={c.observations}</small>
                        </summary>
                        <div>
                          Scenario family: {row.family}
                          <br />
                          Skill: {labels[k]}
                          <br />
                          Observations: {c.observations}
                          <br />
                          Successes: {c.successes}
                          <br />
                          Failures: {c.failures}
                          <br />
                          Estimate:{" "}
                          {c.estimate == null
                            ? "No evidence"
                            : `${(c.estimate * 100).toFixed(1)}%`}
                          <br />
                          Contributing sessions: {c.sessions}
                        </div>
                      </details>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {data.included_sessions} included sessions · {data.excluded_sessions}{" "}
        ledger records without reconstructable completed session excluded.
      </p>
    </>
  );
}
export default function SkillHeatmap({
  unit,
  trainee,
}: {
  unit: string;
  trainee: string;
}) {
  const [scope, setScope] = useState<"unit" | "trainee">("unit"),
    [data, setData] = useState<Heatmap | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    setData(null);
    setError("");
    if (scope === "trainee" && !trainee) return;
    void api<Heatmap>(
      `/units/${encodeURIComponent(unit)}/skill-heatmap${scope === "trainee" ? `?trainee=${encodeURIComponent(trainee)}` : ""}`,
    )
      .then((r) => {
        if (!stopped) setData(r);
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, [unit, trainee, scope]);
  return (
    <section className="panel advanced-card" id="scenario-skill">
      <div className="eyebrow">VYUHA TRAINING EVIDENCE</div>
      <h2>Scenario × skill</h2>
      <label>
        Evidence scope
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as typeof scope)}
        >
          <option value="unit">All recorded sessions in selected unit</option>
          <option value="trainee">Selected trainee in this unit</option>
        </select>
      </label>
      {scope === "trainee" && !trainee ? (
        <p>Select a trainee to inspect their recorded observations.</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : data ? (
        <HeatmapTable data={data} />
      ) : (
        <p role="status">Loading persisted observations…</p>
      )}
    </section>
  );
}
