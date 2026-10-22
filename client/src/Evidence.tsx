import CapabilityRegistry from "./CapabilityRegistry";
import { PageHeader } from "./UI";
import FinaleEvidence, { type FinaleManifest } from "./FinaleEvidence";
import { useEffect, useState } from "react";
import { api } from "./storage";
type DeviceReport = {
  provenance?: string;
  results?: {
    contacts: number;
    graphics: string;
    auto_quality: boolean;
    seconds: number;
    median_render_fps: number;
    median_sim_tick_ms: number;
    p95_sim_tick_ms: number;
  }[];
};
type EvidenceData = {
  finale?: FinaleManifest;
  schema_version: number;
  validated_at: string;
  source_matches: boolean;
  freshness_note: string;
  automated: {
    backend_passed: number;
    frontend_passed: number;
    parity: Record<string, number>;
    build: string;
    offline_assets: number;
  };
  acceptance: string;
  physical: {
    wan_off: string;
    wan_off_reason?: string;
    architecture_claim?: string;
    weak_laptop: string;
    devices: string[];
  };
  performance: {
    scale: {
      scale?: {
        contacts: number;
        tick: { median_ms: number; p95_ms: number };
        ghost_replay_scoring: { median_ms: number };
        python_traced_peak_mib: number;
      }[];
    };
    unit: {
      advanced?: {
        concurrent_clients: number;
        completed_sessions: number;
        http_ms: Record<string, { median: number; p95: number }>;
      };
    };
    browser: unknown;
    android?: DeviceReport;
    weak_laptop?: DeviceReport;
  };
  experiment: {
    summary?: Record<
      string,
      {
        learners: number;
        reached_threshold: number;
        median_sessions_among_reached: number;
        mean_final_hidden_performance: number;
      }
    >;
    method?: string;
  };
  remaining: string[];
};
export default function Evidence() {
  const [data, setData] = useState<EvidenceData | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void api<EvidenceData>("/system/evidence")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main id="system-evidence" className="instructor-page advanced-page">
      <PageHeader
        eyebrow="SOURCE, VALIDATION AND LIMITS"
        title="VYUHA system evidence"
        description="Navigate measured results, release provenance and outstanding validation."
        actions={
          <nav className="advanced-nav">
            <a href="/system/benchmark">Device benchmark</a>
            <a href="/instructor">Instructor</a>
          </nav>
        }
      />
      <CapabilityRegistry />
      <details className="panel advanced-card">
        <summary>Archived release reports and dated measurements</summary>
        <p>
          Historical reports below retain their original wording and source
          scope. They do not describe current next-generation implementation or
          acceptance; use the capability registry above.
        </p>
        <p>
          Measured facts from a versioned validation manifest. Local LAN
          training prototype. Officer controls require authenticated sessions;
          trusted HTTPS protects network credentials. Illustrative parameters
          and training mastery estimates do not establish operational readiness.
        </p>
        <nav className="evidence-index" aria-label="Evidence categories">
          <a href="/system/compliance">
            <strong>Requirements & proof</strong>
            <small>
              Feature-specific working routes and acceptance records
            </small>
          </a>
          <a href="#candidate-evidence">
            <strong>Current candidate</strong>
            <small>
              Source freshness, regression and pending platform checks
            </small>
          </a>
          <a href="#historical-evidence">
            <strong>Historical measurements</strong>
            <small>
              Dated device, network and synthetic performance evidence
            </small>
          </a>
          <a href="/system/benchmark">
            <strong>Measure this device</strong>
            <small>
              Run a local rendering benchmark and export its samples
            </small>
          </a>
        </nav>
        {error && <p role="alert">{error}</p>}
        {data && (
          <>
            {data.finale && (
              <div id="candidate-evidence">
                <FinaleEvidence manifest={data.finale} />
              </div>
            )}
            <details
              className="panel advanced-card evidence-disclosure"
              id="historical-evidence"
            >
              <summary>
                Historical release validation and dated measurements
              </summary>
              <h2>
                {data.finale
                  ? "Historical release validation"
                  : "Validation status"}
              </h2>
              <p role="status">
                {data.acceptance} · {data.validated_at}
              </p>
              <p className={data.source_matches ? "status" : "amber-text"}>
                {data.freshness_note}
              </p>
              <table>
                <tbody>
                  <tr>
                    <th>Backend</th>
                    <td>{data.automated.backend_passed} passed</td>
                  </tr>
                  <tr>
                    <th>Frontend</th>
                    <td>{data.automated.frontend_passed} passed</td>
                  </tr>
                  {Object.entries(data.automated.parity).map(([k, v]) => (
                    <tr key={k}>
                      <th>{k} parity</th>
                      <td>{v} checkpoints</td>
                    </tr>
                  ))}
                  <tr>
                    <th>Production build</th>
                    <td>
                      {data.automated.build} · {data.automated.offline_assets}{" "}
                      cached assets
                    </td>
                  </tr>
                  <tr>
                    <th>Physical WAN-off</th>
                    <td>{data.physical.wan_off}</td>
                  </tr>
                  {data.physical.wan_off_reason && (
                    <tr>
                      <th>WAN test reason</th>
                      <td>{data.physical.wan_off_reason}</td>
                    </tr>
                  )}
                  {data.physical.architecture_claim && (
                    <tr>
                      <th>Architecture / LAN evidence</th>
                      <td>{data.physical.architecture_claim}</td>
                    </tr>
                  )}
                  <tr>
                    <th>Weak laptop</th>
                    <td>{data.physical.weak_laptop}</td>
                  </tr>
                  <tr>
                    <th>Physical device evidence</th>
                    <td>{data.physical.devices.join(" · ")}</td>
                  </tr>
                </tbody>
              </table>
            </details>
            <section className="panel advanced-card">
              <h2>Measured performance</h2>
              <p>
                Python CPU benchmark; browser FPS and physical device
                certification are separate measurements.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Contacts</th>
                    <th>Tick median / p95 ms</th>
                    <th>Ghost/replay ms</th>
                    <th>Traced peak MiB</th>
                  </tr>
                </thead>
                <tbody>
                  {data.performance.scale.scale?.map((r) => (
                    <tr key={r.contacts}>
                      <td>{r.contacts}</td>
                      <td>
                        {r.tick.median_ms} / {r.tick.p95_ms}
                      </td>
                      <td>{r.ghost_replay_scoring.median_ms.toFixed(2)}</td>
                      <td>{r.python_traced_peak_mib}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.performance.unit.advanced && (
                <>
                  <p>
                    {data.performance.unit.advanced.concurrent_clients}{" "}
                    simulated concurrent clients ·{" "}
                    {data.performance.unit.advanced.completed_sessions} verified
                    completions · loopback HTTP
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Request</th>
                        <th>Median ms</th>
                        <th>p95 ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(
                        data.performance.unit.advanced.http_ms,
                      ).map(([k, v]) => (
                        <tr key={k}>
                          <th>{k.replaceAll("_", " ")}</th>
                          <td>{v.median}</td>
                          <td>{v.p95}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {(
                [
                  ["Android / Chrome", data.performance.android],
                  ["Weakest laptop", data.performance.weak_laptop],
                ] as const
              ).map(
                ([name, report]) =>
                  report?.results && (
                    <div key={name}>
                      <h3>{name} · supplied device measurements</h3>
                      <p>{report.provenance}</p>
                      <table>
                        <thead>
                          <tr>
                            <th>Contacts</th>
                            <th>Final graphics / Auto</th>
                            <th>Median FPS</th>
                            <th>Worker median / p95 ms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.results.map((r) => (
                            <tr key={r.contacts}>
                              <td>{r.contacts}</td>
                              <td>
                                {r.graphics} /{" "}
                                {r.auto_quality ? "enabled" : "off"}
                              </td>
                              <td>{r.median_render_fps}</td>
                              <td>
                                {r.median_sim_tick_ms.toFixed(3)} /{" "}
                                {r.p95_sim_tick_ms.toFixed(3)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p>
                        Twenty-second workload. RAM fields are user-entered;
                        browser heap may be privacy-rounded. FPS is not
                        long-duration certification.
                      </p>
                    </div>
                  ),
              )}
            </section>
            <section className="panel advanced-card">
              <h2>
                SIMULATED TRAINING EXPERIMENT — NOT HUMAN EFFICACY EVIDENCE
              </h2>
              <p>{data.experiment.method}</p>
              <table>
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Mastery reached</th>
                    <th>Median sessions among reached</th>
                    <th>Final hidden mean</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.experiment.summary ?? {}).map(
                    ([k, v]) => (
                      <tr key={k}>
                        <th>{k}</th>
                        <td>
                          {v.reached_threshold}/{v.learners}
                        </td>
                        <td>{v.median_sessions_among_reached}</td>
                        <td>{v.mean_final_hidden_performance.toFixed(4)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <p>
                Small mean difference under an abstract learner model. No human
                efficacy study conducted.
              </p>
            </section>
            <section className="panel advanced-card">
              <h2>Remaining limitations</h2>
              <ul>
                {data.remaining.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </details>
    </main>
  );
}
