import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import Instructor from './Instructor';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{window.location.pathname==='/instructor'?<Instructor/>:<App/>}</React.StrictMode>);
function offlineStatus(value:string){document.documentElement.dataset.offlineStatus=value;window.dispatchEvent(new Event('vyuha-offline-status'));}
if(import.meta.env.PROD){
 const register=async()=>{if(!('serviceWorker' in navigator)){offlineStatus('unsupported');return;}offlineStatus('preparing');try{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;offlineStatus('ready');}catch(error){console.warn('Offline cache unavailable',error);offlineStatus('failed');}};
 if(document.readyState==='complete')void register();else window.addEventListener('load',()=>void register(),{once:true});
}else offlineStatus('development');
