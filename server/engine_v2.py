"""Sensor/motion v0.4 engine. The legacy 25/25/15/35 rubric is retained here.
No operational calibration claim; observation and canonical truth are separate.
"""
import copy,math
from .engine_v1_0_1 import HZ,js_round,detection_points,classification_points,ideal,civil,distance,engagement_rule
from .engine_v1_0_1 import Simulation as LegacySimulation
from .prioritisation_v1_0_1 import evaluate
from .raid_v2 import position_v2 as position
from .sensors_v2 import observe_sensors,false_tracks,SPEC
from .response_v2 import create_state,attempt_response,advance_response,report as response_report
ENGINE_VERSION='vyuha-0.4.0'

def observed_position(t):
    o=t.get('observation',{})
    return next((o.get(channel,{}).get('position') for channel in ['ir','eo','radar'] if o.get(channel,{}).get('position')),None)

def capture(sim,t,a):
    if a['effector']=='hold' or t['declared']!='hostile' or any(d['chosen']['track_id']==t['id'] for d in sim.priority_decisions):return
    facts=[]
    for track in sim.tracks:
        pos=observed_position(track)
        if not track['active'] or track['declared']!='hostile' or pos is None:continue
        d=math.hypot(pos['x'],pos['z']);tti=max(0,(d-8)/max(track['speed'],.01))
        rules=sim.scenario['doctrine']['rules'];risk=rules['risk_weights'].get(track['classification'] or '',1)*rules['asset_risk']
        facts.append(dict(track_id=track['id'],tick=sim.tick,time_to_impact=round(tti,6),risk=round(risk,6),priority=round(risk/max(tti,1/30),9)))
    chosen=next((f for f in facts if f['track_id']==t['id']),None)
    if chosen:sim.priority_decisions.append(dict(tick=sim.tick,order=a.get('order',len(sim.events)),chosen=chosen,available=sorted(facts,key=lambda x:(-x['priority'],x['track_id']))))

class Simulation(LegacySimulation):
    def __init__(self,scenario):
        self.sensor_memory={};self.eo_status='normal';self.ir_status='normal';self.false_contacts=[]
        self.response_state=create_state(scenario['response_model']) if scenario.get('response_model') is not None else None
        super().__init__(scenario)
    def observe(self):
        s=self.scenario;end=s['duration']*HZ
        self.radar_status=self.radar_override or ('failed' if s.get('radarFailureStart',end)<=self.tick<s.get('radarFailureEnd',end) else 'jammed' if s['jamStart']<=self.tick<s['jamEnd'] else 'normal')
        self.rf_available=self.rf_override if self.rf_override is not None else not(s.get('rfFailureStart',end)<=self.tick<s.get('rfFailureEnd',end))
        env=dict(night=self.night,fog=s['fog'],radar_status=self.radar_status,rf_available=self.rf_available,eo_status=self.eo_status,ir_status=self.ir_status,terrain=s.get('terrain_boxes',[]))
        if self.response_state is not None:
            # Logical due effects occur after current motion but before same-tick impact.
            for t in self.tracks:
                t['active']=t['spawn']<=self.tick<t.get('expires_tick',end+1) and not t['resolved'] and not t['impact']
                if t['active'] or self.tick==0:t.update(position(t,self.tick))
            def target_status(track_id,effector):
                t=next((t for t in self.tracks if t['id']==track_id),None)
                return dict(active=t['active'],effective=engagement_rule(t,effector)['effective']) if t else None
            def resolve(track_id):
                t=next(t for t in self.tracks if t['id']==track_id);t['resolved']=True;t['active']=False
            advance_response(self.response_state,self.tick,s['seed'],target_status,resolve)
        for i,t in enumerate(self.tracks):
            t['active']=t['spawn']<=self.tick<t.get('expires_tick',end+1) and not t['resolved'] and not t['impact']
            if t['active'] or self.tick==0:t.update(position(t,self.tick))
            if t['active'] and t['identity']=='hostile' and distance(t)<=8:t['impact']=True;t['active']=False
            sensed=observe_sensors(s['seed'],self.tick,i,t,env,self.sensor_memory.get(t['id']),s.get('sensor_config'))
            t['observation']=sensed['observation'];self.sensor_memory[t['id']]=sensed['memory'];o=t['observation']
            t['radar']=o['radar']['detected'];t['thermal']=o['ir']['level']!='none' or o['eo']['level']!='none'
            if t['detected'] is None and (t['radar'] or t['thermal']):t['detected']=self.tick
        self.false_contacts=false_tracks(s['seed'],self.tick,env,s.get('sensor_config'))
    def act(self,a):
        t=next((t for t in self.tracks if t['id']==a['track']),None)
        if self.paused or self.tick>=self.scenario['duration']*HZ or not t or not t['active'] or t['detected'] is None or a['tick']!=self.tick:return False
        if a['k']=='designate':
            if observed_position(t) is None:return False
            if t['designated'] is None:t['designated']=self.tick
        elif a['k']=='classify':
            if t['designated'] is None or not a.get('kind') or not a.get('identity'):return False
            t['classification']=a['kind'];t['declared']=a['identity']
        elif a['k']=='engage':
            if t['designated'] is None or not t['classification'] or not a.get('effector'):return False
            t['attempts'].append(a['effector'])
            if self.response_state is not None:
                rule=engagement_rule(t,a['effector'])
                receipt=attempt_response(self.response_state,dict(a,order=a.get('order',len(self.events))),dict(allowed=rule['allowed'],in_range=rule['in_range'],restricted=rule['restricted'],compatible=a['effector']!='rf_jam' or t['rf'],ideal_match=a['effector']==ideal(t)))
                if receipt['status']=='pending':capture(self,t,a)
            else:
                capture(self,t,a)
                if engagement_rule(t,a['effector'])['effective']:t['resolved']=True;t['active']=False
        else:return False
        self.events.append(copy.deepcopy(a));return True
    def control(self,c):
        if any(x['seq']==c['seq'] for x in self.commands) or c['seq']!=(self.commands[-1]['seq'] if self.commands else 0)+1 or c['tick']!=self.tick or self.tick>=self.scenario['duration']*HZ:return False
        kind,p=c['type'],c['payload']
        if kind in ['pause','resume']:self.paused=kind=='pause'
        elif kind in ['sensor_fault','sensor_restore']:
            state='normal' if kind=='sensor_restore' else p['mode'];sensor=p['sensor']
            if sensor=='radar':self.radar_override=state
            elif sensor=='rf':self.rf_override=state=='normal'
            elif sensor=='eo':self.eo_status=state
            elif sensor=='ir':self.ir_status=state
            else:return False
        elif kind=='environment':self.night=p['night']
        elif kind in ['inject_contact','inject_swarm']:
            count=6 if kind=='inject_swarm' else 1;aircraft=p.get('kind','quad')
            for i in range(count):
                t=dict(id=f'T{len(self.tracks)+1}',kind=aircraft,identity='hostile',rf=aircraft=='quad',spawn=self.tick,bearing=(p['bearing']+i*5)%360,distance=800+i*25,speed=15 if aircraft=='quad' else 28,altitude=20 if aircraft=='quad' else 8)
                t.update(position(t,self.tick));t.update(active=True,detected=None,designated=None,classification=None,declared=None,resolved=False,impact=False,radar=False,thermal=False,attempts=[],rules=copy.deepcopy(self.scenario['doctrine']['rules']))
                self.tracks.append(t)
        else:return False
        self.commands.append(copy.deepcopy(c));self.observe();return True

def replay(scenario, events, end_tick, commands=None, observer=None):
    sim = Simulation(scenario)
    commands = commands or []
    if commands and any("order" not in e for e in events):
        raise ValueError("Controlled sessions require trainee timeline order")
    timeline = [(e["tick"],e.get("order",i),"action",e) for i,e in enumerate(events)]
    timeline += [(c["tick"],c["order"],"command",c) for c in commands]
    # Do not silently repair malformed trainee logs.
    if any(events[i]["tick"] > events[i+1]["tick"] for i in range(len(events)-1)):
        raise ValueError("Events must be ordered")
    if commands and len({e[1] for e in timeline}) != len(timeline):
        raise ValueError("Timeline order must be unique")
    timeline.sort(key=lambda e:(e[0],e[1]))
    if commands and any(timeline[i][1]>=timeline[i+1][1] for i in range(len(timeline)-1)):
        raise ValueError("Timeline order must increase with simulation time")
    if observer:
        observer(sim, "initial", None, None)
    i = 0
    while sim.tick <= end_tick:
        while i < len(timeline) and timeline[i][0] == sim.tick:
            _,_,kind,e = timeline[i]
            if observer and kind == "action":
                observer(sim, "before_action", e, timeline[i][1])
            if not (sim.control(e) if kind == "command" else sim.act(e)):
                raise ValueError(f"Invalid {kind} at tick {sim.tick}")
            if observer:
                observer(sim, kind, e, timeline[i][1])
            i += 1
        if sim.tick == end_tick:
            break
        sim.step(force=True)
        if observer:
            observer(sim, "step", None, None)
    if i != len(timeline):
        raise ValueError("Events must be ordered and inside the session")
    return sim


def score(sim):
    tracks = [t for t in sim.tracks if sim.tick >= t["spawn"]]
    threats = [t for t in tracks if t["identity"] == "hostile"]
    fratricide, breaches, rows = False, 0, []
    priority = evaluate(sim) if sim.scenario.get("prioritisation_version") else None
    for t in tracks:
        is_threat = t["identity"] == "hostile"
        latency = None if t["detected"] is None or t["designated"] is None else (t["designated"]-t["detected"])/HZ
        detect = detection_points(t)
        classify = classification_points(t)
        actions = [a for a in sim.events if a["track"] == t["id"] and a["k"] == "engage"]
        successful, feedback = False, []
        response_actions=[r for r in sim.response_state['attempts'] if r['track']==t['id']] if sim.response_state is not None else []
        for action_index,a in enumerate(actions):
            temp = {**t, **position(t, a["tick"])}
            d = math.hypot(temp["x"], temp["z"])
            rule = engagement_rule(temp, a["effector"])
            restricted = rule["restricted"]
            if restricted:
                breaches += 1
                feedback.append("Kinetic action attempted in the restricted zone.")
            in_range = rule["in_range"]
            if sim.response_state is not None:
                if a['effector']!='hold' and not is_threat:fratricide=True
                if response_actions[action_index]['process_valid']:successful=True
            else:
                if rule["effective"] and not is_threat:fratricide=True
                if rule["rubric_success"]:successful=True
        if sim.response_state is not None and actions:
            valid=sum(r['process_valid'] for r in response_actions);resolved=sum(r['status']=='resolved' for r in response_actions)
            feedback.append(f'Response process/outcome: {valid} suitable executable attempts; {resolved} delayed effects resolved.')
            if not is_threat and any(a['effector']!='hold' for a in actions):feedback.append('Non-hostile destructive response attempted: safety fails regardless of stochastic effect or available resources.')
        wrong = sum(a["effector"] != ideal(t) for a in actions)
        engage = max(0, 35-wrong*7) if successful else 0
        prioritise = (15 if t["resolved"] and not t["impact"] else 0) if is_threat else (15 if "hold" in t["attempts"] else 0)
        if is_threat and priority is not None:prioritise = priority["points"]
        if latency is None:
            feedback.append("Designate the contact after a sensor first reveals it.")
        elif latency > 3:
            feedback.append(f"Designation took {latency:.1f} seconds after first sensor visibility.")
        if classify < 25:
            feedback.append(f"Reference classification: {t['kind'].replace('_', ' ')} / {t['identity']}.")
        if not successful:
            feedback.append("Hold fire on this non-hostile contact." if ideal(t) == "hold" else "RF-link present: RF jamming is the example-pack response." if t["rf"] else "No RF link: use an allowed kinetic response in this example pack.")
        if wrong:
            feedback.append(f"{wrong} unsuitable response{'s' if wrong > 1 else ''}; review the sensor evidence.")
        if t["impact"]:
            feedback.append("This threat reached the protected asset.")
        rows.append(dict(id=t["id"], kind=t["kind"], identity=t["identity"], detect=detect, classify=classify,
                         prioritise=prioritise, engage=engage, total=detect+classify+prioritise+engage,
                         detected=t["detected"], designated=t["designated"], ideal=ideal(t), feedback=feedback,
                         impact=t["impact"], attempts=t["attempts"]))
    relevant = [t for t in rows if t["identity"] == "hostile"]
    leakers = sum(t["impact"] for t in threats)
    raw = sum(t["total"] for t in relevant)/len(relevant) if relevant else 0
    result = 0 if fratricide else max(0, js_round(raw-leakers*10))
    recognition = js_round(sum(t["classify"] for t in rows)/(len(rows)*25)*100) if rows else 0
    response = js_round(sum(t["engage"] for t in rows)/(len(rows)*35)*100) if rows else 0
    summary = "Non-hostile engagement: session failed." if fratricide else f"{leakers} threat{'s' if leakers > 1 else ''} reached the protected asset. Review response selection." if leakers else "Good control. Repeat with a new scenario seed." if result >= 70 else "Review designation, classification, and response before the next drill."
    return dict(score=result, passed=result >= 70 and not fratricide and breaches == 0, fratricide=fratricide,
                roe_breaches=breaches, leakers=leakers, threats=len(threats), rows=rows,
                skills=dict(recognition=recognition, response=response), summary=summary, engine_version=ENGINE_VERSION,
                **({"prioritisation":priority} if priority is not None else {}),
                **({"response_model":response_report(sim.response_state)} if sim.response_state is not None else {}))
