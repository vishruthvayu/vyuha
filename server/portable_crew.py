"""Pseudonymous immutable Crew archives, without live roles or individual credit.

A v2 cohort binds exact declared source rosters, not authenticated humans. HMAC
integrity attests possession of the shared transfer key, not donor truthfulness.
"""
import json
from typing import Literal
from pydantic import Field, model_validator, field_validator
from .models import StrictModel
from .storage import dumps

RESULT_BASIS = 'Shared crew result only; no individual Beta profile or outcome ledger'


class CrewMemberRef(StrictModel):
    id: str = Field(pattern=r'^CM_[a-f0-9]{20}$')
    role: Literal['spotter', 'responder']


class CrewAttributionRef(StrictModel):
    timeline_order: int = Field(ge=0, le=100000)
    member_id: str = Field(pattern=r'^CM_[a-f0-9]{20}$')
    role: Literal['spotter', 'responder']


class CohortMemberRef(StrictModel):
    member_id: str = Field(pattern=r'^CM_[a-f0-9]{20}$')
    id: str = Field(pattern=r'^CCM_[a-f0-9]{20}$')


class CrewCohort(StrictModel):
    version: Literal[1]
    unit_id: str = Field(pattern=r'^U_[a-f0-9]{20}$')
    id: str = Field(pattern=r'^CC_[a-f0-9]{20}$')
    members: list[CohortMemberRef] = Field(min_length=2, max_length=8)

    @field_validator('version', mode='before')
    @classmethod
    def exact_version(cls, value):
        if type(value) is not int:
            raise ValueError('Cohort version must be an integer')
        return value


class SharedCrewMetadata(StrictModel):
    version: Literal[1, 2]
    id: str = Field(pattern=r'^C_[a-f0-9]{20}$')
    name: Literal['Pseudonymous shared crew']
    members: list[CrewMemberRef] = Field(min_length=2, max_length=8)
    attribution: list[CrewAttributionRef] = Field(max_length=5000)
    result_basis: Literal['Shared crew result only; no individual Beta profile or outcome ledger']
    cohort: CrewCohort | None = None

    @field_validator('version', mode='before')
    @classmethod
    def exact_version(cls, value):
        if type(value) is not int:
            raise ValueError('Crew archive version must be an integer')
        return value

    @model_validator(mode='after')
    def coherent(self):
        roster = {m.id: m.role for m in self.members}
        if len(roster) != len(self.members) or set(roster.values()) != {'spotter', 'responder'}:
            raise ValueError('Crew roster requires distinct members and both roles')
        if len({a.timeline_order for a in self.attribution}) != len(self.attribution):
            raise ValueError('Duplicate crew action attribution')
        if [a.timeline_order for a in self.attribution] != sorted(a.timeline_order for a in self.attribution):
            raise ValueError('Crew attribution must be ordered')
        if any(roster.get(a.member_id) != a.role for a in self.attribution):
            raise ValueError('Crew attribution does not match roster role')
        if (self.version == 2) != (self.cohort is not None):
            raise ValueError('Only v2 Crew archives require a cohort binding')
        if self.cohort:
            refs = self.cohort.members
            if len({m.id for m in refs}) != len(refs) or len({m.member_id for m in refs}) != len(refs):
                raise ValueError('Duplicate cohort member binding')
            if {m.member_id for m in refs} != set(roster):
                raise ValueError('Cohort binding must cover the exact exercise roster')
        return self


def metadata_dict(metadata):
    # Preserve the original v1 wire shape for legacy forwarding and comparison.
    return metadata.model_dump(exclude_none=True)


def ensure_schema(db):
    db.execute('CREATE TABLE IF NOT EXISTS crew_archive(session_id TEXT PRIMARY KEY,metadata TEXT NOT NULL)')


def is_crew_session(db, sid):
    ensure_schema(db)
    return bool(db.execute('SELECT 1 FROM crews WHERE session_id=? UNION ALL SELECT 1 FROM crew_archive WHERE session_id=?', (sid, sid)).fetchone())


def shared_metadata(db, sid, secret):
    from .portable import pseudonym
    archived = db.execute('SELECT metadata FROM crew_archive WHERE session_id=?', (sid,)).fetchone()
    if archived:
        return metadata_dict(SharedCrewMetadata.model_validate_json(archived['metadata']))
    row = db.execute('SELECT c.id,c.name,s.unit_id FROM crews c JOIN sessions s ON s.id=c.session_id WHERE c.session_id=?', (sid,)).fetchone()
    if not row:
        return None
    members = db.execute('SELECT id,callsign,role FROM crew_members WHERE crew_id=? ORDER BY id', (row['id'],)).fetchall()
    declared = sorted((m['callsign'].lower(), m['role']) for m in members)
    # Domain separated, keyed and installation/unit scoped: no names or plain
    # dictionary hashes leave the source. Changing a role/name/roster separates it.
    cohort_id = pseudonym(dumps(['crew-cohort-v1', row['unit_id'], row['name'], declared]), secret, 'CC_')
    roster = [dict(id=pseudonym(m['id'], secret, 'CM_'), role=m['role']) for m in members]
    refs = [dict(member_id=pseudonym(m['id'], secret, 'CM_'), id=pseudonym(dumps(['crew-cohort-member-v1', cohort_id, m['callsign'].lower(), m['role']]), secret, 'CCM_')) for m in members]
    attribution = [dict(timeline_order=a['timeline_order'], member_id=pseudonym(a['member_id'], secret, 'CM_'), role=a['role']) for a in db.execute('SELECT timeline_order,member_id,role FROM crew_attribution WHERE session_id=? ORDER BY timeline_order', (sid,))]
    return metadata_dict(SharedCrewMetadata(version=2, id=pseudonym(row['id'], secret, 'C_'), name='Pseudonymous shared crew', members=roster, attribution=attribution, result_basis=RESULT_BASIS, cohort=dict(version=1, unit_id=pseudonym(row['unit_id'], secret, 'U_'), id=cohort_id, members=refs)))


def cohort_roster(metadata):
    if not metadata.cohort:
        return None
    roles = {m.id: m.role for m in metadata.members}
    return tuple(sorted((m.id, roles[m.member_id]) for m in metadata.cohort.members))


def validate_cohorts(entries, unit_id, db=None):
    """Reject contradictory signed roster assertions, including earlier imports."""
    seen = {}
    if db is not None:
        for row in db.execute('SELECT metadata FROM crew_archive'):
            metadata = SharedCrewMetadata.model_validate_json(row['metadata'])
            if metadata.cohort:
                frozen = (metadata.cohort.unit_id, cohort_roster(metadata))
                if metadata.cohort.id in seen and seen[metadata.cohort.id] != frozen:
                    raise ValueError('Stored cohort has contradictory archive rosters')
                seen[metadata.cohort.id] = frozen
    for entry in entries:
        metadata = entry.shared_crew
        if metadata is None or metadata.cohort is None:
            continue
        if metadata.cohort.unit_id != unit_id:
            raise ValueError('Cohort binding belongs to another portable unit')
        cid = metadata.cohort.id
        roster = (metadata.cohort.unit_id, cohort_roster(metadata))
        if cid in seen and seen[cid] != roster:
            raise ValueError('Cohort binding conflicts with its frozen pseudonymous roster')
        seen[cid] = roster


def compatible_metadata(existing, incoming):
    expected = metadata_dict(incoming) if incoming else None
    # A legacy retry may verify the pre-binding snapshot against a modern local
    # source/archive. Never upgrade, downgrade or overwrite a stored archive.
    if expected and expected['version'] == 1 and existing and existing['version'] == 2:
        existing = {k: v for k, v in existing.items() if k != 'cohort'}
        existing['version'] = 1
    return existing == expected


def validate_shared(entry):
    if entry.scenario.get('version') != 2 or entry.scenario.get('director_decision') or entry.scenario.get('director_v2'):
        raise ValueError('Shared crew archive requires a non-individual v0.4 scenario')
    if entry.outcomes is not None:
        raise ValueError('Shared crew history cannot supply individual skill outcomes')
    actions = {a.order: a for a in entry.events}
    if None in actions or len(actions) != len(entry.events):
        raise ValueError('Crew actions require unique timeline orders')
    metadata = entry.shared_crew
    if set(actions) != {a.timeline_order for a in metadata.attribution}:
        raise ValueError('Crew attribution must cover every action exactly once')
    for attribution in metadata.attribution:
        action = actions[attribution.timeline_order]
        if (attribution.role == 'spotter') != (action.k == 'designate'):
            raise ValueError('Crew action violates frozen role attribution')


def save_archive(db, sid, metadata):
    ensure_schema(db)
    db.execute('INSERT INTO crew_archive VALUES (?,?)', (sid, dumps(metadata_dict(metadata))))
