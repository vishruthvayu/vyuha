"""Versioned semantic sites and timed LOS challenges on the unchanged v0.6 engine."""
import copy
import hashlib
import json
from typing import Literal
from fastapi import APIRouter, HTTPException
from . import observation_missions as v1
from . import observation_missions_v2 as v2
from .engine_v4 import Simulation, validate_policy
from .raid_v2 import raid_id, feature_signature, validate_raid, raid_position
from .sensors_v2 import line_of_sight
from .storage import connect
from .training_sites import training_site, terrain_boxes, validate_site, site_catalog

VERSION = 'observation-mission-v3'
ASSESSMENT = 'evidence-assessment-v2'
Site = Literal['freight_corridor', 'open_campus']


class PrepareMission(v1.PrepareMission):
    site: Site = 'freight_corridor'


class MissionRequest(v1.MissionRequest):
    version: Literal['observation-mission-v3'] = VERSION
    site: Site = 'freight_corridor'


router = APIRouter(prefix='/api/v1/observation-missions-v3', tags=['Authored training sites'])


def compile_mission(request):
    req = request if isinstance(request, MissionRequest) else MissionRequest.model_validate(request)
    old = req.model_dump()
    old.pop('site')
    old['version'] = v2.VERSION
    s = v2.compile_mission(old)
    site = training_site(req.site)
    s['training_site'] = site
    s['terrain_boxes'] = terrain_boxes(site)
    # Existing closed-form motion only. The central hall creates an actual LOS
    # interval; the open campus deliberately has different geometry. No future
    # interval or reference path is copied into the public site or live UI.
    primary = next(t for t in s['tracks'] if t['identity'] == 'hostile')
    primary.update(bearing=310, distance=700, speed=10, altitude=16, spawn=60,
                   motion=dict(version=1, primitive='orbit_then_dash', phase_s=round(req.duration*.8, 3),
                               lateral_m=0, period_s=20, turn_deg=100))
    primary.pop('group_id', None)
    primary.pop('formation_offset_m', None)
    primary.pop('formation_forward_m', None)
    primary.pop('group_split_s', None)
    # Recompute public geometry checks and feature fingerprints; never retain
    # stale metadata from the source raid after authoring its spatial task.
    signature = feature_signature(s)
    s['raid']['signature'] = signature
    s['raid']['fingerprint'] = hashlib.sha256(json.dumps(signature, separators=(',', ':')).encode()).hexdigest()[:24]
    geometry = copy.deepcopy(s)
    geometry['engine_version'] = 'vyuha-0.4.0'
    s['raid']['validation'] = validate_raid(geometry)
    m = s['observation_mission']
    m.update(version=VERSION, assessment_version=ASSESSMENT, authoring=req.model_dump())
    s['id'] = raid_id(s)
    return s


def validate_mission(scenario):
    m = scenario.get('observation_mission')
    if type(m) is not dict or m.get('version') != VERSION or m.get('assessment_version') != ASSESSMENT:
        raise ValueError('Unsupported training-site mission contract')
    validate_site(scenario.get('training_site'))
    if scenario != compile_mission(MissionRequest.model_validate(m['authoring'])):
        raise ValueError('Frozen site mission disagrees with its complete authored definition')
    return scenario


def validate_snapshot(scenario):
    from .acquisition import validate_snapshot_v3
    validate_policy(scenario)
    validate_mission(scenario)
    if scenario['id'] != raid_id(scenario):
        raise ValueError('Training-site mission content hash mismatch')
    normalized = copy.deepcopy(scenario)
    for field in ('decision_policy', 'observation_mission', 'training_site'):
        normalized.pop(field)
    normalized['engine_version'] = 'vyuha-0.5.0'
    normalized['id'] = raid_id(normalized)
    validate_snapshot_v3(normalized)
    return scenario


def rehearse(scenario):
    report = v1.rehearse(scenario, _validate=validate_mission, _simulation=Simulation)
    primary = next(t for t in scenario['tracks'] if t['identity'] == 'hostile')
    intervals = []
    start = primary['spawn']
    prior = None
    for tick in range(start, scenario['duration']*30+1):
        position = raid_position(primary, tick)
        clear = line_of_sight({**position, 'altitude': primary['altitude']}, {'terrain': scenario['terrain_boxes']})
        if prior is not None and clear != prior:
            intervals.append(dict(track=primary['id'], start_tick=start, end_tick=tick, clear=prior))
            start = tick
        prior = clear
    intervals.append(dict(track=primary['id'], start_tick=start, end_tick=scenario['duration']*30+1, clear=prior))
    reacquisition = any(not x['clear'] and any(y['clear'] and y['start_tick'] >= x['end_tick'] for y in intervals) for x in intervals)
    report['site_geometry'] = dict(version='training-site-rehearsal-v1', site_id=scenario['training_site']['id'],
                                 line_of_sight_intervals=intervals, clear_after_occlusion=reacquisition,
                                 scope='Author-only geometric LOS reconstruction. Clear geometry is not a guaranteed reported detection or human notice.')
    report['limitations'] += ['The site geometry trace is author-only. It is not copied into trainee observations and does not imply guaranteed acquisition or mastery.']
    return report


@router.get('/catalog')
def catalog():
    with connect() as db:
        rows = db.execute("SELECT spec FROM scenarios WHERE json_extract(spec,'$.observation_mission.version') IN ('observation-mission-v1','observation-mission-v2','observation-mission-v3') ORDER BY rowid DESC LIMIT 40").fetchall()
    missions = []
    for row in rows:
        s = json.loads(row['spec'])
        m = s['observation_mission']
        missions.append(dict(id=s['id'], mission_version=int(m['version'].rsplit('v', 1)[1]), title=m['title'],
                             objectives=m['objectives'], mode=m['mode'], template=m['template'],
                             **({'site': s['training_site']['id']} if 'training_site' in s else {})))
    templates = [v1.brief(k) for k in v1.TEMPLATES]
    for t in templates:
        if 'C03' not in t['competencies']:
            t['competencies'] = [*t['competencies'], 'C03']
    return dict(version=VERSION, templates=templates, sites=site_catalog(), missions=missions)


@router.post('/prepare')
def prepare(request: PrepareMission):
    try:
        return v1._persist(compile_mission(MissionRequest(**request.model_dump())))
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.post('/compile')
def compile_preview(request: MissionRequest):
    if not v1._SLOT.acquire(blocking=False):
        raise HTTPException(429, 'Another author rehearsal is running; retry after it finishes')
    try:
        s = compile_mission(request)
        return dict(scenario=s, rehearsal=rehearse(s))
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    finally:
        v1._SLOT.release()


@router.post('/publish')
def publish(request: MissionRequest):
    try:
        return v1._persist(compile_mission(request))
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


@router.get('/{scenario_id}')
def frozen(scenario_id: str):
    with connect() as db:
        row = db.execute('SELECT spec FROM scenarios WHERE id=?', (scenario_id,)).fetchone()
    if not row:
        raise HTTPException(404, 'Frozen training-site mission not found')
    scenario = json.loads(row['spec'])
    try:
        validate_mission(scenario)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return scenario
