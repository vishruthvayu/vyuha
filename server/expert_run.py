"""Completed-session autonomous reference rollouts, never a live weapons adviser.

Pure/read-only: no database, profile, credential, network or event-write APIs.
Canonical mode explicitly uses after-AAR reference truth. Evidence-only decisions
receive a sanitized observable projection and abstain from unidentified intent.
Neither mode represents a certified human expert, an optimum or learning efficacy.
"""
import copy
import hashlib
import math
import json
from .engine import HZ,Simulation,replay,score,engagement_rule,ideal

VERSION='expert-run-1'
MODES={'canonical_reference','evidence_only'}
MAX_ACTIONS=5000
MAX_WAIT_ENTRIES=6000
MAX_ATTEMPTS_PER_CONTACT=3
RETRY_INTERVAL_TICKS=30

class UnsupportedArchivedContract(ValueError):
    reason_code='ARCHIVED_CONTRACT_UNSUPPORTED'


def _position(value):
    if not isinstance(value,dict) or not all(isinstance(value.get(k),(int,float)) and not isinstance(value[k],bool) and math.isfinite(value[k]) for k in ['x','z']):return None
    return {k:value[k] for k in ['x','z']}


def _sample_current(channel,tick,age):
    t=channel.get('sample_tick')
    return channel.get('available') is True and isinstance(t,int) and not isinstance(t,bool) and 0<=tick-t<=age


def observe_contact(sim,track):
    """A deliberately narrower observation than the legacy historical range UI.
    v0.4 never reads canonical kind/identity/rf/x/z. Legacy displayed RF/IFF and
    optical silhouette are projected by the frozen legacy evidence adapter; its
    historical current-position range is suppressed unless a sensor sees it now.
    """
    o=track.get('observation')
    if isinstance(o,dict) and o.get('version')=='vyuha-0.4.0':
        positions=[];shapes=[]
        for name in ['eo','ir']:
            channel=o.get(name,{})
            if _sample_current(channel,sim.tick,6) and channel.get('level') in ['detect','recognise','identify']:
                pos=_position(channel.get('position'))
                if pos:positions.append(pos)
                if channel.get('level')!='detect' and channel.get('silhouette') in ['bird','multirotor','fixed_wing']:shapes.append(channel['silhouette'])
        r=o.get('radar',{})
        if not positions and _sample_current(r,sim.tick,90) and r.get('state')=='confirmed':
            pos=_position(r.get('position'))
            if pos:positions.append(pos)
        shape=shapes[0] if shapes and len(set(shapes))==1 else None
        rf=o.get('rf',{});iff=o.get('iff',{})
        signal=rf.get('detected') is True if rf.get('available') is True else None
        cue=iff.get('cue') if iff.get('available') is True and iff.get('cue') in ['friendly_reply','registered_civil','no_reply'] else 'unavailable'
        pos=positions[0] if positions else None
    else:
        from .review_v1_0_1 import evidence
        ev=evidence(sim,track)
        current=bool(ev['radar']['detected'] or ev['visual']['available'])
        pos=_position(track) if current else None
        shape=ev['visual']['silhouette'] if ev['visual']['available'] else None
        signal=ev['rf']['signal'] if ev['rf']['available'] else None
        cue=ev['rf']['iff'] if ev['rf']['available'] else 'unavailable'
    rules=sim.scenario.get('doctrine',{}).get('rules',{})
    zone=rules.get('restricted',dict(enabled=True,x_lt=-30,z_gt=20))
    return dict(track_id=track['id'],tick=sim.tick,geometry_available=pos is not None,
                range_m=math.hypot(pos['x'],pos['z']) if pos else None,
                restricted=bool(zone['enabled'] and pos['x']<zone['x_lt'] and pos['z']>zone['z_gt']) if pos else None,
                silhouette=shape,rf_signal=signal,iff=cue)


def evidence_policy(observation):
    """No track/scenario object accepted. No IFF/RF silence-to-hostility rule.
    The current sensor contract lacks an independent hostile-intent observation.
    Positive supported non-hostile labels allow Hold; ambiguous types abstain.
    """
    shape=observation.get('silhouette');cue=observation.get('iff');signal=observation.get('rf_signal')
    if not observation.get('geometry_available'):
        return dict(kind=None,identity=None,effector=None,basis='No current measured geometry; wait for an observation.')
    if shape=='bird' and cue!='friendly_reply':
        return dict(kind='bird',identity='neutral',effector='hold',basis='Current bird-like optical shape supports a conservative non-hostile Hold.')
    identity='friendly' if cue=='friendly_reply' else 'neutral' if cue=='registered_civil' else None
    if identity is None:
        return dict(kind=None,identity=None,effector=None,basis='Identity unresolved: no reply and RF silence do not establish hostility or fiber control.')
    if shape=='fixed_wing':
        return dict(kind='fixed_wing',identity=identity,effector='hold',basis='Current fixed-wing shape plus positive affiliation cue supports Hold.')
    if shape=='multirotor' and signal is True:
        return dict(kind='quad',identity=identity,effector='hold',basis='Current multirotor shape, RF emission and positive affiliation cue support provisional quad labeling and Hold; control medium is not proven.')
    return dict(kind=None,identity=None,effector=None,basis='Positive affiliation cue supports caution; contact type remains unresolved, so the classification action is withheld.')


def resource_ready(sim,track_id,effector):
    state=getattr(sim,'response_state',None)
    if state is None:return True
    if any(a['track']==track_id and a['status']=='pending' for a in state['attempts']):return False
    if effector=='kinetic':return state['kinetic_ammo_remaining']>0 and sim.tick>=state['kinetic_ready_tick']
    if effector=='rf_jam':return sum(a['status']=='pending' and a['effector']=='rf_jam' for a in state['attempts'])<state['config']['jammer_channels']
    return True


def _rank(track):
    rules=track.get('rules',{})
    risk=rules.get('risk_weights',{}).get(track['kind'],1)*rules.get('asset_risk',1)
    tti=max(1/HZ,(math.hypot(track['x'],track['z'])-8)/max(track['speed'],.01))
    return (-risk/tti,track['id'])


def _rollout(scenario,commands,end_tick,mode):
    sim=Simulation(copy.deepcopy(scenario));order=0;cursor=0;timeline=[];held=set();last_attempt={};waits={};wait_entries=0;omitted_wait_entries=0
    ordered_commands=sorted(copy.deepcopy(commands),key=lambda c:(c['tick'],c['order']))
    def note(track_id,reason):
        nonlocal wait_entries,omitted_wait_entries
        if waits.get(track_id)==reason:return
        waits[track_id]=reason
        if wait_entries>=MAX_WAIT_ENTRIES:
            omitted_wait_entries+=1;return
        wait_entries+=1
        timeline.append(dict(tick=sim.tick,category='policy_wait',track=track_id,basis=reason))
    def action(track_id,action_kind,basis,**fields):
        nonlocal order
        if len(sim.events)>=MAX_ACTIONS:raise ValueError('Reference action limit exceeded')
        a=dict(tick=sim.tick,order=order,k=action_kind,track=track_id,**fields)
        if not sim.act(a):return False
        order+=1;timeline.append(dict(tick=sim.tick,order=a['order'],category='reference_action',action=copy.deepcopy(a),basis=basis));return True
    while sim.tick<=end_tick:
        while cursor<len(ordered_commands) and ordered_commands[cursor]['tick']==sim.tick:
            c={**ordered_commands[cursor],'order':order};cursor+=1
            if not sim.control(c):raise ValueError('Applied command cannot be replayed in the reference rollout')
            order+=1;timeline.append(dict(tick=sim.tick,order=c['order'],category='applied_command_replay',command=copy.deepcopy(c),basis='Original applied payload/sequence/tick; hypothetical rollout order.'))
        if not sim.paused and sim.tick<scenario['duration']*HZ:
            observed=[]
            for t in sim.tracks:
                if not t['active']:continue
                ev=observe_contact(sim,t)
                # Never designate a canonical unseen contact in either mode.
                if ev['geometry_available']:
                    observed.append((t,ev))
                    if t['designated'] is None:action(t['id'],'designate','Current working sensor geometry.')
                if t['designated'] is None:continue
                if mode=='canonical_reference':
                    if t['classification']!=t['kind'] or t['declared']!=t['identity']:
                        action(t['id'],'classify','After-AAR canonical rubric reference truth.',kind=t['kind'],identity=t['identity'])
                else:
                    proposal=evidence_policy(ev)
                    if proposal['kind'] is None:note(t['id'],proposal['basis']);continue
                    if t['classification']!=proposal['kind'] or t['declared']!=proposal['identity']:
                        action(t['id'],'classify',proposal['basis'],kind=proposal['kind'],identity=proposal['identity'])
            candidates=[t for t in sim.tracks if t['active'] and t['designated'] is not None and t['classification'] is not None]
            if mode=='canonical_reference':candidates.sort(key=_rank)
            else:
                visible={t['id']:ev for t,ev in observed}
                candidates=[t for t in candidates if t['id'] in visible]
                candidates.sort(key=lambda t:(visible[t['id']]['range_m'],t['id']))
            for t in candidates:
                if mode=='canonical_reference':
                    effector=ideal(t);basis='After-AAR canonical type/link/identity and current range/ROE rubric reference.'
                    rule=engagement_rule(t,effector)
                    if not rule['allowed'] or not rule['in_range'] or rule['restricted']:note(t['id'],'Frozen range/ROE or allowed-effector constraint requires waiting.');continue
                else:
                    proposal=evidence_policy(visible[t['id']]);effector=proposal['effector'];basis=proposal['basis']
                    if effector is None:continue
                    rules=scenario.get('doctrine',{}).get('rules',{})
                    # Evidence-only emits Hold only, never an unsupported destructive choice.
                    hold_in_range=rules.get('hold_any_range',False) or visible[t['id']]['range_m']<=rules.get('rf_range',180)
                    if 'hold' not in rules.get('effectors',['hold','rf_jam','kinetic']) or not hold_in_range:continue
                if effector=='hold':
                    if t['id'] not in held and action(t['id'],'engage',basis,effector='hold'):held.add(t['id'])
                    continue
                attempts=sum(a['k']=='engage' and a['track']==t['id'] and a['effector']!='hold' for a in sim.events)
                if attempts>=MAX_ATTEMPTS_PER_CONTACT:note(t['id'],'Bounded reference retry budget exhausted.');continue
                if sim.tick-last_attempt.get(t['id'],-RETRY_INTERVAL_TICKS)<RETRY_INTERVAL_TICKS:continue
                if not resource_ready(sim,t['id'],effector):note(t['id'],'Pending effect, finite ammunition, cooldown or jammer-channel availability requires waiting.');continue
                if action(t['id'],'engage',basis,effector=effector):last_attempt[t['id']]=sim.tick
        if sim.tick==end_tick:break
        # Match authoritative command replay: paused logical ledger gaps advance
        # with force, while policy actions remain suppressed until a resume.
        sim.step(force=True)
    if cursor!=len(ordered_commands):raise ValueError('Applied command outside the rollout horizon')
    return sim,timeline,omitted_wait_entries


def run_completed_session(record,mode='canonical_reference'):
    """Input: status,scenario,events,commands,end_tick, execution_tick(optional),
    scorecard(required). The route must supply these from the frozen completed row.
    """
    if record.get('status')!='completed':raise ValueError('Expert Run requires a completed frozen session')
    if mode not in MODES:raise ValueError('Unsupported Expert Run mode')
    scenario=copy.deepcopy(record['scenario']);events=copy.deepcopy(record.get('events',[]));commands=copy.deepcopy(record.get('commands',[]));end_tick=record['end_tick']
    if len(events)>MAX_ACTIONS or len(commands)>1000:raise ValueError('Recorded input exceeds bounded rollout limits')
    stored=record.get('scorecard')
    if not isinstance(stored,dict):raise ValueError('Stored completed scorecard is required')
    if stored.get('engine_version') not in ['vyuha-0.2.0','vyuha-0.3.0','vyuha-0.4.0']:
        raise UnsupportedArchivedContract('Archived score contract is unsupported for a validated Expert Run; original card must remain unchanged.')
    original=score(replay(scenario,events,end_tick,commands))
    if stored!=original:raise ValueError('Stored original score disagrees with frozen reconstruction; original card is not rewritten')
    observed=record.get('execution_tick')
    if observed is not None and (type(observed) is not int or not 0<=observed<=end_tick):raise ValueError('Invalid observed horizon')
    sim,timeline,omitted_wait_entries=_rollout(scenario,commands,end_tick,mode);reference=score(sim)
    fingerprint=hashlib.sha256(json.dumps(dict(version=VERSION,scenario=scenario,events=events,commands=commands,end_tick=end_tick,observed_end_tick=observed,mode=mode),sort_keys=True,separators=(',',':')).encode()).hexdigest()
    limits=[
        'Autonomous inspectable training policy; not a certified human expert, an optimal policy or measured learning advantage.',
        'Identical frozen scenario and applied command payloads/sequence/logical ticks; commands run before autonomous choices at each tick with fresh unique orders. Original trainee-action interleaving is not retained.',
        'Full frozen scoring horizon is compared. Effects after the original observed execution horizon are projected simulation outcomes, not physical observations.',
        'Recorded pause gaps advance under authoritative replay logical-clock semantics; no wall-clock pause duration is invented. Autonomous actions are suppressed while paused.',
        'At most three destructive attempts per contact, at least 30 logical ticks between retries; resources/delays/seeded effects remain those of the frozen engine.',
    ]
    if omitted_wait_entries:limits.append(f'{omitted_wait_entries} repeated policy wait transitions omitted after the bounded wait timeline budget; accepted actions and applied commands remain complete.')
    limits.append('Canonical mode deliberately consults after-AAR reference kind, affiliation and control-link truth; never present this mode as live sensor-derived advice.' if mode=='canonical_reference' else 'Evidence-only mode uses observed geometry, silhouette/RF/IFF cues and its own recorded labels. Missing IFF/RF reply does not establish hostile intent or fiber control; unresolved contacts remain unclassified. Positive multirotor/RF/affiliation quad labels are provisional, not calibrated recognition.')
    return dict(version=VERSION,mode=mode,basis='AFTER-AAR CANONICAL RUBRIC REFERENCE TRUTH' if mode=='canonical_reference' else 'EVIDENCE-ONLY AUTONOMOUS CONSERVATIVE TRAINING POLICY',original_score=original,reference_score=reference,delta=reference['score']-original['score'],reference_actions=copy.deepcopy(sim.events),reference_commands=copy.deepcopy(sim.commands),timeline=timeline,omitted_wait_entries=omitted_wait_entries,rollout_horizon=dict(scoring_end_tick=end_tick,original_observed_end_tick=observed,reference_is_hypothetical=True),fingerprint=fingerprint,original_history_unchanged=True,limitations=limits)
