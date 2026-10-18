import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {startTour} from './CapabilityTour';

export default function OperatorGuide({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key==='Tab'){
    const buttons=dialog.current?.querySelectorAll<HTMLElement>('button,a[href]');
    const first=buttons?.[0],last=buttons?.[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);if(previous&&previous!==document.body&&previous.getClientRects().length&&getComputedStyle(previous).visibility!=='hidden')previous.focus();else document.querySelector<HTMLButtonElement>('.navigation-toggle')?.focus();};
 },[onClose]);
 return <div className="modal-backdrop" onClick={onClose}><section ref={dialog} className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e=>e.stopPropagation()}><button className="modal-close" aria-label="Close operator guide" onClick={onClose}><X size={20}/></button><div className="eyebrow">OPERATOR GUIDE</div><h2 id="guide-title">Your first 75-second drill</h2><button className="button subtle" onClick={()=>{onClose();startTour();}}>Replay tour</button><p><strong>VR observation post:</strong> In Training ground, select Open VR cockpit. Try its desktop preview now; a headset needs trusted HTTPS. <a href="/vr-guide.html" target="_blank" rel="noopener noreferrer">Read the beginner VR guide</a>. Physical headset validation is pending.</p><p>Thermal palettes and night grain are illustrative rendering; they do not improve sensor fidelity.</p><ol><li><strong>Observe.</strong> Select a radar marker or contact. The EO/IR camera focuses on it.</li><li><strong>Designate.</strong> Detection time starts at the first working-sensor observation.</li><li><strong>Classify.</strong> Use the silhouette, RF-link evidence and IFF response to choose type and identity.</li><li><strong>Respond.</strong> Hold on birds and friendlies. In this example pack, RF-linked hostiles use the jammer; no-RF threats require an allowed kinetic response.</li><li><strong>Review.</strong> Read the debrief, replay a decision, and repeat with a different seed.</li></ol><p>The original Night Watch has a radar gap at T+22–30s. Advanced and authored exercises use their own frozen conditions. Values are illustrative and do not represent operational doctrine.</p><button className="button primary" onClick={onClose}>Ready to train</button></section></div>;
}
