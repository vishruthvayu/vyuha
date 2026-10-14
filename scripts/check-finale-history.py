#!/usr/bin/env python3
"""Validate actual stored history on a disposable backup; emit aggregate evidence.

Source databases are opened read-only. No private identities/events are exported.
An ephemeral officer credential authenticates protected analytics in the backup.
"""
import argparse
import hashlib
import json
import secrets
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient
from server import auth, storage
from server.main import app


def rows(path):
    with sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True) as db:
        return db.execute("SELECT id,trainee,scenario_id,created_at,status,scorecard,end_tick FROM sessions WHERE status='completed' ORDER BY id").fetchall()


def digest(values):
    return hashlib.sha256(json.dumps(values, separators=(',', ':')).encode()).hexdigest()


def validate(source, baseline):
    original, prior = rows(source), rows(baseline)
    by_id = {row[0]: row for row in original}
    assert all(by_id.get(row[0]) == row for row in prior), 'Baseline immutable fields changed'
    previous_db = storage.DB_PATH
    previous_auth = auth.credential_path
    versions = {}
    try:
        with tempfile.TemporaryDirectory(prefix='vyuha-history-') as folder:
            target = Path(folder) / 'history.db'
            with sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True) as src, sqlite3.connect(target) as backup:
                src.backup(backup)
            storage.DB_PATH = target
            auth.credential_path = lambda: Path(folder) / 'officer.json'
            password = secrets.token_urlsafe(24)
            auth.provision(password)
            with TestClient(app) as client:
                reply = client.post('/api/v1/auth/login', json={'password': password})
                assert reply.status_code == 200
                client.headers['Authorization'] = 'Bearer ' + reply.json()['token']
                people = set()
                for row in original:
                    response = client.get(f'/api/v1/sessions/{row[0]}/aar')
                    assert response.status_code == 200, 'Historical AAR unreadable'
                    aar = response.json()
                    assert aar['verified'] and aar['scorecard'] == json.loads(row[5]), 'Historical score changed'
                    assert 'timeline' in aar and 'decision_reviews' in aar
                    marker = aar['scorecard'].get('engine_version', 'unmarked')
                    versions[marker] = versions.get(marker, 0) + 1
                    people.add(row[1])
                for person in people:
                    assert len(client.get(f'/api/v1/trainees/{person}/profile').json()['skills']) == 4
                with storage.connect() as db:
                    units = [r['id'] for r in db.execute('SELECT id FROM units')]
                maps = [client.get(f'/api/v1/units/{uid}/skill-heatmap').json() for uid in units]
                with storage.connect() as db:
                    from server.crew import is_shared_owner
                    eligible={r['id'] for r in db.execute('SELECT id FROM trainees') if not is_shared_owner(db,r['id'])}
                    expected_training=sum(row[1] in eligible for row in original)
                    expected_rapid=sum(r['trainee'] in eligible for r in db.execute("SELECT r.trainee FROM rapid_sessions r JOIN skill_outcomes o ON o.session_id=r.id WHERE r.result IS NOT NULL AND o.version='rapid-id-v1'"))
                heatmap_training=sum(r['sessions'] for m in maps for r in m['rows'] if r['family']!='RAPID_ID')
                heatmap_rapid=sum(r['sessions'] for m in maps for r in m['rows'] if r['family']=='RAPID_ID')
                assert heatmap_training == expected_training, 'Historical training heatmap count changed'
                assert heatmap_rapid == expected_rapid, 'Rapid ID heatmap count changed'
                assert sum(m['included_sessions'] for m in maps) == expected_training+expected_rapid, 'Heatmap aggregate disagrees with disaggregated training and Rapid ID evidence'
            assert rows(target) == original, 'Backup immutable fields changed'
    finally:
        storage.DB_PATH = previous_db
        auth.credential_path = previous_auth
    assert rows(source) == original and rows(baseline) == prior, 'Source database changed'
    return dict(historical_completed=len(prior), additional_current_completed=len(original)-len(prior),
                all_current_completed_readable=len(original), stored_engine_versions=versions,
                exact_stored_cards_preserved=True, all_verified_aar_ghost_timelines_readable=True,
                all_four_skill_profiles_readable=True, heatmap_included_current_sessions=heatmap_training,
                heatmap_included_rapid_sessions=heatmap_rapid,
                heatmap_included_total_sessions=heatmap_training+heatmap_rapid,
                shared_completed_sessions_excluded_from_individual_heatmap=len(original)-expected_training,
                historical_immutable_fields_sha256=digest(prior), current_immutable_fields_sha256=digest(original),
                production_database_unchanged=True,
                scope='Aggregate only; private records stay in a temporary backup outside Git. Protected analytics use an ephemeral officer credential.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'data/vyuha.db')
    parser.add_argument('--baseline', type=Path, default=ROOT / 'data/stage5-before-stage6.db')
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/finale/HISTORY-RECEIPT.json')
    args = parser.parse_args()
    result = validate(args.source, args.baseline)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
