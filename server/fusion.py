"""Evidence-only training assistant plus separately stored reconstructed receipts.
Normalized heuristic scores are not calibrated probabilities. Receipt validation
proves a model/input boundary, not human viewing, cognitive reliance or correctness.
"""
import copy
import json
import math
import re
from types import SimpleNamespace
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

VERSION = 'fusion-1'
KINDS = ['bird', 'quad', 'fixed_wing', 'fiber_fpv']
DEFAULT_CONFIG = dict(version=VERSION, mode='training', exercise='normal', bias_seed=0)
LIMITATIONS = ['Illustrative heuristic scores, not calibrated posterior probabilities.', 'RF silence and absent IFF reply do not establish hostile intent.', 'Optical shape cannot identify RF-control medium.', 'Advice is training-only; decisions remain with the operator.']


def _integer(v, maximum=5400):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and int(v) == v and 0 <= v <= maximum


def _q(v):
    return math.floor(v * 1e6 + .5) / 1e6


def configuration(value=None):
    value = value or {}
    if not isinstance(value, dict) or set(value) - set(DEFAULT_CONFIG):
        raise ValueError('Unknown fusion config')
    result = {**DEFAULT_CONFIG, **value}
    if result['version'] != VERSION or result['mode'] not in ['training', 'assessment'] or result['exercise'] not in ['normal', 'rf_overweight'] or not _integer(result['bias_seed'], 4294967295):
        raise ValueError('Invalid fusion config')
    return result


def sanitize_evidence(value):
    if not isinstance(value, dict) or value.get('version') != 'vyuha-0.4.0' or not _integer(value.get('tick')) or not isinstance(value.get('track_id'), str) or not re.fullmatch(r'[-A-Za-z0-9_]{1,64}', value['track_id']):
        raise ValueError('Invalid observation envelope')
    optical = []
    for channel in ['eo', 'ir']:
        o = value.get(channel) or {}
        if o.get('available') is True and o.get('level') in ['detect', 'recognise', 'identify'] and _integer(o.get('sample_tick')) and 0 <= value['tick'] - o['sample_tick'] <= 6:
            shape = o.get('silhouette') if o.get('level') != 'detect' and o.get('silhouette') in ['bird', 'fixed_wing', 'multirotor'] else None
            optical.append(dict(channel=channel, level=o['level'], shape=shape, sample_tick=o['sample_tick']))
    r = value.get('radar') or {}
    radar = r.get('state') if r.get('available') is True and _integer(r.get('sample_tick')) and 0 <= value['tick'] - r['sample_tick'] <= 90 and r.get('state') in ['tentative', 'confirmed', 'lost'] else 'none'
    rf = value.get('rf') or {}
    rf_cue = ('signal' if rf.get('detected') is True else 'no_signal') if rf.get('available') is True else 'unavailable'
    iff = value.get('iff') or {}
    iff_cue = iff.get('cue') if iff.get('available') is True and iff.get('cue') in ['friendly_reply', 'registered_civil', 'no_reply'] else 'unavailable'
    return dict(tick=value['tick'], track_id=value['track_id'], radar=radar, optical=optical, rf=rf_cue, iff=iff_cue)


def _prior(value):
    value = value or {}
    kind, identity = value.get('kind'), value.get('identity')
    if kind is not None and kind not in KINDS or identity is not None and identity not in ['friendly', 'neutral', 'hostile']:
        raise ValueError('Invalid operator prior')
    return dict(kind=kind, identity=identity)


def _hash(value):
    # Match JavaScript UTF-16 code units. Envelope IDs are ASCII; reasons are not hashed.
    raw = value.encode('utf-16-le')
    h = 2166136261
    for i in range(0, len(raw), 2):
        h = ((h ^ (raw[i] + raw[i + 1] * 256)) * 16777619) & 0xffffffff
    return format(h, '08x')


def advice(observation, prior=None, config=None, context=None):
    c = configuration(config)
    if c['mode'] == 'assessment':
        return None
    context = context or dict(session_id='local', scenario_id='local')
    if not all(isinstance(context.get(k), str) and re.fullmatch(r'[-A-Za-z0-9_.:]{1,100}', context[k]) for k in ['session_id', 'scenario_id']):
        raise ValueError('Invalid fusion context')
    boundary = context.get('before_order', 0)
    if not _integer(boundary, 100001):
        raise ValueError('Invalid fusion boundary')
    context = {**{k: context[k] for k in ['session_id', 'scenario_id']}, 'before_order': boundary}
    evidence, operator, parts = sanitize_evidence(observation), _prior(prior), []
    def add(cue, reason, weights):
        parts.append(dict(cue=cue, reason=reason, weights=weights))
    shapes = list(dict.fromkeys(o['shape'] for o in evidence['optical'] if o['shape']))
    if len(shapes) == 1:
        shape = shapes[0]
        weights = [2, -.5, -.5, -.5] if shape == 'bird' else [-.5, -.5, 2, -.5] if shape == 'fixed_wing' else [-.5, 1, -.5, 1]
        add('optical_shape', f'Observed {shape} silhouette; EO/IR are counted once.', weights)
    elif len(shapes) > 1:
        add('optical_conflict', 'EO/IR shapes disagree; retain uncertainty.', [0, 0, 0, 0])
    elif evidence['optical']:
        add('optical_detection', 'Detection alone does not identify type.', [0, 0, 0, 0])
    if evidence['rf'] == 'signal':
        add('rf_signal', 'An RF emission is observed; association and control medium remain uncertain.', [-.15, .4, .15, -.15])
    if evidence['rf'] == 'no_signal':
        add('rf_silence', 'No emission detected; silence does not prove fiber control or hostile intent.', [0, -.05, 0, .05])
    if evidence['radar'] != 'none':
        add('radar_track', 'Radar track lifecycle supports observation, not affiliation or type.', [0, 0, 0, 0])
    if operator['kind']:
        add('operator_prior', 'Operator label is a weak prior, not independent sensor evidence.', [.2 if k == operator['kind'] else 0 for k in KINDS])
    bias = c['exercise'] == 'rf_overweight'
    if bias:
        add('exercise_bias', 'Synthetic automation-bias exercise overweights an assumed RF-controlled quad; challenge the recommendation.', [0, 3 + (c['bias_seed'] % 3) * .1, 0, 0])
    raw = [max(.05, 1 + sum(p['weights'][i] for p in parts)) for i in range(4)]
    probabilities = [r / sum(raw) for r in raw]
    hypotheses = [dict(kind=k, score=_q(probabilities[i])) for i, k in enumerate(KINDS)]
    hypotheses.sort(key=lambda h: (-h['score'], KINDS.index(h['kind'])))
    identity = 'friendly_cue' if evidence['iff'] == 'friendly_reply' else 'registered_civil_cue' if evidence['iff'] == 'registered_civil' else 'unresolved'
    visible = bool(evidence['optical']) or evidence['radar'] == 'confirmed'
    recommendation = 'hold' if identity != 'unresolved' else 'verify_identity' if visible else 'observe'
    payload = json.dumps([VERSION, context['session_id'], context['scenario_id'], boundary, c['mode'], c['exercise'], c['bias_seed'], evidence, operator], separators=(',', ':'), ensure_ascii=False)
    return dict(version=VERSION, exposure_id=f'fusion-{_hash(payload)}', evidence=evidence, prior=operator, config=c, context=context, hypotheses=hypotheses, uncertainty=_q(-sum(p * math.log(p) for p in probabilities) / math.log(4)), identity=identity, recommendation=recommendation, contributions=parts, bias_injected=bias, limitations=LIMITATIONS.copy())


def brier_score(distribution, reference):
    values = [distribution.get(k) for k in KINDS]
    if set(distribution) != set(KINDS) or reference not in KINDS or not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and 0 <= v <= 1 for v in values) or abs(sum(values) - 1) > 1e-6:
        raise ValueError('Invalid confidence distribution')
    return _q(sum((distribution[k] - (1 if k == reference else 0)) ** 2 for k in KINDS))


def review_reliance(result, decision, max_age_ticks=90):
    e = result['evidence']
    assessable = decision.get('track') == e['track_id'] and e['tick'] <= decision['tick'] <= e['tick'] + max_age_ticks and decision.get('kind') in KINDS
    relation = 'unassessable' if not assessable else 'aligned' if decision['kind'] == result['hypotheses'][0]['kind'] else 'overrode'
    return dict(exposure_id=result['exposure_id'], relation=relation, bias_injected=result['bias_injected'], note='Alignment is an observed comparison, not proof of cognitive reliance or decision correctness.')


class FrozenFusionConfig(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid')
    version: Literal['fusion-1'] = 'fusion-1'
    mode: Literal['training','assessment'] = 'training'
    exercise: Literal['normal','rf_overweight'] = 'normal'
    bias_seed: int = Field(default=0,ge=0,le=4294967295)


class Exposure(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid')
    tick: int = Field(ge=0, le=5400)
    before_order: int = Field(ge=0, le=100001)
    track: str = Field(pattern=r'^T[1-9][0-9]{0,2}$')
    exposure_id: str = Field(pattern=r'^fusion-[0-9a-f]{8}$')
    action_order: int | None = Field(default=None, ge=0, le=100000)
    association: Literal['accepted', 'rejected', 'independent', 'unspecified'] = 'unspecified'
    distribution: dict[str, float] | None = None


class ExposureBatch(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid')
    exposures: list[Exposure] = Field(max_length=200)


router = APIRouter(prefix='/api/v1/sessions', tags=['Fusion training receipts'])


def ensure_schema(db):
    db.execute('CREATE TABLE IF NOT EXISTS fusion_exposures(session_id TEXT NOT NULL,exposure_id TEXT NOT NULL,body TEXT NOT NULL,receipt TEXT NOT NULL,PRIMARY KEY(session_id,exposure_id))')


def validate_exposure(spec, events, commands, session_id, exposure, horizon, *, _boundary=None):
    """Reconstruct only the accepted prefix BEFORE the display boundary/action.
    No mutation of a scorecard, original session, event stream or learner profile.
    """
    from .engine import replay
    if spec.get('engine_version') not in ('vyuha-0.4.0','vyuha-0.5.0') or not spec.get('fusion'):
        raise ValueError('Fusion is not enabled in the frozen scenario')
    config = configuration(spec['fusion'])
    if config['mode'] == 'assessment':
        raise ValueError('Assessment does not expose assistant advice')
    if exposure.tick > horizon or exposure.tick >= spec['duration'] * 30:
        raise ValueError('Exposure outside observed session horizon')
    ordered_events = [dict(e, order=e.get('order', i)) for i, e in enumerate(events)]
    timeline = ordered_events + commands
    if len({e['order'] for e in timeline}) != len(timeline):
        raise ValueError('Exposure needs a unique accepted timeline order')
    if spec.get('engine_version')!='vyuha-0.5.0' and exposure.before_order > max([e['order'] for e in timeline], default=-1) + 1:
        raise ValueError('Exposure boundary exceeds accepted timeline')
    def preceding(e):
        return e['tick'] < exposure.tick or e['tick'] == exposure.tick and e['order'] < exposure.before_order
    if any(e['tick'] < exposure.tick and e['order'] >= exposure.before_order or e['tick'] > exposure.tick and e['order'] < exposure.before_order for e in timeline):
        raise ValueError('Exposure order disagrees with logical time')
    frontier = max([e['order'] for e in timeline if preceding(e)], default=-1) + 1
    if spec.get('engine_version')!='vyuha-0.5.0' and exposure.before_order != frontier:
        raise ValueError('Exposure boundary is not the next accepted timeline order')
    sim = _boundary if _boundary is not None else replay(spec, [e for e in ordered_events if preceding(e)], exposure.tick, [c for c in commands if preceding(c)])
    if spec.get('engine_version')=='vyuha-0.5.0' and exposure.before_order != sim.next_order:
        raise ValueError('Exposure boundary is not the next acquisition timeline order')
    track = next((t for t in sim.tracks if t['id'] == exposure.track and t['active']), None)
    if track is None or not track.get('observation'):
        raise ValueError('Exposure contact is not active at this boundary')
    result = advice(track['observation'], dict(kind=track.get('classification'), identity=track.get('declared')), config, dict(session_id=session_id, scenario_id=spec['id'], before_order=exposure.before_order))
    if exposure.exposure_id != result['exposure_id']:
        raise ValueError('Exposure identifier disagrees with reconstructed advice')
    decision = next((a for a in ordered_events if a['order'] == exposure.action_order), None) if exposure.action_order is not None else None
    if exposure.action_order is not None and (not decision or decision['track'] != exposure.track or decision['tick'] < exposure.tick or decision['order'] < exposure.before_order or decision['tick'] - exposure.tick > 90):
        raise ValueError('Associated action is absent, precedes exposure or is stale')
    diagnostic = None
    if exposure.distribution is not None:
        # Reference truth is used ONLY after reconstruction for a labelled diagnostic.
        diagnostic = dict(metric='multiclass_brier', value=brier_score(exposure.distribution, track['kind']), scope='optional confidence diagnostic against scenario reference; does not change score or skill profile')
    return dict(advice=result, association=exposure.association, association_source='client self-report; not independently verified', action_order=exposure.action_order, alignment=review_reliance(result, decision) if decision else None, confidence_diagnostic=diagnostic, validation_scope='Frozen model and accepted-log boundary validated; human viewing and causal reliance are not verified.')


def reconstruct_boundaries(spec, events, commands, exposures):
    """One replay per batch; copy only requested contacts at exact prefix boundaries."""
    from .engine import replay
    if not exposures:
        return {}
    requested = {}
    for e in exposures:
        requested.setdefault((e.tick, e.before_order), set()).add(e.track)
    boundaries, frontier = {}, 0
    def observe(sim, stage, event, order):
        nonlocal frontier
        if stage in ['action', 'command']:
            frontier = order + 1
        if spec.get('engine_version')=='vyuha-0.5.0':frontier=sim.next_order
        key = (sim.tick, frontier)
        if key in requested:
            boundaries[key] = SimpleNamespace(next_order=frontier,tracks=copy.deepcopy([t for t in sim.tracks if t['id'] in requested[key]]))
    end = max(e.tick for e in exposures)
    replay(spec, [e for e in events if e['tick'] <= end], end, [c for c in commands if c['tick'] <= end], observer=observe)
    if set(requested) - set(boundaries):
        raise ValueError('Display boundary does not match accepted-log prefix')
    return boundaries


@router.post('/{session_id}/fusion-exposures')
def record_exposures(session_id: str, body: ExposureBatch):
    from .main import session_record, logged_events, applied_commands
    from .storage import connect, dumps
    with connect() as db:
        db.execute('BEGIN')
        row = dict(session_record(db, session_id))
        events, commands = logged_events(db, session_id), applied_commands(db, session_id)
        spec = json.loads(row['spec'])
        telemetry = json.loads(row['control_state']) if row['control_state'] else {}
        horizon = row['execution_tick'] if row['execution_tick'] is not None else telemetry.get('tick', max([e['tick'] for e in events + commands], default=0))
    if row['status'] != 'completed' and any(e.distribution is not None for e in body.exposures):
        raise HTTPException(422, 'Reference confidence diagnostics are available after completion only')
    try:
        # Reconstruct once outside the writer lock; every receipt still binds its exact boundary.
        boundaries = reconstruct_boundaries(spec, events, commands, body.exposures)
        receipts = [(e, validate_exposure(spec, events, commands, session_id, e, horizon, _boundary=boundaries[(e.tick, e.before_order)])) for e in body.exposures]
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(422, str(error)) from error
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        current = dict(session_record(db, session_id))
        if current['spec'] != row['spec'] or current['status'] != row['status'] or current['execution_tick'] != row['execution_tick'] or logged_events(db, session_id) != events or applied_commands(db, session_id) != commands:
            raise HTTPException(409, 'Session changed during receipt reconstruction; retry')
        ensure_schema(db)
        # All validations happen first; retries are idempotent and conflicts fail atomically.
        for e, receipt in receipts:
            old = db.execute('SELECT body FROM fusion_exposures WHERE session_id=? AND exposure_id=?', (session_id, e.exposure_id)).fetchone()
            serialized = dumps(e.model_dump(exclude_none=True))
            if old and old['body'] != serialized:
                raise HTTPException(409, 'Fusion exposure cannot be reused with different metadata')
            db.execute('INSERT OR IGNORE INTO fusion_exposures VALUES (?,?,?,?)', (session_id, e.exposure_id, serialized, dumps(receipt)))
        if db.execute('SELECT COUNT(*) FROM fusion_exposures WHERE session_id=?', (session_id,)).fetchone()[0] > 2000:
            raise HTTPException(422, 'Session fusion receipt limit exceeded')
    return dict(recorded=len(receipts), validation_scope='Reconstructed display model/boundary; not proof of human viewing or reliance')


@router.get('/{session_id}/fusion-review')
def fusion_review(session_id: str):
    from .main import session_record
    from .storage import connect
    with connect() as db:
        session_record(db, session_id)
        ensure_schema(db)
        receipts = [json.loads(r['receipt']) for r in db.execute('SELECT receipt FROM fusion_exposures WHERE session_id=? ORDER BY rowid', (session_id,))]
    diagnostics = [r['confidence_diagnostic']['value'] for r in receipts if r['confidence_diagnostic']]
    return dict(version=VERSION, exposures=receipts, confidence_diagnostic=dict(count=len(diagnostics), mean_brier=_q(sum(diagnostics)/len(diagnostics)) if diagnostics else None, scope='Optional logged confidence; no calibration or learning-efficacy claim'), limitations=['Display exposures and advice association are client-reported; deterministic receipt validation does not establish human reliance.', 'Bias exercises and normalized advice weights are synthetic uncalibrated training heuristics.', 'Original scorecards and Beta profiles are unchanged.'])
