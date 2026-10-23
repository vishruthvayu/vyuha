"""Persist evidence, sample a focus, and parameterize the existing simulator."""
import hashlib
import json
import random
from datetime import datetime, timezone
from .engine import make_scenario
from .review import SKILLS
from .director_models import TrainingProfile, DirectorDecision
from .storage import dumps

PRIOR = 1.0  # Preserve the existing two-skill profile's Beta(1,1) prior.
TEMPLATES = {
    'detection': ['wide_watch', 'compressed_warning', 'background_watch'],
    'classification_iff': ['mixed_identity', 'multirotor_mix', 'bird_screen'],
    'effector_choice': ['link_contrast', 'restricted_approach', 'range_check'],
    'degraded_sensor_response': ['radar_gap', 'night_gap', 'mixed_gap'],
}


def session_outcomes(review):
    """One observation/contact/skill. Any evidenced error wins over corrections."""
    votes = {skill: {} for skill in SKILLS}
    for r in review['decision_reviews']:
        if r['verdict'] == 'unassessable' or r['decision_kind']=='prioritisation':
            continue
        skill = {'detection':'detection', 'classification_iff':'classification_iff', 'engagement':'effector_choice'}[r['decision_kind']]
        targets = [skill]
        ev = r['evidence']
        if ev['radar']['state'] != 'normal' or not ev['rf']['available']:
            targets.append('degraded_sensor_response')
        for target in targets:
            prior = votes[target].get(r['track_id'], True)
            votes[target][r['track_id']] = prior and r['verdict'] == 'correct'
    return {s: dict(successes=sum(v.values()), failures=sum(not x for x in v.values())) for s,v in votes.items()}


def ensure_profile(db, trainee):
    for skill in SKILLS:
        db.execute('INSERT OR IGNORE INTO skill_profiles(trainee,skill,alpha,beta) VALUES (?,?,?,?)', (trainee,skill,PRIOR,PRIOR))


def persist_outcomes(db, trainee, sid, review):
    """Caller owns one SQLite transaction covering completion and all four skills."""
    return persist_skill_results(db,trainee,sid,session_outcomes(review),'director-v1')


def persist_skill_results(db,trainee,sid,outcomes,version):
    from .crew import is_shared_session,is_shared_owner
    if is_shared_session(db,sid) or is_shared_owner(db,trainee):return False
    from .learning import is_practice
    if is_practice(db,sid):return False
    ensure_profile(db,trainee)
    if db.execute('SELECT 1 FROM skill_outcomes WHERE session_id=?',(sid,)).fetchone():
        return False
    stamp=datetime.now(timezone.utc).isoformat()
    db.execute('INSERT INTO skill_outcomes(session_id,trainee,outcomes,processed_at,version) VALUES (?,?,?,?,?)',
               (sid,trainee,dumps(outcomes),stamp,version))
    for skill, result in outcomes.items():
        if result['successes']+result['failures']==0:continue
        db.execute('UPDATE skill_profiles SET alpha=alpha+?,beta=beta+?,updated_at=?,last_session_id=? WHERE trainee=? AND skill=?',
                   (result['successes'],result['failures'],stamp,sid,trainee,skill))
    return True


def read_profile(db, trainee, unprocessed=None, ensure=True):
    if ensure:ensure_profile(db,trainee)
    rows={r['skill']:r for r in db.execute('SELECT * FROM skill_profiles WHERE trainee=?',(trainee,))}
    skills={s:dict(alpha=float(rows[s]['alpha']),beta=float(rows[s]['beta']),observations=int(rows[s]['alpha']+rows[s]['beta']-2*PRIOR),
                   mean=rows[s]['alpha']/(rows[s]['alpha']+rows[s]['beta']),updated_at=rows[s]['updated_at'],last_session_id=rows[s]['last_session_id']) for s in SKILLS}
    outcomes=[dict(session_id=r['session_id'],skills=json.loads(r['outcomes']),processed_at=r['processed_at'],version=r['version'])
              for r in db.execute('SELECT * FROM skill_outcomes WHERE trainee=? ORDER BY processed_at,session_id',(trainee,))]
    return TrainingProfile(trainee=trainee,sessions=len(outcomes),skills=skills,outcomes=outcomes,unprocessed_sessions=unprocessed or []).model_dump()


def recent_history(db, trainee):
    return [json.loads(r['decision']) for r in db.execute('SELECT decision FROM director_history WHERE trainee=? ORDER BY rowid DESC LIMIT 5',(trainee,))]


def difficulty(mean):
    return 1 if mean < .4 else 2 if mean < .7 else 3


def select_director(profile, history, seed):
    r=random.Random(seed)
    samples={s:r.betavariate(profile['skills'][s]['alpha'],profile['skills'][s]['beta']) for s in SKILLS}
    focus=min(SKILLS,key=lambda s:samples[s]);estimate=profile['skills'][focus]
    level=difficulty(estimate['mean'])
    candidates=[f'{focus}/{t}' for t in TEMPLATES[focus]]
    r.shuffle(candidates)
    recent=[h['scenario_template'] for h in history[:5]]
    allowed=[c for c in candidates if c not in recent]
    fallback=not allowed
    # Least recent, never the immediately previous template when alternatives exist.
    template=allowed[0] if allowed else max(candidates,key=lambda c:recent.index(c) if c in recent else 99)
    scenario_seed=r.randrange(2**32)
    successes=sum(o['skills'][focus]['successes'] for o in profile['outcomes'][-5:])
    failures=sum(o['skills'][focus]['failures'] for o in profile['outcomes'][-5:])
    fresh=all(p['observations']==0 for p in profile['skills'].values())
    reason='Limited history available. This initial assessment establishes a baseline.' if fresh else (
        f'The seeded Thompson draw selected this skill from the persistent four-skill profile. '
        f'Its last five processed sessions contain {successes} successful and {failures} failed contact observations. '
        f'The displayed mastery is the Beta mean, not the selection draw.'
        + (' This skill has no observations yet; its estimate is the baseline prior.' if estimate['observations']==0 else ''))
    return dict(trainee_id=profile['trainee'],director_seed=seed,focus_skill=focus,mastery_estimate=estimate['mean'],observations=estimate['observations'],
                difficulty=level,difficulty_label=['foundational','standard','challenging'][level-1],reason_code='INITIAL_ASSESSMENT' if fresh else 'LOWEST_SAMPLED_MASTERY',
                reason=reason,recent_successes=successes,recent_failures=failures,scenario_template=template,scenario_seed=scenario_seed,
                anti_rote=dict(rejected_candidates=sum(c in recent for c in candidates),fallback=fallback),debug_samples=samples,profile_snapshot=profile['skills'])


def adapt_scenario(decision):
    """Twelve templates x three levels; only existing scenario fields are changed."""
    focus=decision['focus_skill'];level=decision['difficulty'];variant=TEMPLATES[focus].index(decision['scenario_template'].split('/')[1])
    s=make_scenario(decision['scenario_seed'], 'response' if focus=='effector_choice' else 'recognition', level==3 or (focus=='degraded_sensor_response' and variant!=0))
    s['focus']=focus;s['title']=f"{focus.replace('_',' ').title()} · {decision['difficulty_label'].title()}"
    s['fog']=[.08,.25,.5][level-1]
    s['jamStart']=2250;s['jamEnd']=2250
    s['tracks']=s['tracks'][:(5 if level==1 else 6 if level==2 else 8)]
    for i,t in enumerate(s['tracks']):
        t['spawn']=max(0,t['spawn']+(variant-1)*30)
        if t['identity']=='hostile':
            t['speed']*= [.75,1,1.15][level-1]
            t['distance']+= [15,0,-12][level-1]
        t['bearing']=(t['bearing']+variant*12)%360
    if focus=='detection':
        for t in s['tracks']:
            if t['identity']=='hostile':
                t['distance']+= [5,20,35][variant]
                if variant==1:t['speed']*=1.2
        if variant==2:
            s['tracks'].append(dict(id=f"T{len(s['tracks'])+1}",kind='bird',identity='neutral',rf=False,spawn=60,bearing=165,distance=125,speed=.8,altitude=18))
        if level==3:s['jamStart']=450;s['jamEnd']=810
    elif focus=='classification_iff':
        if variant==1:
            s['tracks'][0].update(kind='quad',identity='neutral',rf=False)
            s['tracks'][3].update(kind='quad',rf=True)
        elif variant==2:
            s['tracks'].append(dict(id=f"T{len(s['tracks'])+1}",kind='bird',identity='neutral',rf=False,spawn=90,bearing=100,distance=120,speed=.8,altitude=22))
        if level==3:s['jamStart']=600;s['jamEnd']=780
    elif focus=='effector_choice':
        # Pair is deliberately early/playable: link presence changes the response.
        s['tracks'][2].update(kind='quad',rf=True,spawn=60,bearing=40,distance=130)
        s['tracks'][4].update(kind='fiber_fpv',rf=False,spawn=90,bearing=70,distance=135)
        if variant==1:s['tracks'][3].update(bearing=325,distance=150)  # existing restricted sector
        if variant==2:s['tracks'][2].update(distance=185)  # wait for jammer range
    else:
        s['jamStart']=[120,60,30][variant];s['jamEnd']=[360,600,900][level-1]
        for t in s['tracks'][2:]:t['spawn']=max(s['jamStart'],min(t['spawn'],s['jamEnd']-30))
    features=['Night' if s['night'] else 'Day',f"{len(s['tracks'])} mixed contacts",f"Fog parameter {s['fog']}"]
    if any(t['kind']=='fiber_fpv' for t in s['tracks']):features.append('No-RF FPV included')
    if any(t['identity']=='friendly' for t in s['tracks']):features.append('Friendly contact included')
    if s['jamStart']<s['jamEnd']:features.append(f"Radar gap T+{s['jamStart']/30:g}–{s['jamEnd']/30:g}s; RF/IFF remains available")
    if focus=='effector_choice' and variant==1:features.append('Restricted-sector approach')
    if focus=='effector_choice' and variant==2:features.append('Initial target outside jammer range')
    fingerprint=dumps(dict(template=decision['scenario_template'],difficulty=level,night=s['night'],mix=[(t['kind'],t['identity'],t['rf']) for t in s['tracks']],jam=[s['jamStart'],s['jamEnd']]))
    decision=DirectorDecision(**decision,scenario_features=features,fingerprint=hashlib.sha256(fingerprint.encode()).hexdigest()).model_dump()
    s['director_decision']=decision
    s['id']='dir_'+hashlib.sha256(dumps(s).encode()).hexdigest()[:24]
    return s
