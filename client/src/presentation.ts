import type {InstructorCommand,InstructorIntent,InstructorSession,Snapshot,Track} from './types';
export type CameraPreset='overview'|'observer'|'follow';
export type ThermalPalette='white'|'black'|'amber';
export const palettes={white:{label:'WHITE HOT',hot:'#ffffff',background:'#18201f',ground:'#303b38'},black:{label:'BLACK HOT',hot:'#101817',background:'#b8c2ba',ground:'#8b968f'},amber:{label:'AMBER',hot:'#ffdc91',background:'#271b16',ground:'#574434'}};
export function controlReason(action:'designate'|'classify'|'respond',phase:string,target?:Track,allowed=true){
 if(phase!=='running')return phase==='paused'?'Exercise is paused. Resume to make decisions.':'Start an exercise to make decisions.';
 if(!target)return 'Select a contact first.';
 if(!target.active)return 'This contact is no longer active.';
 if(action==='designate')return target.designated!==null?'Contact already designated.':undefined;
 if(target.designated===null)return 'Designate the contact first.';
 if(action==='respond'&&!target.classification)return 'Confirm the contact classification first.';
 if(!allowed)return 'This effector is unavailable in the frozen exercise configuration.';
 return undefined;
}
export function nextStep(phase:string,target?:Track){return phase==='ready'?'Prepare or start a drill.':phase==='paused'?'Resume the exercise to make decisions.':phase==='complete'?'Review Ghost and your recorded decisions.':!target?'Select a radar contact.':!target.active?'Select an active contact.':target.designated===null?`Review available evidence and designate ${target.id}.`:!target.classification?`Review RF / IFF and visual evidence; classify ${target.id}.`:`Choose a response for ${target.id}; check evidence, range and restrictions.`;}
export function instructorReason(session?:InstructorSession,busy=false,retry=false,error=''){return busy?'Sending the current command.':retry?'Resolve the pending command using its original ID.':error?'Server connection is uncertain. Reconnect before sending.':!session?'Select a trainee session.':session.status==='COMPLETED'?'Session completed. New commands cannot be sent.':session.status==='RECOVERABLE'?'Trainee connection is stale. Application status is unknown; wait for reconnection.':undefined;}
export function commandLabel(c:InstructorIntent){return c.type==='sensor_fault'?`${c.payload.sensor.toUpperCase()} ${c.payload.mode==='jammed'?'degraded':'offline'}`:c.type==='sensor_restore'?`Restore ${c.payload.sensor.toUpperCase()}`:c.type==='inject_contact'?`Inject ${c.payload.kind==='fiber_fpv'?'no-RF FPV':'hostile quad'}`:c.type==='inject_swarm'?'Inject six-contact swarm':c.type==='environment'?`Set ${c.payload.night?'night':'day'}`:c.type==='pause'?'Pause exercise':'Resume exercise';}
export function commandState(c:InstructorCommand|undefined,status:InstructorSession['status']|undefined,transport:'ready'|'sending'|'failed'|'acknowledged'='ready'){
 if(c?.tick!=null)return {state:'APPLIED',detail:`T+${(c.tick/30).toFixed(2)}s · order ${c.order}`};
 if(transport==='sending')return {state:'SENDING',detail:'Waiting for server receipt.'};
 if(transport==='failed'&&!c)return {state:'FAILED',detail:'Request outcome unconfirmed. Retry with the same command ID.'};
 if(c&&status==='COMPLETED')return {state:'FAILED',detail:'No recorded application before exercise ended.'};
 if(c&&status==='RECOVERABLE')return {state:'TIMED OUT',detail:'Trainee updates are stale. Application is unconfirmed; reconnect before retrying.'};
 return c||transport==='acknowledged'?{state:'ACKNOWLEDGED',detail:'Server stored command; awaiting trainee application.'}:{state:'READY',detail:'Select a command for the current session.'};
}
export function cameraPose(preset:CameraPreset,tracks:readonly Track[],selected:string|null){
 const t=tracks.find(t=>t.id===selected&&t.active);
 if(preset==='overview'||!t){const extent=Math.max(160,...tracks.map(t=>t.distance));return {effective:'overview' as CameraPreset,position:[0,extent*1.5,extent*.9] as [number,number,number],aim:[0,0,60] as [number,number,number],fallback:preset!=='overview'};}
 const follow=preset==='follow';return {effective:preset,position:[t.x+(follow?24:55),t.altitude+(follow?18:40),t.z+(follow?35:65)] as [number,number,number],aim:[t.x,t.altitude,t.z] as [number,number,number],fallback:false};
}
export function sensorLabels(s:Pick<Snapshot,'radarStatus'|'rfAvailable'>){return {radar:s.radarStatus==='failed'?'OFFLINE':s.radarStatus==='jammed'?'DEGRADED':'NORMAL',rf:s.rfAvailable?'NORMAL':'OFFLINE'};}
