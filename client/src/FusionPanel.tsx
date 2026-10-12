import {useEffect,useMemo} from 'react';
import {fusionAdvice,type FusionConfig,type FusionContext,type FusionAdvice,type OperatorPrior} from './fusion';
import type {SensorObservation} from './sensors-v2';
export type FusionPanelProps={observation?:SensorObservation|null;prior?:OperatorPrior;config?:Partial<FusionConfig>|null;context:FusionContext;onExposure?:(advice:FusionAdvice|null)=>void};
const LABEL={bird:'Bird',quad:'RF-controlled quad',fixed_wing:'Fixed-wing',fiber_fpv:'No-RF FPV'};
/** Parent captures the latest displayed advice before an accepted decision, then
 * uploads a separate receipt after its accepted event stream. No Action mutation.
 * Undefined config is OFF; assessment clears the previous display/exposure.
 */
export function FusionPanel({observation,prior,config,context,onExposure}:FusionPanelProps){
  const result=useMemo(()=>observation&&config?fusionAdvice(observation,prior,config,context):null,[observation,prior,config,context]);
  useEffect(()=>{onExposure?.(result);},[result?.exposure_id,onExposure]);
  if(!result) return null;
  return <aside className="panel fusion-panel" aria-label="Fusion training assistant">
    <h3>Fusion Assistant <small>Training heuristic</small></h3>
    {result.bias_injected&&<p role="note"><strong>Automation-bias exercise</strong> — this deliberately biased suggestion may be wrong. Check the observed cues.</p>}
    <p><strong>{result.recommendation==='hold'?'Hold and verify the affiliation cue':result.recommendation==='verify_identity'?'Verify identity before selecting a response':'Continue observation'}</strong>. Identity: {result.identity==='unresolved'?'Unresolved':result.identity==='friendly_cue'?'Friendly IFF cue':'Registered civil cue'}.</p>
    <p>Type hypothesis weights · uncertainty {Math.round(result.uncertainty*100)}%</p>
    <ol>{result.hypotheses.map(h=><li key={h.kind}>{LABEL[h.kind]} — {Math.round(h.score*100)}%</li>)}</ol>
    <details open><summary>Why this suggestion?</summary><ul>{result.contributions.map(c=><li key={c.cue}>{c.reason} <small>Type weight changes: {c.weights.map((w,i)=>`${LABEL[(['bird','quad','fixed_wing','fiber_fpv'] as const)[i]]} ${w>=0?'+':''}${w}`).join(', ')}</small></li>)}</ul></details>
    <p className="muted">Illustrative normalized weights, not calibrated probabilities. No RF or IFF reply does not establish hostile intent. The operator makes the decision.</p>
  </aside>;
}
export default FusionPanel;
