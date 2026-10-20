import type {TrackSpec} from './types';

export type RaidMotion = {
 version:1;
 primitive:'direct'|'weave'|'orbit_then_dash'|'dogleg'|'probe_retreat';
 phase_s:number;
 lateral_m:number;
 period_s:number;
 turn_deg:number;
};
export type RaidTrack = TrackSpec & {
 motion?:RaidMotion;
 group_id?:string;
 formation_offset_m?:number;
 formation_forward_m?:number;
 group_split_s?:number;
 expires_tick?:number;
 threat_profile?:string;
 registration_id?:string;
};
export type RaidFamily='DIRECT'|'SATURATION'|'DECOY_THEN_STRIKE'|'STAGGERED_WAVES'|'LOW_APPROACH'|'SPLIT_SWARM'|'PROBE_AND_RETREAT'|'BLIND_SECTOR';
export type RaidMetadata={
 version:2;
 family:RaidFamily;
 requested_seed:number;
 waves:{tick:number;role:string;contacts:string[]}[];
 signature:string[];
 fingerprint:string;
 formation_model:string;
 constraints:{response_window_s:number;peak_hostile_cap:number;max_contacts:number};
 anti_repeat:{rejected_attempts:number;history_considered:number};
 validation:{basis:string;response_windows:{[track:string]:{first_tick:number;last_tick:number;usable_ticks:number}};peak_simultaneous_hostiles:number;saturation_index:number};
 sector_basis?:string;
};

/** Closed-form version-2 motion. No previous-frame state enters this function.
 * Coordinates use the same deterministic micrometer grid as Python. */
export function raidPosition(track:RaidTrack,tick:number){
 const age=Math.max(0,(tick-track.spawn)/30);
 const motion=track.motion;
 const primitive=motion?.primitive??'direct';
 const phase=motion?.phase_s??0;
 let angle=track.bearing*Math.PI/180;
 let radius:number;
 let lateral=0;
 if(primitive==='orbit_then_dash'){
  const before=Math.min(age,phase);
  angle+=(motion?.turn_deg??0)*Math.PI/180*(before/Math.max(phase,1/30));
  radius=Math.max(0,track.distance-Math.max(0,age-phase)*track.speed);
 }else if(primitive==='probe_retreat'){
  radius=Math.max(0,track.distance-Math.min(age,phase)*track.speed+Math.max(0,age-phase)*track.speed*.75);
 }else{
  radius=Math.max(0,track.distance-age*track.speed);
  if(primitive==='weave')lateral=(motion?.lateral_m??0)*Math.sin(age*2*Math.PI/Math.max(motion?.period_s??1,1/30))*Math.min(1,radius/80);
  else if(primitive==='dogleg'){
   const progress=Math.max(0,Math.min(1,(age-phase)/Math.max(motion?.period_s??1,1/30)));
   lateral=(motion?.lateral_m??0)*Math.sin(Math.PI*progress)*Math.min(1,radius/80);
  }
 }
 let slot=track.formation_offset_m??0;
 radius+=(track.formation_forward_m??0)*Math.min(1,radius/80);
 if(track.group_split_s!==undefined&&age>track.group_split_s)slot+=(slot<0?-1:1)*Math.min(180,(age-track.group_split_s)*6);
 lateral+=slot*Math.min(1,radius/80);
 const x=Math.sin(angle)*radius+Math.cos(angle)*lateral;
 const z=Math.cos(angle)*radius-Math.sin(angle)*lateral;
 return {x:Math.floor(x*1e6+.5)/1e6,z:Math.floor(z*1e6+.5)/1e6};
}

export function raidContactActive(track:RaidTrack,tick:number){
 return tick>=track.spawn&&(track.expires_tick===undefined||tick<track.expires_tick);
}
