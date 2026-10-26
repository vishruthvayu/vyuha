"""Approved immutable curriculum snapshots, resolved by their exact byte hash.

The registry is bundled source configuration, never a trainee-supplied path or
an imported bundle. Unknown versions/hashes and edited snapshots fail closed.
Current curriculum selection remains learning.CATALOG; historical resolution is
independent from that current pointer. No mutable JSON objects are cached.
"""
import hashlib
import json
import re
from pathlib import Path

REGISTRY = Path(__file__).parent / 'config' / 'learning-catalogs-v1.json'
SUPPORTED_CONTRACTS = frozenset({'learning-v1'})
MAX_SNAPSHOTS = 32
MAX_CATALOG_BYTES = 2_000_000
_UNKNOWN = 'Unknown frozen curriculum catalog; do not reinterpret old evidence'


def _registry():
    try:
        if REGISTRY.stat().st_size > 32768:
            raise ValueError('Curriculum catalog registry exceeds bounded size')
        data = json.loads(REGISTRY.read_bytes())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError('Curriculum catalog registry is unavailable') from error
    if (type(data) is not dict or set(data) != {'version', 'catalogs'}
            or data['version'] != 'learning-catalog-registry-v1'
            or type(data['catalogs']) is not list
            or not 1 <= len(data['catalogs']) <= MAX_SNAPSHOTS):
        raise ValueError('Invalid curriculum catalog registry')
    result = {}
    root = REGISTRY.parent.resolve()
    for entry in data['catalogs']:
        if (type(entry) is not dict or set(entry) != {'sha256', 'contract', 'file'}
                or type(entry['sha256']) is not str
                or not re.fullmatch(r'[a-f0-9]{64}', entry['sha256'])
                or type(entry['contract']) is not str
                or entry['contract'] not in SUPPORTED_CONTRACTS
                or type(entry['file']) is not str
                or entry['file'] != f"learning-catalogs/{entry['sha256']}.json"
                or entry['sha256'] in result):
            raise ValueError('Invalid curriculum catalog registry entry')
        snapshot = (root / entry['file']).resolve()
        if not snapshot.is_relative_to(root / 'learning-catalogs'):
            raise ValueError('Curriculum catalog snapshot leaves the bundled registry')
        result[entry['sha256']] = (entry['contract'], snapshot)
    return result


def catalog_by_hash(digest: str, contract: str = 'learning-v1'):
    """Return a fresh catalog object only for an explicitly registered contract/hash.

    A self-consistent uploaded catalog is not sufficient: its hash must be in
    the bundled allowlist. The actual file bytes must match it on every read.
    """
    if (type(digest) is not str or not re.fullmatch(r'[a-f0-9]{64}', digest)
            or type(contract) is not str or contract not in SUPPORTED_CONTRACTS):
        raise ValueError(_UNKNOWN)
    entry = _registry().get(digest)
    if entry is None or entry[0] != contract:
        raise ValueError(_UNKNOWN)
    try:
        path = entry[1]
        if not 1 <= path.stat().st_size <= MAX_CATALOG_BYTES:
            raise ValueError('Frozen curriculum catalog exceeds bounded size')
        raw = path.read_bytes()
    except OSError as error:
        raise ValueError('Frozen curriculum catalog is unavailable') from error
    if hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError('Frozen curriculum catalog content hash mismatch')
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError('Frozen curriculum catalog is invalid JSON') from error
    if (type(data) is not dict or data.get('schema_version') != 1
            or data.get('version') != contract
            or type(data.get('competencies')) is not list
            or type(data.get('items')) is not list):
        raise ValueError('Frozen curriculum catalog contract mismatch')
    return data, digest


def current_catalog(path: Path):
    """Validate the existing current pointer against the approved snapshots."""
    try:
        if not 1 <= path.stat().st_size <= MAX_CATALOG_BYTES:
            raise ValueError('Current curriculum catalog exceeds bounded size')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError as error:
        raise ValueError('Current curriculum catalog is unavailable') from error
    return catalog_by_hash(digest)
