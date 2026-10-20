"""Read-only hypothetical branches and an evidence-constrained reference policy."""
import copy
import hashlib
from fastapi import APIRouter,HTTPException
from pydantic import Field
from .models import Action,StrictModel
from .engine import HZ,replay,score,engagement_rule
from .review import evidence
from .storage import connect,dumps

router=APIRouter(prefix='/api/v1')
class Alternative(StrictModel):
    decision_index:int=Field(ge=0,le=4999)
    action:Action

def reference_choice(ev,t,rules):
    """Reads observed cues and trainee declarations, never canonical identity/kind/RF."""
    cues=[]
    if ev['rf']['iff']=='friendly_reply':
        cues.append('A working IFF sensor returned a friendly reply')
        return {'action':'hold','confidence':'supported','cues':cues,'basis':'available_evidence'}
    if ev['rf']['iff']=='registered_civil':
        return {'action':'hold','confidence':'supported','cues':['Current modeled registration beacon is civil; verify identity'],'basis':'available_evidence'}
    if ev['visual']['available'] and ev['visual']['silhouette']=='bird':
        return {'action':'hold','confidence':'supported','cues':['Current optical silhouette is bird-like'],'basis':'available_evidence'}
    if ev['prior_identity']!='hostile':
        return {'action':'hold','confidence':'uncertain','cues':['Hostile identity has not been established by the recorded operator; no reply is not hostility'],'basis':'available_evidence'}
    if ev['range_m'] is None:
        return {'action':'hold','confidence':'uncertain','cues':['No observed range supports an engagement'],'basis':'available_evidence'}
    if ev['rf']['available'] and ev['rf']['signal'] and ev['range_m']<=rules.get('rf_range',180) and 'rf_jam' in rules.get('effectors',['hold','rf_jam','kinetic']):
        return {'action':'rf_jam','confidence':'conditional','cues':['Operator declared hostile identity','Current RF link observed','Observed range within frozen jammer limit'],'basis':'available_evidence'}
    # Absence of RF detection does not prove a fiber link. A no-RF response is
    # conditional on an explicit prior operator classification and current ROE.
    if ev['prior_classification']=='fiber_fpv' and ev['visual']['available'] and ev['range_m']<=rules.get('kinetic_range',160) and ev['restricted'] is False and 'kinetic' in rules.get('effectors',['hold','rf_jam','kinetic']):
        return {'action':'kinetic','confidence':'conditional','cues':['Operator declared hostile no-RF FPV','Current visual observation','Observed range and frozen restricted-sector rule permit kinetic'],'basis':'available_evidence'}
    return {'action':'hold','confidence':'uncertain','cues':['Available observations do not support a permitted response; continue observing'],'basis':'available_evidence'}

def branch(scenario,actions,commands,end_tick,index,alternative):
    if not 0<=index<len(actions):raise ValueError('Choose an existing recorded decision')
    original=actions[index]
    if alternative['tick']!=original['tick'] or alternative['track']!=original['track']:
        raise ValueError('Alternative must use the selected recorded decision tick and contact')
    if alternative['k']!=original['k']:raise ValueError('Alternative must replace the same decision stage')
    target_order=original.get('order',index)
    prefix=actions[:index]
    prefix_commands=[c for c in commands if (c['tick'],c['order'])<(original['tick'],target_order)]
    sim=replay(scenario,prefix,original['tick'],prefix_commands)
    t=next((t for t in sim.tracks if t['id']==original['track']),None)
    if t is None:raise ValueError('Contact is absent at this decision boundary')
    ev=evidence(sim,t)
    policy=reference_choice(ev,t,scenario.get('doctrine',{}).get('rules',{}))
    alt={**alternative,'order':target_order}
    if not sim.act(alt):raise ValueError('Alternative action is impossible at the recorded boundary')
    remaining=[{'tick':a['tick'],'order':a.get('order',i),'action':a} for i,a in enumerate(actions) if i>index]
    remaining += [{'tick':c['tick'],'order':c['order'],'command':c} for c in commands if c not in prefix_commands]
    remaining.sort(key=lambda e:(e['tick'],e['order']))
    rejected=[];cursor=0
    while sim.tick<=end_tick:
        while cursor<len(remaining) and remaining[cursor]['tick']==sim.tick:
            entry=remaining[cursor];cursor+=1
            if 'command' in entry:
                if not sim.control(entry['command']):
                    raise ValueError('Recorded instructor command is invalid in the hypothetical branch')
            elif not sim.act(entry['action']):
                rejected.append({'tick':entry['tick'],'order':entry['order'],'action':entry['action'],'reason':'No longer valid after hypothetical branch'})
        if sim.tick==end_tick:break
        sim.step(force=True)
    original_card=score(replay(scenario,actions,end_tick,commands))
    hypothetical=score(sim)
    fingerprint=hashlib.sha256(dumps({'scenario':scenario,'actions':actions,'commands':commands,'index':index,'alternative':alt,'end':end_tick}).encode()).hexdigest()
    return {'kind':'counterfactual','branch_id':'whatif_'+fingerprint[:24],'original_score':original_card,'hypothetical_score':hypothetical,'delta':hypothetical['score']-original_card['score'],'rejected_later_actions':rejected,'evidence_at_branch':ev,'reference_policy':policy,'alternative':alt,'note':'Hypothetical simulated branch. Original history, score and skills are unchanged. Subsequent recorded actions are attempted only when still valid. Reference is an inspectable training policy, not a certified human military expert.'}

@router.post('/sessions/{sid}/what-if')
def what_if(sid:str,req:Alternative):
    from .main import session_record,logged_events,applied_commands
    with connect() as db:
        row=session_record(db,sid)
        if row['status']!='completed':raise HTTPException(409,'What-if requires a completed frozen session')
        import json
        scenario=json.loads(row['spec']);actions=logged_events(db,sid);commands=applied_commands(db,sid)
        end_tick=row['end_tick']
    try:return branch(scenario,actions,commands,end_tick,req.decision_index,req.action.model_dump(exclude_none=True))
    except ValueError as e:raise HTTPException(422,str(e)) from e
