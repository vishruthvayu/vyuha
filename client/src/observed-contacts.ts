import type {Snapshot,Track} from './types';
/** Current reported position, including bounded radar coasting; never a truth fallback in v2. */
export function reportedPosition(t:Track){const o=t.observation;if(o)return o.ir.position??o.eo.position??o.radar.position??null;return t.active&&(t.radar||t.thermal)?{x:t.x,z:t.z,altitude:t.altitude}:null;}
export function reportedContacts(state:Snapshot){return state.tracks.flatMap(t=>{if(!t.active)return [];const p=reportedPosition(t);return p?[{...t,...p}]:[];});}
export function visualPosition(t:Track|undefined,vision:'day'|'night'|'thermal'){
 if(!t?.active)return null;if(t.observation)return (vision==='day'?t.observation.eo:t.observation.ir).position;
 return t.thermal?{x:t.x,z:t.z,altitude:t.altitude}:null;
}
