"""Read-only response comparisons at actual accepted decision boundaries.

One replay of the original history supplies available evidence. This is neither
an alternate expert rollout nor a new score; original results remain untouched.
"""
import copy
import hashlib
import json
from collections import Counter

from fastapi import APIRouter, HTTPException

from .counterfactual import reference_choice
from .engine import HZ, replay
from .review import evidence, expected_engagement
from .storage import connect, dumps

router = APIRouter(prefix='/api/v1/sessions', tags=['Response reference'])


def compare(scenario, actions, commands, end_tick, session_id):
    entries = []
    indexes = {id(action): index for index,action in enumerate(actions)}
    rules = scenario.get('doctrine', {}).get('rules', {})

    def observe(sim, phase, action, order):
        if phase != 'before_action' or action['k'] != 'engage':
            return
        track = next((t for t in sim.tracks if t['id']==action['track']), None)
        if track is None:
            raise ValueError('Response target is absent at its recorded decision')
        ev = copy.deepcopy(evidence(sim, track))
        # Do not pass canonical kind/identity/link/geometry to the policy. Future
        # policy changes must continue to respect this explicit input boundary.
        operator_state = dict(classification=ev['prior_classification'], declared=ev['prior_identity'])
        choice = reference_choice(copy.deepcopy(ev), operator_state, copy.deepcopy(rules))
        if choice['basis'] != 'available_evidence':
            raise ValueError('Response policy crossed the available-evidence boundary')
        entries.append(dict(decision_index=indexes[id(action)], tick=sim.tick, order=order, track_id=action['track'], recorded_effector=action['effector'], available_evidence=ev, reference_policy=copy.deepcopy(choice), agrees_with_policy=action['effector']==choice['action'], identity_assurance='operator_declaration_only' if ev['prior_identity']=='hostile' else 'unestablished_or_nonhostile', iff_no_reply_is_hostility=False, rubric_reference=dict(basis='full_rubric_truth', label='Rubric/type-range reference', effector=expected_engagement(track), limitation='Uses canonical target identity/link and static permitted type-range rules; not resource-aware expected success or a claim the trainee knew hidden facts.')))

    replay(scenario, actions, end_tick, commands, observer=observe)
    confidence = Counter(entry['reference_policy']['confidence'] for entry in entries)
    agreement = sum(entry['agrees_with_policy'] for entry in entries)
    fingerprint = hashlib.sha256(dumps(dict(scenario=scenario,actions=actions,commands=commands,end_tick=end_tick)).encode()).hexdigest()
    limitations = [
        'Inspectable conservative training policy, not a certified human military expert.',
        'Comparison follows the original accepted history; it is not an autonomous expert rollout or hypothetical alternative result.',
        'Agreement is descriptive and does not award points or certify correctness, mastery or operational competence.',
        'IFF no reply and absent RF detection do not prove hostility or a fibre control link; hostile identity may be an unverified operator declaration.',
        'Static rubric/type-range reference is separately labelled canonical truth, not evidence the trainee necessarily possessed.',
    ]
    if scenario.get('response_model'):
        limitations.append('Resource availability and delayed response outcomes are separate response-ledger evidence; this static type-range comparison does not predict their exact result.')
    return dict(schema_version=1,kind='available_evidence_response_comparison',session_id=session_id,engine_version=scenario.get('engine_version','released-v1.0.1-legacy'),mode='original_history_boundary_comparison',replayed_end_tick=end_tick,hz=HZ,input_fingerprint=fingerprint,entries=entries,summary=dict(recorded_responses=len(entries),agreements=agreement,agreement_fraction=agreement/len(entries) if entries else None,supported=confidence['supported'],conditional=confidence['conditional'],uncertain=confidence['uncertain'],interpretation='Descriptive agreement with a conditional evidence policy; not a score or correctness judgement.'),limitations=limitations,original_history_unchanged=True)


@router.get('/{session_id}/reference-policy')
def reference_report(session_id: str):
    from .main import session_record, logged_events, applied_commands
    with connect() as db:
        db.execute('BEGIN')
        row = session_record(db, session_id)
        if row['status'] != 'completed':
            raise HTTPException(409, 'Response reference requires a completed frozen session')
        scenario = json.loads(row['spec'])
        actions, commands = logged_events(db, session_id), applied_commands(db, session_id)
        end_tick = row['end_tick']
    try:
        return compare(scenario, actions, commands, end_tick, session_id)
    except (ValueError, KeyError, TypeError, OverflowError) as error:
        raise HTTPException(422, 'Recorded response boundaries cannot be reconstructed: '+str(error)[:160]) from error
