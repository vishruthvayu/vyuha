"""Extract a compact decision review from the existing authoritative replay."""
import copy
import math
from .engine import HZ, civil, engagement_rule, ideal, replay, score
from .review_models import GhostAAR

SKILLS = ['detection', 'classification_iff', 'effector_choice', 'degraded_sensor_response']
LABELS = {'quad':'Quadcopter', 'fiber_fpv':'No-RF FPV', 'fixed_wing':'Fixed-wing', 'bird':'Bird',
          'rf_jam':'RF jammer', 'kinetic':'Kinetic', 'hold':'Hold'}


def evidence(sim, t):
    return dict(tick=sim.tick,radar=dict(available=sim.radar_status!='failed',state=sim.radar_status,detected=bool(t['radar'])),
                rf=dict(available=sim.rf_available,signal=t['rf'] if sim.rf_available and t['detected'] is not None else None,
                        iff=('friendly_reply' if t['identity']=='friendly' else 'no_reply') if sim.rf_available and t['detected'] is not None else 'unavailable'),
                visual=dict(available=bool(t['thermal']),silhouette=('multirotor' if t['kind'] in ['quad','fiber_fpv'] else t['kind']) if t['thermal'] else None),
                range_m=round(math.hypot(t['x'],t['z']),3) if t['detected'] is not None else None,restricted=civil(t) if t['detected'] is not None else None,first_detectable_tick=t['detected'],
                prior_classification=t['classification'],prior_identity=t['declared'],night=sim.night)


def command_title(command):
    kind,p=command['type'],command['payload']
    if kind=='sensor_fault':label=f"{p['sensor'].upper()} {p['mode']}"
    elif kind=='sensor_restore':label=f"{p['sensor'].upper()} restored"
    elif kind=='environment':label='Night conditions' if p['night'] else 'Day conditions'
    elif kind=='inject_contact':label=f"Injected {LABELS[p['kind']]} · bearing {p['bearing']}°"
    elif kind=='inject_swarm':label=f"Injected 6-drone swarm · bearing {p['bearing']}°"
    else:label=kind.capitalize()
    return 'Instructor · '+label


def expected_engagement(t):
    reference=ideal(t)
    rule=engagement_rule(t,reference)
    return 'hold' if reference!='hold' and (not rule['in_range'] or rule['restricted']) else reference


def explain(code, t, a, ev, tick, expected):
    delay=None if t['detected'] is None else (tick-t['detected'])/HZ
    templates={
        'DETECTION_ON_TIME':f"This contact first became detectable at T+{(t['detected'] or 0)/HZ:.2f}s. Designation at T+{tick/HZ:.2f}s took {delay or 0:.2f}s, within the rubric's three-second full-credit window.",
        'DETECTION_LATE':f"This contact first became detectable at T+{(t['detected'] or 0)/HZ:.2f}s. Designation at T+{tick/HZ:.2f}s took {delay or 0:.2f}s. Detection credit tapers after three simulation seconds, not after spawn or paused wall-clock time.",
        'THREAT_MISSED':f"This threat became detectable at T+{(t['detected'] or 0)/HZ:.2f}s. No designation was recorded by the reviewed end at T+{tick/HZ:.2f}s.",
        'DETECTION_PENDING':f"No designation was recorded before the reviewed end. Only {delay or 0:.2f}s elapsed after first detectability; the full-credit reaction window had not expired.",
        'NO_EVIDENCE_AVAILABLE':"No working radar or EO/IR observation made this contact detectable within the reviewed interval. Missing detection is not treated as an evidenced trainee error.",
        'CORRECT_CLASSIFICATION':"The recorded type and identity match the reconstructed reference. Classification uses the final per-contact rubric; a correct label does not prove every identity cue was available.",
        'WRONG_TYPE':f"The recorded type differs from the reconstructed {LABELS[t['kind']]} reference, while identity is correct. The existing rubric allows 12/25 for correct identity with the wrong type.",
        'WRONG_CATEGORY':"The recorded identity differs from reconstructed ground truth. IFF 'no reply' is not a hostile identification.",
        'FRIENDLY_MISIDENTIFIED':"Ground truth after review identifies a friendly contact, but the recorded classification differs. A friendly IFF reply supports that identity only when the RF/IFF sensor is available.",
        'BIRD_MISIDENTIFIED':"Ground truth after review identifies a neutral bird. A bird silhouette is evidence only when the modeled EO/IR observation is available.",
        'CLASSIFICATION_NOT_RECORDED':"Designation was recorded, but no classification was recorded within the reviewed interval. The score shown is the final contact classification node, not an invented per-action deduction.",
        'CORRECT_HOLD':"Hold matches the permitted reference at this tick. Non-hostiles require Hold; an unavailable range or a restricted kinetic sector also requires waiting or a permitted alternative.",
        'CORRECT_RF_JAM':"The reconstructed RF-linked hostile was within the 180 m jammer range. RF jammer matches the existing illustrative response rule.",
        'CORRECT_KINETIC':"The reconstructed no-RF hostile was within the 160 m kinetic range and outside the restricted sector. Kinetic matches the existing illustrative response rule.",
        'NO_RF_JAM_INEFFECTIVE':"The reconstructed target had no RF control link. RF jamming could not disrupt it. The ground-truth reference is kinetic when within range and outside the restricted sector.",
        'FRIENDLY_ENGAGED':"A non-Hold response was attempted against a reconstructed friendly contact. The reference is Hold. An effective non-hostile engagement fails the session under the existing rubric.",
        'NEUTRAL_ENGAGED':"A non-Hold response was attempted against a reconstructed neutral contact. The reference is Hold. An effective non-hostile engagement fails the session under the existing rubric.",
        'KINETIC_OUT_OF_RANGE':f"The target was {(ev['range_m'] or 0):.1f} m away. Kinetic's effective range is 160 m; the attempt could not resolve it outside that range.",
        'RF_JAM_OUT_OF_RANGE':f"The target was {(ev['range_m'] or 0):.1f} m away. The jammer's effective range is 180 m; the attempt could not resolve it outside that range.",
        'KINETIC_ROE_RESTRICTED':"The target was in the scenario's restricted sector (x < -30 m and z > 20 m). Kinetic was blocked. Use Hold or the permitted reference effector; no additional doctrine is inferred.",
        'WRONG_EFFECTOR':f"The selected response differs from the permitted reconstructed reference at this tick: {LABELS[expected.get('effector') or 'hold']}. Reference success uses the existing RF-link, range and restricted-sector rules.",
        'RESPONSE_NOT_RECORDED':"No engagement was recorded for this classified threat before its observed asset impact. This omission is reviewed against the existing per-contact engagement node.",
    }
    text=templates[code]
    if not ev['rf']['available']:
        text+=" RF and IFF evidence were unavailable at this moment. Control-link and identity ground truth were not visible in the RF panel; this review does not claim they should have been known."
    elif ev['rf']['iff']=='no_reply':
        text+=" The IFF panel returned no reply; that alone does not establish hostility."
    if not ev['visual']['available']:
        text+=" No current modeled EO/IR silhouette observation is recorded."
    if code in ['NO_RF_JAM_INEFFECTIVE','CORRECT_RF_JAM','CORRECT_KINETIC','WRONG_EFFECTOR']:
        text+=" The expected response is a ground-truth rubric reference, conditional on establishing identity."
    return text


class Extractor:
    def __init__(self, sid, horizon):
        self.sid=sid;self.horizon=horizon;self.timeline=[];self.drafts=[];self.seen={};self.sensors=None
        self.observed={};self.end_evidence={};self.ends={};self.first_evidence={};self.first_context={}

    def event(self, tick, category, code, title, track=None, order=None, decision=None, before=False):
        self.timeline.append(dict(id=f'tl_{len(self.timeline):04d}',tick=tick,order=order,category=category,code=code,title=title,
                                  track_id=track,decision_id=decision,seek_before=before))

    def capture(self, sim, t, a, order):
        self.drafts.append(dict(tick=sim.tick,order=order,a=copy.deepcopy(a),t=copy.deepcopy(t),ev=evidence(sim,t),
                               context=[c['seq'] for c in sim.commands if c['type'] in ['sensor_fault','sensor_restore','environment']]))

    def __call__(self, sim, phase, entry, order):
        if sim.tick>self.horizon:return
        if phase in ['initial','step']:order=-1
        if phase=='before_action':
            t=next((t for t in sim.tracks if t['id']==entry['track']),None)
            if t is None:return
            if entry['k']!='designate' or t['designated'] is None:self.capture(sim,t,entry,order)
            return
        if phase=='command':
            self.event(sim.tick,'instructor_action',entry['type'],command_title(entry),order=order)
        if phase=='action':
            detail=LABELS.get(entry.get('effector'),entry.get('kind',entry['k']))
            self.event(sim.tick,'trainee_action',entry['k'],f"{entry['track']} · {entry['k']} · {detail}",entry['track'],order)
        sensors=(sim.radar_status,sim.rf_available,sim.night)
        if sensors!=self.sensors:
            self.event(sim.tick,'sensor_transition','SENSOR_STATE',f"Radar {sim.radar_status} · RF {'active' if sim.rf_available else 'offline'} · {'Night' if sim.night else 'Day'}",order=order)
            self.sensors=sensors
        for t in sim.tracks:
            if t['spawn']>sim.tick:continue
            previous=self.seen.get(t['id'],(None,False,False))
            if t['detected'] is not None and previous[0] is None:
                self.first_evidence[t['id']]=evidence(sim,t)
                self.first_context[t['id']]=[c['seq'] for c in sim.commands if c['type'] in ['sensor_fault','sensor_restore','environment']]
                self.event(sim.tick,'contact_detection','FIRST_DETECTABLE',f"{t['id']} · first working-sensor observation",t['id'],order)
            if t['resolved'] and not previous[1]:
                self.ends[t['id']]=('resolved',sim.tick)
                self.event(sim.tick,'contact_resolution','THREAT_RESOLVED' if t['identity']=='hostile' else 'CONTACT_RESOLVED',f"{t['id']} · contact resolved",t['id'],order)
            if t['impact'] and not previous[2]:
                self.ends[t['id']]=('asset_impact',sim.tick)
                self.event(sim.tick,'asset_impact','THREAT_IMPACTED_ASSET',f"{t['id']} · protected asset impact",t['id'],order)
            self.seen[t['id']]=(t['detected'],t['resolved'],t['impact'])
            # Retain final observed contact state, not a 30 Hz history of every track.
        if phase in ['initial','action','command'] or sim.tick==self.horizon:
            self.observed={t['id']:copy.deepcopy(t) for t in sim.tracks if t['spawn']<=sim.tick}
            self.end_evidence={t['id']:evidence(sim,t) for t in sim.tracks if t['spawn']<=sim.tick}


def build_review(scenario, actions, commands, sid, observed_end, horizon_source='completion', scoring_end=2250):
    if not 0<=observed_end<=scoring_end:raise ValueError('Invalid observed exercise horizon')
    if any(e['tick']>observed_end for e in actions+commands):raise ValueError('Recorded action exceeds observed exercise horizon')
    extractor=Extractor(sid,observed_end)
    sim=replay(scenario,actions,scoring_end,commands,observer=extractor)
    card=score(sim);rows={r['id']:r for r in card['rows']}
    for t in extractor.observed.values():
        if t['identity']!='hostile' or t['designated'] is not None:continue
        extractor.drafts.append(dict(tick=observed_end,order=None,a=None,t=t,ev=extractor.first_evidence.get(t['id'],extractor.end_evidence[t['id']]),context=extractor.first_context.get(t['id'],[])))
    for t in extractor.observed.values():
        if t['identity']=='hostile' and t['designated'] is not None and t['classification'] is None:
            extractor.drafts.append(dict(tick=observed_end,order=None,a=None,missing='classification',t=t,ev=extractor.first_evidence.get(t['id'],extractor.end_evidence[t['id']]),context=extractor.first_context.get(t['id'],[])))
        elif t['identity']=='hostile' and t['classification'] is not None and not t['attempts'] and t['impact']:
            extractor.drafts.append(dict(tick=observed_end,order=None,a=None,missing='engagement',t=t,ev=extractor.first_evidence.get(t['id'],extractor.end_evidence[t['id']]),context=extractor.first_context.get(t['id'],[])))
    reviews=[]
    for i,d in enumerate(extractor.drafts):
        t,a,ev=d['t'],d['a'],d['ev'];tick=d['tick'];row=rows[t['id']]
        k=a['k'] if a else {'classification':'classify','engagement':'engage'}.get(d.get('missing'),'designate')
        expected=dict(type=k,basis='ground_truth_reference')
        if k=='designate':
            kind='detection';node='detect';possible=25;skill='detection';expected['basis']='available_evidence'
            delay=None if t['detected'] is None else (tick-t['detected'])/HZ
            code=('DETECTION_ON_TIME' if delay<=3 else 'DETECTION_LATE') if a else 'NO_EVIDENCE_AVAILABLE' if delay is None else 'DETECTION_PENDING' if delay<=3 else 'THREAT_MISSED'
            verdict='correct' if code=='DETECTION_ON_TIME' else 'unassessable' if code in ['NO_EVIDENCE_AVAILABLE','DETECTION_PENDING'] else 'incorrect'
        elif k=='classify':
            kind='classification_iff';node='classify';possible=25;skill='classification_iff'
            expected.update(kind=t['kind'],identity=t['identity'])
            code='CLASSIFICATION_NOT_RECORDED' if not a else 'CORRECT_CLASSIFICATION' if a['kind']==t['kind'] and a['identity']==t['identity'] else 'BIRD_MISIDENTIFIED' if t['kind']=='bird' else 'FRIENDLY_MISIDENTIFIED' if t['identity']=='friendly' else 'WRONG_CATEGORY' if a['identity']!=t['identity'] else 'WRONG_TYPE'
            verdict='correct' if code=='CORRECT_CLASSIFICATION' else 'unassessable' if not a and observed_end<scoring_end else 'incorrect'
        else:
            kind='engagement';node='engage';possible=35;skill='effector_choice';expected.update(effector=expected_engagement(t))
            if not a:code='RESPONSE_NOT_RECORDED'
            else:
                effector=a['effector'];rule=engagement_rule(t,effector)
                code='FRIENDLY_ENGAGED' if effector!='hold' and t['identity']=='friendly' else 'NEUTRAL_ENGAGED' if effector!='hold' and t['identity']=='neutral' else 'KINETIC_ROE_RESTRICTED' if rule['restricted'] else 'KINETIC_OUT_OF_RANGE' if effector=='kinetic' and not rule['in_range'] else 'RF_JAM_OUT_OF_RANGE' if effector=='rf_jam' and not rule['in_range'] else 'NO_RF_JAM_INEFFECTIVE' if effector=='rf_jam' and not t['rf'] else 'WRONG_EFFECTOR' if effector!=expected['effector'] else {'hold':'CORRECT_HOLD','kinetic':'CORRECT_KINETIC','rf_jam':'CORRECT_RF_JAM'}[effector]
            verdict='correct' if code.startswith('CORRECT_') else 'incorrect'
        skills=[] if verdict!='incorrect' else [skill]
        if skills and (ev['radar']['state']!='normal' or not ev['rf']['available']):skills.append('degraded_sensor_response')
        final=extractor.observed[t['id']];ending=extractor.ends.get(t['id'])
        immediate='not_applicable'
        if k=='engage' and a:immediate='resolved' if engagement_rule(t,a['effector'])['effective'] else 'held' if a['effector']=='hold' else 'remained_active'
        # Only link to endings after this decision, within the actually observed interval.
        ending=ending if ending and (not a or ending[1]>=tick) else None
        ck,ct=ending if ending else ('hold',None) if immediate=='held' else ('remained_active',None) if final['active'] else ('no_consequence_yet',None)
        consequence_code='THREAT_IMPACTED_ASSET' if ck=='asset_impact' else 'THREAT_RESOLVED' if ck=='resolved' and t['identity']=='hostile' else 'CONTACT_RESOLVED' if ck=='resolved' else 'NO_CONSEQUENCE_YET'
        text=(f"The contact {'remained active after this response and later reached' if immediate=='remained_active' else 'later reached' if a else 'reached'} the protected asset at T+{ct/HZ:.2f}s." if ck=='asset_impact' else f"The contact was resolved at T+{ct/HZ:.2f}s." if ck=='resolved' else 'The contact remained active at the reviewed end; no later observed consequence is asserted.' if ck=='remained_active' else 'Hold was recorded; no later observed consequence is asserted.' if ck=='hold' else 'No later observed consequence is recorded for this decision.')
        penalty=10 if row['impact'] and k=='engage' else 0
        penalty_basis='observed' if penalty and final['impact'] else 'scoring_projection' if penalty else 'none'
        review=dict(decision_id=f'dec_{i:04d}',session_id=sid,track_id=t['id'],tick=tick,order=d['order'],decision_kind=kind,evidence=ev,
                    ground_truth=dict(kind=t['kind'],identity=t['identity'],rf_link=t['rf'],spawn_tick=t['spawn']),trainee_action=a,
                    expected_action=expected,verdict=verdict,reason_code=code,explanation=explain(code,t,a,ev,tick,expected),
                    consequence=dict(kind=ck,tick=ct,reason_code=consequence_code,immediate=immediate,text=text),
                    score_effect=dict(node=node,points_awarded=row[node],points_possible=possible,session_penalty=penalty,penalty_basis=penalty_basis,
                                      session_failure=bool(k=='engage' and a and t['identity']!='hostile' and engagement_rule(t,a['effector'])['effective'])),
                    skill_tags=skills,context_commands=d['context'])
        reviews.append(review)
        if verdict=='incorrect':extractor.event(tick,'score_error',code,f"{t['id']} · {code.replace('_',' ').lower()}",t['id'],d['order'],review['decision_id'],a is not None)
    # Attach action timeline entries to their matching review for one-click pre-action seeking.
    mapping={(r['tick'],r['order'],r['track_id']):r for r in reviews if r['trainee_action']}
    for event in extractor.timeline:
        if event['category']=='trainee_action':
            r=mapping.get((event['tick'],event['order'],event['track_id']))
            if r:event.update(decision_id=r['decision_id'],seek_before=True)
    extractor.timeline.sort(key=lambda e:(e['tick'],e['order'] if e['order'] is not None else -1,e['id']))
    errors=[r for r in reviews if r['verdict']=='incorrect'];correct=[r for r in reviews if r['verdict']=='correct']
    counts={s:len({r['track_id'] for r in errors if s in r['skill_tags']}) for s in SKILLS}
    losses={}
    for skill in SKILLS:
        per_node={}
        for r in errors:
            if skill not in r['skill_tags']:continue
            effect=r['score_effect'];key=(r['track_id'],effect['node'])
            per_node[key]=max(per_node.get(key,0),effect['points_possible']-effect['points_awarded'])
        losses[skill]=sum(per_node.values())
    impact=lambda r:((100 if r['score_effect']['session_failure'] else 0)+r['score_effect']['points_possible']-r['score_effect']['points_awarded']+r['score_effect']['session_penalty'])
    largest=max(errors,key=impact)['decision_id'] if errors else None
    strongest=max(correct,key=lambda r:r['score_effect']['points_awarded'])['decision_id'] if correct else None
    focus=max(SKILLS,key=lambda s:(losses[s],counts[s],-SKILLS.index(s))) if errors else None
    relevant=[r for r in card['rows'] if r['identity']=='hostile']
    result=dict(timeline=extractor.timeline,decision_reviews=reviews,
                ghost_summary=dict(largest_loss=largest,strongest_decision=strongest,mistake_counts=counts,lost_points=losses,recommended_focus=focus,
                                   no_major_errors=not errors,text='No major decision errors were found in the reviewed interval.' if not errors else f"Recommended training focus: {focus.replace('_',' ')}. Counts are distinct contacts with evidenced errors; sensor context does not prove causation."),
                replay_metadata=dict(observed_end_tick=observed_end,scoring_end_tick=scoring_end,horizon_source=horizon_source,early_end=observed_end<scoring_end,
                                     note='Review and timeline stop at the observed exercise end. Final node scores retain the existing 75-second scoring projection.' if observed_end<scoring_end else 'Review covers the recorded exercise. Paused wall-clock time is excluded.'),
                node_averages={node:round(sum(r[node] for r in relevant)/len(relevant),2) if relevant else 0.0 for node in ['detect','classify','prioritise','engage']})
    return GhostAAR.model_validate(result).model_dump(),card
