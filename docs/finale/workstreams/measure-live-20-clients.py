"""Disposable loopback HTTP/SSE load receipt; not physical browser scalability."""
import concurrent.futures,json,os,statistics,threading,time,urllib.request,urllib.parse
from pathlib import Path
URL='http://127.0.0.1:8037'
N=20
TOKEN=None
latencies={}
def call(path,body=None,officer=False):
    started=time.perf_counter()
    req=urllib.request.Request(URL+'/api/v1'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+TOKEN} if officer else {})})
    with urllib.request.urlopen(req,timeout=120) as r: value=json.load(r)
    return value,(time.perf_counter()-started)*1000
TOKEN=call('/auth/login',{'password':os.environ['VYUHA_QA_PASSWORD']})[0]['token']
# All data is restricted to the dedicated disposable8037 server.
spec=call('/raids',dict(name='MISSION-20-CLIENT-SYNTHETIC',seed=20834,duration=60,difficulty='foundational',family='DIRECT',terrain='rural'),True)[0]
ids=[]
for i in range(N):
    person=call('/units/join',dict(unit_id='local',callsign=f'M20-{i:02d}',request_id=f'm20join-{i}'))[0]['trainee_id']
    ids.append(call('/sessions',dict(scenario_id=spec['id'],trainee=person))[0]['id'])
def telemetry(sid,tick=60,applied=None):
    return call(f'/sessions/{sid}/control-state',dict(tick=tick,paused=bool(applied),active_contacts=len(spec['tracks']),radar_status='normal',rf_available=True,night=False,applied=applied or []))[1]
with concurrent.futures.ThreadPoolExecutor(max_workers=N) as pool:
    latencies['initial_20_concurrent_telemetry']=list(pool.map(telemetry,ids))
    board=[];dashboard=[];overview=[]
    for _ in range(5):
        pictures,ms=call('/white-cell',officer=True);assert all(sid in {p['session_id'] for p in pictures['pictures']} for sid in ids)
        board.append(ms);dashboard.append(call('/units/local/dashboard',officer=True)[1]);overview.append(call('/instructor/sessions',officer=True)[1])
        latencies.setdefault('telemetry_between_board_read_batches',[]).extend(pool.map(telemetry,ids))
    # Hold20 command streams simultaneously, then issue one targeted pause each.
    barrier=threading.Barrier(N+1);release=threading.Event()
    def stream(sid):
        request=urllib.request.Request(URL+f'/api/v1/sessions/{sid}/command-stream?after=0')
        with urllib.request.urlopen(request,timeout=120) as response:
            assert response.headers.get_content_type()=='text/event-stream'
            while True:
                line=response.readline().decode()
                if line.startswith('data:'):assert json.loads(line[5:])['commands']==[];break
            barrier.wait(timeout=30);release.wait(timeout=30)
            while True:
                line=response.readline().decode()
                if not line:raise RuntimeError('Stream closed before command')
                if line.startswith('data:'):
                    commands=json.loads(line[5:]).get('commands',[])
                    if commands:
                        assert len(commands)==1 and commands[0]['session_id']==sid and commands[0]['type']=='pause'
                        return commands[0],time.perf_counter()
    futures=[pool.submit(stream,sid) for sid in ids]
    barrier.wait(timeout=30)
    issued={};receipts={}
    for sid in ids:
        issued[sid]=time.perf_counter()
        r,ms=call(f'/instructor/sessions/{sid}/commands',dict(command_id='m20-pause-'+sid,type='pause',payload={}),True)
        latencies.setdefault('officer_issue',[]).append(ms)
        receipts[sid]=r['command']
    release.set()
    delivery=[]
    for sid,future in zip(ids,futures):
        command,received=future.result(timeout=30);assert command['seq']==receipts[sid]['seq']
        delivery.append((received-issued[sid])*1000)
    def ack(sid):return telemetry(sid,60,[dict(seq=1,tick=60,order=0)])
    latencies['20_concurrent_command_ack']=list(pool.map(ack,ids))
    for sid in ids:
        row=call('/instructor/sessions/'+sid,officer=True)[0]
        assert row['commands'][0]['tick']==60 and row['commands'][0]['order']==0 and row['status']=='PAUSED'
    latencies['white_cell_20_active']=board;latencies['unit_dashboard_between_telemetry_batches']=dashboard;latencies['instructor_overview_20_active']=overview
    latencies['SSE_issue_to_observed_frame_ms_includes_sequential_issue_barrier']=delivery
    Path('/tmp/vyuha-mission-live-load-raw.json').write_text(json.dumps(latencies,indent=2))
    complete=[]
    for sid in ids:
        card,ms=call('/sessions/'+sid+'/complete',{'end_tick':int(spec['duration']*30),'execution_tick':60});complete.append(ms)
        aar=call('/sessions/'+sid+'/aar')[0];assert aar['verified'] and aar['scorecard']==card
    latencies['serial_completion']=complete
    # A closed stream reconnect retains the cursor and closes without mutating evidence.
def summarize(xs):
    ordered=sorted(xs)
    return dict(samples_ms=xs,median_ms=statistics.median(xs),p95_ms=ordered[min(len(xs)-1,int(.95*len(xs)))],max_ms=max(xs),count=len(xs))
result=dict(scope='Actual20 concurrent loopback HTTP/SSE clients and20 active synthetic individual sessions on one Mac. Explicit synthetic two-second telemetry horizon and no trainee decisions;60-second projection scoring. Not20 physical devices,20 rendering browsers, operational endurance or military/human evidence. SSE delivery timings include deliberate all-stream release after sequential command issuance and cannot establish intrinsic network latency.',simultaneously_open_streams=N,session_count=N,command_isolation_verified=True,all_command_acknowledgments_persisted=True,completed_verified_AAR=N,contacts_per_session=len(spec['tracks']),telemetry_tick=60,metrics={k:summarize(v) for k,v in latencies.items()})
Path('/tmp/vyuha-mission-live-load-receipt.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:{m:v[m] for m in ['median_ms','p95_ms','max_ms','count']} for k,v in result['metrics'].items()},indent=2))
