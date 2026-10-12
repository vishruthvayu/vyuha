"""Read-only public compliance/evidence index; never promotes audit status."""
import json
from collections import Counter
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parents[1]
router = APIRouter(prefix='/api/v1/system/compliance', tags=['Compliance'])
OFFICIAL_ROWS = {'SC01', 'SC02', 'SC03', 'SC04', 'SC05', 'SC06', 'SC07', 'SC08', 'SC09', 'SC10', 'SC11', 'SC14'}
DOCUMENTS = {
    'audit-matrix': ('AUDIT-CLOSURE-MATRIX.md', 'Complete 93-row acceptance matrix'),
    'audit-data': ('audit-backlog.json', 'Traceable audit data and checkpoints'),
    'research': ('RESEARCH-NOTES.md', 'Requirement provenance and primary research'),
    'requirements': ('SIH-PS-COMPLIANCE.md', 'Official requirement mapping'),
    'tests': ('TEST-RESULTS.md', 'Scoped test results'),
    'acceptance': ('FINAL-RELEASE-ACCEPTANCE.md', 'Remaining final release requirements'),
    'integration': ('INTEGRATION-STATUS.md', 'Candidate integration status'),
    'historical': ('HISTORICAL-COMPATIBILITY.md', 'Frozen historical compatibility'),
    'security': ('SECURITY-VALIDATION.md', 'Security validation scope'),
    'performance': ('PERFORMANCE-REPORT.md', 'Measured performance and limitations'),
    'physical': ('PHYSICAL-LAN-VALIDATION.md', 'Physical evidence provenance'),
    'evidence': ('evidence.json', 'Finale evidence manifest'),
}


def audit_data():
    try:
        audit = json.loads((ROOT/'docs/finale/audit-backlog.json').read_text())
        rows = audit['items']
        if len(rows) != 93 or len({row['id'] for row in rows}) != 93:
            raise ValueError('Audit traceability must retain all 93 findings')
        if any(row['status'] not in {'PASS', 'PARTIAL', 'N/A'} for row in rows):
            raise ValueError('Unknown audit status')
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise HTTPException(503, 'Compliance evidence unavailable: '+str(error)[:140]) from error
    return audit


@router.get('')
def compliance():
    audit = audit_data()
    documents = [dict(id=key, title=value[1], url=f'/api/v1/system/compliance/documents/{key}') for key,value in DOCUMENTS.items() if (ROOT/'docs/finale'/value[0]).is_file()]
    rows = [{**row, 'source_kind': 'official_clause_or_platform_choice' if row['id'] in OFFICIAL_ROWS else 'audit_quality_expectation', 'evidence_url': '/api/v1/system/compliance/documents/audit-matrix', 'implemented_is_not_validated': True} for row in audit['items']]
    candidate_path = ROOT/'docs/finale/evidence.json'
    candidate = json.loads(candidate_path.read_text()) if candidate_path.exists() else None
    return dict(schema_version=1, project='VYUHA · SIH26247', release_status='CANDIDATE — FINAL ACCEPTANCE PENDING', recorded_date=audit['created_date'], baseline_commit=audit['baseline_commit'], branch=audit['working_branch'], independent_score=audit.get('new_independent_score'), original_report_score=audit['original_report_score'], score_note='The earlier external score is historical. No new independent score or 100/100 acceptance is implied.', source=dict(kind='Inspected archived official SIH problem-statement image', url='/api/v1/system/compliance/source', fallback_url='/api/v1/system/compliance/documents/research', description='Desktop OR VR is the official platform choice. Difficulty, randomisation, instructor depth, LAN security and scientific fidelity are separately labelled quality objectives.'), totals=dict(Counter(row['status'] for row in rows)), items=rows, checkpoints=audit.get('candidate_checkpoints', {}), remaining=audit.get('unresolved_release_requirements', []), documents=documents, candidate_evidence=candidate, freshness_note='Source-specific checkpoint receipts describe tested software only. A completed final regression, source manifest and release acceptance are still required.')


@router.get('/documents/{document_id}')
def document(document_id: str):
    entry = DOCUMENTS.get(document_id)
    if entry is None:
        raise HTTPException(404, 'Unknown compliance document')
    path = ROOT/'docs/finale'/entry[0]
    if not path.is_file():
        raise HTTPException(404, 'Compliance document not yet recorded')
    return FileResponse(path, media_type='application/json' if path.suffix=='.json' else 'text/plain; charset=utf-8')


@router.get('/source')
def official_source():
    path = ROOT.parent.parent/'work/stage7/official-ps-details.png'
    if not path.is_file():
        raise HTTPException(404, 'Archived source image unavailable in this checkout; read the requirement provenance notes')
    return FileResponse(path, media_type='image/png')
