import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ComplianceBoard,officialItems,type ComplianceManifest,type ComplianceItem} from './Compliance';
const row=(id:string,kind:ComplianceItem['source_kind'],finding:string):ComplianceItem=>({id,source_kind:kind,audit_finding:finding,status:id==='SC02'?'N/A':'PARTIAL',severity:'P1',implementation:'Candidate module exists',tests:'Scoped software tests pass; browser proof pending',remaining_limitation:'Physical validation pending',problem_statement_relevance:'Recorded source requirement',user_visible_proof:'Observe intended behavior',evidence_url:'/api/v1/system/compliance/documents/audit-matrix',implemented_is_not_validated:true});
const manifest:ComplianceManifest={schema_version:1,project:'VYUHA',release_status:'CANDIDATE — FINAL ACCEPTANCE PENDING',recorded_date:'2026-10-11',baseline_commit:'2ca96105044ad6a14952d74db619e20006c26eca',branch:'feature/vyuha-finale-edition',independent_score:null,score_note:'No new independent score or 100/100 acceptance is implied.',source:{kind:'Archived official',url:'/api/v1/system/compliance/source',fallback_url:'/api/v1/system/compliance/documents/research',description:'Desktop OR VR is the official platform choice.'},totals:{PARTIAL:92,'N/A':1},items:[row('SC03','official_clause_or_platform_choice','Single drone classification'),row('SC02','official_clause_or_platform_choice','Desktop OR VR alternative'),row('SC12','audit_quality_expectation','Difficulty quality objective')],checkpoints:{backend:{passed:319,failed:1,final_broad_rerun:'PENDING'}},remaining:['Fusion, Crew and resource scoring remain open'],documents:[{id:'acceptance',title:'Remaining release requirements',url:'/api/v1/system/compliance/documents/acceptance'}],freshness_note:'Scoped software checkpoint; final source manifest pending'};

test('official requirement subset keeps the OR alternative and excludes quality-only clauses',()=>{
 assert.deepEqual(officialItems(manifest).map(r=>r.id),['SC03','SC02']);
 assert.equal(officialItems(manifest)[1].status,'N/A');
});
test('compliance view separates implementation from validation without a fabricated score',()=>{
 const html=renderToStaticMarkup(<ComplianceBoard manifest={manifest}/>);
 assert.match(html,/FINAL ACCEPTANCE PENDING/);assert.match(html,/Implementation and validation are separate/);
 assert.match(html,/A final independent acceptance score has not been recorded/);assert.match(html,/92 partial/);
 assert.match(html,/Scoped software tests pass; browser proof pending/);assert.match(html,/Physical validation pending/);
 assert.match(html,/not presented as additional verbatim official clauses/);assert.doesNotMatch(html,/Difficulty quality objective/);
});
test('evidence links and unresolved release work remain visible and immutable',()=>{
 const before=JSON.stringify(manifest),html=renderToStaticMarkup(<ComplianceBoard manifest={manifest}/>);
 assert.match(html,/\/api\/v1\/system\/compliance\/source/);assert.match(html,/\/api\/v1\/system\/compliance\/documents\/acceptance/);
 assert.match(html,/Fusion, Crew and resource scoring remain open/);assert.match(html,/final source manifest pending/);
 assert.equal(JSON.stringify(manifest),before);
});

test('focused finding exposes its own evidence and workflow without passing it automatically',()=>{
 const record={...manifest.items[0],evidence_url:'/api/v1/system/compliance/findings/SC03',finding_url:'/system/compliance?finding=SC03#finding-SC03',evidence_documents:[{title:'Actual browser evidence',url:'/api/v1/system/compliance/documents/browser-acceptance'}],live_workflow:{url:'/',required_context:'Join a trainee and record an observed decision.',scope:'Relevant workflow; validation requires completing the action.'}};
 const updated={...manifest,items:[record,...manifest.items.slice(1)]};
 const before=JSON.stringify(updated),html=renderToStaticMarkup(<ComplianceBoard manifest={updated} initialFinding="SC03"/>);
 assert.match(html,/id="finding-SC03"/);assert.match(html,/findings\/SC03/);assert.match(html,/Open workflow for SC03/);assert.match(html,/Actual browser evidence/);assert.match(html,/validation requires completing/);
 assert.doesNotMatch(html,/id="finding-SC12"/);assert.equal(JSON.stringify(updated),before);
});
test('unknown focused finding stays explicit instead of presenting unrelated proof',()=>{
 const html=renderToStaticMarkup(<ComplianceBoard manifest={manifest} initialFinding="UNKNOWN"/>);
 assert.match(html,/This finding is unavailable/);assert.doesNotMatch(html,/Open workflow for/);
});
