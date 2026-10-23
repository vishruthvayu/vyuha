"""Frozen curriculum compiler through existing engine; synthetic parity inputs."""
import json
from server.learning import catalog,choose_item,PrepareLearning,LearningContext,compile_item
from server.engine_v2 import Simulation
from server.tests.finale_sensor_fixtures import projection

def fixtures():
    data,digest=catalog();state={'competencies':{c['id']:dict(correct=0,incorrect=0,unassessable=0,assessed_sessions=0) for c in data['competencies'] if c['scope']=='individual'},'recent_items':[]};out=[]
    for item in data['items']:
        if item['audience']!='individual':continue
        req=PrepareLearning(request_id='parity-item',trainee='SYNTHETIC',mode='assessment' if item['pool']=='assessment' else 'practice',item_id=item['id'],form=item['form'],seed=7)
        _,selection=choose_item(data,state,req)
        context=LearningContext(catalog_hash=digest,item_id=item['id'],mode=req.mode,assistance=item['assistance'],seed=7,selection=selection)
        scenario=compile_item(context);sim=Simulation(scenario);points=[]
        while sim.tick<=1800:
            if sim.tick in [0,30,300,900,1799,1800]:points.append(projection(sim))
            if sim.tick==1800:break
            sim.step(True)
        out.append(dict(id=item['id'],scenario=scenario,checkpoints=points))
    return out
if __name__=='__main__':print(json.dumps(fixtures(),separators=(',',':')))
