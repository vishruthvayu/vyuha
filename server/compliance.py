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
    'current-reconciliation': ('IMPLEMENTATION-RECONCILIATION.md', 'Current Ultimate implementation reconciliation'),
    'current-reconciliation-data': ('IMPLEMENTATION-RECONCILIATION.json', 'Current implementation status and exact source references'),
    'current-regression': ('ultimate/CURRENT-REGRESSION.json', 'Current source-specific regression receipt'),
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
    'browser-acceptance': ('BROWSER-ACCEPTANCE.json','Actual browser action/result evidence'),
    'authorization': ('AUTHORIZATION-ROUTE-RECEIPT.json','Registered protected route checks'),
    'transfer': ('TRANSFER-FINALE-RECEIPT.json','Signed transfer integrity checks'),
    'raid-validation': ('RAID-V2-RECEIPT.json','Procedural raid validation'),
    'terrain-proof': ('TERRAIN-VALIDATION.md','Urban/rural terrain source, tests and reproduction'),
    'reconstruction': ('RECONSTRUCTION-PROFILE-RECEIPT.json','Measured reconstruction profile'),
    'physical-runbook': ('WINDOWS-PHONE-ACCEPTANCE-RUNBOOK.md','Windows/Android physical execution runbook'),
    'physical-results': ('PHYSICAL-TEST-RESULTS.md','Genuine physical/native result ledger'),
    'deployment': ('DEPLOYMENT-GUIDE.md','Prepared platform deployment commands'),
    'director-experiment': ('DIRECTOR-V2-SIMULATED-EXPERIMENT.md','Synthetic Director experiment and limits'),
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
    rows = [{**row, 'source_kind': 'official_clause_or_platform_choice' if row['id'] in OFFICIAL_ROWS else 'audit_quality_expectation', **finding_links(row), 'implemented_is_not_validated': True} for row in audit['items']]
    candidate_path = ROOT/'docs/finale/evidence.json'
    candidate = json.loads(candidate_path.read_text()) if candidate_path.exists() else None
    return dict(schema_version=1, project='VYUHA · SIH26247', release_status='CANDIDATE — FINAL ACCEPTANCE PENDING', recorded_date=audit['created_date'], baseline_commit=audit['baseline_commit'], branch=audit['working_branch'], independent_score=audit.get('new_independent_score'), original_report_score=audit['original_report_score'], score_note='Earlier external and provisional scores are checkpoints. No final stable score or 100/100 acceptance is implied.', source=dict(kind='Inspected archived official SIH problem-statement image', url='/api/v1/system/compliance/source', fallback_url='/api/v1/system/compliance/documents/research', description='Desktop OR VR is the official platform choice. Difficulty, randomisation, instructor depth, LAN security and scientific fidelity are separately labelled quality objectives.'), totals=dict(Counter(row['status'] for row in rows)), items=rows, checkpoints=audit.get('candidate_checkpoints', {}), remaining=audit.get('unresolved_release_requirements', []), documents=documents, candidate_evidence=candidate, freshness_note='Source-specific checkpoint receipts describe tested software only. A completed final regression, source manifest and release acceptance are still required.')


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

# Fixed route/document catalogue: public traceability never enumerates private
# saved-session identifiers or grants officer/trainee capabilities.
WORKFLOW_GROUPS = [
    (['SC07'], '/exercises#raid-composer', 'Officer sign-in; choose urban or rural Terrain, compile a frozen raid and inspect its terrain and line-of-sight conditions.'),
    (['SC01','SC03','SC05','SC06','SC15','P0-01','P0-02','P0-03','P1-04','CH01','CH03','CH04','CH06','F03','X05','X16','X25','X28'], '/', 'Join a trainee identity, choose conditions and record an observed-contact decision.'),
    (['SC04','SC08','SC09','SC12','SC13','P0-04','P0-05','CH05','F02','X21','X03','P2-04'], '/exercises#raid-composer', 'Officer sign-in; compile a frozen raid, then run it from the training library.'),
    (['SC10','SC21','P1-06','CH08','CH09','F04','X14','X22','X23'], '/?view=aar', 'Choose your completed session; inspect Ghost, decision paths and separate hypothetical/reference runs.'),
    (['SC11','F07','SC17','X26'], '/analytics#scenario-skill', 'Officer sign-in; choose a trainee and inspect persisted history and scenario-skill evidence.'),
    (['SC18','P1-05','F01'], '/instructor#white-cell', 'Officer sign-in and an active trainee session; compare observed/reference pictures and acknowledged commands.'),
    (['F06','X15','X07'], '/crew', 'Officer creates a crew; participants use separate role codes. Completed history is descriptive, not individual competency.'),
    (['F05','X24','SC16'], '/exercises#raid-composer', 'Officer selects a frozen Fusion mode, runs the library drill, then reviews exposure receipts. Calibration and human reliance remain separate.'),
    (['SC20','P1-02','CH11'], '/instructor', 'Officer sign-in; inspect protected controls. Ordinary trainee callsigns remain a trusted-LAN identity model.'),
    (['SC19','SC14','P1-01','P1-03','CH12','X01','X08','X13','SC23','P2-03','CH15','X31'], '/system/evidence', 'Read deployment evidence and use the physical runbook; opening this page does not perform a physical/native test.'),
    (['CH16','X30'], '/unit', 'Officer sign-in; inspect stored cohort and completed exercise evidence.'),
    (['X04','X09'], '/transfer', 'Officer sign-in and a configured shared key; export and import the unchanged signed file.'),
    (['P2-05','CH13','X12','X29'], '/system/benchmark', 'Run the fixed-tier measurement on the actual target device; renderer, logical ticks and server latency are separate.'),
]
EVIDENCE_GROUPS = [
    (['SC07'], ['terrain-proof','raid-validation']),
    (['SC18','P1-05','F01','SC03','SC10','SC11','F04','F06','X15','X11','X24'], ['browser-acceptance','tests']),
    (['SC20','P1-02','CH11','X07','X08'], ['security','authorization']),
    (['X04'], ['transfer','tests']),
    (['F02','SC04','SC09','SC12','SC13','P0-04','P0-05','X21'], ['raid-validation','tests']),
    (['P2-05','CH13','CH16','X12','X29','X30'], ['performance','reconstruction']),
    (['SC14','SC19','SC23','P1-03','P2-03','CH12','CH15','X13','X31'], ['physical','physical-runbook','physical-results','deployment']),
    (['F07','SC17','X26'], ['director-experiment','research']),
    (['P2-02','CH14'], ['integration','tests']),
]

def finding_links(row):
    workflow = next(((url,context) for ids,url,context in WORKFLOW_GROUPS if row['id'] in ids), None)
    documents = next((ids for rows,ids in EVIDENCE_GROUPS if row['id'] in rows), ['evidence','tests'])
    links = [dict(title=DOCUMENTS[key][1],url=f'/api/v1/system/compliance/documents/{key}') for key in documents if key in DOCUMENTS and (ROOT/'docs/finale'/DOCUMENTS[key][0]).is_file()]
    return dict(evidence_url=f"/api/v1/system/compliance/findings/{row['id']}", finding_url=f"/system/compliance?finding={row['id']}#finding-{row['id']}", evidence_documents=links, live_workflow=dict(url=workflow[0],required_context=workflow[1],scope='Relevant implemented workflow; validation requires completing the action and inspecting its result.') if workflow else None)

@router.get('/findings/{finding_id}')
def finding(finding_id: str):
    audit = audit_data()
    row = next((item for item in audit['items'] if item['id']==finding_id), None)
    if row is None:
        raise HTTPException(404,'Unknown audit finding')
    return {**row, **finding_links(row), 'implemented_is_not_validated': True}
