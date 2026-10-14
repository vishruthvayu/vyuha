"""Raw ASGI preserves Latin-1 header octets that TestClient re-encodes as UTF-8.

Unrelated header text must not crash a guard or grant malformed credentials.
These tests exercise the middleware directly with real provisioned role/session
fixtures, never change the trusted-LAN Origin policy or scoring contracts.
"""
import asyncio
import json

import pytest

from server import auth, crew, storage
from server.tests.test_api import client
from server.tests.test_finale_security import officer
from server.tests.test_crew import shared


def request_guard(guard, path, credential_headers=(), method='GET'):
    messages = []
    reached = []

    async def downstream(scope, receive, send):
        reached.append(scope['path'])
        await send({'type': 'http.response.start', 'status': 204, 'headers': []})
        await send({'type': 'http.response.body', 'body': b''})

    async def receive():
        return {'type': 'http.request', 'body': b'', 'more_body': False}

    async def send(message):
        messages.append(message)

    scope = {
        'type': 'http', 'method': method, 'path': path,
        'headers': [
            (b'x-client-note', b'Client \xe9'),
            (b'origin', b'https://untrusted.example/\xff'),
            *credential_headers,
        ],
    }
    asyncio.run(guard(downstream)(scope, receive, send))
    status = next(message['status'] for message in messages if message['type'] == 'http.response.start')
    assert bool(reached) == (status == 204)
    return status


def database_dump():
    with storage.connect() as db:
        return list(db.iterdump())


@pytest.mark.parametrize('mode,expected', [
    ('anonymous', 401), ('forged_unicode', 401), ('bad_scheme', 401),
    ('cookie_only', 401), ('valid', 204),
])
def test_raw_header_text_preserves_officer_authorization(officer, mode, expected):
    client, password = officer
    token = client.post('/api/v1/auth/login', json={'password': password}).json()['token']
    headers = {
        'anonymous': [],
        'forged_unicode': [(b'authorization', b'Bearer forged-\xe9')],
        'bad_scheme': [(b'authorization', b'Bear\xe9r ' + token.encode())],
        'cookie_only': [(b'cookie', b'officer=' + token.encode())],
        'valid': [(b'authorization', b'Bearer ' + token.encode())],
    }[mode]
    before = database_dump()
    assert request_guard(auth.OfficerAuthorization, '/api/v1/instructor/sessions', headers) == expected
    assert database_dump() == before


@pytest.mark.parametrize('mode,expected', [
    ('anonymous', 401), ('forged_unicode', 401), ('valid_member', 204),
    ('valid_officer', 204),
])
def test_raw_header_text_preserves_active_crew_read_capabilities(shared, mode, expected):
    token = shared['headers'][0]['X-VYUHA-Crew-Token']
    headers = {
        'anonymous': [],
        'forged_unicode': [(b'x-vyuha-crew-token', b'forged-\xe9')],
        'valid_member': [(b'x-vyuha-crew-token', token.encode())],
        'valid_officer': [(b'authorization', shared['client'].headers['authorization'].encode())],
    }[mode]
    before = database_dump()
    assert request_guard(crew.CrewSessionBoundary, f"/api/v1/sessions/{shared['issued']['session_id']}/aar", headers) == expected
    assert database_dump() == before


@pytest.mark.parametrize('leaf', ['events', 'complete', 'control-state'])
def test_raw_header_text_does_not_grant_direct_shared_inputs(shared, leaf):
    token = shared['headers'][0]['X-VYUHA-Crew-Token']
    before = database_dump()
    headers = [(b'x-vyuha-crew-token', token.encode())]
    assert request_guard(crew.CrewSessionBoundary, f"/api/v1/sessions/{shared['issued']['session_id']}/{leaf}", headers, 'POST') == 403
    assert database_dump() == before


@pytest.mark.parametrize('mode,expected', [
    ('anonymous', 401), ('forged_unicode', 401), ('valid_member', 401),
    ('valid_officer', 204),
])
def test_raw_header_text_keeps_imported_shared_results_officer_only(shared, mode, expected):
    sid = shared['issued']['session_id']
    with storage.connect() as db:
        db.execute('INSERT INTO crew_archive(session_id,metadata) VALUES (?,?)', (sid, '{}'))
        db.execute('DELETE FROM crews WHERE session_id=?', (sid,))
    headers = {
        'anonymous': [],
        'forged_unicode': [(b'authorization', b'Bearer forged-\xe9')],
        'valid_member': [(b'x-vyuha-crew-token', shared['headers'][0]['X-VYUHA-Crew-Token'].encode())],
        'valid_officer': [(b'authorization', shared['client'].headers['authorization'].encode())],
    }[mode]
    before = database_dump()
    assert request_guard(crew.CrewSessionBoundary, f'/api/v1/sessions/{sid}/aar', headers) == expected
    assert database_dump() == before


@pytest.mark.parametrize('field,value', [('expires_at', 0), ('revoked_at', 'synthetic-revoked')])
def test_raw_header_text_cannot_revive_expired_or_revoked_crew_capability(shared, field, value):
    with storage.connect() as db:
        db.execute(f'UPDATE crew_members SET {field}=? WHERE id=?', (value, shared['issued']['members'][0]['member_id']))
    before = database_dump()
    headers = [(b'x-vyuha-crew-token', shared['headers'][0]['X-VYUHA-Crew-Token'].encode())]
    assert request_guard(crew.CrewSessionBoundary, f"/api/v1/sessions/{shared['issued']['session_id']}/aar", headers) == 401
    assert database_dump() == before


def test_unicode_forgery_does_not_change_password_or_bearer_verification(officer):
    _, password = officer
    assert auth.verify(password)
    assert not auth.verify('wrong-unicode-\u00e9' * 2)
    assert not auth.valid('\u00e9' * 48)
    credential = json.loads(auth.credential_path().read_text())
    credential['digest'] = '\u00e9' * 64
    auth.credential_path().write_text(json.dumps(credential))
    assert not auth.verify(password), 'Non-ASCII HMAC comparison input must fail closed'
