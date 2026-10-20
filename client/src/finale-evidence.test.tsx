import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import FinaleEvidence, { type FinaleManifest } from "./FinaleEvidence";
const candidate: FinaleManifest = {
  acceptance: "CANDIDATE; final acceptance pending",
  branch: "feature/vyuha-finale-edition",
  source_matches: false,
  historical_wan: {
    status: "Historical team report",
    reported_scope: "Exact Finale build not tested physically",
  },
  remaining: ["Native platform execution pending"],
  tests: {
    backend: { passed: 453, failed: 0 },
    frontend: { passed: 132, failed: 0 },
    production_build: "PASS",
    offline_assets: 26,
    offline_cache: "synthetic-cache",
  },
  independent_audit: {
    status: "PROVISIONAL",
    score: 81,
    final_score: null,
    scoped_pass: 51,
    partial: 41,
    not_applicable: 1,
  },
};
test("candidate evidence displays current receipts without turning provisional score or stale source into acceptance", () => {
  const html = renderToStaticMarkup(<FinaleEvidence manifest={candidate} />);
  assert.match(html, /453 passed/);
  assert.match(html, /132 passed/);
  assert.match(html, /source changed/);
  assert.match(html, /81\/100/);
  assert.match(html, /Final audit: pending/);
  assert.match(html, /does not confer stable release approval/);
  assert.match(html, /prior version/);
});
