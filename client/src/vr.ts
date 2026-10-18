import {controlReason} from './presentation';
import {simulatedObservations} from './observations';
import {KIND_LABEL,type Action,type Effector,type Identity,type Kind,type Scenario,type Snapshot} from './types';

export type VRPhase='ready'|'running'|'paused'|'complete';
export const vrKinds:Kind[]=['quad','fixed_wing','fiber_fpv','bird'];
export const vrIdentities:Identity[]=['hostile','friendly','neutral'];
export const vrContacts=(state:Snapshot)=>state.tracks.filter(t=>t.active&&t.detected!==null);
export function vrEvidence(state:Snapshot,selected:string|null){
 const t=vrContacts(state).find(t=>t.id===selected);
 if(!t)return 'Select a detected contact';
 const rf=simulatedObservations(state).find(o=>o.track_id===selected&&o.sensor==='rf');
 return `${t.id} | ${Math.round(Math.hypot(t.x,t.z))} m\nRadar: ${state.radarStatus==='failed'?'OFFLINE':t.radar?'contact':'no contact'} | IR: ${t.thermal?'contact':'no contact'}\nRF: ${!state.rfAvailable?'OFFLINE':rf?.rf_signal?'link detected':'no link detected'}\nIFF: ${!state.rfAvailable?'OFFLINE':rf?.iff==='friendly_reply'?'friendly reply':'no reply'}\nDeclared: ${t.classification?KIND_LABEL[t.classification]:'unknown'} / ${t.declared??'unknown'}`;
}
// VR sends the ordinary action payload. The worker still owns time, order and acceptance.
export function vrAction(state:Snapshot,phase:VRPhase,scenario:Scenario,selected:string|null,k:'designate'|'classify'|'engage',kind:Kind,identity:Identity,effector?:Effector):Omit<Action,'tick'>|undefined{
 const t=vrContacts(state).find(t=>t.id===selected);
 const allowed=k!=='engage'||!!effector&&(!scenario.doctrine||scenario.doctrine.rules.effectors.includes(effector));
 if(controlReason(k==='engage'?'respond':k,phase,t,allowed))return;
 return k==='classify'?{k,track:t!.id,kind,identity}:k==='engage'?{k,track:t!.id,effector}:{k,track:t!.id};
}

export type XRSupport='checking'|'available'|'insecure'|'unavailable'|'error';
export async function checkVRSupport(secure:boolean,xr:Pick<XRSystem,'isSessionSupported'>|undefined):Promise<XRSupport>{
 if(!secure)return 'insecure';
 if(!xr)return 'unavailable';
 try{return await xr.isSessionSupported('immersive-vr')?'available':'unavailable';}catch{return 'error';}
}

// Kept independent from rendering so denial, suspension and teardown can be exercised without hardware.
export class VRSessionLifecycle{
 session:XRSession|null=null;
 private disposed=false;
 private entering=false;
 constructor(private suspend:()=>void,private changed:(active:boolean)=>void){}
 async enter(xr:Pick<XRSystem,'requestSession'>,attach:(session:XRSession)=>Promise<void>){
  if(this.disposed||this.entering||this.session)return;
  this.entering=true;
  let session:XRSession|undefined;
  try{
   // local gives a seated origin. No room movement, floor calibration or hand-tracking requirement.
   session=await xr.requestSession('immersive-vr',{requiredFeatures:['local']});
   if(this.disposed){await session.end();return;}
   this.session=session;
   session.addEventListener('end',this.ended);
   session.addEventListener('visibilitychange',this.visibility);
   await attach(session);
   if(this.disposed||this.session!==session)return;
   this.changed(true);
  }catch(error){
   if(session&&this.session===session){this.detach(session);this.session=null;await session.end().catch(()=>{});this.suspend();this.changed(false);}
   throw error;
  }finally{this.entering=false;}
 }
 private detach=(s:XRSession)=>{s.removeEventListener('end',this.ended);s.removeEventListener('visibilitychange',this.visibility);};
 private ended=()=>{if(this.session)this.detach(this.session);this.session=null;this.suspend();this.changed(false);};
 private visibility=()=>{if(this.session?.visibilityState!=='visible')this.suspend();};
 async exit(){if(this.session){this.suspend();await this.session.end();}}
 dispose(){this.disposed=true;const s=this.session;if(s){this.detach(s);this.session=null;this.suspend();void s.end().catch(()=>{});}}
}
