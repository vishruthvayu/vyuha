import React,{lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
const App=lazy(()=>import('./App'));
const RapidID=lazy(()=>import('./RapidID'));
const ExerciseStudio=lazy(()=>import('./ExerciseStudio'));
const Analytics=lazy(()=>import('./Analytics'));
const Evaluation=lazy(()=>import('./Evaluation'));
const Recorded=lazy(()=>import('./Recorded'));
const Transfer=lazy(()=>import('./Transfer'));
const Benchmark=lazy(()=>import('./Benchmark'));
const Evidence=lazy(()=>import('./Evidence'));
const Instructor=lazy(()=>import('./Instructor'));
import './style.css';
import UnitPage,{UnitGateway} from './Unit';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={<main><h1>Loading VYUHA…</h1><p role="status">Loading bundled application assets.</p></main>}>{window.location.pathname==='/system/evidence'?<Evidence/>:window.location.pathname==='/system/benchmark'?<Benchmark/>:window.location.pathname==='/transfer'?<Transfer/>:window.location.pathname==='/evaluation'?<UnitGateway>{identity=><Evaluation identity={identity}/>}</UnitGateway>:window.location.pathname==='/recorded'?<UnitGateway>{identity=><Recorded identity={identity}/>}</UnitGateway>:window.location.pathname==='/exercises'?<ExerciseStudio/>:window.location.pathname==='/analytics'?<UnitGateway>{identity=><Analytics identity={identity}/>}</UnitGateway>:window.location.pathname==='/rapid-id'?<UnitGateway>{identity=><RapidID identity={identity}/>}</UnitGateway>:window.location.pathname==='/instructor'?<Instructor/>:window.location.pathname==='/unit'?<UnitPage/>:<UnitGateway>{identity=><App identity={identity}/>}</UnitGateway>}</Suspense></React.StrictMode>);
function offlineStatus(value:string){document.documentElement.dataset.offlineStatus=value;window.dispatchEvent(new Event('vyuha-offline-status'));}
if(import.meta.env.PROD){
 const register=async()=>{if(!window.isSecureContext||!('serviceWorker' in navigator)){offlineStatus('unsupported');return;}offlineStatus('preparing');try{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;offlineStatus('ready');}catch(error){console.warn('Offline cache unavailable',error);offlineStatus('failed');}};
 if(document.readyState==='complete')void register();else window.addEventListener('load',()=>void register(),{once:true});
}else offlineStatus('development');
