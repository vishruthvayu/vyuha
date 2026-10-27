"""Pure passive-report mission guidance. No engine dispatch, score or DB writes.

Matching a caller-supplied worker scope is not authorization or a secrecy claim.
The application adapter must use current correlated observations/accepted events.
"""
import re

VERSION = 'episode-plan-v1'
LIMITATION = ('Derived mission guidance only; activity is not correctness, mastery, '
              'gaze, active acquisition or proof of learning.')


def obj(value, keys, label):
    if type(value) is not dict or set(value) != set(keys):
        raise ValueError(f'Invalid {label} fields')
    return value


def integer(value, low, high, label):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f'Invalid {label}')
    return value


def text(value, label):
    if type(value) is not str or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}', value):
        raise ValueError(f'Invalid {label}')
    return value


def scope(value):
    value = obj(value, ['attemptId', 'scenarioId', 'engineVersion'], 'scope')
    if value['engineVersion'] != 'vyuha-0.4.0':
        raise ValueError('Unsupported mission engine')
    return dict(attemptId=text(value['attemptId'], 'attemptId'),
                scenarioId=text(value['scenarioId'], 'scenarioId'), engineVersion='vyuha-0.4.0')


def same_scope(value, expected):
    if scope(value) != expected:
        raise ValueError('Mixed mission scope')


def create_mission_plan(context, options):
    context = scope(context)
    keys = ['worldId', 'assistance', 'durationTicks'] + (['objectiveId'] if type(options) is dict and 'objectiveId' in options else [])
    options = obj(options, keys, 'mission options')
    if options['assistance'] not in ['full', 'faded', 'none']:
        raise ValueError('Unknown assistance policy')
    return dict(version=VERSION, scope=context,
                identities=dict(objective=text(options.get('objectiveId', 'reported-evidence-cycle-v1'), 'objectiveId'),
                                world=text(options['worldId'], 'worldId'), episode='passive-observation-v1',
                                evaluation='guidance-only-v1'),
                assistance=options['assistance'], durationTicks=integer(options['durationTicks'], 1800, 5400, 'durationTicks'),
                maximumSampleAgeTicks=30)


def validate_plan(value):
    p = obj(value, ['version', 'scope', 'identities', 'assistance', 'durationTicks', 'maximumSampleAgeTicks'], 'plan')
    ids = obj(p['identities'], ['objective', 'world', 'episode', 'evaluation'], 'plan identities')
    if (p['version'] != VERSION or ids['episode'] != 'passive-observation-v1'
            or ids['evaluation'] != 'guidance-only-v1' or type(p['maximumSampleAgeTicks']) is not int
            or p['maximumSampleAgeTicks'] != 30):
        raise ValueError('Unsupported mission plan contract')
    return create_mission_plan(p['scope'], dict(worldId=ids['world'], objectiveId=ids['objective'],
                                               assistance=p['assistance'], durationTicks=p['durationTicks']))


def project_mission(plan, frame):
    p = validate_plan(plan)
    f = obj(frame, ['version', 'scope', 'tick', 'selectedTrackId', 'contacts', 'accepted', 'completed'], 'mission frame')
    if f['version'] != 'mission-frame-v1' or type(f['completed']) is not bool:
        raise ValueError('Unsupported mission frame')
    same_scope(f['scope'], p['scope'])
    tick = integer(f['tick'], 0, p['durationTicks'], 'frame tick')
    selected = None if f['selectedTrackId'] is None else text(f['selectedTrackId'], 'selectedTrackId')
    if type(f['contacts']) is not list or len(f['contacts']) > 200 or type(f['accepted']) is not list or len(f['accepted']) > 10000:
        raise ValueError('Mission input bounds exceeded')
    actions, by_order = [], {}
    previous_tick = previous_order = -1
    for value in f['accepted']:
        a = obj(value, ['scope', 'tick', 'order', 'trackId', 'action', 'status'], 'accepted receipt')
        same_scope(a['scope'], p['scope'])
        at = integer(a['tick'], 0, tick, 'accepted tick')
        order = integer(a['order'], 0, 100000, 'accepted order')
        track = text(a['trackId'], 'trackId')
        if a['status'] != 'accepted' or a['action'] not in ['designate', 'classify', 'engage']:
            raise ValueError('Unaccepted mission action')
        signature = f"{at}:{track}:{a['action']}"
        if order in by_order:
            if by_order[order] != signature:
                raise ValueError('Conflicting accepted order')
            continue
        if at < previous_tick or order <= previous_order:
            raise ValueError('Accepted receipts out of order')
        previous_tick, previous_order = at, order
        by_order[order] = signature
        actions.append(a)
    contacts, seen = [], set()
    for value in f['contacts']:
        c = obj(value, ['scope', 'id', 'reportTick', 'channels', 'iff'], 'reported contact')
        same_scope(c['scope'], p['scope'])
        contact_id = text(c['id'], 'contact id')
        report_tick = integer(c['reportTick'], 0, tick, 'report tick')
        if contact_id in seen:
            raise ValueError('Duplicate reported contact')
        seen.add(contact_id)
        if c['iff'] not in ['friendly_reply', 'registered_civil', 'no_reply', 'unavailable'] or type(c['channels']) is not list or len(c['channels']) != 3:
            raise ValueError('Invalid reported channels')
        names, available, fresh = set(), [], []
        positive = shape = False
        for value in c['channels']:
            ch = obj(value, ['channel', 'available', 'level', 'sampleTick'], 'reported channel')
            name = ch['channel']
            if (name not in ['radar', 'eo', 'ir'] or name in names or type(ch['available']) is not bool
                    or ch['level'] not in ['none', 'detect', 'shape'] or name == 'radar' and ch['level'] == 'shape'):
                raise ValueError('Invalid reported channel semantics')
            names.add(name)
            sample = None if ch['sampleTick'] is None else integer(ch['sampleTick'], 0, report_tick, 'sample tick')
            if not ch['available'] and ch['level'] != 'none':
                raise ValueError('Unavailable channel cannot contain a signal')
            if ch['available']:
                available.append(name)
            if ch['available'] and ch['level'] != 'none':
                positive = True
                if sample is not None and tick - sample <= p['maximumSampleAgeTicks']:
                    fresh.append(name)
                    shape = shape or ch['level'] == 'shape'
        recorded = [a for a in actions if a['trackId'] == contact_id]
        state = ('shape' if shape else 'reported') if fresh else 'stale_or_undated' if positive else 'none' if available else 'unavailable'
        contacts.append(dict(id=contact_id, reportTick=report_tick, reportAgeTicks=tick-report_tick,
                             evidenceState=state, availableChannels=available, freshChannels=fresh, identityCue=c['iff'],
                             designated=any(a['action'] == 'designate' for a in recorded),
                             classified=any(a['action'] == 'classify' for a in recorded),
                             responseRecorded=any(a['action'] == 'engage' for a in recorded)))
    contacts.sort(key=lambda c: c['id'])
    contact = next((c for c in contacts if c['id'] == selected), None)
    stage = 'reconstruct' if f['completed'] else 'observe' if not contact or not contact['freshChannels'] else 'investigate' if not contact['designated'] else 'decide'
    visible = p['assistance'] != 'none'
    task = ('Reconstruct the available evidence and recorded decisions.' if stage == 'reconstruct' else
            'Inspect report timing and sensor availability. An old or undated sample does not by itself establish whether a contact is present.' if not contact or not contact['freshChannels'] else
            'Compare the available channels, then designate the reported contact when ready.' if not contact['designated'] else
            'Classify only what the available cues support. No reply does not establish hostile identity.' if not contact['classified'] else
            'Choose a response using your classification and the available evidence.' if not contact['responseRecorded'] else
            'Monitor the recorded outcome or inspect another reported contact.')
    if p['assistance'] == 'faded':
        task = dict(observe='Observe the reported picture.', investigate='Inspect the available evidence.',
                    decide='Make and monitor your decision.', reconstruct='Review the recorded evidence.')[stage]
    return dict(version='mission-projection-v1', scope=dict(p['scope']), identities=dict(p['identities']), tick=tick,
                stage=stage, guidanceVisible=visible, task=task if visible else None, selectedTrackId=selected,
                contacts=contacts, reportedContacts=len(contacts), acceptedDecisions=len(actions), completed=f['completed'],
                limitation=LIMITATION)
