import type {Scenario,TrackSpec} from './types';
export function rng(seed:number) {let a=seed>>>0; return ()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
export function makeScenario(seed=482913,focus='recognition',night=true):Scenario {
 const r=rng(seed);const offset=Math.floor(r()*18)-9;
 const rows:[TrackSpec['kind'],TrackSpec['identity'],boolean,number,number,number,number,number][]=[
  ['bird','neutral',false,0,72,155,.65,22],['quad','friendly',true,0,285,120,1.1,18],
  ['quad','hostile',true,60,35,140,2.1,26],['fixed_wing','hostile',false,330,120,175,2.8,35],
  ['fiber_fpv','hostile',false,630,320,148,3.8,10],
  ['quad','hostile',true,1080,15,155,3.2,20],['quad','hostile',true,1110,26,160,3.2,25],['quad','hostile',true,1140,38,165,3.2,15]];
 return {version:1,id:`sc_${seed}_${night?'night':'day'}_${focus}`,seed,title:focus==='response'?'Silent approach':night?'Night watch':'Day watch',duration:75,night,fog:.2,jamStart:660,jamEnd:900,focus,tracks:rows.map((x,i)=>({id:`T${i+1}`,kind:focus==='response'&&i===5?'fiber_fpv':x[0],identity:x[1],rf:focus==='response'&&i===5?false:x[2],spawn:x[3],bearing:x[4]+offset,distance:x[5],speed:x[6],altitude:x[7]}))};
}
