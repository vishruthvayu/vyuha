"""Evidence-assessment-v1: authored-mission support, separate from frozen scores.

Before-action public observations are interpreted without canonical truth. This
is a transparent synthetic educational contract, not calibrated competence,
attention, intention, human confidence or learning efficacy.
"""
import copy
from functools import lru_cache
import hashlib
import json
from collections import Counter
from fastapi import APIRouter, HTTPException
from .engine_v3 import replay
from .storage import connect, dumps

VERSION = 'evidence-assessment-v1'
PROFILES = ('night_switch', 'civil_restraint', 'timed_window')
COMPETENCIES = ('C01', 'C02', 'C03', 'C05')
STATUSES = ('supported', 'unsupported', 'inconclusive', 'unassessable')
CRITERIA = {
 'night_switch': {'C01':'Designate from an actual reported position, not a hidden reference.', 'C02':'Separate shape/category support from affiliation and control-medium claims.', 'C05':'After an unavailable channel result, a working different channel must publish before a recorded decision to support the adaptation event pattern.'},
 'civil_restraint': {'C02':'Weigh positive affiliation separately from inconclusive optical category detail.', 'C03':'Choose restraint consistently with a positive non-hostile cue or unresolved affiliation; extra optical requests are not required.', 'C05':'A decision consistent with positive IFF despite absent or inconclusive current optical shape supports the alternative-cue handling pattern.'},
 'timed_window': {'C01':'Designate only with a reported position.', 'C02':'Interpret the exact released/expired evidence at the classification frontier; another legitimate cue can still support an affiliation claim.', 'C03':'Retain restraint where public evidence does not establish hostile intent; inactivity is not an uncertainty declaration.'},
}
router = APIRouter(prefix='/api/v1/observation-learning', tags=['Observation learning evidence'])
LIMITATIONS = [
 'Educational support differs from original rubric correctness and consequence; original scores are unchanged.',
 'Availability is reconstructed, not evidence that the trainee noticed, relied on or understood a report.',
 'The sensor contract has no positive hostile-intent observation; silence and shape do not establish hostility or a fibre link.',
 'Acquisition utility describes changed reported decision features, not information-theoretic gain or request-count rewards.',
 'No mastery, calibrated proficiency, empirically equated forms, operational certification or human learning gain is inferred.',
 'Action choices are not confidence statements. Confidence is not evaluated by this event contract.',
 'The frozen action alphabet cannot record an unclassified defer choice. Explicit Hold is evaluated separately from the preceding type/identity declaration; inactivity is not interpreted as justified uncertainty.',
]


def mission_contract(scenario):
    m = scenario.get('observation_mission')
    if m is None:
        return None
    if (scenario.get('engine_version') != 'vyuha-0.5.0' or not isinstance(m, dict)
        or m.get('version') != 'observation-mission-v1' or m.get('assessment_version') != VERSION
        or m.get('criterion_profile') not in PROFILES or m.get('template') != m.get('criterion_profile')
        or m.get('mode') not in ('practice', 'assessment') or not isinstance(m.get('competencies'), list)
        or not m['competencies'] or len(set(m['competencies'])) != len(m['competencies'])
        or not set(m['competencies']) <= set(COMPETENCIES)
        or not set(m['competencies']) <= set(CRITERIA.get(m.get('criterion_profile'),{}))):
        raise ValueError('Unsupported frozen observation assessment contract')
    return m


def public_facts(sim, track):
    """Canonical type/identity/link/geometry are deliberately not inputs."""
    o = copy.deepcopy(track.get('observation') or {})
    radar = o.get('radar', {})
    valid = [r for r in sim.acquisition_snapshot()['results']
             if r['trackId'] == track['id'] and r['releaseTick'] <= sim.tick < r['expiryTick']]
    geometry = bool(radar.get('available') and radar.get('position') is not None
                    or any(o.get(c, {}).get('available') and o[c].get('position') is not None for c in ('eo', 'ir')))
    return dict(tick=sim.tick, track=track['id'], observation=o, current_optical_results=valid, has_geometry=geometry)


def finding(dimension, status, code, text, references):
    return dict(dimension=dimension, status=status, code=code, explanation=text, evidence_ids=list(dict.fromkeys(references)))


def interpret(action, facts, profile):
    """Pure interpretation; prior unsupported labels cannot bootstrap evidence."""
    if profile not in PROFILES:
        raise ValueError('Unknown authored criterion profile')
    o = facts.get('observation', {})
    rf, iff = o.get('rf', {}), o.get('iff', {})
    shapes = {o.get(c, {}).get('silhouette') for c in ('eo', 'ir')
              if o.get(c, {}).get('available') and o[c].get('level') in ('recognise', 'identify')}
    positive = iff.get('cue') if iff.get('available') else None
    refs = [f"{k}:{facts['track']}:{facts['tick']}" for k in ('radar', 'rf', 'iff') if o.get(k, {}).get('available')]
    refs += [r['resultId'] for r in facts.get('current_optical_results', [])]
    def f(dimension, status, code, text):
        return finding(dimension, status, code, text, refs)
    if action['k'] == 'designate':
        yes = facts.get('has_geometry')
        return [f('observation', 'supported' if yes else 'inconclusive', 'REPORTED_GEOMETRY' if yes else 'NO_CURRENT_GEOMETRY',
                  'A reported position was available before designation; recognition and attention are separate.' if yes else 'No current reported position supports a geometry claim; no intent is inferred.')]
    if action['k'] == 'classify':
        label, identity = action.get('kind'), action.get('identity')
        if label == 'bird' and 'bird' in shapes or label == 'fixed_wing' and 'fixed_wing' in shapes:
            tf = f('type', 'supported', 'REPORTED_SHAPE_CATEGORY', 'Current reported shape supports this illustrative category. Affiliation is a separate claim.')
        elif label == 'quad' and 'multirotor' in shapes and rf.get('available') and rf.get('detected'):
            tf = f('type', 'supported', 'PROVISIONAL_RF_MULTIROTOR', 'Current multirotor shape plus RF emission supports a provisional RF-emitting multirotor category, not proof of the control medium.')
        elif label == 'fiber_fpv':
            tf = f('type', 'unsupported', 'CONTROL_MEDIUM_NOT_OBSERVED', 'RF silence or a multirotor silhouette does not establish fibre control. The model does not directly observe that medium.')
        elif shapes and not ('multirotor' in shapes and label in ('quad', 'fiber_fpv')):
            tf = f('type', 'unsupported', 'SHAPE_CATEGORY_CONFLICT', 'The current reported shape conflicts with this category. Hidden target type is not consulted.')
        else:
            tf = f('type', 'inconclusive', 'TYPE_DETAIL_INSUFFICIENT', 'Current reports do not resolve this type. Expired or detection-only optics are not recognition; other cues may still justify restraint.')
        if identity == 'friendly' and positive == 'friendly_reply':
            identity_finding = f('identity', 'supported', 'POSITIVE_FRIENDLY_IFF', 'A working IFF observation returned a positive friendly cue. An optical request is not mandatory for this affiliation interpretation.')
        elif identity == 'neutral' and (positive == 'registered_civil' or 'bird' in shapes and positive != 'friendly_reply'):
            identity_finding = f('identity', 'supported', 'POSITIVE_CIVIL_OR_WILDLIFE_CUE', 'A positive civil registration cue or current bird-like shape supports the authored non-hostile interpretation, not real-world intent.')
        elif identity == 'hostile':
            identity_finding = f('identity', 'unsupported', 'HOSTILITY_NOT_ESTABLISHED', 'No positive hostile-intent cue exists in this contract. No reply, RF silence, shape or a matching after-review answer cannot establish this claim.')
        elif positive in ('friendly_reply', 'registered_civil'):
            identity_finding = f('identity', 'unsupported', 'POSITIVE_AFFILIATION_CONFLICT', 'A positive affiliation cue conflicts with the submitted identity. Inconclusive optics do not override it.')
        else:
            identity_finding = f('identity', 'inconclusive', 'IDENTITY_UNRESOLVED', 'Reports do not settle affiliation. Retaining uncertainty or seeking a useful different observation is legitimate.')
        return [tf, identity_finding]
    if action['k'] == 'engage':
        nonhostile = positive in ('friendly_reply', 'registered_civil') or 'bird' in shapes
        if action.get('effector') == 'hold':
            return [f('restraint', 'supported', 'POSITIVE_CUE_RESTRAINT' if nonhostile else 'UNCERTAINTY_RETAINED',
                      'Hold is consistent with positive non-hostile evidence; no extra optical request is required.' if nonhostile else 'Hold retains uncertainty while no positive hostility evidence is supplied. This records a choice, not private reasoning.')]
        return [f('restraint', 'unsupported', 'POSITIVE_NONHOSTILE_CUE_IGNORED' if nonhostile else 'DESTRUCTIVE_BASIS_UNESTABLISHED',
                  'A destructive response conflicts with positive non-hostile evidence.' if nonhostile else 'The response may match canonical outcome rules, but public evidence does not establish hostility. Prior unsupported labels do not create evidence.')]
    return []


def combined(values):
    statuses = {x['status'] for x in values}
    return next((s for s in ('unsupported', 'inconclusive', 'supported') if s in statuses), 'unassessable')


def _utility(query, result, before, acquisition):
    if result is None:
        return 'unassessable', 'No result was published before the recorded end. No future evidence or acquisition credit is invented.'
    prior = before.get('observation', {}).get(query['channel'], {})
    reading = result['reading']
    sample = next((x['observation'] for x in acquisition['samples'] if x['resultId'] == result['resultId']), {})
    if not reading['available']:
        return ('no_new_decision_feature', 'This channel was already unavailable. The repeat added no type or identity cue.') if prior.get('available') is False else ('revealed_limit', 'The result establishes channel unavailability, not an empty sky or hostile affiliation.')
    if reading['level'] == 'none':
        return 'no_detection', 'An available channel reported no detection. This is not proof of absence or affiliation.'
    features = lambda value: (value.get('available'), value.get('level'), value.get('silhouette'))
    if any(features(before.get('observation', {}).get(c, {})) == features(sample) for c in ('eo', 'ir')):
        return 'no_new_decision_feature', 'No new type/identity feature relative to current optics. Refresh/corroboration or position may still matter; no automatic penalty or reward applies.'
    return 'new_reported_feature', 'A current detection or shape feature was added. Availability does not prove it was noticed or used; requesting alone earns no competency evidence.'


def assess_mission(scenario, actions, commands, sid, observed_end):
    m = mission_contract(scenario)
    if m is None:
        return None
    if type(observed_end) is not int or not 0 <= observed_end <= scenario['duration'] * 30:
        raise ValueError('Invalid mission observed horizon')
    decisions, query_before = [], {}
    def observe(sim, phase, action, order):
        if phase != 'before_action':
            return
        track = next((t for t in sim.tracks if t['id'] == action['track']), None)
        if track is None:
            raise ValueError('Missing action alias')
        facts = public_facts(sim, track)
        if action['k'] == 'inspect':
            query_before[action['request_id']] = facts
            return
        findings = interpret(action, facts, m['criterion_profile'])
        decisions.append(dict(id=f'evidence_decision_{order}', tick=sim.tick, order=order, track=action['track'], action=copy.deepcopy(action),
                              status=combined(findings), findings=findings, available_evidence=facts,
                              confidence=dict(status='not_assessed', reason='Choices are not recorded confidence statements.')))
    sim = replay(scenario, actions, observed_end, commands, observer=observe)
    sim.end_acquisition()
    acquisition = sim.acquisition_snapshot()
    requests = []
    for query in acquisition['requests']:
        result = next((r for r in acquisition['results'] if r['id'] == query['id']), None)
        utility, explanation = _utility(query, result, query_before.get(query['id'], {}), acquisition)
        linked = [d['id'] for d in decisions if d['track'] == query['trackId'] and result is not None
                  and (result['releaseTick'] < d['tick'] or result['releaseTick'] == d['tick'] and result['releasedOrder'] < d['order']) and d['tick'] < result['expiryTick']]
        requests.append(dict(id=query['id'], track=query['trackId'], channel=query['channel'], accepted_tick=query['acceptedTick'], accepted_order=query['acceptedOrder'],
                             sample_tick=query['sampleTick'], release_tick=query['releaseTick'], result_id=result['resultId'] if result else None,
                             expiry_tick=result['expiryTick'] if result else None, released_order=result['releasedOrder'] if result else None, utility=utility, explanation=explanation, available_before_decisions=linked, cognitive_use='not_observed'))
    grouped = {key: [] for key in m['competencies']}
    for d in decisions:
        key = {'designate':'C01', 'classify':'C02', 'engage':'C03'}.get(d['action']['k'])
        if key in grouped:
            grouped[key].append((d['status'], d['id']))
    if 'C05' in grouped:
        unavailable = [r for r in acquisition['results'] if not r['reading']['available']]
        for d in decisions:
            optical=d['available_evidence']['observation']
            alternative_iff=(m['criterion_profile']=='civil_restraint'
                             and any(f['status']=='supported' and f['code'] in ('POSITIVE_FRIENDLY_IFF','POSITIVE_CIVIL_OR_WILDLIFE_CUE','POSITIVE_CUE_RESTRAINT') for f in d['findings'])
                             and not any(optical.get(c,{}).get('silhouette') for c in ('eo','ir')))
            switched=(m['criterion_profile']=='night_switch' and any(r['reading']['available'] and r['reading']['level'] != 'none' and any(u['trackId'] == r['trackId'] and u['channel'] != r['channel'] and u['releaseTick'] < r['acceptedTick'] for u in unavailable) for r in d['available_evidence']['current_optical_results']))
            if alternative_iff or switched:
                grouped['C05'].append(('supported', d['id']))
    competencies = [dict(id=key, status=combined([dict(status=s) for s, _ in values]), decision_ids=list(dict.fromkeys(i for _, i in values)), criterion=CRITERIA[m['criterion_profile']].get(key,'No versioned criterion is admitted for this competency.'), observation_scope='Recorded mission event pattern; not mastery or causal attribution.') for key, values in grouped.items()]
    report = dict(version=VERSION, session_id=sid, mission_version=m['version'], criterion_profile=m['criterion_profile'], mode=m['mode'], assessed=m['mode']=='assessment',
                  observed_end_tick=observed_end, score_contract='separate-from-frozen-rubric', decisions=decisions, acquisitions=requests, competencies=competencies,
                  summary=dict(decisions=len(decisions), statuses=dict(Counter(d['status'] for d in decisions)), requests=len(requests), mastery_awarded=False), limitations=LIMITATIONS)
    candidates=[c for c in competencies if c['status'] in ('unsupported','inconclusive')]
    focus=(candidates[0]['id'] if candidates else m['competencies'][0])
    template={'C01':'timed_window','C02':'civil_restraint','C03':'civil_restraint','C05':'night_switch'}[focus]
    seed=(scenario['seed']+104729)&0xffffffff
    report['follow_up']=dict(competency=focus,template=template,mode='practice',seed=seed,reason=f'Revisit {focus} with changed conditions; this is evidence-targeted practice, not a mastery judgment.',href=f'/?mission_template={template}&mission_mode=practice&seed={seed}')
    report['input_fingerprint'] = hashlib.sha256(dumps(dict(scenario=scenario, actions=actions, commands=commands, observed_end=observed_end, version=VERSION)).encode()).hexdigest()
    report['report_hash'] = hashlib.sha256(dumps(report).encode()).hexdigest()
    return report


@lru_cache(maxsize=64)
def _cached_assessment(payload):
    return assess_mission(**json.loads(payload))


def progression(trainee):
    from .main import logged_events, applied_commands
    with connect() as db:
        rows = db.execute("SELECT s.*,sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE s.trainee=? AND s.status='completed' AND json_extract(sc.spec,'$.observation_mission.version')='observation-mission-v1' ORDER BY s.created_at DESC,s.id DESC LIMIT 8", (trainee,)).fetchall()
        records = []
        for row in rows:
            actions, commands = logged_events(db,row['id']), applied_commands(db,row['id'])
            records.append(dict(scenario=json.loads(row['spec']), actions=actions, commands=commands, sid=row['id'], observed_end=row['execution_tick'] if row['execution_tick'] is not None else max([e['tick'] for e in actions+commands],default=0)))
    groups = {mode: dict(sessions=0, competencies={key: {s:0 for s in STATUSES} for key in COMPETENCIES}) for mode in ('practice','assessment')}
    sessions, evidence = [], []
    for record in records:
        report = copy.deepcopy(_cached_assessment(dumps(record)))
        if report is None:
            continue
        group = groups[report['mode']];group['sessions'] += 1
        for o in report['competencies']:
            group['competencies'][o['id']][o['status']] += 1
            evidence.append(dict(session_id=report['session_id'], mode=report['mode'], competency=o['id'], status=o['status']))
        sessions.append(dict(session_id=report['session_id'], template=record['scenario']['observation_mission']['template'], mode=report['mode'], competencies=report['competencies'], report_hash=report['report_hash'], observed_end_tick=report['observed_end_tick']))
    need = sorted([e for e in evidence if e['status'] in ('unsupported','inconclusive')], key=lambda e:(e['mode']!='assessment',e['status']!='unsupported',COMPETENCIES.index(e['competency'])))
    focus = need[0]['competency'] if need else 'C05' if not evidence else min(COMPETENCIES,key=lambda k:sum(groups[mode]['competencies'][k]['supported'] for mode in groups))
    template = {'C01':'timed_window','C02':'civil_restraint','C03':'civil_restraint','C05':'night_switch'}[focus]
    seed = ((records[0]['scenario']['seed'] if records else 482913)+104729)&0xffffffff
    basis = [e for e in need if e['competency']==focus][:4]
    reason = f"Revisit {focus}: a reconstructed {basis[0]['mode']} decision had {basis[0]['status']} evidence support." if basis else f'Sample another {focus} evidence opportunity; missing observations are not proof of weakness or mastery.'
    return dict(version='observation-progression-v1',assessment_version=VERSION,trainee=trainee,window=dict(limit=8,completed_mission_sessions=len(sessions)),**groups,sessions=sessions,
                recommendation=dict(policy='evidence-gap-director-v1',template=template,mode='practice',seed=seed,competency=focus,reason=reason,based_on=basis,href=f'/?mission_template={template}&mission_mode=practice&seed={seed}'),limitations=LIMITATIONS)


@router.get('/trainees/{trainee}/progression')
def read_progression(trainee: str):
    if not 1 <= len(trainee) <= 64:
        raise HTTPException(422,'Invalid trainee identifier')
    try:
        return progression(trainee)
    except (ValueError,KeyError,TypeError) as error:
        raise HTTPException(422,'Mission evidence cannot be reconstructed: '+str(error)[:160]) from error
