"""Read-only C01 observation-opportunity diagnostic; never scoring or mastery.

Only sensor observations enter the monitor. The simulation adapter necessarily
executes the existing frozen engine; canonical kind/identity/coordinates are not
monitor features. This passive-run check does not establish human solvability.
"""
import copy
import hashlib
import json
import math
from dataclasses import dataclass
from fastapi import APIRouter, Depends, HTTPException, Query, Request


def _require_officer(request: Request):
    # Keep protection at the router as well as the existing evaluations middleware.
    from .auth import bearer, valid
    if not valid(bearer(request.headers)):
        raise HTTPException(401, 'Officer sign-in required', headers={'WWW-Authenticate': 'Bearer'})


router = APIRouter(prefix='/api/v1/evaluations/assessment-diagnostics',
                   tags=['Assessment diagnostics'], dependencies=[Depends(_require_officer)])

VERSION = 'observation-obligation-pilot-v1'
PILOT_ITEM = 'C01_BASELINE-A_A'
PILOT_CATALOG = '5abe5c7920a40c989546bc59abf77c4cb6430f0cd8a8af5dca2a361ac977d345'
MAX_FRAMES = 50000
LIMITATION = ('Passive synthetic observation-window diagnostic only; no score, '
              'human solvability, difficulty equivalence, physical calibration, '
              'proficiency or learning benefit is established. Identity ambiguity is permitted.')


def _integer(value, low, high, label):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f'{label} must be an integer in {low}..{high}')
    return value


@dataclass(frozen=True)
class ObservationObligation:
    """Proposed diagnostic threshold, not a frozen score/assessment requirement."""
    competency_id: str = 'C01'
    start_tick: int = 0
    end_tick: int = 1799
    minimum_contiguous_ticks: int = 15
    maximum_sample_age_ticks: int = 30

    def __post_init__(self):
        if self.competency_id != 'C01':
            raise ValueError('Pilot supports C01 only; other competencies need separate contracts')
        _integer(self.start_tick, 0, 5399, 'start_tick')
        _integer(self.end_tick, self.start_tick, 5399, 'end_tick')
        _integer(self.minimum_contiguous_ticks, 1, 5400, 'minimum_contiguous_ticks')
        _integer(self.maximum_sample_age_ticks, 0, 90, 'maximum_sample_age_ticks')


def project_observation(observation):
    """Allowlist only the delivered sensor contract; ignore all extra truth fields."""
    if not isinstance(observation, dict):
        raise ValueError('Observation must be an object')
    tick = _integer(observation.get('tick'), 0, 5399, 'observation tick')
    track_id = observation.get('track_id')
    if not isinstance(track_id, str) or not 1 <= len(track_id) <= 64:
        raise ValueError('A bounded observed track ID is required')
    channels = {}
    for name in ('radar', 'eo', 'ir'):
        source = observation.get(name, {})
        if not isinstance(source, dict):
            raise ValueError('Sensor channel must be an object')
        position = source.get('position')
        if position is not None:
            if not isinstance(position, dict) or any(
                isinstance(position.get(axis), bool) or
                not isinstance(position.get(axis), (int, float)) or
                not math.isfinite(position[axis]) for axis in ('x', 'z', 'altitude')
            ):
                raise ValueError('Observed position must be finite')
        sample = source.get('sample_tick')
        if sample is not None:
            _integer(sample, 0, tick, 'sample_tick (future samples are forbidden)')
        signal = source.get('detected') is True if name == 'radar' else source.get('level') in ('detect', 'recognise', 'identify')
        channels[name] = dict(available=source.get('available') is True,
                              signal=signal, positioned=position is not None,
                              sample_tick=sample)
    # No reply is deliberately *not* interpreted as hostile or as absent target.
    iff = observation.get('iff', {})
    if not isinstance(iff, dict):
        raise ValueError('IFF observation must be an object')
    cue = iff.get('cue')
    return dict(tick=tick, track_id=track_id, channels=channels,
                identity_ambiguous=cue not in ('friendly_reply', 'registered_civil'))


def evaluate_observations(observations, obligation=None):
    """Stream ordered observations; no input writes, engine actions or DB access."""
    obligation = obligation or ObservationObligation()
    last_tick = -1
    tick_tracks = set()
    runs = {}
    longest = {}
    qualifying = []
    stale_samples = ambiguous_ticks = count = 0
    digest = hashlib.sha256()
    for observation in observations:
        count += 1
        if count > MAX_FRAMES:
            raise ValueError('Observation diagnostic frame limit exceeded')
        row = project_observation(observation)
        tick, track = row['tick'], row['track_id']
        if tick < last_tick:
            raise ValueError('Observations must be ordered; do not repair evidence order')
        if tick != last_tick:
            tick_tracks.clear()
        if track in tick_tracks:
            raise ValueError('Duplicate observed track/tick cannot create an opportunity')
        tick_tracks.add(track)
        last_tick = tick
        digest.update((json.dumps(row, sort_keys=True, separators=(',', ':'))+'\n').encode())
        if not obligation.start_tick <= tick <= obligation.end_tick:
            continue
        visible = []
        for name, channel in row['channels'].items():
            if not (channel['available'] and channel['signal'] and channel['positioned']):
                continue
            sample = channel['sample_tick']
            if sample is None or tick-sample > obligation.maximum_sample_age_ticks:
                stale_samples += 1
                continue
            visible.append(name)
        if not visible:
            runs.pop(track, None)
            continue
        ambiguous_ticks += int(row['identity_ambiguous'])
        previous = runs.get(track)
        start = previous[0] if previous and previous[1] == tick-1 else tick
        runs[track] = (start, tick)
        span = tick-start+1
        if span > longest.get(track, {}).get('ticks', 0):
            longest[track] = dict(track_id=track, start_tick=start, end_tick=tick, ticks=span)
        if span == obligation.minimum_contiguous_ticks:
            qualifying.append(dict(track_id=track, start_tick=start, end_tick=tick))
    return dict(version=VERSION, competency_id='C01',
                status='SATISFIED' if qualifying else 'UNSATISFIED',
                criterion='At least one observed track has the proposed contiguous detection window',
                obligation=dict(start_tick=obligation.start_tick, end_tick=obligation.end_tick,
                                minimum_contiguous_ticks=obligation.minimum_contiguous_ticks,
                                maximum_sample_age_ticks=obligation.maximum_sample_age_ticks),
                observed_frames=count, projected_observation_sha256=digest.hexdigest(),
                first_qualifying_window=qualifying[0] if qualifying else None,
                longest_windows=sorted(longest.values(), key=lambda r: r['track_id']),
                stale_channel_samples=stale_samples,
                visible_ambiguous_identity_frames=ambiguous_ticks,
                reason='OBSERVED_WINDOW_PRESENT' if qualifying else 'NO_TIME_VALID_WINDOW',
                limitation=LIMITATION)


def frozen_pilot(seed=7):
    """Compile one named assessment through normal versioned learning APIs."""
    from .learning import catalog, choose_item, PrepareLearning, LearningContext, compile_item
    _integer(seed, 0, 4294967295, 'seed')
    data, digest = catalog()
    if digest != PILOT_CATALOG:
        raise ValueError('Frozen pilot catalog changed; do not silently reinterpret its obligations')
    state = dict(competencies={c['id']: dict(correct=0, incorrect=0, unassessable=0, assessed_sessions=0)
                               for c in data['competencies'] if c['scope'] == 'individual'}, recent_items=[])
    req = PrepareLearning(request_id='obligation-pilot', trainee='SYNTHETIC', mode='assessment',
                          item_id=PILOT_ITEM, form='baseline-a', seed=seed)
    item, selection = choose_item(data, state, req)
    context = LearningContext(catalog_hash=digest, item_id=item['id'], mode='assessment',
                              assistance='none', seed=seed, selection=selection)
    return compile_item(context), context.model_dump()


def passive_observations(scenario):
    """Run real engine without actions; emit copies of observations, never truth."""
    from .engine import Simulation
    if scenario.get('engine_version') != 'vyuha-0.4.0':
        raise ValueError('Pilot requires the frozen v0.4 observation contract')
    end_tick = _integer(scenario.get('duration'), 60, 180, 'duration')*30
    sim = Simulation(copy.deepcopy(scenario))
    while sim.tick < end_tick:
        for track in sim.tracks:
            # The monitor gets only the delivered observation. Inactive/no-signal
            # rows add no opportunity; no truth-based filtering is performed.
            yield copy.deepcopy(track['observation'])
        sim.step(force=True)


def pilot_report(seed=7):
    scenario, context = frozen_pilot(seed)
    report = evaluate_observations(passive_observations(scenario))
    report.update(item_id=context['item_id'], catalog_hash=context['catalog_hash'], seed=seed,
                  scenario_sha256=hashlib.sha256(json.dumps(scenario, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
                  engine_version=scenario['engine_version'], method='passive existing Python engine; no trainee actions or score writes')
    return report


@router.get('/c01')
def c01_diagnostic(seed: int = Query(default=7, ge=0, le=4294967295)):
    """Explicit officer request only; recompute passive evidence without writes/cache."""
    try:
        return pilot_report(seed)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
