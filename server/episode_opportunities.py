"""Bounded author-only rehearsal of unchanged v0.4 modeled sensor reports.

No trainee or instructor actions are applied, no database rows are written, and
no score/solvability/attention/acquisition result is inferred. Exact logical-tick
run lengths retain gaps; RF/IFF sample clocks remain unknown in this engine.
"""
import copy
import hashlib
import json
import re
import threading
import time
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field

from .engine import HZ, Simulation
from .models import StrictModel
from .portable import validate_snapshot_v2

VERSION = 'episode-opportunities-v1'
MAX_CONTACTS = 20
MAX_TRACK_TICKS = 72000
MAX_SEGMENTS = 16000
MAX_GEOMETRY_WORK = 288000
MAX_SECONDS = 5.0
CHANNELS = ('radar', 'eo', 'ir', 'rf', 'iff')
_LIMITATION = (
    'Counterfactual passive modeled reports with no trainee/instructor actions, '
    'not actual notice, gaze, active acquisition, human solvability, calibration, '
    'score or learning evidence. Intervals are half-open logical report ticks; '
    'held radar paints are not new samples. RF/IFF sample clocks are not recorded '
    'by this engine. Optical recognise/identify levels describe modeled shape '
    'resolution, not affiliation. Inactive contacts are not evidence opportunities. '
    'False radar clutter is not included in this planned-roster rehearsal.'
)
router = APIRouter(prefix='/api/v1/raids', tags=['Author sensor rehearsal'])
_SLOT = threading.BoundedSemaphore(1)


class OpportunityRequest(StrictModel):
    version: Literal['episode-opportunities-request-v1']
    expected_scenario_id: str = Field(pattern=r'^raid_[a-f0-9]{24}$')
    expected_fingerprint: str = Field(pattern=r'^[a-f0-9]{24}$')
    scenario: dict[str, Any] = Field(max_length=80)


class CapacityError(ValueError):
    pass


def _checked_scenario(scenario, expected_scenario_id, expected_fingerprint):
    if type(scenario) is not dict:
        raise ValueError('A frozen compiled raid is required')
    if scenario.get('engine_version') != 'vyuha-0.4.0' or type(scenario.get('version')) is not int or scenario.get('version') != 2:
        raise ValueError('Modeled report rehearsal requires frozen engine 0.4/schema 2')
    duration = scenario.get('duration')
    tracks = scenario.get('tracks')
    if type(duration) is not int or not 60 <= duration <= 180 or type(tracks) is not list:
        raise ValueError('Invalid frozen raid horizon/roster')
    if not 1 <= len(tracks) <= MAX_CONTACTS or len(tracks) * duration * HZ > MAX_TRACK_TICKS:
        raise CapacityError(f'Rehearsal is limited to {MAX_CONTACTS} contacts and {MAX_TRACK_TICKS} contact-ticks; reduce the roster or duration')
    boxes = scenario.get('terrain_boxes')
    if type(boxes) is not list or len(boxes) > 16 or len(tracks) * duration * HZ * max(1, len(boxes)) > MAX_GEOMETRY_WORK:
        raise CapacityError('Rehearsal static-geometry budget exceeded; reduce roster, duration or occluders')
    if type(expected_scenario_id) is not str or not re.fullmatch(r'raid_[a-f0-9]{24}', expected_scenario_id) or type(expected_fingerprint) is not str or not re.fullmatch(r'[a-f0-9]{24}', expected_fingerprint):
        raise ValueError('Invalid frozen rehearsal reference')
    if type(scenario.get('raid')) is not dict or scenario.get('id') != expected_scenario_id or scenario['raid'].get('fingerprint') != expected_fingerprint:
        raise ValueError('The rehearsal does not match the selected frozen raid')
    # Use the established import contract, including hash, complete config and
    # geometric consistency. Uploaded reports/results never become authority.
    validate_snapshot_v2(scenario)
    encoded = json.dumps(scenario, sort_keys=True, separators=(',', ':'), allow_nan=False)
    return copy.deepcopy(scenario), hashlib.sha256(encoded.encode()).hexdigest()


def _reading(active, channel, report):
    value = report[channel]
    available = value['available']
    if not active:
        state = 'inactive'
    elif not available:
        state = 'unavailable'
    elif channel == 'radar':
        state = value['state']
    elif channel in ('eo', 'ir'):
        state = value['level']
    elif channel == 'rf':
        state = 'detected' if value['detected'] else 'not_detected'
    else:
        state = value['cue']
    sample = value.get('sample_tick') if channel in ('radar', 'eo', 'ir') else None
    return state, available, sample


def rehearse_opportunities(scenario, expected_scenario_id, expected_fingerprint, *, maximum_seconds=None):
    """Pure successful result. Capacity refusal never returns partial intervals.

    The optional wall-time guard limits service work, not logical model timing.
    Successful identical inputs always produce the same deterministic result.
    """
    started = time.monotonic()
    spec, digest = _checked_scenario(scenario, expected_scenario_id, expected_fingerprint)
    end = spec['duration'] * HZ
    result = {
        'version': VERSION,
        'scenario_id': spec['id'],
        'raid_fingerprint': spec['raid']['fingerprint'],
        'scenario_hash': digest,
        'engine_version': 'vyuha-0.4.0',
        'sensor_version': spec['sensor_version'],
        'scope': 'counterfactual-unintervened-author-reference',
        'horizon': {'first_tick': 0, 'end_tick_exclusive': end, 'hz': HZ},
        'actions_applied': 0,
        'commands_applied': 0,
        'planned_contacts': len(spec['tracks']),
        'segment_count': 0,
        'contacts': [],
        'limitation': _LIMITATION,
    }
    rows = {}
    for track in spec['tracks']:
        row = {'track_id': track['id'], 'active_ticks': 0,
               'channels': {name: {'state_ticks': {}, 'intervals': []} for name in CHANNELS}}
        result['contacts'].append(row)
        rows[track['id']] = row
    sim = Simulation(spec)
    segments = 0
    for tick in range(end):
        if tick % HZ == 0 and maximum_seconds is not None and time.monotonic() - started > maximum_seconds:
            raise TimeoutError('Modeled report rehearsal exceeded its service time budget; no partial result was returned')
        if sim.tick != tick:
            raise ValueError('Authoritative rehearsal clock did not advance as expected')
        for track in sim.tracks:
            row = rows[track['id']]
            row['active_ticks'] += int(track['active'])
            observation = track['observation']
            if observation['tick'] != tick or observation['track_id'] != track['id'] or observation['version'] != 'vyuha-0.4.0':
                raise ValueError('Uncorrelated authoritative observation')
            for channel in CHANNELS:
                state, available, sample = _reading(track['active'], channel, observation)
                channel_row = row['channels'][channel]
                counts = channel_row['state_ticks']
                counts[state] = counts.get(state, 0) + 1
                intervals = channel_row['intervals']
                if intervals and intervals[-1]['state'] == state and intervals[-1]['available'] == available:
                    interval = intervals[-1]
                    interval['end_tick_exclusive'] = tick + 1
                    if sample is not None:
                        if interval['first_sample_tick'] is None:
                            interval['first_sample_tick'] = sample
                        interval['last_sample_tick'] = sample
                else:
                    segments += 1
                    if segments > MAX_SEGMENTS:
                        raise CapacityError(f'Rehearsal report variability exceeds {MAX_SEGMENTS} exact intervals; reduce the workload')
                    intervals.append({'first_tick': tick, 'end_tick_exclusive': tick + 1,
                                      'state': state, 'available': available,
                                      'first_sample_tick': sample, 'last_sample_tick': sample})
        if tick + 1 < end:
            sim.step(force=True)
    if sim.events or sim.commands:
        raise ValueError('Passive author rehearsal unexpectedly applied an intervention')
    result['segment_count'] = segments
    return result


@router.post('/opportunities')
def opportunities(request: OpportunityRequest):
    # The existing OfficerAuthorization middleware protects all /api/v1/raids
    # routes. One bounded worker prevents concurrent costly request stampedes.
    if not _SLOT.acquire(blocking=False):
        raise HTTPException(429, 'Another modeled-report rehearsal is running; retry shortly', headers={'Retry-After': '2'})
    try:
        return rehearse_opportunities(request.scenario, request.expected_scenario_id,
                                      request.expected_fingerprint, maximum_seconds=MAX_SECONDS)
    except TimeoutError as error:
        raise HTTPException(503, str(error), headers={'Retry-After': '2'}) from error
    except (ValueError, KeyError, TypeError, OverflowError) as error:
        raise HTTPException(422, str(error)) from error
    finally:
        _SLOT.release()
