import {Component,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {World,type Vision} from './Scene';
import {nextStep} from './presentation';
import {KIND_LABEL,type Action,type Effector,type Identity,type Kind,type Scenario,type Snapshot} from './types';
import {checkVRSupport,VRSessionLifecycle,vrAction,vrContacts,vrEvidence,vrIdentities,vrKinds,type VRPhase,type XRSupport} from './vr';
import './vr.css';

type Button={id:string;label:string;enabled:boolean;run:()=>void};
type Props={state:Snapshot;scenario:Scenario;phase:VRPhase;selected:string|null;kind:Kind;identity:Identity;vision:Vision;busy:boolean;startLabel:string;onStart:()=>void;onPause:()=>void;onSuspend:()=>void;onSelect:(id:string)=>void;onKind:(kind:Kind)=>void;onIdentity:(identity:Identity)=>void;onVision:(vision:Vision)=>void;onAction:(action:Omit<Action,'tick'>)=>void;onClose:()=>void};
class VRBoundary extends Component<{children:ReactNode;onClose:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div role="alert"><p>VR rendering could not start. Your exercise can continue in the ordinary workspace.</p><button className="button primary" onClick={this.props.onClose}>Return to training</button></div>:this.props.children;}
}
// Each label is a real scene surface: it remains visible in immersive mode without DOM-overlay support.
function Surface({text,position,width=.86,height=.12,button}:{text:string;position:[number,number,number];width?:number;height?:number;button?:Button}){
 const texture=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=Math.round(width*1024);canvas.height=Math.round(height*1024);
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=button?(button.enabled?'#183b3f':'#17252d'):'#0c1b25';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle=button?.enabled?'#a8d879':'#42606b';ctx.lineWidth=5;ctx.strokeRect(3,3,canvas.width-6,canvas.height-6);
  const lines=text.split('\n'),size=Math.min(button?46:38,(canvas.height-28)/lines.length*.7);
  ctx.font=`${button?'600':'400'} ${size}px system-ui, sans-serif`;ctx.fillStyle=button&&!button.enabled?'#8c9ca7':'#f1f6f7';ctx.textBaseline='middle';
  lines.forEach((line,i)=>ctx.fillText(line,28,canvas.height/2+(i-(lines.length-1)/2)*size*1.35,canvas.width-56));
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
 },[text,width,height,button?.enabled,!!button]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh position={position} name={button?.id??'readout'} userData={{vrButton:button}} onClick={e=>{if(button){e.stopPropagation();if(button.enabled)button.run();}}}>
  <planeGeometry args={[width,height]}/><meshBasicMaterial map={texture} toneMapped={false} fog={false}/>
 </mesh>;
}
function Runtime({ready,onSuspend,onStatus,onFault}:{ready:(renderer:THREE.WebGLRenderer|null,lifecycle:VRSessionLifecycle|null)=>void;onSuspend:()=>void;onStatus:(active:boolean)=>void;onFault:(message:string)=>void}){
 const {gl,scene,camera}=useThree();
 const latest=useRef({onSuspend,onStatus,onFault});latest.current={onSuspend,onStatus,onFault};
 const pointers=useRef<{controller:THREE.XRTargetRaySpace;ray:THREE.Line;dot:THREE.Mesh}[]>([]);
 const raycaster=useMemo(()=>new THREE.Raycaster(),[]),rotation=useMemo(()=>new THREE.Matrix4(),[]);
 const rig=useMemo(()=>new THREE.Group(),[]);
 useEffect(()=>{
  gl.xr.enabled=true;gl.xr.setReferenceSpaceType('local');gl.xr.setFramebufferScaleFactor(.85);gl.xr.setFoveation(1);
  rig.position.set(0,1.6,0);scene.add(rig);rig.add(camera);camera.position.set(0,0,0);camera.rotation.set(-.2,0,0);
  const lifecycle=new VRSessionLifecycle(()=>latest.current.onSuspend(),active=>{if(!active){camera.position.set(0,0,0);camera.rotation.set(-.2,0,0);}latest.current.onStatus(active);});
  const reset=()=>{camera.position.set(0,0,0);camera.rotation.set(-.2,0,0);};gl.xr.addEventListener('sessionend',reset);
  const hit=(controller:THREE.XRTargetRaySpace)=>{
   controller.updateWorldMatrix(true,false);rotation.extractRotation(controller.matrixWorld);
   raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(rotation);
   raycaster.near=.02;raycaster.far=6;
   return raycaster.intersectObjects(scene.children,true).find(h=>h.object.userData.vrButton);
  };
  const cleanups:(()=>void)[]=[];
  for(let i=0;i<2;i++){
   const controller=gl.xr.getController(i);rig.add(controller);
   const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]);
   const material=new THREE.LineBasicMaterial({color:'#aee985',depthTest:false});
   const ray=new THREE.Line(geometry,material);ray.scale.z=3;ray.renderOrder=10;controller.add(ray);
   const dot=new THREE.Mesh(new THREE.SphereGeometry(.008,8,6),new THREE.MeshBasicMaterial({color:'#d9fa98',depthTest:false}));dot.renderOrder=11;scene.add(dot);dot.visible=false;
   const select=()=>{if(!gl.xr.isPresenting||lifecycle.session?.visibilityState!=='visible')return;const h=hit(controller);const b=h?.object.userData.vrButton as Button|undefined;if(b?.enabled)b.run();};
   controller.addEventListener('select',select);
   pointers.current.push({controller,ray,dot});
   cleanups.push(()=>{controller.removeEventListener('select',select);controller.remove(ray);rig.remove(controller);scene.remove(dot);geometry.dispose();material.dispose();dot.geometry.dispose();(dot.material as THREE.Material).dispose();});
  }
  ready(gl,lifecycle);
  const lost=(e:Event)=>{e.preventDefault();latest.current.onFault('Graphics context lost. The exercise is paused. Close and reopen the cockpit to recover.');latest.current.onSuspend();void lifecycle.exit().catch(()=>{});latest.current.onStatus(false);};gl.domElement.addEventListener('webglcontextlost',lost);
  return()=>{ready(null,null);lifecycle.dispose();gl.xr.removeEventListener('sessionend',reset);gl.domElement.removeEventListener('webglcontextlost',lost);cleanups.forEach(f=>f());pointers.current=[];rig.remove(camera);scene.remove(rig);};
 },[gl,scene,camera,rig,ready,raycaster,rotation]);
 useFrame(()=>{
  for(const {controller,ray,dot} of pointers.current){
   if(!gl.xr.isPresenting||!controller.visible){dot.visible=false;continue;}
   rotation.extractRotation(controller.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(rotation);raycaster.near=.02;raycaster.far=6;
   const h=raycaster.intersectObjects(scene.children,true).find(h=>h.object.userData.vrButton);
   ray.scale.z=h?.distance??3;dot.visible=!!h;if(h)dot.position.copy(h.point);
  }
 });
 return null;
}
function Cockpit({props,buttons,page,setPage}:{props:Props;buttons:Button[];page:number;setPage:(n:number)=>void}){
 const {state,scenario,phase,selected,vision}=props;
 const contacts=vrContacts(state),pages=Math.max(1,Math.ceil(contacts.length/4)),safePage=Math.min(page,pages-1);
 return <>
  <World state={state} selected={selected} vision={vision} onFps={()=>{}} terrain={scenario.terrain_id} quality="low" fog={scenario.fog} immersive/>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.02,0]}><circleGeometry args={[2,48]}/><meshBasicMaterial color="#1a3039" fog={false}/></mesh>
  <gridHelper args={[4,8,'#6b9395','#31484f']}/>
  <Surface text={`VYUHA / VR OBSERVATION POST\n${phase.toUpperCase()} | ${(state.tick/30).toFixed(0)} / ${scenario.duration} seconds`} position={[0,2.12,-1.9]} width={2.8} height={.19}/>
  <Surface text={vrEvidence(state,selected)} position={[-.98,1.64,-1.9]} width={.88} height={.48}/>
  {contacts.slice(safePage*4,safePage*4+4).map((t,i)=>{const b={id:`contact-${t.id}`,label:`${selected===t.id?'> ':''}${t.id} | ${Math.round(Math.hypot(t.x,t.z))} m`,enabled:true,run:()=>props.onSelect(t.id)};return <Surface key={t.id} text={b.label} button={b} position={[-.98,1.3-i*.14,-1.9]} width={.88}/>;})}
  {!contacts.length&&<Surface text="No detected contacts yet" position={[-.98,1.25,-1.9]} width={.88}/>}
  <Surface text={`Contacts ${safePage+1}/${pages} | next page`} position={[-.98,.67,-1.9]} width={.88} button={{id:'contact-page',label:'Next contacts',enabled:pages>1,run:()=>setPage((safePage+1)%pages)}}/>
  {buttons.slice(0,8).map((b,i)=><Surface key={b.id} text={b.label} button={b} position={[0,1.83-i*.15,-1.9]}/>)}
  <Surface text={`RADAR ${state.radarStatus.toUpperCase()}\nRF / IFF ${state.rfAvailable?'AVAILABLE':'OFFLINE'}\n${vision.toUpperCase()} VIEW\n${state.messages.at(-1)?.text??'Illustrative training simulation'}`} position={[.98,1.68,-1.9]} width={.88} height={.36}/>
  {buttons.slice(8).map((b,i)=><Surface key={b.id} text={b.label} button={b} position={[.98,1.37-i*.15,-1.9]} width={.88}/>)}
  <Surface text={nextStep(phase,state.tracks.find(t=>t.id===selected))} position={[0,.44,-1.9]} width={2.8} height={.12}/>
  <Surface text="Point either controller at a button; release trigger to select.\nStay seated. No walking or joystick movement. Exit VR pauses the drill." position={[0,.22,-1.9]} width={2.8} height={.2}/>
 </>;
}
export default function VRCockpit(props:Props){
 const [support,setSupport]=useState<XRSupport>('checking'),[active,setActive]=useState(false),[entering,setEntering]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(0),[pending,setPending]=useState<{effector:Effector;track:string;until:number}|null>(null);
 const runtime=useRef<{renderer:THREE.WebGLRenderer|null;lifecycle:VRSessionLifecycle|null}>({renderer:null,lifecycle:null});
 // Stable callback avoids recreating the XR runtime when the worker publishes snapshots.
 const ready=useMemo(()=> (renderer:THREE.WebGLRenderer|null,lifecycle:VRSessionLifecycle|null)=>{runtime.current={renderer,lifecycle};},[]);
 useEffect(()=>{let cancelled=false;void checkVRSupport(window.isSecureContext,navigator.xr).then(s=>{if(!cancelled)setSupport(s);});const change=()=>{void checkVRSupport(window.isSecureContext,navigator.xr).then(s=>{if(!cancelled)setSupport(s);});};navigator.xr?.addEventListener('devicechange',change);return()=>{cancelled=true;navigator.xr?.removeEventListener('devicechange',change);};},[]);
 useEffect(()=>{setPending(null);},[props.selected,props.phase]);
 useEffect(()=>{if(!pending)return;const timer=setTimeout(()=>setPending(null),Math.max(0,pending.until-Date.now()));return()=>clearTimeout(timer);},[pending]);
 async function enter(){const {renderer,lifecycle}=runtime.current;if(!renderer||!lifecycle||!navigator.xr)return;setEntering(true);setError('');try{await lifecycle.enter(navigator.xr,session=>renderer.xr.setSession(session));}catch(e){setError(`VR could not start: ${e instanceof Error?e.message:'permission or headset unavailable'}. You can retry or use desktop preview.`);}finally{setEntering(false);}}
 const exit=()=>{setPending(null);void runtime.current.lifecycle?.exit().catch(e=>setError(`Could not exit VR: ${String(e)}. Use the headset system menu.`));};
 const send=(k:'designate'|'classify'|'engage',effector?:Effector)=>{const action=vrAction(props.state,props.phase,props.scenario,props.selected,k,props.kind,props.identity,effector);if(action)props.onAction(action);};
 const can=(k:'designate'|'classify'|'engage',effector?:Effector)=>!!vrAction(props.state,props.phase,props.scenario,props.selected,k,props.kind,props.identity,effector);
 const armed=pending&&pending.track===props.selected&&props.phase==='running'&&pending.until>Date.now()?pending:null;
 const buttons:Button[]=[
  {id:'designate',label:'1 / Designate contact',enabled:can('designate'),run:()=>send('designate')},
  {id:'kind',label:`Type: ${KIND_LABEL[props.kind]} / cycle`,enabled:can('classify'),run:()=>props.onKind(vrKinds[(vrKinds.indexOf(props.kind)+1)%vrKinds.length])},
  {id:'identity',label:`Identity: ${props.identity} / cycle`,enabled:can('classify'),run:()=>props.onIdentity(vrIdentities[(vrIdentities.indexOf(props.identity)+1)%vrIdentities.length])},
  {id:'classify',label:'2 / Confirm classification',enabled:can('classify'),run:()=>send('classify')},
  ...(['hold','rf_jam','kinetic'] as const).map(e=>({id:e,label:`3 / ${e==='hold'?'Hold fire':e==='rf_jam'?'RF jammer':'Kinetic response'}`,enabled:can('engage',e),run:()=>props.selected&&setPending({effector:e,track:props.selected,until:Date.now()+8000})})),
  {id:'confirm',label:armed?`CONFIRM ${armed.effector.replace('_',' ')} on ${armed.track}`:'Select response, then confirm',enabled:!!armed&&can('engage',armed.effector),run:()=>{if(armed){send('engage',armed.effector);setPending(null);}}},
  {id:'start-pause',label:props.busy?'Please wait…':props.phase==='ready'?props.startLabel:props.phase==='running'?'Pause exercise':'Resume exercise',enabled:!props.busy&&props.phase!=='complete',run:()=>{setPending(null);if(props.phase==='ready')props.onStart();else props.onPause();}},
  {id:'vision',label:`View: ${props.vision} / cycle`,enabled:true,run:()=>props.onVision(props.vision==='thermal'?'day':props.vision==='day'?'night':'thermal')},
  {id:'cancel',label:'Cancel pending response',enabled:!!armed,run:()=>setPending(null)},
  {id:'exit',label:'Exit headset / pause',enabled:active,run:exit},
 ];
 const descriptions:Record<XRSupport,string>={checking:'Checking this browser for a VR headset…',available:'WebXR headset detected. Enter VR when you are ready.',insecure:'Headset mode needs trusted HTTPS. Plain LAN HTTP supports desktop preview only.',unavailable:'No immersive WebXR headset detected. Desktop preview is available below.',error:'The browser could not check VR support. Check permissions and retry by reopening this cockpit.'};
 return <section className="vr-workspace" aria-label="VR observation cockpit">
  <div className="vr-heading"><div><div className="eyebrow">IMMERSIVE TRAINING / SOFTWARE PREVIEW</div><h2>VR observation post</h2><p role="status">{active?'Headset session active. All exercise controls are inside VR.':descriptions[support]}</p></div><div className="vr-entry"><button className="button primary" disabled={support!=='available'||entering||active} onClick={()=>void enter()}>{entering?'Starting VR…':'Enter VR'}</button><button className="button subtle" onClick={()=>{props.onSuspend();props.onClose();}}>Close cockpit</button></div></div>
  <p className="vr-note">A stationary seated cockpit. Point a controller and release its trigger to select. On a laptop, click the cockpit or use the controls below. Software-tested; physical headset validation pending.</p>
  {error&&<p role="alert">{error}</p>}
  <VRBoundary onClose={props.onClose}><div className="vr-canvas"><Canvas dpr={1} camera={{position:[0,0,0],fov:65,near:.05,far:800}} gl={{antialias:true,powerPreference:'high-performance'}} fallback={<p>WebGL is unavailable. Close the cockpit to use the tactical view.</p>}>
   <Runtime ready={ready} onSuspend={props.onSuspend} onStatus={setActive} onFault={setError}/><Cockpit props={props} buttons={buttons} page={page} setPage={setPage}/>
  </Canvas></div></VRBoundary>
  <details className="vr-desktop-controls" open><summary>Desktop preview controls</summary><p>{vrEvidence(props.state,props.selected).split('\n').join(' · ')}</p><div className="vr-button-grid">{vrContacts(props.state).map(t=><button key={t.id} className="button subtle" aria-pressed={t.id===props.selected} onClick={()=>props.onSelect(t.id)}>{t.id}</button>)}</div><div className="vr-button-grid">{buttons.map(b=><button key={b.id} data-vr-action={b.id} className="button subtle" disabled={!b.enabled} onClick={b.run}>{b.label}</button>)}</div></details>
 </section>;
}
