// Inject axe-core into a CDP-connected page and return WCAG 2.0-2.2 A/AA violations.
import { readFileSync } from 'node:fs';
const AXE = readFileSync(new URL('../../client/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
export async function axeRun(c, include = 'body') {
  await c.ev(`(() => { if (!window.axe) { const s = document.createElement('script'); s.textContent = ${JSON.stringify(AXE)}; document.head.appendChild(s); } return true; })()`);
  return c.ev(`axe.run(document.querySelector(${JSON.stringify(include)}) || document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 4).map(n => n.target.join(' ')), summary: v.nodes[0]?.failureSummary?.slice(0, 220) })))`);
}
