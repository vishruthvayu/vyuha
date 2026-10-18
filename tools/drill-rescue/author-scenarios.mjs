// Officer-authored library scenarios for visual acceptance (local disposable DB).
// The password is read from a file and never printed.
import { readFileSync } from 'node:fs';
const [APP, pwFile] = process.argv.slice(2);
const password = readFileSync(pwFile, 'utf8').trim();
const j = async (path, body, token, method = 'POST') => { const r = await fetch(APP + '/api/v1' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + t.slice(0, 300)); return t ? JSON.parse(t) : null; };
const { token } = await j('/auth/login', { password });
const specs = [
  { name: 'Rural forward base day', terrain: 'rural', night: false, tactic: 'STAGGERED_WAVES', mix: ['bird', 'friendly_uav', 'hostile_quad', 'no_rf_fpv', 'fixed_wing'] },
  { name: 'Rural forward base night', terrain: 'rural', night: true, tactic: 'STAGGERED_WAVES', mix: ['bird', 'friendly_uav', 'hostile_quad', 'no_rf_fpv', 'fixed_wing'] },
  { name: 'Urban outpost night', terrain: 'urban', night: true, tactic: 'STAGGERED_WAVES', mix: ['bird', 'friendly_uav', 'hostile_quad', 'no_rf_fpv', 'fixed_wing'] },
  { name: 'Urban outpost day mixed', terrain: 'urban', night: false, tactic: 'STAGGERED_WAVES', mix: ['bird', 'friendly_uav', 'hostile_quad', 'no_rf_fpv', 'fixed_wing', 'hostile_quad'] },
];
const have = (await j('/scenario-library', null, token, 'GET')).scenarios.map(s => s.title);
for (const s of specs) {
  if (have.includes(s.name)) { console.log('exists', s.name); continue; }
  const r = await j('/scenario-library', { schema_version: 2, fog: 0.15, seed: 482913, focus: 'classification_iff', ...s }, token);
  console.log('saved', r.id, r.title, r.terrain_id, r.night ? 'night' : 'day', r.tracks.length, 'tracks');
}
await j('/auth/logout', {}, token).catch(() => {});
