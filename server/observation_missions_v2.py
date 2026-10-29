"""Explicit mission v2 admission for deliberate unclassified uncertainty decisions.

V1 compilation and fixtures remain frozen; sensor/motion/material semantics do
not change. Only this opt-in mission binds the v0.6 action alphabet.
"""
import copy,json
from typing import Literal
from fastapi import APIRouter,HTTPException
from . import observation_missions as prior
from .engine_v4 import Simulation, POLICY
from .raid_v2 import raid_id
from .storage import connect

VERSION='observation-mission-v2'
ASSESSMENT='evidence-assessment-v2'
class MissionRequest(prior.MissionRequest):
    version:Literal['observation-mission-v2']=VERSION

router=APIRouter(prefix='/api/v1/observation-missions-v2',tags=['Uncertainty mission contract v2'])

def compile_mission(request):
    req=request if isinstance(request,MissionRequest) else MissionRequest.model_validate(request)
    old=req.model_dump();old['version']=prior.VERSION
    s=prior.compile_mission(old)
    s['engine_version']='vyuha-0.6.0';s['decision_policy']=copy.deepcopy(POLICY)
    m=s['observation_mission'];m.update(version=VERSION,assessment_version=ASSESSMENT,authoring=req.model_dump())
    if 'C03' not in m['competencies']:m['competencies']=[*m['competencies'],'C03']
    s['id']=raid_id(s)
    return s

def validate_mission(scenario):
    m=scenario.get('observation_mission')
    if type(m) is not dict or m.get('version')!=VERSION or m.get('assessment_version')!=ASSESSMENT:raise ValueError('Unsupported uncertainty mission contract')
    if scenario!=compile_mission(MissionRequest.model_validate(m['authoring'])):raise ValueError('Frozen uncertainty mission disagrees with authored definition')
    return scenario

def validate_snapshot(scenario):
    from .acquisition import validate_snapshot_v3
    from .engine_v4 import validate_policy
    validate_policy(scenario);validate_mission(scenario)
    if scenario['id']!=raid_id(scenario):raise ValueError('Uncertainty mission content hash mismatch')
    normalized=copy.deepcopy(scenario)
    normalized.pop('decision_policy');normalized.pop('observation_mission');normalized['engine_version']='vyuha-0.5.0';normalized['id']=raid_id(normalized)
    validate_snapshot_v3(normalized)
    return scenario

@router.get('/catalog')
def catalog():
    with connect() as db:rows=db.execute("SELECT spec FROM scenarios WHERE json_extract(spec,'$.observation_mission.version') IN ('observation-mission-v1','observation-mission-v2') ORDER BY rowid DESC LIMIT 40",()).fetchall()
    missions=[]
    for row in rows:
        s=json.loads(row['spec']);m=s['observation_mission'];missions.append(dict(id=s['id'],mission_version=2 if m['version']==VERSION else 1,title=m['title'],objectives=m['objectives'],mode=m['mode'],template=m['template']))
    templates=[prior.brief(k) for k in prior.TEMPLATES]
    for t in templates:
        if 'C03' not in t['competencies']:t['competencies']=[*t['competencies'],'C03']
    return dict(version=VERSION,templates=templates,missions=missions)

@router.post('/prepare')
def prepare(request:prior.PrepareMission):
    try:return prior._persist(compile_mission(MissionRequest(**request.model_dump())))
    except ValueError as error:raise HTTPException(422,str(error)) from error

@router.post('/compile')
def compile_preview(request:MissionRequest):
    if not prior._SLOT.acquire(blocking=False):raise HTTPException(429,'Another author rehearsal is running; retry after it finishes')
    try:
        scenario=compile_mission(request)
        return dict(scenario=scenario,rehearsal=prior.rehearse(scenario,_validate=validate_mission,_simulation=Simulation))
    except ValueError as error:raise HTTPException(422,str(error)) from error
    finally:prior._SLOT.release()

@router.post('/publish')
def publish(request:MissionRequest):
    try:return prior._persist(compile_mission(request))
    except ValueError as error:raise HTTPException(422,str(error)) from error

@router.get('/{scenario_id}')
def frozen(scenario_id:str):
    with connect() as db:row=db.execute('SELECT spec FROM scenarios WHERE id=?',(scenario_id,)).fetchone()
    if not row:raise HTTPException(404,'Frozen uncertainty mission not found')
    scenario=json.loads(row['spec'])
    try:validate_mission(scenario)
    except ValueError as error:raise HTTPException(422,str(error)) from error
    return scenario
