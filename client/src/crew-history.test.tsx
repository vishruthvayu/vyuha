import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CrewHistoryResults, type CrewHistoryData } from "./CrewOfficerTools";
const metrics = {
  accepted_actions: 3,
  attributed_actions: 3,
  unattributed_actions: 0,
  contacts_with_actions: 1,
  members: [
    {
      member_id: "A",
      callsign: "WATCH",
      role: "spotter",
      accepted_actions: 1,
      designations: 1,
      classifications: 0,
      responses: 0,
    },
  ],
  median_designation_to_classification_s: 0.4,
  median_classification_to_response_s: null,
  timing_basis: "Accepted logical ticks",
  interpretation: "No individual skill credit",
};
const data = {
  included_sessions: 1,
  scope: "Completed shared history",
  interpretation: "Descriptive labels, not individual competence",
  timing_basis: "Logical ticks exclude pauses",
  sessions: [
    {
      session_id: "shared & id",
      name: "Unit crew",
      source: "local_crew",
      created_at: "2026-10-12",
      completed_at: null,
      scenario: { title: "Raid", family: "DIRECT", difficulty: "standard" },
      scorecard: { score: 50 },
      coordination_metrics: metrics,
      coordination_timeline: [
        {
          tick: 30,
          order: 1,
          k: "designate",
          track: "T1",
          callsign: "WATCH",
          role: "spotter",
          attributed: true,
        },
        {
          tick: 42,
          order: 2,
          k: "classify",
          track: "T1",
          callsign: "RESP",
          role: "responder",
          attributed: true,
        },
      ],
      timeline_total_actions: 2,
      timeline_truncated: false,
    },
  ],
  groups: [
    {
      group_id: "one",
      name: "Unit crew",
      source: "local_crew",
      session_count: 1,
      median_designation_to_classification_s: 0.4,
      median_classification_to_response_s: null,
      members: [{ callsign: "WATCH", role: "spotter", accepted_actions: 1 }],
    },
  ],
} as unknown as CrewHistoryData;
test("crew history shows accepted logical order, attributed roles and separately shared score", () => {
  const before = JSON.stringify(data),
    html = renderToStaticMarkup(<CrewHistoryResults data={data} />);
  assert.match(html, /T\+1.00s · #1/);
  assert.match(html, /T\+1.40s · #2/);
  assert.match(html, /WATCH · spotter/);
  assert.match(html, /RESP · responder/);
  assert.match(html, /shared 50\/100/);
  assert.match(html, /not individual competence/);
  assert.match(html, /session=shared\+%26\+id&amp;review=officer/);
  assert.equal(JSON.stringify(data), before);
});
test("bounded crew timeline explicitly discloses truncation and absent handoff pairs", () => {
  const item = structuredClone(data);
  item.sessions[0].timeline_truncated = true;
  item.sessions[0].timeline_total_actions = 101;
  const html = renderToStaticMarkup(<CrewHistoryResults data={item} />);
  assert.match(html, /latest 100 of 101/);
  assert.match(html, /No recorded pair/);
  assert.match(html, /complete log/);
});
