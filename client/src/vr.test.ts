import test from 'node:test';
import assert from 'node:assert/strict';
import {VRSessionLifecycle,checkVRSupport,vrAction,vrContacts,vrEvidence} from './vr';
import {Simulation,replay,score} from './sim';
import {makeScenario} from './scenario';
import type {Action,Scenario} from './types';

const detected=()=>{const sim=new Simulation(makeScenario());while(!sim.state.tracks.some(t=>t.active&&t.detected!==null))sim.step();return sim;};
test('VR gates decisions by phase, detection, designation, classification and frozen effectors',()=>{
 const sim=detected(),spec=sim.scenario,t=vrContacts(sim.snapshot())[0];
 const action=(k:'designate'|'classify'|'engage',phase:'running'|'paused'='running',id=t.id)=>vrAction(sim.snapshot(),phase,spec,id,k,'quad','hostile','kinetic');
 assert.equal(action('designate','paused'),undefined);
 assert.equal(action('designate','running','missing'),undefined);
 assert.equal(action('classify'),undefined);assert.equal(action('engage'),undefined);
 sim.act({...action('designate')!,tick:sim.state.tick});
 assert.equal(action('designate'),undefined);assert.equal(action('engage'),undefined);
 sim.act({...action('classify')!,tick:sim.state.tick});
 assert.equal(action('engage')?.effector,'kinetic');
 const restricted={...spec,doctrine:{rules:{effectors:['hold']}}} as Scenario;
 assert.equal(vrAction(sim.snapshot(),'running',restricted,t.id,'engage','quad','hostile','kinetic'),undefined);
 sim.state.tracks.find(x=>x.id===t.id)!.active=false;assert.equal(action('engage'),undefined);
});
test('cockpit evidence exposes observed cues and trainee declarations rather than ground-truth identity/type',()=>{
 const sim=detected(),t=vrContacts(sim.snapshot())[0];
 t.kind='fiber_fpv';t.identity='hostile';t.classification=null;t.declared=null;
 const text=vrEvidence(sim.snapshot(),t.id);assert.match(text,/Declared: unknown \/ unknown/);assert.doesNotMatch(text,/hostile|fiber_fpv|No-RF FPV/);
 sim.state.rfAvailable=false;assert.match(vrEvidence(sim.snapshot(),t.id),/RF: OFFLINE\nIFF: OFFLINE/);
 assert.equal(vrEvidence(sim.snapshot(),'absent'),'Select a detected contact');
});
test('VR action adapter produces an ordinary replayable exercise and identical score',()=>{
 const sim=detected(),spec=sim.scenario,log:Action[]=[];
 while(!sim.state.done){for(const t of vrContacts(sim.snapshot())){
  const kinds=([...(t.designated===null?['designate' as const]:[]),...(!t.classification?['classify' as const]:[]),...(!t.attempts.includes('hold')?['engage' as const]:[])]);
  for(const k of kinds){const a=vrAction(sim.snapshot(),'running',spec,t.id,k,t.kind,t.identity,'hold');if(a&&(k!=='engage'||!t.attempts.includes('hold'))){const event={...a,tick:sim.state.tick,order:log.length};if(sim.act(event))log.push(event);}}
 }sim.step();}
 assert.ok(log.some(a=>a.k==='engage'));assert.deepEqual(score(replay(spec,log,spec.duration*30)),score(sim));
});
test('capability checks distinguish insecure, absent, rejected and supported WebXR',async()=>{
 assert.equal(await checkVRSupport(false,undefined),'insecure');assert.equal(await checkVRSupport(true,undefined),'unavailable');
 assert.equal(await checkVRSupport(true,{isSessionSupported:async()=>false}),'unavailable');
 assert.equal(await checkVRSupport(true,{isSessionSupported:async()=>true}),'available');
 assert.equal(await checkVRSupport(true,{isSessionSupported:async()=>{throw Error('denied');}}),'error');
});
class Session extends EventTarget{visibilityState='visible';ends=0;async end(){this.ends++;this.dispatchEvent(new Event('end'));}}
const asSession=(s:Session)=>s as unknown as XRSession;
const xr=(s:Session)=>({requestSession:async()=>asSession(s)}) as Pick<XRSystem,'requestSession'>;
test('XR lifecycle pauses on visibility loss and exit, supports clean re-entry',async()=>{
 const s=new Session(),status:boolean[]=[];let pauses=0,attachments=0;const life=new VRSessionLifecycle(()=>pauses++,a=>status.push(a));
 await life.enter(xr(s),async()=>{attachments++;});assert.deepEqual(status,[true]);assert.equal(attachments,1);
 await life.enter(xr(s),async()=>{attachments++;});assert.equal(attachments,1);
 s.visibilityState='hidden';s.dispatchEvent(new Event('visibilitychange'));assert.equal(pauses,1);
 s.visibilityState='visible';s.dispatchEvent(new Event('visibilitychange'));assert.equal(pauses,1); // never auto-resume
 await life.exit();assert.equal(life.session,null);assert.deepEqual(status,[true,false]);
 const other=new Session();await life.enter(xr(other),async()=>{});life.dispose();assert.equal(other.ends,1);assert.equal(life.session,null);
});
test('XR denial and renderer attachment failure do not leave an active session',async()=>{
 const life=new VRSessionLifecycle(()=>{},()=>{});
 await assert.rejects(life.enter({requestSession:async()=>{throw Error('permission denied');}},async()=>{}),/permission denied/);assert.equal(life.session,null);
 const s=new Session();await assert.rejects(life.enter(xr(s),async()=>{throw Error('attachment failed');}),/attachment failed/);assert.equal(s.ends,1);assert.equal(life.session,null);
});
test('pending session request is ended if cockpit unmounts; concurrent requests are suppressed',async()=>{
 let resolve!:(s:XRSession)=>void;let calls=0,attached=false;
 const request={requestSession:()=>{calls++;return new Promise<XRSession>(r=>resolve=r);}};
 const life=new VRSessionLifecycle(()=>{},()=>{});const promise=life.enter(request,async()=>{attached=true;});
 await life.enter(request,async()=>{});assert.equal(calls,1);life.dispose();const s=new Session();resolve(asSession(s));await promise;
 assert.equal(s.ends,1);assert.equal(attached,false);assert.equal(life.session,null);
});
test('session ending during renderer attachment never publishes an active cockpit',async()=>{
 const s=new Session(),status:boolean[]=[];const life=new VRSessionLifecycle(()=>{},a=>status.push(a));
 await life.enter(xr(s),async()=>{await s.end();});assert.deepEqual(status,[false]);assert.equal(life.session,null);
});
