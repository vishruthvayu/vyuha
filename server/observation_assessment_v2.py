"""Evidence-assessment-v2 adds declared uncertainty, without rewriting v1 criteria."""
import copy
from . import observation_assessment as prior
from .observation_missions_v2 import validate_mission
from .engine_v4 import replay
VERSION='evidence-assessment-v2'
CRITERIA=copy.deepcopy(prior.CRITERIA)
for profile in CRITERIA:
    CRITERIA[profile]['C03']='Record an explicit restraint/defer choice against the public evidence at this boundary. Declared reasons are not private reasoning, and inactivity is not a declaration.'
LIMITATIONS=[x for x in prior.LIMITATIONS if 'unclassified defer choice' not in x]+[
 'Defer records a decision to withhold a new classification or response, with a trainee-declared reason. It does not erase earlier declarations, designate, resolve a contact or award tactical points.',
 'A declared uncertainty reason does not establish attention, private reasoning or cognitive reliance. Conflict interpretation is not calibrated.'
]
def contract(scenario):
    validate_mission(scenario)
    return scenario['observation_mission']
def interpret(action,facts,profile):
    if action['k']!='defer':return prior.interpret(action,facts,profile)
    o=facts['observation'];iff=o.get('iff',{});positive=iff.get('cue') if iff.get('available') else None
    shapes={o.get(c,{}).get('silhouette') for c in ('eo','ir') if o.get(c,{}).get('available') and o[c].get('level') in ('recognise','identify')}
    refs=[f"{c}:{facts['track']}:{facts['tick']}" for c in ('radar','rf','iff') if o.get(c,{}).get('available')]+[r['resultId'] for r in facts['current_optical_results']]
    reason=action['reason']
    if reason=='affiliation_unresolved':
        status='supported' if positive not in ('friendly_reply','registered_civil') and 'bird' not in shapes else 'inconclusive'
        text='The declaration retains unresolved affiliation; no positive affiliation cue is available.' if status=='supported' else 'A positive non-hostile cue is present. Deferral is recorded, but the declared unresolved affiliation does not establish how that cue was interpreted.'
    elif reason=='type_unresolved':
        status='supported' if not any(shapes) else 'inconclusive'
        text='Current reports do not supply a recognized optical category. The trainee explicitly withheld a new declaration.' if status=='supported' else 'Current shape detail is present, but it need not settle the control medium. The declaration alone does not prove why the trainee remained uncertain.'
    else:
        status='inconclusive';text='The trainee explicitly reported conflicting evidence. This contract does not infer which reports they cognitively compared or certify that conflict.'
    return [prior.finding('restraint',status,'EXPLICIT_UNCERTAINTY_DECLARED',text,refs)]
def assess_mission(scenario,actions,commands,sid,observed_end):
    return prior.assess_mission(scenario,actions,commands,sid,observed_end,_contract=contract,_interpret=interpret,_replay=replay,_version=VERSION,_criteria=CRITERIA,_limitations=LIMITATIONS,_follow_suffix='&mission_version=2')
