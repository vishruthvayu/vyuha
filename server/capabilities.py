"""Canonical capability/backlog registry with source-scoped validation receipts.

Definitions are runtime inputs; receipts live under docs outside the runtime hash,
so sealing validation never requires a self-referential source fingerprint.
"""
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from .evidence import ROOT, source_hash

router = APIRouter(prefix='/api/v1/system', tags=['Capability evidence'])
CATALOG = ROOT / 'server/config/capabilities-v1.json'
RECEIPTS = ROOT / 'docs/next-generation/validation.json'
STATUSES = {'IMPLEMENTED', 'PARTIAL', 'PLANNED', 'EXTERNALLY_BLOCKED', 'DEFERRED'}
SCOPES = {'backend', 'frontend', 'parity', 'historical', 'browser', 'performance', 'build', 'security', 'physical'}


def safe_file(root, value, prefixes):
    if not isinstance(value, str) or value.startswith('/') or '..' in Path(value).parts:
        raise ValueError('Evidence/source path must be repository-relative')
    if not any(value.startswith(p + '/') for p in prefixes):
        raise ValueError('Path outside public source/evidence roots')
    path = root / value
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('Public reference escapes repository')
    return path


def validate_catalog(data, root=ROOT):
    if set(data) != {'schema_version', 'title', 'capabilities', 'roadmap'} or type(data['schema_version']) is not int or data['schema_version'] != 1:
        raise ValueError('Unsupported capability catalog')
    if not isinstance(data['capabilities'], list) or not 1 <= len(data['capabilities']) <= 128:
        raise ValueError('Catalog requires a bounded capability list')
    ids = set()
    for row in data['capabilities']:
        if set(row) != {'id', 'title', 'implementation', 'route', 'source_files', 'evidence_ids', 'limitations'}:
            raise ValueError('Capability fields disagree with catalog schema')
        if not re.fullmatch(r'[a-z][a-z0-9-]{1,60}', row['id']) or row['id'] in ids:
            raise ValueError('Invalid or duplicate capability ID')
        ids.add(row['id'])
        if row['implementation'] not in STATUSES or not row['title'] or len(row['title']) > 140:
            raise ValueError('Invalid capability state/title')
        if not isinstance(row['route'], str) or not row['route'].startswith('/') or row['route'].startswith('//') or ':' in row['route']:
            raise ValueError('Capability route must be a local workflow')
        if not row['source_files'] or len(row['source_files']) > 20:
            raise ValueError('Capability requires bounded source references')
        for name in row['source_files']:
            path = safe_file(root, name, ['server', 'client', 'scripts'])
            if row['implementation'] in {'IMPLEMENTED', 'PARTIAL'} and not path.is_file():
                raise ValueError('Implemented capability has missing source: ' + name)
        if row['implementation'] in {'PLANNED', 'EXTERNALLY_BLOCKED', 'DEFERRED'} and row['evidence_ids']:
            raise ValueError('Unimplemented capability cannot claim passed validation')
    backlog = data['roadmap']
    if {r['id'] for r in backlog} != {f'R{i:02}' for i in range(1, 41)} or len(backlog) != 40:
        raise ValueError('Registry must retain all forty roadmap recommendations')
    for row in backlog:
        if set(row) != {'id', 'title', 'implementation', 'checkpoint', 'dependencies'} or row['implementation'] not in STATUSES:
            raise ValueError('Invalid roadmap contract')
        if any(d not in {r['id'] for r in backlog} or d == row['id'] for d in row['dependencies']):
            raise ValueError('Unknown/self roadmap dependency')
    # Dependency cycles would make completion ordering meaningless.
    edges = {r['id']: r['dependencies'] for r in backlog}
    def visit(key, ancestors):
        if key in ancestors:
            raise ValueError('Cyclic roadmap dependencies')
        for dependency in edges[key]:
            visit(dependency, ancestors | {key})
    for key in edges:
        visit(key, set())
    return data


def validate_receipt(receipt, current_hash, root=ROOT):
    required = {'id', 'status', 'source_hash', 'source_revision', 'scopes', 'artifacts', 'note'}
    if not required <= set(receipt) or set(receipt) - required - {'devices', 'method'}:
        raise ValueError('Unsupported validation receipt fields')
    if receipt['status'] not in {'PASS', 'PENDING', 'NOT_RUN', 'PARTIAL'}:
        raise ValueError('Unknown validation state')
    if not receipt['scopes'] or not set(receipt['scopes']) <= SCOPES:
        raise ValueError('Unknown validation scope')
    if receipt['status'] != 'PASS':
        return {**receipt, 'freshness': receipt['status'], 'current_pass': False}
    if not re.fullmatch(r'[a-f0-9]{64}', receipt['source_hash']) or not re.fullmatch(r'[a-f0-9]{40}', receipt['source_revision']):
        raise ValueError('Passed validation requires exact source hash and revision')
    if not receipt['artifacts']:
        raise ValueError('Passed validation requires actual proof artifacts')
    for artifact in receipt['artifacts']:
        if set(artifact) != {'path', 'sha256'}:
            raise ValueError('Artifact requires path and SHA-256')
        path = safe_file(root, artifact['path'], ['docs'])
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != artifact['sha256']:
            raise ValueError('Proof artifact missing or changed: ' + artifact['path'])
    if 'physical' in receipt['scopes']:
        if receipt.get('method') != 'physical' or not receipt.get('devices'):
            raise ValueError('Physical pass requires method and device receipts')
        for device in receipt['devices']:
            if set(device) != {'platform', 'browser', 'tested_at', 'workflow'} or any(not isinstance(v, str) or not v.strip() for v in device.values()):
                raise ValueError('Physical proof requires platform/browser/date/workflow')
            if datetime.fromisoformat(device['tested_at']).tzinfo is None:
                raise ValueError('Physical test timestamp requires timezone')
    current = receipt['source_hash'] == current_hash
    return {**receipt, 'freshness': 'CURRENT_PASS' if current else 'HISTORICAL_PASS', 'current_pass': current}


def registry():
    data = validate_catalog(json.loads(CATALOG.read_text()))
    current = source_hash()
    receipt_rows = json.loads(RECEIPTS.read_text())['receipts'] if RECEIPTS.is_file() else []
    receipts = {}
    for receipt in receipt_rows:
        try:
            if receipt['id'] in receipts:
                raise ValueError('Duplicate validation receipt ID')
            receipts[receipt['id']] = validate_receipt(receipt, current)
        except (KeyError, ValueError, TypeError) as error:
            receipts[receipt.get('id', 'invalid')] = {'id': receipt.get('id', 'invalid'), 'freshness': 'INVALID', 'current_pass': False, 'error': str(error)}
    rows = []
    for row in data['capabilities']:
        evidence = [receipts.get(key, {'id': key, 'freshness': 'MISSING', 'current_pass': False}) for key in row['evidence_ids']]
        rows.append({**row, 'validation': evidence})
    return {**data, 'capabilities': rows, 'current_source_hash': current,
            'note': 'Implementation and validation are separate. Historical PASS never certifies changed source. Physical testing and learning efficacy require separate evidence.'}


@router.get('/capabilities')
def capabilities():
    try:
        return registry()
    except (ValueError, KeyError, OSError, TypeError) as error:
        raise HTTPException(503, 'Capability registry unavailable: ' + str(error)[:240]) from error
