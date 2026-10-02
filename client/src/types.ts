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
export type Record = {id:string;trainee:string;scenario:Scenario;events:Action[];commands?:AppliedCommand[];executionTick?:number;endTick:number;scorecard:ScoreCard;created_at:string;verified:boolean}&Partial<GhostAAR>;
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

export type GhostSkill='detection'|'classification_iff'|'effector_choice'|'degraded_sensor_response';
export type AvailableEvidence={tick:number;radar:{available:boolean;state:Snapshot['radarStatus'];detected:boolean};rf:{available:boolean;signal:boolean|null;iff:'friendly_reply'|'no_reply'|'unavailable'};visual:{available:boolean;silhouette:'bird'|'fixed_wing'|'multirotor'|null};range_m:number|null;restricted:boolean|null;first_detectable_tick:number|null;prior_classification:string|null;prior_identity:string|null;night:boolean};
export type DecisionReview={decision_id:string;session_id:string;track_id:string;tick:number;order:number|null;decision_kind:'detection'|'classification_iff'|'engagement';evidence:AvailableEvidence;ground_truth:{kind:Kind;identity:Identity;rf_link:boolean;spawn_tick:number};trainee_action:Action|null;expected_action:{type:'designate'|'classify'|'engage'|'observe';kind:Kind|null;identity:Identity|null;effector:Effector|null;basis:'available_evidence'|'ground_truth_reference'};verdict:'correct'|'incorrect'|'unassessable';reason_code:ReviewReason;explanation:string;consequence:{kind:'resolved'|'asset_impact'|'remained_active'|'hold'|'no_consequence_yet';tick:number|null;reason_code:string;immediate:string;text:string};score_effect:{scope:'final_contact_node';node:'detect'|'classify'|'engage';points_awarded:number;points_possible:number;session_penalty:number;penalty_basis:'observed'|'scoring_projection'|'none';session_failure:boolean};skill_tags:GhostSkill[];context_commands:number[]};
export type TimelineItem={id:string;tick:number;order:number|null;category:'trainee_action'|'instructor_action'|'sensor_transition'|'contact_detection'|'contact_resolution'|'asset_impact'|'score_error';code:string;title:string;track_id:string|null;decision_id:string|null;seek_before:boolean};
export type GhostAAR={timeline:TimelineItem[];decision_reviews:DecisionReview[];ghost_summary:{largest_loss:string|null;strongest_decision:string|null;mistake_counts:{[K in GhostSkill]:number};lost_points:{[K in GhostSkill]:number};recommended_focus:GhostSkill|null;no_major_errors:boolean;text:string};replay_metadata:{hz:number;observed_end_tick:number;scoring_end_tick:number;horizon_source:'completion'|'telemetry'|'last_recorded_event';early_end:boolean;version:string;note:string};node_averages:{detect:number;classify:number;prioritise:number;engage:number}};

export type ReviewReason='DETECTION_ON_TIME'|'DETECTION_LATE'|'THREAT_MISSED'|'DETECTION_PENDING'|'NO_EVIDENCE_AVAILABLE'|'CORRECT_CLASSIFICATION'|'WRONG_TYPE'|'WRONG_CATEGORY'|'FRIENDLY_MISIDENTIFIED'|'BIRD_MISIDENTIFIED'|'CLASSIFICATION_NOT_RECORDED'|'CORRECT_HOLD'|'CORRECT_RF_JAM'|'CORRECT_KINETIC'|'NO_RF_JAM_INEFFECTIVE'|'FRIENDLY_ENGAGED'|'NEUTRAL_ENGAGED'|'KINETIC_OUT_OF_RANGE'|'RF_JAM_OUT_OF_RANGE'|'KINETIC_ROE_RESTRICTED'|'WRONG_EFFECTOR'|'RESPONSE_NOT_RECORDED';
