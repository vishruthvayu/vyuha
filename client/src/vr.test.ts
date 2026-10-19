import test from 'node:test';
import assert from 'node:assert/strict';
import { VRSessionLifecycle,checkVRSupport,vrAction,vrContacts,vrEvidence,vrRenderContacts,validConfirmation } from './vr';
import { observeSensors, SENSOR_VERSION } from './sensors-v2';
import { ObservationVisibility } from './visibility';
import { Simulation,replay,score } from './sim';
import { makeScenario } from './scenario';
import type { Action,Scenario,Snapshot,Track } from './types';
function fixture() {
 const scenario:Scenario={...makeScenario(),engine_version:SENSOR_VERSION,sensor_version:SENSOR_VERSION};
 const track:Track={...scenario.tracks[0],id:'T1',kind:'quad',identity:'hostile',rf:true,x:999,z:999,altitude:200,active:true,detected:1,designated:null,classification:null,declared:null,resolved:false,impact:false,radar:true,thermal:true,attempts:[]};
 track.observation=observeSensors(1,60,0,{...track,x:40,z:60,altitude:10},{night:false,fog:0}).observation;
 // Deterministic public camera observation, independent of truth fixture.
 track.observation.eo={available:true,level:'recognise',position:{x:40,z:60,altitude:10},silhouette:'multirotor',sample_tick:60};
 track.observation.ir=structuredClone(track.observation.eo);
 const state:Snapshot={tick:60,tracks:[track],jammed:false,radarStatus:'normal',rfAvailable:true,night:false,paused:false,done:false,messages:[]};
 return {scenario,state,track};
}
test('VR projects only current observed position and generic shape under adversarial hidden truth',()=>{
 const {scenario,state,track}=fixture();
 const altered=structuredClone(state),a=altered.tracks[0];
 Object.assign(a,{kind:'fiber_fpv',identity:'friendly',rf:false,x:-700,z:1900,altitude:800,impact:true,resolved:true});
 assert.deepEqual(vrContacts(state),vrContacts(altered));
 assert.deepEqual(vrEvidence(state,'T1'),vrEvidence(altered,'T1'));
 for(const vision of ['day','thermal','night'] as const){
  const first=vrRenderContacts(state,scenario,vision,new ObservationVisibility(),'a');
  assert.deepEqual(first,vrRenderContacts(altered,scenario,vision,new ObservationVisibility(),'a'));
  assert.deepEqual(first,[{id:'T1',x:40,y:10,z:60,shape:'multirotor'}]);
 }
 assert.equal(vrContacts(state)[0].range,72);
 assert.doesNotMatch(vrEvidence(state,'T1'),/hostile|friendly|fiber_fpv|999/);
 track.observation!.eo.level='detect';track.observation!.eo.silhouette=null;
 assert.equal(vrRenderContacts(state,scenario,'day',new ObservationVisibility(),'a')[0].shape,'unresolved');
});
test('VR missing v2 observations and bearing-only evidence never fall back to true geometry',()=>{
 const {state,scenario,track}=fixture();delete track.observation;
 assert.deepEqual(vrContacts(state),[]);
 assert.deepEqual(vrRenderContacts(state,scenario,'day',new ObservationVisibility(),'a'),[]);
 assert.equal(vrAction(state,'running',scenario,'T1','designate','quad','hostile'),undefined);
 const f=fixture();const o=f.track.observation!;o.eo.position=null;o.ir.position=null;o.radar.position=null;
 assert.deepEqual(vrContacts(f.state),[]);assert.match(vrEvidence(f.state,'T1'),/Select/);
});
test('VR optical loss holds only frozen observation for six ticks, failed channels clear immediately',()=>{
 const {state,scenario,track}=fixture();const v=new ObservationVisibility();
 assert.equal(vrRenderContacts(state,scenario,'day',v,'a').length,1);
 track.observation!.eo.level='none';track.observation!.eo.position=null;track.x=9000;
 state.tick++;assert.equal(vrRenderContacts(state,scenario,'day',v,'a')[0].x,40);
 track.observation!.eo.available=false;
 assert.deepEqual(vrRenderContacts(state,scenario,'day',v,'a'),[]);
});
test('VR actions preserve phase, designation, classification, resource, cooldown and restriction gates',()=>{
 const {state,scenario,track}=fixture();
 const a=(k:Action['k'],e:'hold'|'rf_jam'|'kinetic'='hold')=>vrAction(state,'running',scenario,'T1',k,'quad','hostile',e);
 assert.equal(vrAction(state,'paused',scenario,'T1','designate','quad','hostile'),undefined);
 assert.equal(a('classify'),undefined);assert.equal(a('engage'),undefined);assert.deepEqual(a('designate'),{k:'designate',track:'T1'});
 track.designated=60;assert.equal(a('designate'),undefined);assert.ok(a('classify'));track.classification='quad';assert.ok(a('engage','kinetic'));
 state.response={version:1,kinetic_ammo_remaining:0,kinetic_ready_tick:0,jammer_channels_in_use:1,pending:[],attempts:[]};
 assert.equal(a('engage','kinetic'),undefined);
 scenario.response_model={jammer_channels:1} as Scenario['response_model'];assert.equal(a('engage','rf_jam'),undefined);
 state.response.kinetic_ammo_remaining=1;state.response.kinetic_ready_tick=61;assert.equal(a('engage','kinetic'),undefined);
 state.response.kinetic_ready_tick=0;
 track.observation!.ir.position={x:-80,z:80,altitude:10};assert.equal(a('engage','kinetic'),undefined);
 track.observation!.ir.position={x:800,z:800,altitude:10};assert.equal(a('engage','rf_jam'),undefined);
 track.active=false;assert.equal(a('classify'),undefined);
});
test('VR second confirmation invalidates contact/session/phase/timeout/availability changes',()=>{
 const p={session:'one',track:'T1',effector:'hold' as const,until:9000};
 assert.equal(validConfirmation(p,'one','T1','running',1000,true),true);
 for(const [session,id,phase,now,available] of [['two','T1','running',1000,true],['one','T2','running',1000,true],['one','T1','paused',1000,true],['one','T1','running',9000,true],['one','T1','running',1000,false]] as const)
  assert.equal(validConfirmation(p,session,id,phase,now,available),false);
 assert.equal(validConfirmation(null,'one','T1','running',0,true),false);
});
test('VR ordinary payloads retain identical worker-style replay and scoring',()=>{
 const scenario=makeScenario(),sim=new Simulation(scenario),actions:Action[]=[];
 while(!sim.state.done){
  for(const t of vrContacts(sim.snapshot(),false)) {
   for(const k of ['designate','classify','engage'] as const){
    if(k==='classify'&&t.classification)continue;
    if(k==='engage'&&sim.state.tracks.find(x=>x.id===t.id)!.attempts.length)continue;
    const a=vrAction(sim.snapshot(),'running',scenario,t.id,k,'quad','neutral','hold');
    if(a){const action={...a,tick:sim.state.tick,order:actions.length};if(sim.act(action))actions.push(action);}
   }
  }sim.step();
 }
 assert.ok(actions.some(a=>a.k==='engage'));assert.deepEqual(score(sim),score(replay(scenario,actions,scenario.duration*30)));
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
