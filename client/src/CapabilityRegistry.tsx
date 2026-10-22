import { useEffect, useState } from "react";
import { api } from "./storage";
export type CapabilityData = {
  schema_version: number;
  title: string;
  current_source_hash: string;
  note: string;
  capabilities: {
    id: string;
    title: string;
    implementation: string;
    route: string;
    source_files: string[];
    limitations: string;
    validation: {
      id: string;
      freshness: string;
      current_pass: boolean;
      source_revision?: string;
      scopes?: string[];
      note?: string;
      error?: string;
    }[];
  }[];
  roadmap: {
    id: string;
    title: string;
    implementation: string;
    checkpoint: string;
    dependencies: string[];
  }[];
};
export function CapabilityTable({ data }: { data: CapabilityData }) {
  return (
    <section
      id="capabilities"
      className="panel advanced-card"
      aria-labelledby="capability-heading"
    >
      <h2 id="capability-heading">Capabilities and validation</h2>
      <p>{data.note}</p>
      <details>
        <summary>Current runtime fingerprint</summary>
        <code className="mono">{data.current_source_hash}</code>
      </details>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Capability evidence table"
      >
        <table>
          <caption>
            Implementation status is separate from source-specific validation
          </caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Implementation</th>
              <th scope="col">Validation</th>
            </tr>
          </thead>
          <tbody>
            {data.capabilities.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  {["IMPLEMENTED", "PARTIAL"].includes(row.implementation) ? (
                    <a href={row.route}>{row.title}</a>
                  ) : (
                    row.title
                  )}
                  <details>
                    <summary>Source and limitations</summary>
                    <ul>
                      {row.source_files.map((p) => (
                        <li key={p}>
                          <code>{p}</code>
                        </li>
                      ))}
                    </ul>
                    <p>{row.limitations}</p>
                  </details>
                </th>
                <td>{row.implementation.replaceAll("_", " ")}</td>
                <td>
                  {row.validation.length
                    ? row.validation.map((v) => (
                        <div key={v.id}>
                          <strong>{v.freshness.replaceAll("_", " ")}</strong>
                          <details>
                            <summary>Validation scope and revision</summary>
                            <p>{v.scopes?.join(" · ")}</p>
                            <small>{v.note ?? v.error}</small>
                            {v.source_revision && (
                              <p>
                                <code>{v.source_revision}</code>
                              </p>
                            )}
                          </details>
                        </div>
                      ))
                    : "Not yet validated"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Next-generation roadmap: R01–R40</summary>
        <ol>
          {data.roadmap.map((r) => (
            <li key={r.id}>
              <strong>
                {r.id} · {r.title}
              </strong>{" "}
              — {r.implementation.replaceAll("_", " ")} · Checkpoint{" "}
              {r.checkpoint}
              {r.dependencies.length > 0 && (
                <small> · Depends on {r.dependencies.join(", ")}</small>
              )}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
export default function CapabilityRegistry() {
  const [data, setData] = useState<CapabilityData | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void api<CapabilityData>("/system/capabilities")
      .then((d) => {
        if (live && Array.isArray(d.capabilities) && Array.isArray(d.roadmap))
          setData(d);
      })
      .catch(() => {
        if (live)
          setError(
            "The current capability registry is unavailable. Historical receipts below do not validate changed source.",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  return data ? (
    <CapabilityTable data={data} />
  ) : (
    <section className="panel advanced-card">
      <h2>Capabilities and validation</h2>
      <p role="status">{error || "Loading source-scoped capabilities…"}</p>
    </section>
  );
}
