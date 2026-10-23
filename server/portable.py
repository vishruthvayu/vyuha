"""Pseudonymous HMAC transfer, validated reconstruction and atomic deduplicated import.

HMAC detects modifications by parties without the shared key. It is not identity,
non-repudiation, trusted telemetry, or proof that a donor's training data is authentic.
"""
import copy,hashlib,hmac,json,os,re,math
from pathlib import Path
from typing import Literal
from fastapi import APIRouter,HTTPException
from pydantic import Field,model_validator
from .models import StrictModel,Action
from .engine import make_scenario
from .review import build_review
from .director import persist_skill_results,session_outcomes
from .storage import connect,dumps
from .observations import Recording
router=APIRouter(prefix='/api/v1')

class SnapshotTrack(StrictModel):
 id:str=Field(pattern=r'^T[1-9][0-9]{0,2}$')
 kind:Literal['bird','quad','fixed_wing','fiber_fpv']
 identity:Literal['hostile','friendly','neutral']
 rf:bool
 spawn:int=Field(ge=0,le=2250)
 bearing:float=Field(ge=-360,le=720,allow_inf_nan=False)
 distance:float=Field(ge=0,le=2000,allow_inf_nan=False)
 speed:float=Field(gt=0,le=50,allow_inf_nan=False)
 altitude:float=Field(ge=0,le=500,allow_inf_nan=False)
 radar_range:float|None=Field(default=None,gt=0,le=2000,allow_inf_nan=False)
 thermal_range:float|None=Field(default=None,gt=0,le=2000,allow_inf_nan=False)

class Snapshot(StrictModel):
 version:Literal[1]
 engine_version:Literal['vyuha-0.2.0','vyuha-0.3.0']|None=None
 id:str=Field(min_length=1,max_length=100,pattern=r'^[A-Za-z0-9_-]+$')
 seed:int=Field(ge=0,le=4294967295)
 title:str=Field(min_length=1,max_length=100)
 duration:Literal[75]
 night:bool
 fog:float=Field(ge=0,le=1,allow_inf_nan=False)
 jamStart:int=Field(ge=0,le=2250)
 jamEnd:int=Field(ge=0,le=2250)
 focus:str=Field(max_length=40)
 tracks:list[SnapshotTrack]=Field(min_length=1,max_length=200)
 director_decision:dict|None=None
 doctrine:dict|None=None
 red_force:dict|None=None
 prioritisation_version:Literal[1]|None=None
 terrain:Literal['urban','rural']|None=None
 terrain_id:Literal['urban_outpost','rural_forward_base']|None=None
 terrain_version:Literal[1]|None=None
 authoring:dict|None=None
 difficulty_label:Literal['foundational','standard','challenging']|None=None
 radarFailureStart:int|None=Field(default=None,ge=0,le=2250)
 radarFailureEnd:int|None=Field(default=None,ge=0,le=2250)
 rfFailureStart:int|None=Field(default=None,ge=0,le=2250)
 rfFailureEnd:int|None=Field(default=None,ge=0,le=2250)
 @model_validator(mode='after')
 def unique(self):
  if len({t.id for t in self.tracks})!=len(self.tracks):raise ValueError('Duplicate scenario tracks')
  if self.prioritisation_version and not self.doctrine:raise ValueError('Advanced score requires doctrine snapshot')
  if self.doctrine:
   p=self.doctrine
   if p.get('version')!=1 or p.get('id') not in ['army-forward-post','capf-border-post','critical-infrastructure']:raise ValueError('Unsupported pack version')
   rules=p.get('rules',{})
   for k in ['rf_range','kinetic_range']:
    v=rules.get(k)
    if not isinstance(v,(int,float)) or isinstance(v,bool) or not 1<=v<=2000:raise ValueError('Invalid pack effector range')
   if not rules.get('effectors') or not set(rules['effectors'])<={'hold','rf_jam','kinetic'}:raise ValueError('Unsupported effectors')
   zone=rules.get('restricted',{})
   if type(zone.get('enabled')) is not bool or any(type(zone.get(k)) not in [int,float] or abs(zone[k])>2000 for k in ['x_lt','z_gt']):raise ValueError('Invalid restricted sector')
   weights=rules.get('risk_weights',{})
   if not weights or not set(weights)<={'bird','quad','fixed_wing','fiber_fpv'} or any(type(v) not in [int,float] or not 0<=v<=10 for v in weights.values()):raise ValueError('Invalid risk weights')
   if type(rules.get('asset_risk')) not in [int,float] or not 0<rules['asset_risk']<=10:raise ValueError('Invalid asset risk')
   if rules.get('distance_precision',9)!=9:raise ValueError('Unsupported distance precision')
   if p.get('rubric')!=dict(detect=25,classify=25,prioritise=15,engage=35):raise ValueError('Unsupported rubric')
  if self.director_decision:
   from .director_models import DirectorDecision
   DirectorDecision.model_validate(self.director_decision)
  return self

class TerrainBox(StrictModel):
 x_min:float=Field(ge=-10000,le=10000,allow_inf_nan=False)
 x_max:float=Field(ge=-10000,le=10000,allow_inf_nan=False)
 z_min:float=Field(ge=-10000,le=10000,allow_inf_nan=False)
 z_max:float=Field(ge=-10000,le=10000,allow_inf_nan=False)
 height:float=Field(ge=0,le=2000,allow_inf_nan=False)
 @model_validator(mode='after')
 def ordered(self):
  if self.x_min>self.x_max or self.z_min>self.z_max:raise ValueError('Terrain box bounds must be ordered')
  return self

class ThreatProfile(StrictModel):
 kind:Literal['bird','quad','fixed_wing','fiber_fpv']
 identity:Literal['hostile','friendly','neutral']
 rf:bool
 speed_mps:list[float]=Field(min_length=2,max_length=2)
 altitude_m:list[float]=Field(min_length=2,max_length=2)
 registration_beacon:bool|None=None

class ThreatUnits(StrictModel):
 distance:Literal['m']
 speed:Literal['m/s']
 altitude:Literal['m']
 time:Literal['s']

class ThreatConfig(StrictModel):
 version:Literal[1]
 id:str=Field(min_length=1,max_length=240)
 label:str=Field(min_length=1,max_length=240)
 units:ThreatUnits
 profiles:dict[Literal['hostile_quad','no_rf_fpv','fixed_wing','bird','friendly_uav','civil_uav'],ThreatProfile]=Field(min_length=6,max_length=6)

class SensorGeometry(StrictModel):
 radar_range_m:float=Field(ge=20,le=10000,allow_inf_nan=False)
 day_camera_range_m:float=Field(ge=20,le=10000,allow_inf_nan=False)
 thermal_range_m:float=Field(ge=20,le=10000,allow_inf_nan=False)

class HoldConfig(StrictModel):
 enabled:bool

class RFConfig(HoldConfig):
 max_range_m:float=Field(ge=20,le=5000,allow_inf_nan=False)
 requires_rf_link:Literal[True]

class KineticConfig(HoldConfig):
 max_range_m:float=Field(ge=20,le=5000,allow_inf_nan=False)

class EffectorRoster(StrictModel):
 hold:HoldConfig
 rf_jam:RFConfig
 kinetic:KineticConfig

class DistanceUnits(StrictModel):
 distance:Literal['m']

class EffectorConfig(StrictModel):
 version:Literal[1]
 id:str=Field(min_length=1,max_length=240)
 label:str=Field(min_length=1,max_length=240)
 units:DistanceUnits
 sensor_geometry:SensorGeometry
 effectors:EffectorRoster
 engagement_channels:int=Field(ge=1,le=12)
 asset_radius_m:Literal[8]
 minimum_response_window_s:float=Field(ge=1,le=30,allow_inf_nan=False)

class RestrictedSector(StrictModel):
 enabled:bool
 x_lt:float=Field(ge=-10000,le=10000,allow_inf_nan=False)
 z_gt:float=Field(ge=-10000,le=10000,allow_inf_nan=False)

class FinaleRules(StrictModel):
 rf_range:float=Field(ge=20,le=5000,allow_inf_nan=False)
 kinetic_range:float=Field(ge=20,le=5000,allow_inf_nan=False)
 restricted:RestrictedSector
 effectors:list[Literal['hold','rf_jam','kinetic']]=Field(min_length=1,max_length=3)
 risk_weights:dict[Literal['bird','quad','fixed_wing','fiber_fpv'],float]=Field(min_length=4,max_length=4)
 asset_risk:float=Field(gt=0,le=10,allow_inf_nan=False)
 distance_precision:Literal[6]
 hold_any_range:bool

class PackDefaults(StrictModel):
 fog:float=Field(ge=0,le=1,allow_inf_nan=False)
 night:bool
 mix:list[str]=Field(max_length=200)

class FrozenRubric(StrictModel):
 detect:Literal[25]
 classify:Literal[25]
 prioritise:Literal[15]
 engage:Literal[35]

from .raid_v2 import RaidTrackSpec,Family

class FinaleDoctrine(StrictModel):
 id:Literal['army-forward-post','capf-border-post','critical-infrastructure']
 version:Literal[1]
 name:str=Field(min_length=1,max_length=100)
 description:str=Field(min_length=1,max_length=240)
 example_values:Literal[True]
 rules:FinaleRules
 defaults:PackDefaults
 allowed_tactics:list[Family]=Field(min_length=1,max_length=8)
 rubric:FrozenRubric

class RaidWave(StrictModel):
 tick:int=Field(ge=0,le=5400)
 role:str=Field(min_length=1,max_length=50)
 contacts:list[str]=Field(min_length=1,max_length=200)

class RaidConstraints(StrictModel):
 response_window_s:float=Field(ge=1,le=30,allow_inf_nan=False)
 peak_hostile_cap:Literal[3,6,12]
 max_contacts:Literal[200]

class RaidAntiRepeat(StrictModel):
 rejected_attempts:int=Field(ge=0,le=23)
 history_considered:int=Field(ge=0,le=5)

class ResponseWindow(StrictModel):
 first_tick:int=Field(ge=0,le=5400)
 last_tick:int=Field(ge=0,le=5400)
 usable_ticks:int=Field(ge=1,le=5400)

class RaidGeometry(StrictModel):
 basis:str=Field(min_length=1,max_length=240)
 response_windows:dict[str,ResponseWindow]=Field(min_length=1,max_length=200)
 peak_simultaneous_hostiles:int=Field(ge=1,le=12)
 saturation_index:float=Field(gt=0,le=200,allow_inf_nan=False)

class RaidMetadata(StrictModel):
 version:Literal[2]
 family:Family
 requested_seed:int=Field(ge=0,le=4294967295)
 waves:list[RaidWave]=Field(min_length=1,max_length=4)
 formation_model:str=Field(min_length=1,max_length=240)
 constraints:RaidConstraints
 anti_repeat:RaidAntiRepeat
 signature:list[str]=Field(min_length=1,max_length=200)
 fingerprint:str=Field(pattern=r'^[a-f0-9]{24}$')
 validation:RaidGeometry
 sector_basis:Literal['Provided measured weak sector','Seeded random sector; no measured weakness supplied']|None=None

class FinaleRedForce(StrictModel):
 version:Literal[2]
 tactic:Family
 tactic_seed:int=Field(ge=0,le=4294967295)
 phases:list[RaidWave]=Field(min_length=1,max_length=4)

from .director_v2 import DirectorV2Metadata
from .fusion import FrozenFusionConfig
from .response_v2 import ResponseConfig

class SnapshotV2(StrictModel):
 response_model:ResponseConfig|None=None
 version:Literal[2]
 engine_version:Literal['vyuha-0.4.0']
 id:str=Field(pattern=r'^raid_[a-f0-9]{24}$')
 seed:int=Field(ge=0,le=4294967295)
 title:str=Field(min_length=3,max_length=70)
 duration:int=Field(ge=60,le=180)
 night:bool
 fog:float=Field(ge=0,le=.8,allow_inf_nan=False)
 jamStart:int=Field(ge=0,le=5400)
 jamEnd:int=Field(ge=0,le=5400)
 focus:Literal['detection','classification_iff','effector_choice','degraded_sensor_response']
 tracks:list[RaidTrackSpec]=Field(min_length=1,max_length=200)
 terrain:Literal['urban','rural']
 terrain_id:Literal['urban_outpost','rural_forward_base']
 terrain_version:Literal[1]
 terrain_boxes:list[TerrainBox]=Field(max_length=128)
 difficulty_label:Literal['foundational','standard','challenging']
 sensor_version:Literal['vyuha-0.4.0']
 sensor_config:dict[str,float|int]
 doctrine:FinaleDoctrine
 prioritisation_version:Literal[1]
 threat_config:ThreatConfig
 effector_config:EffectorConfig
 raid:RaidMetadata
 red_force:FinaleRedForce
 director_decision:dict|None=None
 director_v2:DirectorV2Metadata|None=None
 fusion:FrozenFusionConfig|None=None
 radarFailureStart:int|None=Field(default=None,ge=0,le=5400)
 radarFailureEnd:int|None=Field(default=None,ge=0,le=5400)
 rfFailureStart:int|None=Field(default=None,ge=0,le=5400)
 rfFailureEnd:int|None=Field(default=None,ge=0,le=5400)

def validate_snapshot_v2(spec):
 SnapshotV2.model_validate(spec)
 from .raid_v2 import validate_raid,raid_id,feature_signature
 expected=validate_raid(spec)
 if spec['raid']['validation']!=expected:raise ValueError('Raid geometry metadata disagrees with frozen reconstruction')
 signature=feature_signature(spec)
 fingerprint=hashlib.sha256(json.dumps(signature,separators=(',',':')).encode()).hexdigest()[:24]
 if spec['raid']['signature']!=signature or spec['raid']['fingerprint']!=fingerprint:raise ValueError('Raid fingerprint disagrees with frozen contact features')
 if spec['id']!=raid_id(spec):raise ValueError('Raid content hash disagrees with frozen specification')
 if spec['raid']['constraints']['peak_hostile_cap']!={'foundational':3,'standard':6,'challenging':12}[spec['difficulty_label']]:raise ValueError('Raid difficulty cap mismatch')
 end=spec['duration']*30
 for name in ['jamStart','jamEnd','radarFailureStart','radarFailureEnd','rfFailureStart','rfFailureEnd']:
  if spec.get(name) is not None and spec[name]>end:raise ValueError('Sensor window exceeds raid horizon')
 if spec['terrain_id']!=('urban_outpost' if spec['terrain']=='urban' else 'rural_forward_base'):raise ValueError('Frozen terrain identity mismatch')
 if spec['red_force']['phases']!=spec['raid']['waves'] or spec['red_force']['tactic']!=spec['raid']['family'] or spec['red_force']['tactic_seed']!=spec['seed']:raise ValueError('Frozen raid wave metadata mismatch')
 wave_members=[tid for wave in spec['raid']['waves'] for tid in wave['contacts']]
 if len(wave_members)!=len(set(wave_members)) or set(wave_members)!={t['id'] for t in spec['tracks'] if t['identity']=='hostile'}:raise ValueError('Raid waves must partition the frozen hostile roster')
 if any(type(value) not in (int,float) or not math.isfinite(value) or not 0<=value<=10 for value in spec['doctrine']['rules']['risk_weights'].values()):raise ValueError('Invalid frozen risk weights')
 cfg=spec['effector_config'];rules=spec['doctrine']['rules']
 if rules['rf_range']!=cfg['effectors']['rf_jam']['max_range_m'] or rules['kinetic_range']!=cfg['effectors']['kinetic']['max_range_m'] or set(rules['effectors'])!={k for k,v in cfg['effectors'].items() if v['enabled']}:raise ValueError('Frozen effector configuration disagrees with doctrine rules')
 if spec.get('director_decision'):
  from .director_models import DirectorDecision
  DirectorDecision.model_validate(spec['director_decision'])
 return spec

class UnitRef(StrictModel):
 id:str=Field(pattern=r'^U_[a-f0-9]{20}$')
 name:str=Field(min_length=1,max_length=80)

from .portable_crew import SharedCrewMetadata,shared_metadata,validate_shared,save_archive,validate_cohorts,compatible_metadata
from .portable_teaching import TeachingNote,export_notes,validate_notes,notes_match,insert_notes
from .fusion import Exposure
from .portable_fusion import export_exposures,prepare_exposures,verify_existing_exposures,insert_exposures

from .learning import LearningContext,compile_item,is_practice,complete_attempt,decorate as decorate_learning

class TacticalEntry(StrictModel):
 learning_context:LearningContext|None=None
 id:str=Field(min_length=8,max_length=64,pattern=r'^[A-Za-z0-9_-]+$')
 trainee:str=Field(pattern=r'^P_[a-f0-9]{20}$')
 created_at:str=Field(max_length=40)
 processed_at:str=Field(max_length=40)
 scenario:dict
 events:list[Action]=Field(max_length=5000)
 commands:list[dict]=Field(max_length=100)
 execution_tick:int=Field(ge=0,le=5400)
 end_tick:int=Field(ge=1800,le=5400)
 scorecard:dict
 outcomes:dict|None
 shared_crew:SharedCrewMetadata|None=None
 teaching_notes:list[TeachingNote]=Field(default_factory=list,max_length=100)
 fusion_exposures:list[Exposure]=Field(default_factory=list,max_length=2000)

class RapidEntry(StrictModel):
 id:str=Field(pattern=r'^R_[a-f0-9]{32}$')
 trainee:str=Field(pattern=r'^P_[a-f0-9]{20}$')
 seed:int=Field(ge=0,le=4294967295)
 created_at:str=Field(max_length=40)
 processed_at:str=Field(max_length=40)
 answers:list[dict]=Field(min_length=10,max_length=20)
 result:dict

class Payload(StrictModel):
 schema_version:Literal[1]
 engine_versions:list[Literal['vyuha-0.1.0','vyuha-0.2.0','vyuha-0.3.0','vyuha-0.4.0']]=Field(max_length=4)
 unit:UnitRef
 sessions:list[TacticalEntry]=Field(max_length=200)
 rapid:list[RapidEntry]=Field(max_length=100)
 profiles:dict
 recordings:list[dict]=Field(max_length=20)
 note:Literal['Pseudonymous transfer. HMAC integrity is not identity or training authenticity.']

class Envelope(StrictModel):
 algorithm:Literal['HMAC-SHA256']
 canonicalization:Literal['vyuha-json-number-v2']|None=None
 payload:dict
 hmac:str=Field(pattern=r'^[a-f0-9]{64}$')

def key():
 value=os.environ.get('VYUHA_BUNDLE_SECRET')
 path=os.environ.get('VYUHA_BUNDLE_KEYFILE')
 try:secret=value.encode() if value else Path(path).read_bytes() if path else b''
 except OSError:raise HTTPException(503,'Configured bundle key file is unavailable')
 if len(secret)<32:raise HTTPException(503,'Configure a local shared bundle key of at least 32 bytes; see scripts/bundle-key.py. Never commit or include it in bundles.')
 return secret

CANONICALIZATION='vyuha-json-number-v2'
MAX_SAFE_INTEGER=9007199254740991

def canonical_payload(payload):
 """Stable across JSON.parse/stringify, including 1.0 -> 1 and -0.0 -> 0.

 This is a versioned VYUHA format, not a claim of RFC 8785 compliance. JSON
 numbers share JavaScript's finite IEEE-754 domain; integers outside its exact
 range are rejected rather than silently rounded. Strings and booleans retain
 their distinct JSON types. The algorithm and version are domain-separated.
 """
 def normalize(value):
  if value is None or type(value) in (str,bool):return value
  if type(value) is int:
   if abs(value)>MAX_SAFE_INTEGER:raise ValueError('Portable integer exceeds JavaScript safe integer range')
   return value
  if type(value) is float:
   if not math.isfinite(value):raise ValueError('Portable numbers must be finite')
   if value.is_integer():
    if abs(value)>MAX_SAFE_INTEGER:raise ValueError('Portable integer exceeds JavaScript safe integer range')
    return int(value)
   return value
  if type(value) is list:return [normalize(v) for v in value]
  if type(value) is dict:
   if any(type(k) is not str for k in value):raise ValueError('Portable object keys must be strings')
   return {k:normalize(v) for k,v in value.items()}
  raise ValueError('Unsupported portable JSON value')
 return (CANONICALIZATION+'\n'+json.dumps(normalize(payload),separators=(',',':'),sort_keys=True,allow_nan=False)).encode()

def digest(payload,secret,canonicalization=None):
 data=canonical_payload(payload) if canonicalization==CANONICALIZATION else dumps(payload).encode()
 return hmac.new(secret,data,hashlib.sha256).hexdigest()

def sign(payload,secret):
 return dict(algorithm='HMAC-SHA256',canonicalization=CANONICALIZATION,payload=payload,hmac=digest(payload,secret,CANONICALIZATION))
def pseudonym(value,secret,prefix):
 # Imported anonymous IDs stay stable when forwarded; fresh installations cannot
 # accidentally pool their default unit or local-demo trainee identifiers.
 if re.fullmatch(re.escape(prefix)+r'[a-f0-9]{20}',value):return value
 with connect() as db:origin=db.execute('SELECT nonce FROM transfer_origin WHERE singleton=1').fetchone()['nonce']
 return prefix+hmac.new(secret,(origin+':'+value).encode(),hashlib.sha256).hexdigest()[:20]

def export_scenario(spec,secret):
 s=copy.deepcopy(spec)
 if s.get('director_decision'):
  d=s['director_decision'];tid=d['trainee_id']
  if not re.fullmatch(r'P_[a-f0-9]{20}',tid):d['trainee_id']=pseudonym(tid,secret,'P_')
 if s.get('authoring'):
  s['authoring']['created_by']='LOCAL-INSTRUCTOR'
  s['authoring']['request']['created_by']='LOCAL-INSTRUCTOR'
 return s

@router.post('/units/{uid}/bundle/export')
def export(uid:str):
 secret=key()
 from .main import profile,aar
 with connect() as db:
  u=db.execute('SELECT * FROM units WHERE id=?',(uid,)).fetchone()
  if not u:raise HTTPException(404,'Unit not found')
  from .portable_crew import ensure_schema
  ensure_schema(db)
  crew_owners={r['trainee'] for r in db.execute('SELECT s.trainee FROM sessions s WHERE EXISTS(SELECT 1 FROM crews c WHERE c.session_id=s.id) OR EXISTS(SELECT 1 FROM crew_archive c WHERE c.session_id=s.id)')}
  trainees=[r['id'] for r in db.execute('SELECT id FROM trainees WHERE unit_id=?',(uid,)) if r['id'] not in crew_owners]
 for tid in trainees:profile(tid)
 entries=[];rapids=[];profiles={};versions=set()
 with connect() as db:
  rows=db.execute("SELECT * FROM sessions WHERE unit_id=? AND status='completed' ORDER BY created_at,id",(uid,)).fetchall()
  rr=db.execute('SELECT r.* FROM rapid_sessions r JOIN trainees t ON t.id=r.trainee WHERE t.unit_id=? AND r.result IS NOT NULL ORDER BY r.created_at,r.id',(uid,)).fetchall()
  if len(rows)>200 or len(rr)>100:raise HTTPException(422,'Unit exceeds portable bundle limits: 200 tactical and 100 recognition sessions; no partial history is silently exported')
  for r in rows:
   a=aar(r['id']);o=db.execute('SELECT outcomes,processed_at FROM skill_outcomes WHERE session_id=?',(r['id'],)).fetchone()
   learning=decorate_learning(db,r['id']).get('learning')
   practice=is_practice(db,r['id'])
   shared=shared_metadata(db,r['id'],secret)
   if shared and o:raise HTTPException(422,'Shared crew session has an invalid individual outcome ledger; repair source classification before export')
   if practice and o:raise HTTPException(422,'Practice cannot have individual outcomes')
   if not shared and not practice and not o:raise HTTPException(422,'Session has no reconstructable skill outcomes')
   exposures=export_exposures(db,r['id'])
   try:notes=export_notes(db,r['id'])
   except ValueError as e:raise HTTPException(422,'Teaching archive source is invalid: '+str(e)) from e
   versions.add(a['scorecard']['engine_version'])
   entries.append(dict(id=r['id'],trainee=pseudonym(r['trainee'],secret,'P_'),created_at=r['created_at'],processed_at=r['completed_at'] or r['created_at'] if shared or practice else o['processed_at'],scenario=export_scenario(a['scenario'],secret),events=a['events'],commands=a['commands'],execution_tick=a['executionTick'],end_tick=a['endTick'],scorecard=a['scorecard'],outcomes=None if shared or practice else json.loads(o['outcomes']),**({'learning_context':learning['context']} if learning else {}),**({'shared_crew':shared} if shared else {}),**({'fusion_exposures':exposures} if exposures else {}),**({'teaching_notes':notes} if notes else {})))
  for r in rr:
   o=db.execute('SELECT processed_at FROM skill_outcomes WHERE session_id=?',(r['id'],)).fetchone()
   if not o:raise HTTPException(422,'Recognition ledger missing')
   body=json.loads(r['body']);answers=[json.loads(a['result']) for a in db.execute('SELECT result FROM rapid_answers WHERE session_id=? ORDER BY round_index',(r['id'],))]
   rapids.append(dict(id=r['id'],trainee=pseudonym(r['trainee'],secret,'P_'),seed=body['seed'],created_at=r['created_at'],processed_at=o['processed_at'],answers=answers,result=json.loads(r['result'])))
  for tid in trainees:profiles[pseudonym(tid,secret,'P_')]={r['skill']:dict(alpha=r['alpha'],beta=r['beta']) for r in db.execute('SELECT * FROM skill_profiles WHERE trainee=?',(tid,))}
  recordings=[dict(id=r['id'],recording=json.loads(r['spec'])) for r in db.execute('SELECT * FROM recordings LIMIT 21')]
 if len(recordings)>20:raise HTTPException(422,'Export exceeds 20 recordings')
 payload=dict(schema_version=1,engine_versions=sorted(versions),unit=dict(id=pseudonym(uid,secret,'U_'),name=u['name']),sessions=entries,rapid=rapids,profiles=profiles,recordings=recordings,note='Pseudonymous transfer. HMAC integrity is not identity or training authenticity.')
 try:Payload.model_validate(payload)
 except ValueError as e:raise HTTPException(422,'Unit history exceeds the strict portable schema: '+str(e)[:200]) from e
 if len(dumps(payload).encode())>7*1024*1024:raise HTTPException(422,'Portable payload exceeds 7 MiB; export is bounded')
 return sign(payload,secret)

def validate_rapid(entry):
 from .advanced import make_rapid,RapidAnswer,rapid_metrics
 rounds=make_rapid(entry.seed,len(entry.answers));answers=[];prior=0
 for i,(a,r) in enumerate(zip(entry.answers,rounds)):
  req=RapidAnswer.model_validate({k:a[k] for k in ['round_index','answer','round_start_ms','response_time_ms']})
  if req.round_index!=i or req.round_start_ms<prior or req.answer is None and req.response_time_ms!=5000:raise ValueError('Invalid recognition clock/sequence')
  prior=req.round_start_ms+req.response_time_ms
  expected=dict(**req.model_dump(),correct_answer=r['correct_answer'],correct=req.answer==r['correct_answer'] and req.response_time_ms<5000,evidence=r['evidence'],flight=r['flight'],briefing=r['briefing'],snapshot_tick=r['snapshot_tick'],explanation='Reference uses the modeled silhouette, RF/IFF and exercise identity briefing; no IFF reply alone is not proof of hostility.')
  if a!=expected:raise ValueError('Recognition answer reference disagrees with seeded evidence')
  answers.append(expected)
 if entry.result!=rapid_metrics(answers):raise ValueError('Recognition summary disagrees with rounds')
 return rounds

@router.post('/bundle/import')
def import_bundle(req:Envelope):
 try:expected=digest(req.payload,key(),req.canonicalization)
 except (ValueError,TypeError,OverflowError) as e:raise HTTPException(422,'Invalid portable JSON numbers: '+str(e)[:200]) from e
 if not hmac.compare_digest(req.hmac,expected):raise HTTPException(422,'Bundle integrity check failed; no data imported')
 try:
  p=Payload.model_validate(req.payload);ids=[e.id for e in p.sessions]+[e.id for e in p.rapid]
  if len(ids)!=len(set(ids)):raise ValueError('Duplicate canonical session IDs inside bundle')
  validate_cohorts(p.sessions,p.unit.id)
  from .review import SKILLS
  if len(p.profiles)>1000:raise ValueError('Too many profile snapshots')
  for tid,skills in p.profiles.items():
   if not re.fullmatch(r'P_[a-f0-9]{20}',tid) or set(skills)!=set(SKILLS):raise ValueError('Invalid anonymous profile snapshot')
   for values in skills.values():
    if set(values)!={'alpha','beta'} or any(type(v) not in [int,float] or not math.isfinite(v) or not 1<=v<=10000000 for v in values.values()):raise ValueError('Invalid Beta snapshot')
  if any(e.trainee not in p.profiles for e in p.sessions if not e.shared_crew) or any(e.trainee not in p.profiles for e in p.rapid):raise ValueError('Individual session owner absent from profiles')
  if any(e.trainee in p.profiles for e in p.sessions if e.shared_crew):raise ValueError('Synthetic crew owner must not have an individual profile snapshot')
  prepared=[];rapid_prepared=[];fusion_prepared={}
  from datetime import datetime
  for e in p.sessions+p.rapid:
   for stamp in [e.created_at,e.processed_at]:
    if datetime.fromisoformat(stamp).tzinfo is None:raise ValueError('Portable timestamps require an ISO timezone')
  for e in p.sessions:
   if e.scorecard.get('engine_version') not in p.engine_versions:raise ValueError('Scorecard engine version is unsupported or undeclared')
   if e.scenario.get('version')==2:
    validate_snapshot_v2(e.scenario)
    if e.scorecard.get('engine_version')!='vyuha-0.4.0':raise ValueError('Finale scenario requires its exact score engine marker')
   else:
    Snapshot.model_validate(e.scenario)
    if e.scorecard.get('engine_version')=='vyuha-0.4.0':raise ValueError('Finale score marker requires scenario version 2')
   maximum=e.scenario['duration']*30
   if e.end_tick!=maximum or not 0<=e.execution_tick<=maximum:raise ValueError('Portable horizon disagrees with frozen scenario duration')
   if e.scenario.get('director_decision') and e.scenario['director_decision']['trainee_id']!=e.trainee:raise ValueError('Frozen Director owner disagrees with pseudonymous session owner')
   from .models import InstructorCommand
   from pydantic import TypeAdapter
   prev=0
   for c in e.commands:
    TypeAdapter(InstructorCommand).validate_python({k:c[k] for k in ['command_id','type','payload']})
    if set(c)-{'session_id','seq','issued_at','tick','order','command_id','type','payload'} or c['session_id']!=e.id or type(c['tick']) is not int or not 0<=c['tick']<maximum or c['seq']!=prev+1 or type(c['order']) is not int:raise ValueError('Malformed command timeline')
    if e.scenario['version']==1 and c['type'] in ['sensor_fault','sensor_restore'] and c['payload']['sensor'] not in ['radar','rf']:raise ValueError('Sensor command is unsupported by the historical engine')
    prev=c['seq']
   if any(a.tick>e.execution_tick for a in e.events) or any(c['tick']>e.execution_tick for c in e.commands):raise ValueError('Action exceeds observed horizon')
   review,card=build_review(e.scenario,[a.model_dump(exclude_none=True) for a in e.events],e.commands,e.id,e.execution_tick,'completion',e.end_tick)
   if (card if e.scenario['version']==2 else {k:v for k,v in card.items() if k!='engine_version'})!=(e.scorecard if e.scenario['version']==2 else {k:v for k,v in e.scorecard.items() if k!='engine_version'}):raise ValueError('Stored score disagrees with reconstruction')
   if e.learning_context:
    if e.shared_crew:raise ValueError('Shared crew cannot own individual learning attempts')
    if compile_item(e.learning_context)!=e.scenario:raise ValueError('Learning item disagrees with frozen scenario')
   practice=bool(e.learning_context and e.learning_context.mode!='assessment')
   if practice:
    if e.outcomes is not None:raise ValueError('Practice must not carry individual skill outcomes')
   elif e.shared_crew:validate_shared(e)
   elif session_outcomes(review)!=e.outcomes:raise ValueError('Skill outcomes disagree with reconstructed Ghost')
   validate_notes(e)
   fusion_prepared[e.id]=prepare_exposures(e)
   prepared.append((e,review))
  for e in p.rapid:rapid_prepared.append((e,validate_rapid(e)))
  from .observations import recording_hash
  for r in p.recordings:
   recording=Recording.model_validate(r['recording'])
   if r['id']!='rec_'+recording_hash(recording)[:24]:raise ValueError('Recording hash mismatch')
 except (ValueError,KeyError,TypeError,OverflowError) as e:raise HTTPException(422,'Invalid portable history: '+str(e)[:300]) from e
 inserted=skipped=0
 from .units import persist_stats
 from .review import SKILLS
 with connect() as db:
  db.execute('BEGIN IMMEDIATE')
  try:validate_cohorts(p.sessions,p.unit.id,db)
  except ValueError as e:raise HTTPException(409,str(e)+'; import rolled back') from e
  aliases={pseudonym(r['id'],key(),'P_'):r['id'] for r in db.execute('SELECT id FROM trainees')}
  unit_aliases={pseudonym(r['id'],key(),'U_'):r['id'] for r in db.execute('SELECT id FROM units')}
  unit_id=unit_aliases.get(p.unit.id,p.unit.id)
  old_unit=db.execute('SELECT name FROM units WHERE id=?',(unit_id,)).fetchone()
  if old_unit and old_unit['name']!=p.unit.name:raise HTTPException(409,'Unit metadata conflicts; import rolled back')
  db.execute('INSERT OR IGNORE INTO units VALUES (?,?)',(unit_id,p.unit.name))
  affected=set()
  from .director import ensure_profile
  for anonymous in p.profiles:
   tid=aliases.get(anonymous,anonymous)
   old_member=db.execute('SELECT unit_id FROM trainees WHERE id=?',(tid,)).fetchone()
   if old_member and old_member['unit_id']!=unit_id:raise HTTPException(409,'Profile belongs to an incompatible unit; import rolled back')
   db.execute('INSERT OR IGNORE INTO trainees VALUES (?,?,?,?)',(tid,unit_id,tid,'bundle-import'))
   ensure_profile(db,tid)
  for e in p.sessions+p.rapid:e.trainee=aliases.get(e.trainee,e.trainee)
  def member(e):
   old=db.execute('SELECT unit_id FROM trainees WHERE id=?',(e.trainee,)).fetchone()
   if old and old['unit_id']!=unit_id:raise HTTPException(409,'Pseudonymous trainee belongs to an incompatible unit; import rolled back')
   db.execute('INSERT OR IGNORE INTO trainees VALUES (?,?,?,?)',(e.trainee,unit_id,e.trainee,e.created_at))
   if not getattr(e,'shared_crew',None):affected.add(e.trainee)
  for e,review in prepared:
   old=db.execute('SELECT * FROM sessions WHERE id=?',(e.id,)).fetchone()
   oldspec=db.execute('SELECT spec FROM scenarios WHERE id=?',(e.scenario['id'],)).fetchone()
   if oldspec and export_scenario(json.loads(oldspec['spec']),key())!=e.scenario:raise HTTPException(409,'Scenario ID conflicts; import rolled back')
   if old:
    from .main import logged_events,applied_commands
    o=db.execute('SELECT outcomes,processed_at FROM skill_outcomes WHERE session_id=?',(e.id,)).fetchone()
    if old['trainee']!=e.trainee or old['unit_id']!=unit_id or old['status']!='completed' or old['scenario_id']!=e.scenario['id'] or json.loads(old['scorecard'])!=e.scorecard or logged_events(db,e.id)!=[a.model_dump(exclude_none=True) for a in e.events] or applied_commands(db,e.id)!=e.commands or (bool(o) if e.shared_crew or e.learning_context and e.learning_context.mode!='assessment' else not o or json.loads(o['outcomes'])!=e.outcomes) or old['execution_tick']!=e.execution_tick:raise HTTPException(409,'Canonical session ID conflicts; import rolled back')
    expected_learning=e.learning_context.model_dump() if e.learning_context else None
    if decorate_learning(db,e.id).get('learning',{}).get('context')!=expected_learning:raise HTTPException(409,'Learning context conflicts with immutable history; import rolled back')
    if not compatible_metadata(shared_metadata(db,e.id,key()),e.shared_crew):raise HTTPException(409,'Shared crew classification or attribution conflicts; import rolled back')
    if not notes_match(db,e):raise HTTPException(409,'Teaching notes conflict with immutable history; import rolled back')
    verify_existing_exposures(db,e,fusion_prepared[e.id])
    skipped+=1;continue
   if e.shared_crew and db.execute('SELECT 1 FROM skill_profiles WHERE trainee=? UNION ALL SELECT 1 FROM skill_outcomes WHERE trainee=?',(e.trainee,e.trainee)).fetchone():raise HTTPException(409,'Crew owner conflicts with an individual skill profile; import rolled back')
   member(e);db.execute('INSERT OR IGNORE INTO scenarios VALUES (?,?)',(e.scenario['id'],dumps(e.scenario)))
   db.execute("INSERT INTO sessions(id,trainee,scenario_id,created_at,status,scorecard,end_tick,unit_id,execution_tick,completed_at) VALUES (?,?,?,?,'completed',?,?,?,?,?)",(e.id,e.trainee,e.scenario['id'],e.created_at,dumps(e.scorecard),e.end_tick,unit_id,e.execution_tick,e.processed_at if e.shared_crew or e.learning_context else e.created_at))
   log=[a.model_dump(exclude_none=True) for a in e.events]
   for seq,offset in enumerate(range(0,len(log),2000)):db.execute('INSERT INTO chunks VALUES (?,?,?)',(e.id,seq,dumps(log[offset:offset+2000])))
   for c in e.commands:db.execute('INSERT INTO instructor_commands VALUES (?,?,?,?,?,?,?)',(e.id,c['seq'],c['command_id'],c['issued_at'],dumps({k:c[k] for k in ['command_id','type','payload']}),c['tick'],c['order']))
   insert_notes(db,e)
   if e.learning_context:
    db.execute('INSERT INTO learning_attempts(session_id,context) VALUES (?,?)',(e.id,dumps(e.learning_context.model_dump())))
    complete_attempt(db,e.id,review)
   if e.shared_crew:save_archive(db,e.id,e.shared_crew)
   else:
    persist_skill_results(db,e.trainee,e.id,e.outcomes,'director-v1');db.execute('UPDATE skill_outcomes SET processed_at=? WHERE session_id=?',(e.processed_at,e.id))
   persist_stats(db,e.id,review)
   insert_exposures(db,e,fusion_prepared[e.id])
   if e.scenario.get('director_decision'):
    d={**e.scenario['director_decision'],'trainee_id':e.trainee};db.execute('INSERT INTO director_history VALUES (?,?,?)',(e.id,e.trainee,dumps(d)))
   inserted+=1
  for e,rounds in rapid_prepared:
   old=db.execute('SELECT * FROM rapid_sessions WHERE id=?',(e.id,)).fetchone()
   if old:
    answers=[json.loads(r['result']) for r in db.execute('SELECT result FROM rapid_answers WHERE session_id=? ORDER BY round_index',(e.id,))]
    if old['trainee']!=e.trainee or json.loads(old['body'])['seed']!=e.seed or json.loads(old['result'] or 'null')!=e.result or answers!=e.answers:raise HTTPException(409,'Recognition session ID conflicts; import rolled back')
    skipped+=1;continue
   member(e);body=dict(request_id='bundle-'+e.id,trainee_id=e.trainee,seed=e.seed,rounds=len(rounds));db.execute('INSERT INTO rapid_sessions VALUES (?,?,?,?,?,?,?)',(e.id,body['request_id'],e.trainee,dumps(body),dumps(rounds),e.created_at,dumps(e.result)))
   for i,a in enumerate(e.answers):db.execute('INSERT INTO rapid_answers VALUES (?,?,?,?)',(e.id,i,dumps({k:a[k] for k in ['round_index','answer','round_start_ms','response_time_ms']}),dumps(a)))
   outcomes={s:dict(successes=e.result['correct'] if s=='classification_iff' else 0,failures=e.result['rounds']-e.result['correct'] if s=='classification_iff' else 0) for s in SKILLS};persist_skill_results(db,e.trainee,e.id,outcomes,'rapid-id-v1');db.execute('UPDATE skill_outcomes SET processed_at=? WHERE session_id=?',(e.processed_at,e.id));inserted+=1
  for tid in affected:
   for skill in SKILLS:
    rows=db.execute('SELECT * FROM skill_outcomes WHERE trainee=? ORDER BY processed_at,rowid',(tid,)).fetchall()
    relevant=[r for r in rows if sum(json.loads(r['outcomes'])[skill].values())]
    if relevant:
     latest=relevant[-1];db.execute('UPDATE skill_profiles SET updated_at=?,last_session_id=? WHERE trainee=? AND skill=?',(latest['processed_at'],latest['session_id'],tid,skill))
  for r in p.recordings:db.execute('INSERT OR IGNORE INTO recordings VALUES (?,?)',(r['id'],dumps(r['recording'])))
 return dict(inserted_sessions=inserted,skipped_sessions=skipped,recordings=len(p.recordings),profile_basis='Rebuilt only from validated imported outcome ledger; supplied profile snapshots are informational.',integrity='HMAC verified with local shared key; donor identity/authenticity not attested')
