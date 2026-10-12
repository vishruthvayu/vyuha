"""Authenticated authoring of immutable v0.4 raid scenarios."""
from datetime import datetime,timezone
from fastapi import APIRouter,HTTPException
from .raid_v2 import RaidRequest,compose_raid
from .storage import connect,dumps
router=APIRouter(prefix='/api/v1/raids')
@router.post('/preview')
def preview(req:RaidRequest):
    try:return compose_raid(req)
    except ValueError as e:raise HTTPException(422,str(e)) from e
@router.post('',status_code=201)
def save(req:RaidRequest):
    scenario=preview(req)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('INSERT OR IGNORE INTO scenarios VALUES (?,?)',(scenario['id'],dumps(scenario)))
        db.execute('INSERT OR IGNORE INTO scenario_library VALUES (?,?,?)',(scenario['id'],datetime.now(timezone.utc).isoformat(),dumps(req.model_dump())))
    return scenario
