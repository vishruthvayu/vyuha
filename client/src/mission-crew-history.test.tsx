import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CrewHistoryResults, type CrewHistoryData } from './CrewOfficerTools';

test('portable roster history distinguishes signed cohorts from unbound legacy exercises', () => {
  const data = {
    included_sessions: 4,
    scope: 'Imported groups never restore live membership or match local labels.',
    interpretation: 'No individual competence or Beta profile credit.',
    timing_basis: 'Accepted logical ticks.',
    sessions: [],
    groups: [
      { group_id: 'cohort', name: 'Pseudonymous shared crew', source: 'imported_pseudonymous_archive', grouping_basis: 'Signed pseudonymous source roster cohort', session_count: 3, median_designation_to_classification_s: .4, median_classification_to_response_s: null, members: [{ callsign: 'CCM_private-pseudonym', role: 'spotter', accepted_actions: 3 }] },
      { group_id: 'legacy', name: 'Pseudonymous shared crew', source: 'imported_pseudonymous_archive', grouping_basis: 'Legacy archive; no cross-exercise roster binding', session_count: 1, median_designation_to_classification_s: null, median_classification_to_response_s: null, members: [] },
    ],
  } as CrewHistoryData;
  const before = JSON.stringify(data);
  const html = renderToStaticMarkup(<CrewHistoryResults data={data} />);
  assert.match(html, /Signed pseudonymous source roster cohort/);
  assert.match(html, /Legacy archive; no cross-exercise roster binding/);
  assert.match(html, /3 sessions/);
  assert.match(html, /1 sessions/);
  assert.match(html, /No individual competence or Beta profile credit/);
  assert.equal(JSON.stringify(data), before);
});
