import React from "react";
export type FinaleManifest = {
  acceptance: string;
  branch: string;
  candidate_commit?: string;
  source_matches?: boolean;
  source_tree_sha256?: string;
  historical_wan: { status: string; reported_scope: string };
  remaining: string[];
  tests?: {
    backend: { passed: number; failed: number };
    frontend: { passed: number; failed: number };
    production_build: string;
    offline_assets: number;
    offline_cache: string;
  };
  independent_audit?: {
    status: string;
    score: number;
    final_score: number | null;
    scoped_pass: number;
    partial: number;
    not_applicable: number;
  };
};
export default function FinaleEvidence({
  manifest,
}: {
  manifest: FinaleManifest;
}) {
  return (
    <section className="panel advanced-card">
      <h2>Finale candidate — release validation in progress</h2>
      <p>
        {manifest.acceptance} · {manifest.branch}
      </p>
      {manifest.candidate_commit && (
        <p>Candidate checkpoint: {manifest.candidate_commit}</p>
      )}
      {manifest.source_matches !== undefined && (
        <p className={manifest.source_matches ? "status" : "amber-text"}>
          {manifest.source_matches
            ? "Candidate source hash matches this checkout."
            : "Candidate source changed after these measurements; repeat affected validation before release."}
        </p>
      )}
      {manifest.tests && (
        <table>
          <tbody>
            <tr>
              <th>Candidate backend</th>
              <td>
                {manifest.tests.backend.passed} passed ·{" "}
                {manifest.tests.backend.failed} failed
              </td>
            </tr>
            <tr>
              <th>Candidate frontend</th>
              <td>
                {manifest.tests.frontend.passed} passed ·{" "}
                {manifest.tests.frontend.failed} failed
              </td>
            </tr>
            <tr>
              <th>Candidate production build</th>
              <td>
                {manifest.tests.production_build} ·{" "}
                {manifest.tests.offline_assets} local assets · cache{" "}
                {manifest.tests.offline_cache}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {manifest.independent_audit && (
        <p>
          Independent assessment: {manifest.independent_audit.score}/100 ·{" "}
          {manifest.independent_audit.status}. Final audit:{" "}
          {manifest.independent_audit.final_score === null
            ? "pending"
            : `${manifest.independent_audit.final_score}/100`}
          . Passing software checks does not confer stable release approval.
        </p>
      )}
      <p>
        Historical physical WAN-off evidence: {manifest.historical_wan.status}.{" "}
        {manifest.historical_wan.reported_scope}
      </p>
      <h3>Candidate acceptance still open</h3>
      <ul>
        {manifest.remaining.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        The release measurements below belong to the prior version; they do not
        certify the new Finale systems.
      </p>
    </section>
  );
}
