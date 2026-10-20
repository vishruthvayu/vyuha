"""Opt-in finite-resource delayed response training model.
All values and seeded effect probabilities are illustrative, uncalibrated and
unrelated to actual hardware performance. Canonical eligibility is internal;
public snapshots contain resources/observable result status only.
"""
import copy
import math
from .sensors_v2 import sample

DEFAULT_CONFIG = dict(version=1, illustrative_training_assumptions=True, kinetic_ammo=8,
    kinetic_cooldown_ticks=30, kinetic_delay_ticks=15, kinetic_success_probability=.85,
    jammer_channels=2, jammer_duration_ticks=90, jammer_success_probability=.75)
BOUNDS = dict(kinetic_ammo=(0,200),kinetic_cooldown_ticks=(1,300),kinetic_delay_ticks=(1,300),
    kinetic_success_probability=(0,1),jammer_channels=(1,8),jammer_duration_ticks=(1,300),jammer_success_probability=(0,1))
INTS = {'kinetic_ammo','kinetic_cooldown_ticks','kinetic_delay_ticks','jammer_channels','jammer_duration_ticks'}


def configuration(overrides=None):
    overrides = {} if overrides is None else overrides
    if not isinstance(overrides,dict) or set(overrides)-set(DEFAULT_CONFIG):raise ValueError('Unknown response configuration')
    c = {**DEFAULT_CONFIG,**overrides}
    if type(c['version']) is not int or c['version']!=1 or c['illustrative_training_assumptions'] is not True:raise ValueError('Unsupported response configuration')
    for k,(lo,hi) in BOUNDS.items():
        v=c[k]
        if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not lo<=v<=hi or k in INTS and int(v)!=v:raise ValueError('Response parameter outside bounds: '+k)
    return c


def create_state(config=None):
    c=configuration(config)
    return dict(version=1,config=c,kinetic_ammo_remaining=c['kinetic_ammo'],kinetic_ready_tick=0,last_tick=0,attempts=[])


def channel_count(state):
    return sum(a['effector']=='rf_jam' and a['status']=='pending' for a in state['attempts'])


def attempt_response(state,action,eligibility):
    """One receipt per accepted intent, including resource blocks. Reference
    eligibility is internal. Unsuitable destructive attempts consume resources.
    """
    tick=action['tick'];effector=action['effector'];c=state['config']
    if type(tick) is not int or tick<state['last_tick'] or effector not in ['hold','kinetic','rf_jam']:raise ValueError('Invalid response attempt')
    if any(type(eligibility.get(k)) is not bool for k in ['allowed','in_range','restricted','compatible','ideal_match']):raise ValueError('Invalid reference eligibility')
    state['last_tick']=tick
    due=tick+c['kinetic_delay_ticks'] if effector=='kinetic' else tick+c['jammer_duration_ticks'] if effector=='rf_jam' else None
    a=dict(id=f"R{len(state['attempts'])+1}",track=action['track'],effector=effector,tick=tick,order=action.get('order',len(state['attempts'])),due_tick=due,status='pending',result_tick=None,process_valid=False,launch_eligible=eligibility['allowed'] and eligibility['in_range'] and not eligibility['restricted'] and eligibility['compatible'])
    if not eligibility['allowed']:a['status']='unavailable'
    elif effector=='hold':a['status']='hold';a['process_valid']=eligibility['ideal_match'] and eligibility['in_range']
    elif effector=='kinetic':
        if state['kinetic_ammo_remaining']<=0:a['status']='blocked_ammo'
        elif tick<state['kinetic_ready_tick']:a['status']='blocked_cooldown'
        else:
            state['kinetic_ammo_remaining']-=1;state['kinetic_ready_tick']=tick+c['kinetic_cooldown_ticks']
            a['process_valid']=a['launch_eligible'] and eligibility['ideal_match']
    elif channel_count(state)>=c['jammer_channels']:a['status']='blocked_channels'
    else:a['process_valid']=a['launch_eligible'] and eligibility['ideal_match']
    if a['status']!='pending':a['due_tick']=None;a['result_tick']=tick
    state['attempts'].append(a)
    return a


def advance_response(state,tick,seed,target_status,resolve):
    """Called each logical tick after motion, before asset-impact evaluation.
    Dwell expiry releases channels on failure too. RF sensing availability is
    not treated as jammer hardware availability.
    """
    if type(tick) is not int or tick<state['last_tick']:raise ValueError('Response clock moved backwards')
    state['last_tick']=tick
    completed=[]
    for index,a in enumerate(state['attempts']):
        if a['status']!='pending' or a['due_tick']>tick:continue
        target=target_status(a['track'],a['effector'])
        if not target or not target['active']:a['status']='target_inactive'
        else:
            probability=state['config']['kinetic_success_probability'] if a['effector']=='kinetic' else state['config']['jammer_success_probability']
            draw=sample(seed,a['tick'],index,71 if a['effector']=='kinetic' else 72)
            if a['launch_eligible'] and target['effective'] and draw<probability:
                resolve(a['track']);a['status']='resolved'
            else:a['status']='no_effect'
        a['result_tick']=tick;completed.append(a['id'])
    return completed


def public_state(state):
    fields=['id','track','effector','tick','order','due_tick','status','result_tick']
    return dict(version=1,kinetic_ammo_remaining=state['kinetic_ammo_remaining'],kinetic_ready_tick=state['kinetic_ready_tick'],jammer_channels_in_use=channel_count(state),pending=[a['id'] for a in state['attempts'] if a['status']=='pending'],attempts=[{k:copy.deepcopy(a[k]) for k in fields} for a in state['attempts']])


def report(state):
    result=public_state(state)
    result.update(basis='Illustrative seeded delayed effects; engagement points credit executable suitable process separately from stochastic resolution. Non-hostile destructive attempts fail safety regardless of result.',process_valid_attempts=sum(a['process_valid'] for a in state['attempts']),resolved_effects=sum(a['status']=='resolved' for a in state['attempts']),no_effect_results=sum(a['status']=='no_effect' for a in state['attempts']),reference_attempts=[dict(a) for a in state['attempts']])
    return result

# Frozen-scenario/request boundary model. Runtime uses the JSON-compatible dict.
from typing import Literal
from pydantic import BaseModel,ConfigDict,Field,model_validator
class ResponseConfig(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    version:Literal[1]=1
    illustrative_training_assumptions:Literal[True]=True
    kinetic_ammo:int=Field(default=8,ge=0,le=200)
    kinetic_cooldown_ticks:int=Field(default=30,ge=1,le=300)
    kinetic_delay_ticks:int=Field(default=15,ge=1,le=300)
    kinetic_success_probability:float=Field(default=.85,ge=0,le=1,allow_inf_nan=False)
    jammer_channels:int=Field(default=2,ge=1,le=8)
    jammer_duration_ticks:int=Field(default=90,ge=1,le=300)
    jammer_success_probability:float=Field(default=.75,ge=0,le=1,allow_inf_nan=False)

    @model_validator(mode='before')
    @classmethod
    def validate_frozen_configuration(cls,value):
        if isinstance(value,dict):configuration(value)
        return value
