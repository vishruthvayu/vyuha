"""Read-only longitudinal policy over unchanged reconstructed mission assessments.

No scoring/competency truth is introduced. Context diversity is descriptive,
never evidence of empirical transfer or calibrated proficiency.
"""
from urllib.parse import urlencode
from .observation_assessment import COMPETENCIES, STATUSES

VERSION = 'observation-journey-v1'
POLICY = 'longitudinal-evidence-policy-v1'
WINDOW = 32
TITLES = {'C01': 'Observe reported geometry', 'C02': 'Separate category and affiliation',
          'C03': 'Retain justified uncertainty', 'C05': 'Adapt the evidence channel'}
TEMPLATES = {'night_switch': ('C01', 'C02', 'C05'),
             'civil_restraint': ('C02', 'C03', 'C05'),
             'timed_window': ('C01', 'C02', 'C03')}


def context_key(template, version, site):
    # Seed changes alone deliberately do not create independent contexts.
    return f'{version}:{site or "no-authored-site"}:{template}'


def aggregate(trainee, entries, total):
    """Entries are newest first, each with a reconstructed report and frozen spec."""
    sessions, evidence = [], []
    for entry in entries:
        report, spec = entry['report'], entry['scenario']
        mission = spec['observation_mission']
        site = spec.get('training_site', {}).get('id')
        context = context_key(mission['template'], mission['version'], site)
        decisions = {d['id']: d for d in report['decisions']}
        session = dict(session_id=report['session_id'], scenario_id=spec['id'],
                       created_at=entry['created_at'], completed_at=entry.get('completed_at'),
                       evidence_at=entry.get('completed_at') or entry['created_at'],
                       evidence_time_source='completed_at' if entry.get('completed_at') else 'created_at_legacy_fallback',
                       template=mission['template'],
                       mission_version=mission['version'], assessment_version=report['version'],
                       site=site, mode=report['mode'], seed=spec['seed'],
                       context_key=context, report_hash=report['report_hash'],
                       href='/?'+urlencode(dict(view='aar',session=report['session_id'])))
        sessions.append(session)
        for item in report['competencies']:
            evidence.append(dict(**session, competency=item['id'], status=item['status'],
                                 criterion=item['criterion'],
                                 decisions=[dict(id=key, tick=decisions[key]['tick'], order=decisions[key]['order'])
                                            for key in item['decision_ids'] if key in decisions]))
    rows = []
    for competency in COMPETENCIES:
        observations = [e for e in evidence if e['competency'] == competency]
        practices = [e for e in observations if e['mode'] == 'practice']
        independent = [e for e in observations if e['mode'] == 'assessment']
        # An unassessable session never erases earlier assessable evidence.
        latest_practice = next((e for e in practices if e['status'] != 'unassessable'), None)
        latest_independent = next((e for e in independent if e['status'] != 'unassessable'), None)
        counts = {mode: {status: sum(e['status'] == status for e in observations if e['mode'] == mode)
                         for status in STATUSES} for mode in ('practice', 'assessment')}
        state = ('independent-gap' if latest_independent and latest_independent['status'] != 'supported'
                 else 'independent-supported' if latest_independent
                 else 'practice-only' if latest_practice else 'not-observed')
        rows.append(dict(id=competency, title=TITLES[competency], state=state,
                         latest_practice=latest_practice, latest_independent=latest_independent,
                         counts=counts, independent_contexts=len({e['context_key'] for e in independent
                                                                 if e['status'] != 'unassessable'}),
                         evidence=observations))
    # Preserve the most recent mission contract/site. Cold start uses v3.
    latest = sessions[0] if sessions else None
    version = int(latest['mission_version'].rsplit('v', 1)[1]) if latest else 3
    site = latest['site'] if latest else 'freight_corridor'
    candidates = []
    for row in rows:
        independent, practice = row['latest_independent'], row['latest_practice']
        refreshed = bool(practice and practice['status'] == 'supported' and
                         (not independent or evidence.index(practice) < evidence.index(independent)))
        gap = bool(independent and independent['status'] in ('unsupported', 'inconclusive'))
        practice_gap = bool(practice and practice['status'] in ('unsupported', 'inconclusive') and
                            (not independent or evidence.index(practice) < evidence.index(independent)))
        priority = (0 if gap and not refreshed else 1 if practice_gap else
                    2 if not independent and not refreshed else 3 if refreshed else 4)
        mode = 'assessment' if refreshed else 'practice'
        basis = ([independent] if independent else []) + ([practice] if practice else [])
        eligible = [t for t, competencies in TEMPLATES.items()
                    if row['id'] in competencies or version >= 2 and row['id'] == 'C03']
        for template in eligible:
            key = context_key(template, f'observation-mission-v{version}', site)
            seen = [s for s in sessions if s['context_key'] == key]
            supported_here = any(e['context_key'] == key and e['status'] == 'supported'
                                 for e in row['evidence'])
            rank = [priority, int(supported_here), len(seen), COMPETENCIES.index(row['id']),
                    list(TEMPLATES).index(template)]
            candidates.append(dict(competency=row['id'], template=template, mode=mode,
                                   priority=priority, prior_context_sessions=len(seen),
                                   already_supported=supported_here, rank=rank, based_on=basis))
    candidates.sort(key=lambda c: c['rank'])
    chosen = candidates[0]
    used_seeds = {s['seed'] for s in sessions}
    seed = ((latest['seed'] if latest else 482913) + 104729) & 0xffffffff
    while seed in used_seeds:
        seed = (seed + 104729) & 0xffffffff
    query = dict(mission_template=chosen['template'], mission_mode=chosen['mode'],
                 seed=seed, mission_version=version)
    if version == 3:
        query['mission_site'] = site
    reason = ('Latest independent evidence needs another supported decision opportunity.' if chosen['priority'] == 0
              else 'The latest practice decision remains unsupported or inconclusive.' if chosen['priority'] == 1
              else 'No assessable independent evidence is recorded for this competency.' if chosen['priority'] == 2
              else 'Supported practice is recorded; sample independent evidence separately.' if chosen['priority'] == 3
              else 'Sample another scenario-bound evidence opportunity; support is not mastery.')
    novelty = ('Unobserved template context in this window.' if chosen['prior_context_sessions'] == 0
               else 'Preferred contexts already have observations; this is deliberate repetition, not new transfer evidence.')
    recommendation = dict(**chosen, policy=POLICY, seed=seed, mission_version=version, site=site,
                          reason=reason, novelty=novelty, href='/?'+urlencode(query))
    return dict(version=VERSION, trainee=trainee,
                window=dict(limit=WINDOW, included_sessions=len(sessions), total_sessions=total,
                            truncated=total > len(sessions), ordering='completed_at (legacy fallback created_at) descending, session_id descending'),
                competencies=rows, sessions=sessions, recommendation=recommendation,
                candidates=candidates, limitations=[
                    'Only server-completed, reconstructed own mission evidence is included; active, queued and Crew records are excluded.',
                    'Reconstructed reports establish availability, not attention, gaze, understanding or cognitive use.',
                    'Practice and independent observations remain separate. Supported is scenario-bound evidence, not readiness, mastery or certification.',
                    'Mission/criterion versions remain attached to every observation; counts do not establish equivalent difficulty across versions.',
                    'A different seed is not independent context, retention or transfer evidence. Repeated contexts are not independent demonstrations.',
                    'This transparent policy has synthetic fixture evaluation only; no human learning gain or calibrated competence is claimed.',
                    'Personal evidence uses existing trusted-LAN trainee identifier visibility; identifiers are not authenticated identities.'
                ])


def journey(trainee):
    from .main import logged_events, applied_commands
    from .storage import connect, dumps
    from .crew import is_shared_owner
    from .observation_assessment import _cached_assessment
    import json
    condition = "s.trainee=? AND s.status='completed' AND json_extract(sc.spec,'$.observation_mission.version') IN ('observation-mission-v1','observation-mission-v2','observation-mission-v3')"
    with connect() as db:
        if is_shared_owner(db, trainee):
            raise ValueError('Crew aggregates cannot own individual competency evidence')
        total = db.execute('SELECT COUNT(*) FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE '+condition, (trainee,)).fetchone()[0]
        rows = db.execute('SELECT s.*,sc.spec FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id WHERE '+condition+" ORDER BY COALESCE(NULLIF(s.completed_at,''),s.created_at) DESC,s.id DESC LIMIT ?", (trainee, WINDOW)).fetchall()
        entries = []
        for row in rows:
            actions, commands = logged_events(db,row['id']), applied_commands(db,row['id'])
            spec = json.loads(row['spec'])
            report = _cached_assessment(dumps(dict(scenario=spec, actions=actions, commands=commands,
                sid=row['id'], observed_end=row['execution_tick'] if row['execution_tick'] is not None
                else max([e['tick'] for e in actions+commands], default=0))))
            if report is not None:
                entries.append(dict(report=report, scenario=spec, created_at=row['created_at'], completed_at=row['completed_at']))
    return aggregate(trainee, entries, total)
