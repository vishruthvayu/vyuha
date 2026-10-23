"""Read-only C01 observation-opportunity diagnostic; never scoring or mastery.

Only sensor observations enter the monitor. The simulation adapter necessarily
executes the existing frozen engine; canonical kind/identity/coordinates are not
monitor features. This passive-run check does not establish human solvability.
"""
import copy
import hashlib
import json
import math
import platform
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
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


# A diagnostic authoring receipt, deliberately separate from preparation,
# assignment, study allocation, evidence credit and the engine's own generator.
GENERATION_VERSION = 'c01-generation-receipt-v1'
MAX_GENERATION_CANDIDATES = 3
COMPILER_CANDIDATE_BOUND = 24  # compose_raid's existing, unchanged inner bound
GENERATION_SEED_LIST = (0, 7, 19)
_CONTENT_FIELDS = ('title', 'objective', 'instructions', 'reflection')
_MANIFEST_FIELDS = {'item_id', 'catalog_hash', 'content_version', 'mode', 'form',
                    'assistance', 'seed', 'scenario_sha256', 'content'}
_CUE_FIELDS = {'answer', 'answer_key', 'solution', 'correct_response',
               'expected_action', 'hint', 'hints', 'advice', 'kind', 'identity',
               'threat_profile', 'preview_only'}


def _sha256(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     allow_nan=False).encode()).hexdigest()


def _generation_source_paths():
    # Include the effective generator, passive engine and sensor/config inputs.
    # Exclude paths, local identities and unrelated application/DB/UI sources.
    from . import learning
    root = Path(learning.__file__).resolve().parent.parent
    paths = {f'server/{name}.py': root/'server'/f'{name}.py' for name in (
        'learning', 'models', 'raid_v2', 'engine', 'engine_v2', 'engine_v1_0_1',
        'prioritisation_v1_0_1', 'sensors_v2', 'fusion', 'response_v2')}
    paths['server/assessment_obligations.py'] = Path(__file__).resolve()
    for name in ('examples/finale-threats-v1.json', 'examples/finale-effectors-v1.json',
                 'server/config/sensors-v2.json'):
        paths[name] = root/name
    return paths


def _source_hashes():
    return {name: hashlib.sha256(path.read_bytes()).hexdigest()
            for name, path in _generation_source_paths().items()}


# Hash at import so changed disk files cannot describe stale loaded code or
# serve a previously cached result as though the new inputs were executed.
_LOADED_GENERATION_SOURCES = _source_hashes()


def _generation_inputs():
    from importlib.metadata import version
    from .learning import catalog
    data, digest = catalog()
    if digest != PILOT_CATALOG:
        raise ValueError('Frozen pilot catalog changed; do not silently reinterpret its obligations')
    sources = _source_hashes()
    if sources != _LOADED_GENERATION_SOURCES:
        raise ValueError('Generation source/config changed after import; restart before generating a receipt')
    return dict(catalog_hash=digest, content_version=data['version'],
                source_sha256=sources, python_version=platform.python_version(),
                pydantic_version=version('pydantic'))


def _pilot_content():
    from .learning import catalog
    data, digest = catalog()
    if digest != PILOT_CATALOG:
        raise ValueError('Frozen pilot catalog changed')
    item = next(item for item in data['items'] if item['id'] == PILOT_ITEM)
    return data, item


def _delivery_manifest(scenario, context):
    data, item = _pilot_content()
    return dict(item_id=PILOT_ITEM, catalog_hash=context['catalog_hash'],
                content_version=data['version'], mode='assessment', form=item['form'],
                assistance='none', seed=context['seed'], scenario_sha256=_sha256(scenario),
                content={field: copy.deepcopy(item[field]) for field in _CONTENT_FIELDS})


def _manifest_rejections(manifest, expected):
    """Schema/frozen-copy checks only; not general semantic cue detection."""
    def has_cue(value):
        if isinstance(value, dict):
            return bool(set(value) & _CUE_FIELDS) or any(has_cue(v) for v in value.values())
        return isinstance(value, list) and any(has_cue(v) for v in value)
    reasons = []
    if not isinstance(manifest, dict):
        return ['DELIVERY_MANIFEST_SCHEMA_MISMATCH']
    if has_cue(manifest):
        reasons.append('LEAKED_ANSWER_CUE_FIELD')
    if set(manifest) != _MANIFEST_FIELDS:
        reasons.append('DELIVERY_MANIFEST_SCHEMA_MISMATCH')
    if manifest != expected:
        reasons.append('FROZEN_DELIVERY_MANIFEST_MISMATCH')
    return reasons


def _parameter_assignment(scenario, context):
    # No roster, kind, canonical identity, hidden coordinates or answer key.
    _, item = _pilot_content()
    return dict(requested_seed=context['seed'], compiled_seed=scenario['seed'],
                source_scenario_spec_sha256=_sha256(item['scenario']),
                duration_seconds=scenario['duration'], terrain=scenario['terrain'],
                night=scenario['night'], fog=scenario['fog'],
                family=scenario['raid']['family'], focus=scenario['focus'],
                difficulty=scenario['difficulty_label'],
                compiler_rejected_candidates=scenario['raid']['anti_repeat']['rejected_attempts'])


def _generation_candidate(scenario, context, obligation, manifest=None):
    """Read-only candidate check, also used for precise failing mutations."""
    expected = _delivery_manifest(scenario, context)
    manifest = expected if manifest is None else manifest
    reasons = _manifest_rejections(manifest, expected)
    # Even a rejected cue is never echoed back into the receipt.
    result = dict(disposition='invalid', rejection_reasons=reasons,
                  parameter_assignment=_parameter_assignment(scenario, context),
                  scenario_sha256=_sha256(scenario), delivery_manifest=None,
                  observation_diagnostic=None)
    if reasons:
        return result
    report = evaluate_observations(passive_observations(scenario), obligation)
    result['observation_diagnostic'] = report
    if report['status'] != 'SATISFIED':
        result['rejection_reasons'] = ['NO_TIME_VALID_WINDOW_PASSIVE_RUN']
        return result
    result['disposition'] = ('valid-ambiguous' if report['visible_ambiguous_identity_frames']
                             else 'valid')
    result['delivery_manifest'] = copy.deepcopy(expected)
    return result


@lru_cache(maxsize=8)
def _cached_generation(seed, max_attempts, obligation, frozen_inputs_json):
    attempts, durations = [], []
    for index in range(max_attempts):
        candidate_seed = (seed + index*0x9E3779B9) & 0xffffffff
        started = time.perf_counter()
        # A finite-window contradiction is a proof about this proposed contract,
        # not a proof that a human cannot solve the original assessment.
        if obligation.minimum_contiguous_ticks > obligation.end_tick-obligation.start_tick+1:
            candidate = dict(disposition='invalid',
                             rejection_reasons=['UNSATISFIABLE_OBSERVATION_WINDOW'],
                             parameter_assignment=None, scenario_sha256=None,
                             delivery_manifest=None, observation_diagnostic=None)
        else:
            try:
                scenario, context = frozen_pilot(candidate_seed)
            except ValueError:
                candidate = dict(disposition='invalid',
                                 rejection_reasons=['COMPILER_CONSTRAINT_REJECTED'],
                                 parameter_assignment=None, scenario_sha256=None,
                                 delivery_manifest=None, observation_diagnostic=None)
            else:
                try:
                    candidate = _generation_candidate(scenario, context, obligation)
                except ValueError:
                    candidate = dict(disposition='invalid',
                                     rejection_reasons=['OBSERVATION_CONTRACT_REJECTED'],
                                     parameter_assignment=None, scenario_sha256=None,
                                     delivery_manifest=None, observation_diagnostic=None)
        durations.append(time.perf_counter()-started)
        attempts.append(dict(attempt=index+1, requested_seed=candidate_seed, **candidate))
        if candidate['disposition'] != 'invalid':
            break
    accepted = int(attempts[-1]['disposition'] != 'invalid')
    receipt = dict(version=GENERATION_VERSION, item_id=PILOT_ITEM, competency_id='C01',
                   purpose='diagnostic-only; not a learning preparation or study assignment',
                   mode='assessment', study_mode='not-enrolled', assistance='none',
                   frozen_inputs=json.loads(frozen_inputs_json), requested_seed=seed,
                   candidate_seed_rule='(seed + zero_based_attempt * 0x9E3779B9) modulo 2^32',
                   max_attempts=max_attempts, compiler_candidate_bound_per_attempt=COMPILER_CANDIDATE_BOUND,
                   maximum_observation_frames_per_attempt=7200,
                   obligation=dict(start_tick=obligation.start_tick, end_tick=obligation.end_tick,
                                   minimum_contiguous_ticks=obligation.minimum_contiguous_ticks,
                                   maximum_sample_age_ticks=obligation.maximum_sample_age_ticks),
                   disposition=attempts[-1]['disposition'] if accepted else 'generation-exhausted',
                   attempted_count=len(attempts), accepted_count=accepted,
                   rejected_count=len(attempts)-accepted, attempts=attempts,
                   objective_scope=('unsatisfiable-under-declared-window' if
                       attempts[0]['rejection_reasons'] == ['UNSATISFIABLE_OBSERVATION_WINDOW']
                       else 'passive-observation-check-only'),
                   not_evaluated=['human-solvability', 'classification-or-response-opportunity',
                                  'semantic-novelty', 'difficulty-equivalence', 'empirical-fairness',
                                  'semantic-answer-cues-in-frozen-prose', 'learning-benefit'],
                   limitation=LIMITATION)
    # Do not populate the cache if runtime inputs changed during computation.
    if _generation_inputs() != json.loads(frozen_inputs_json):
        raise ValueError('Frozen generation inputs changed during computation')
    return dict(receipt=receipt, receipt_sha256=_sha256(receipt),
                performance=dict(attempt_seconds=durations, max_seconds=max(durations),
                                 timing_scope='original computation; cache reuse retains these timings; excluded from receipt hash'))


def generation_report(seed=7, max_attempts=2, obligation=None, preview_seed=None):
    """Bounded frozen-family engineering receipt; no DB/preparation/score writes."""
    _integer(seed, 0, 4294967295, 'seed')
    _integer(max_attempts, 1, MAX_GENERATION_CANDIDATES, 'max_attempts')
    if preview_seed is not None:
        _integer(preview_seed, 0, 4294967295, 'preview_seed')
    inputs = _generation_inputs()
    result = copy.deepcopy(_cached_generation(seed, max_attempts, obligation or ObservationObligation(),
                          json.dumps(inputs, sort_keys=True, separators=(',', ':'))))
    result['preview'] = None
    if preview_seed is not None:
        # A fixed author preview is compiled separately. Its seed is never passed
        # into candidate selection or the delivered manifest; no preview validity
        # is inferred merely because this compilation succeeds.
        scenario, context = frozen_pilot(preview_seed)
        result['preview'] = dict(scope='preview-only; observation validity not evaluated',
                                 parameter_assignment=_parameter_assignment(scenario, context),
                                 scenario_sha256=_sha256(scenario))
    # Reject concurrent edits as well as edits present before cache lookup.
    if _generation_inputs() != inputs:
        raise ValueError('Frozen generation inputs changed during computation')
    return result


def generation_seed_report(seeds=GENERATION_SEED_LIST, max_attempts=2):
    """Small declared offline benchmark, not a new endpoint or difficulty metric."""
    if not isinstance(seeds, (tuple, list)) or not 1 <= len(seeds) <= 3:
        raise ValueError('Seed report requires one to three declared seeds')
    for seed in seeds:
        _integer(seed, 0, 4294967295, 'seed')
    if len(set(seeds)) != len(seeds):
        raise ValueError('Seed report cannot duplicate seeds')
    reports = [generation_report(seed, max_attempts) for seed in seeds]
    durations = [sum(report['performance']['attempt_seconds']) for report in reports]
    return dict(version=GENERATION_VERSION, seeds=list(seeds),
                accepted_count=sum(r['receipt']['accepted_count'] for r in reports),
                rejected_count=sum(r['receipt']['rejected_count'] for r in reports),
                exhausted_count=sum(r['receipt']['disposition'] == 'generation-exhausted' for r in reports),
                generation_seconds=dict(p95=sorted(durations)[math.ceil(.95*len(durations))-1],
                                        maximum=max(durations), per_seed=durations,
                                        method='nearest-rank p95 of at most three original computation timings; descriptive only'),
                reports=reports)


@router.get('/c01/generation')
def c01_generation_diagnostic(seed: int = Query(default=7, ge=0, le=4294967295),
                              max_attempts: int = Query(default=2, ge=1, le=MAX_GENERATION_CANDIDATES),
                              preview_seed: int | None = Query(default=None, ge=0, le=4294967295)):
    """Explicit officer authoring request; bounded work, no delivery or DB writes."""
    try:
        return generation_report(seed, max_attempts, preview_seed=preview_seed)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
