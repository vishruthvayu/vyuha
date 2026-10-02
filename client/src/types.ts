export type Kind = 'bird'|'quad'|'fixed_wing'|'fiber_fpv';
export type Identity = 'hostile'|'friendly'|'neutral';
export type Effector = 'rf_jam'|'kinetic'|'hold';
export type TrackSpec = {id:string;kind:Kind;identity:Identity;rf:boolean;spawn:number;bearing:number;distance:number;speed:number;altitude:number};
export type Scenario = {version:1;id:string;seed:number;title:string;duration:number;night:boolean;fog:number;jamStart:number;jamEnd:number;focus:string;tracks:TrackSpec[]};
export type Action = {tick:number;order?:number;k:'designate'|'classify'|'engage';track:string;kind?:Kind;identity?:Identity;effector?:Effector};
export type Track = TrackSpec & {x:number;z:number;active:boolean;detected:number|null;designated:number|null;classification:Kind|null;declared:Identity|null;resolved:boolean;impact:boolean;radar:boolean;thermal:boolean;attempts:Effector[]};
export type Snapshot = {tick:number;tracks:Track[];jammed:boolean;radarStatus:'normal'|'jammed'|'failed';rfAvailable:boolean;night:boolean;paused:boolean;done:boolean;messages:{tick:number;track:string;text:string}[]};
export type NodeScore = {id:string;kind:Kind;identity:Identity;detect:number;classify:number;prioritise:number;engage:number;total:number;detected:number|null;designated:number|null;ideal:string;feedback:string[];impact:boolean;attempts:Effector[]};
export type ScoreCard = {score:number;passed:boolean;fratricide:boolean;roe_breaches:number;leakers:number;threats:number;rows:NodeScore[];skills:{recognition:number;response:number};summary:string;engine_version:string};
export type Record = {id:string;trainee:string;scenario:Scenario;events:Action[];commands?:AppliedCommand[];executionTick?:number;endTick:number;scorecard:ScoreCard;created_at:string;verified:boolean};
export const KIND_LABEL:{[K in Kind]:string} = {bird:'Bird',quad:'Quadcopter',fixed_wing:'Fixed-wing',fiber_fpv:'No-RF FPV'};

export type InstructorIntent =
 | {type:'pause'|'resume';payload:{[key:string]:never}}
 | {type:'inject_contact';payload:{kind:'quad'|'fiber_fpv';bearing:number}}
 | {type:'inject_swarm';payload:{count:6;bearing:number}}
 | {type:'sensor_fault';payload:{sensor:'radar';mode:'jammed'|'failed'}|{sensor:'rf';mode:'failed'}}
 | {type:'sensor_restore';payload:{sensor:'radar'|'rf'}}
 | {type:'environment';payload:{night:boolean}};
export type InstructorCommand = InstructorIntent & {command_id:string;session_id:string;seq:number;issued_at:string;tick?:number|null;order?:number|null};
export type AppliedCommand = InstructorCommand & {tick:number;order:number};
export type InstructorSession = {id:string;trainee:string;scenario:string;status:'ACTIVE'|'PAUSED'|'RECOVERABLE'|'COMPLETED';last_seen:string|null;telemetry:ControlTelemetry|null;commands:InstructorCommand[]};
export type ControlTelemetry = {tick:number;paused:boolean;active_contacts:number;radar_status:Snapshot['radarStatus'];rf_available:boolean;night:boolean};
