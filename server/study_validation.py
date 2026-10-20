"""Prespecified parallel-arm learning and descriptive advice analysis.

Receives sanitized exports, not private participant identities or live sessions.
Declared human records and randomization must be independently verified. The
software never proves consent, facilitator observation, causality or cognitive bias.
"""
import hashlib
import random
import re
from pathlib import Path
from collections import defaultdict
from .data_validation import _object, _id, _text, _number, _percentile, _hash

LIMITATION = 'Supplied-study export analysis; consent, assignment, independent scoring and verified viewing require researcher review. Descriptive advice correctness/alignment does not establish cognitive over-trust.'


def evaluate_study(manifest, trials, manifest_sha256, trials_sha256):
    _object(manifest, ['schema_version', 'study_id', 'version', 'source_kind', 'design', 'ethics_reference', 'consent_status', 'consent_reference', 'preregistration_reference', 'assignment_reference', 'scoring_reference', 'source_revision', 'bootstrap_seed', 'bootstrap_replicates', 'limitations'], at='study manifest')
    if type(manifest['schema_version']) is not int or manifest['schema_version'] != 1 or manifest['design'] != 'parallel_assigned' or manifest['source_kind'] not in {'human', 'synthetic'}:
        raise ValueError('Unsupported study schema/design/source')
    for key in ['study_id', 'version']:
        _id(manifest[key], key)
    for key in ['ethics_reference', 'consent_reference', 'preregistration_reference', 'assignment_reference', 'scoring_reference', 'source_revision']:
        _text(manifest[key], key)
    if manifest['consent_status'] != 'reviewed' and manifest['source_kind'] == 'human':
        raise ValueError('Human analysis requires reviewed consent/ethics declaration')
    if manifest['consent_status'] not in {'reviewed', 'not_applicable'}:
        raise ValueError('Unknown consent status')
    if not isinstance(manifest['limitations'], list) or not manifest['limitations']:
        raise ValueError('Study limitations required')
    for value in manifest['limitations']:
        _text(value, 'limitation')
    _number(manifest['bootstrap_seed'], 'bootstrap seed', 0, 2**32-1, True)
    _number(manifest['bootstrap_replicates'], 'bootstrap replicates', 100, 10000, True)
    _hash(manifest_sha256, 'manifest hash')
    _hash(trials_sha256, 'trials hash')
    if not re.fullmatch('[a-f0-9]{40}', manifest['source_revision']):
        raise ValueError('Full source revision required')
    if not trials:
        raise ValueError('No study trials')
    participants, assignments, seen, sessions, phase_tasks = defaultdict(lambda: defaultdict(list)), {}, set(), {}, defaultdict(set)
    reliance = dict(verified_trials=0, unverified_trials=0, correct_advice=0, incorrect_advice=0, followed_correct=0, rejected_correct=0, followed_incorrect=0, rejected_incorrect=0, improved=0, worsened=0)
    for trial in trials:
        _object(trial, ['participant_id', 'session_id', 'condition', 'phase', 'task_id', 'context', 'task_correct', 'completion_s'], ['advice'], at='trial')
        for key in ['participant_id', 'session_id', 'task_id', 'context']:
            _id(trial[key], key)
        condition, phase = trial['condition'], trial['phase']
        if condition not in {'control', 'adaptive'} or phase not in {'baseline', 'post', 'retention'} or type(trial['task_correct']) is not bool:
            raise ValueError('Invalid condition/phase/independent correctness')
        _number(trial['completion_s'], 'completion time seconds', 0)
        participant = trial['participant_id']
        if participant in assignments and assignments[participant] != condition:
            raise ValueError('Participant crosses parallel-arm assignments')
        assignments[participant] = condition
        unique = participant, phase, trial['task_id']
        if unique in seen:
            raise ValueError('Duplicate participant-phase-task trial')
        seen.add(unique)
        session = trial['session_id']
        if session in sessions and sessions[session] != (participant, phase):
            raise ValueError('Session crosses participants/phases')
        sessions[session] = participant, phase
        phase_tasks[phase].add(trial['task_id'])
        participants[participant][phase].append(trial)
        advice = trial.get('advice')
        if advice is not None:
            _object(advice, ['reference_label', 'initial_label', 'recommendation', 'final_label', 'viewing_basis', 'viewing_reference'], at='advice trial')
            for key in ['reference_label', 'initial_label', 'recommendation', 'final_label']:
                _id(advice[key], key)
            _text(advice['viewing_reference'], 'viewing reference')
            if advice['viewing_basis'] not in {'independently_observed', 'self_report', 'unverified'}:
                raise ValueError('Unknown viewing basis')
            if trial['task_correct'] != (advice['final_label'] == advice['reference_label']):
                raise ValueError('Final independent correctness contradicts reference label')
            if advice['viewing_basis'] != 'independently_observed':
                reliance['unverified_trials'] += 1
            else:
                reliance['verified_trials'] += 1
                correct = advice['recommendation'] == advice['reference_label']
                followed = advice['final_label'] == advice['recommendation']
                initial_correct = advice['initial_label'] == advice['reference_label']
                reliance['correct_advice' if correct else 'incorrect_advice'] += 1
                reliance[('followed_' if followed else 'rejected_')+('correct' if correct else 'incorrect')] += 1
                reliance['improved'] += int(not initial_correct and trial['task_correct'])
                reliance['worsened'] += int(initial_correct and not trial['task_correct'])
    # Identical evaluation task sets within each phase avoid arm/task mix confounding.
    for phase in phase_tasks:
        sets = [{r['task_id'] for r in phases[phase]} for phases in participants.values() if phase in phases]
        if any(tasks != sets[0] for tasks in sets):
            raise ValueError('Evaluation task sets differ within a phase; use separately analysed strata')
    summary, differences, missing = {}, {}, {}
    for condition in ['control', 'adaptive']:
        ids = sorted(key for key in participants if assignments[key] == condition)
        summary[condition] = dict(participants=len(ids), phases={})
        for phase in ['baseline', 'post', 'retention']:
            values = [sum(r['task_correct'] for r in participants[key][phase])/len(participants[key][phase]) for key in ids if participants[key].get(phase)]
            summary[condition]['phases'][phase] = dict(participants=len(values), mean_participant_accuracy=sum(values)/len(values) if values else None)
        differences[condition] = {}
        missing[condition] = {}
        for phase in ['post', 'retention']:
            paired = []
            for key in ids:
                baseline, followup = participants[key].get('baseline'), participants[key].get(phase)
                if baseline and followup:
                    paired.append(sum(r['task_correct'] for r in followup)/len(followup)-sum(r['task_correct'] for r in baseline)/len(baseline))
            differences[condition][phase] = paired
            missing[condition][phase] = len(ids)-len(paired)
    contrasts = {}
    for phase in ['post', 'retention']:
        a, c = differences['adaptive'][phase], differences['control'][phase]
        mean = lambda xs: sum(xs)/len(xs) if xs else None
        effect = mean(a)-mean(c) if a and c else None
        samples = []
        if len(a) >= 2 and len(c) >= 2:
            rng = random.Random(manifest['bootstrap_seed'])
            for _ in range(manifest['bootstrap_replicates']):
                samples.append(mean([rng.choice(a) for _ in a])-mean([rng.choice(c) for _ in c]))
        contrasts[phase] = dict(adaptive_minus_control_change=effect, interval_95=[_percentile(samples,.025),_percentile(samples,.975)] if samples else None, paired_participants=dict(adaptive=len(a),control=len(c)), missing_paired_participants={arm: missing[arm][phase] for arm in missing}, interval_method='Seeded participant bootstrap within assignment arms; paired baseline/follow-up change. Null below two paired participants per arm', interpretation='Unreviewed export contrast; causal attribution requires valid assignment/control/scoring, attrition analysis and external review')
    return dict(schema_version=1,study_id=manifest['study_id'],study_version=manifest['version'],manifest_sha256=manifest_sha256,trials_sha256=trials_sha256,source_kind=manifest['source_kind'],evidence_status='HUMAN_EXPORT_ANALYSED_UNREVIEWED' if manifest['source_kind']=='human' else 'SYNTHETIC_STUDY_INTERFACE_TESTED',evaluation_module_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),configuration=manifest,arms=summary,contrasts=contrasts,advice_descriptive_counts=reliance,limitation=LIMITATION)
