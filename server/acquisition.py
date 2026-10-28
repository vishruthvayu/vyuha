"""Versioned active-observation practice authoring, without mastery claims."""
import copy
from fastapi import APIRouter, HTTPException
from pydantic import Field
from .models import StrictModel
from .raid_v2 import RaidRequest, compose_raid, raid_id
from .engine_v3 import DEFAULT_POLICY, ENGINE_VERSION, validate_policy
from .storage import connect, dumps

router = APIRouter(prefix='/api/v1/acquisition', tags=['Active observation practice'])

class Practice(StrictModel):
    seed: int = Field(default=482913, ge=0, le=4294967295)
    night: bool = False


def make_practice(seed=482913, night=False):
    scenario = compose_raid(RaidRequest(seed=seed, duration=90, night=night, difficulty='foundational',
        name='Active observation — evidence before decision', focus='classification_iff', family='DIRECT',
        mix=['hostile_quad', 'friendly_uav', 'bird'], fusion={'version':'fusion-1','mode':'training','exercise':'normal','bias_seed':0}))
    scenario['engine_version'] = ENGINE_VERSION
    scenario['acquisition_policy'] = copy.deepcopy(DEFAULT_POLICY)
    scenario['acquisition_policy']['cadenceTicks'] = scenario['sensor_config']['optical_sample_ticks']
    scenario['id'] = raid_id(scenario)
    return scenario


def validate_snapshot_v3(scenario):
    from .portable import validate_snapshot_v2
    validate_policy(scenario)
    if scenario['id'] != raid_id(scenario):
        raise ValueError('Acquisition content hash disagrees with frozen specification')
    if 'observation_mission' in scenario:
        from .observation_missions import validate_mission
        validate_mission(scenario)
    normalized = copy.deepcopy(scenario)
    normalized.pop('observation_mission', None)
    del normalized['acquisition_policy']
    normalized['engine_version'] = 'vyuha-0.4.0'
    normalized['id'] = raid_id(normalized)
    validate_snapshot_v2(normalized)
    return scenario


@router.post('/practice')
def practice(request: Practice):
    try:
        spec = make_practice(request.seed, request.night)
        validate_snapshot_v3(spec)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    with connect() as db:
        db.execute('INSERT OR IGNORE INTO scenarios(id,spec) VALUES (?,?)', (spec['id'], dumps(spec)))
    return spec
