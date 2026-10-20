"""Read-only coordination measurements; no individual skill or score credit."""
from statistics import median
from .engine import HZ


def coordination_summary(actions, attribution, roster):
    members = {m['id']: dict(member_id=m['id'], callsign=m['callsign'], role=m['role'],
                            accepted_actions=0, designations=0, classifications=0, responses=0)
               for m in roster}
    owners = {a['timeline_order']: a['member_id'] for a in attribution}
    paths, missing = {}, 0
    for index, action in enumerate(actions):
        actor = owners.get(action.get('order', index))
        if actor not in members:
            missing += 1
            continue
        member = members[actor]
        member['accepted_actions'] += 1
        field = {'designate': 'designations', 'classify': 'classifications', 'engage': 'responses'}[action['k']]
        member[field] += 1
        path = paths.setdefault(action['track'], {})
        path.setdefault(action['k'], dict(tick=action['tick'], member_id=actor))
    handoffs = []
    for track, stages in paths.items():
        designate, classify, respond = (stages.get(k) for k in ['designate', 'classify', 'engage'])
        if not designate or not classify:
            continue
        handoffs.append(dict(track_id=track, spotter_member_id=designate['member_id'],
                             classifier_member_id=classify['member_id'],
                             responder_member_id=respond['member_id'] if respond else None,
                             designation_to_classification_s=(classify['tick']-designate['tick'])/HZ,
                             classification_to_response_s=(respond['tick']-classify['tick'])/HZ if respond else None))
    classification = [h['designation_to_classification_s'] for h in handoffs]
    response = [h['classification_to_response_s'] for h in handoffs if h['classification_to_response_s'] is not None]
    return dict(version=1, accepted_actions=len(actions), attributed_actions=len(actions)-missing,
                unattributed_actions=missing, contacts_with_actions=len(paths), members=list(members.values()),
                handoffs=handoffs, median_designation_to_classification_s=median(classification) if classification else None,
                median_classification_to_response_s=median(response) if response else None,
                timing_basis='Authoritative logical ticks; pause and outage wall time excluded. First accepted stage per contact.',
                interpretation='Coordination counts and timing only. No independent individual tactical score, skill-profile credit or operational competence inference.')
