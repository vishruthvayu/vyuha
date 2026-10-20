"""Read-only completed Crew coordination history. Labels are not identity proof.

Archived pseudonyms never restore role capabilities or individual learning credit.
Metrics use accepted action ticks, not elapsed network/pause/participant time.
"""
import hashlib
import json
from statistics import median
from .crew_metrics import coordination_summary
from .storage import dumps


def completed_history(db,limit=100):
    from .main import logged_events
    rows=db.execute("""SELECT s.id,s.unit_id,s.created_at,s.completed_at,s.scorecard,sc.spec,
                c.id AS crew_id,c.name,a.metadata
                FROM sessions s JOIN scenarios sc ON sc.id=s.scenario_id
                LEFT JOIN crews c ON c.session_id=s.id
                LEFT JOIN crew_archive a ON a.session_id=s.id
                WHERE s.status='completed' AND (c.id IS NOT NULL OR a.session_id IS NOT NULL)
                ORDER BY COALESCE(s.completed_at,s.created_at) DESC,s.created_at DESC,s.id DESC LIMIT ?""",(limit,)).fetchall()
    sessions=[];groups={}
    for row in rows:
        archived=bool(row['metadata'])
        if archived:
            metadata=json.loads(row['metadata'])
            roster=[dict(id=m['id'],callsign=m['id'],role=m['role']) for m in metadata['members']]
            attribution=metadata['attribution'];name=metadata['name'];crew_id=metadata['id']
            cohort=metadata.get('cohort')
            stable_members={m['member_id']:m['id'] for m in cohort['members']} if cohort else {}
            grouping=['archive-cohort-v1',cohort['id']] if cohort else ['archive',crew_id]
            grouping_basis='Signed pseudonymous source roster cohort' if cohort else 'Legacy archive; no cross-exercise roster binding'
        else:
            roster=[dict(r) for r in db.execute('SELECT id,callsign,role FROM crew_members WHERE crew_id=? ORDER BY callsign',(row['crew_id'],))]
            attribution=[dict(r) for r in db.execute('SELECT timeline_order,member_id,role FROM crew_attribution WHERE session_id=? ORDER BY timeline_order',(row['id'],))]
            name=row['name'];crew_id=row['crew_id']
            grouping=['local',row['unit_id'],name,sorted((m['callsign'].lower(),m['role']) for m in roster)]
            stable_members={};grouping_basis='Exact locally declared crew name and callsign/role roster'
        actions=logged_events(db,row['id'])
        metrics=coordination_summary(actions,attribution,roster)
        actors={member['id']:member for member in roster}
        owners={item['timeline_order']:item['member_id'] for item in attribution}
        timeline=[]
        for index,action in enumerate(actions[-100:],start=max(0,len(actions)-100)):
            actor=actors.get(owners.get(action.get('order',index)))
            timeline.append(dict(**action,member_id=actor['id'] if actor else None,callsign=actor['callsign'] if actor else None,role=actor['role'] if actor else None,attributed=actor is not None))
        spec=json.loads(row['spec'])
        group_id=hashlib.sha256(dumps(grouping).encode()).hexdigest()[:24]
        entry=dict(session_id=row['id'],crew_id=crew_id,name=name,source='imported_pseudonymous_archive' if archived else 'local_crew',grouping_basis=grouping_basis,group_id=group_id,created_at=row['created_at'],completed_at=row['completed_at'],scenario=dict(id=spec['id'],title=spec['title'],engine_version=spec.get('engine_version'),family=spec.get('raid',{}).get('family'),difficulty=spec.get('difficulty_label')),scorecard=json.loads(row['scorecard']),coordination_metrics=metrics,coordination_timeline=timeline,timeline_total_actions=len(actions),timeline_truncated=len(actions)>100)
        sessions.append(entry)
        group=groups.setdefault(group_id,dict(group_id=group_id,name=name,source=entry['source'],grouping_basis=grouping_basis,sessions=[],members={},classification_handoffs=[],response_handoffs=[]))
        group['sessions'].append(row['id'])
        for m in metrics['members']:
            label=stable_members.get(m['member_id'],m['callsign'])
            key=(label.lower(),m['role'])
            total=group['members'].setdefault(key,dict(callsign=label,role=m['role'],accepted_actions=0,designations=0,classifications=0,responses=0))
            for field in ['accepted_actions','designations','classifications','responses']:total[field]+=m[field]
        for h in metrics['handoffs']:
            group['classification_handoffs'].append(h['designation_to_classification_s'])
            if h['classification_to_response_s'] is not None:group['response_handoffs'].append(h['classification_to_response_s'])
    summaries=[]
    for group in groups.values():
        classification=group.pop('classification_handoffs');response=group.pop('response_handoffs')
        group['session_count']=len(group['sessions']);group['members']=list(group['members'].values())
        group.update(classification_handoff_count=len(classification),response_handoff_count=len(response),median_designation_to_classification_s=median(classification) if classification else None,median_classification_to_response_s=median(response) if response else None)
        summaries.append(group)
    return dict(schema_version=1,limit=limit,included_sessions=len(sessions),sessions=sessions,groups=summaries,scope='Latest completed shared exercises only; active exercises excluded. Local groups require exact declared crew name and callsign/role roster; labels are not authenticated identity. V2 imported archives group by signed installation/unit-scoped roster cohorts with stable member pseudonyms. Legacy archives without binding remain separate by exercise crew ID. Imported groups are never matched to local callsigns. Shared-key integrity does not authenticate people or donor claims.',interpretation='Descriptive coordination counts and logical handoffs only. Different scenarios and conditions are not controlled comparisons, individual competence, causal learning gains or individual skill-profile credit.',timing_basis='Accepted logical ticks exclude pauses, outages and network wall time. Group medians pool recorded handoffs, not per-session medians.')
