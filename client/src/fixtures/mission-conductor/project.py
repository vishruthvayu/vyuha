import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[4]))
from server.mission_conductor import create_mission_plan,project_mission
payload=json.load(sys.stdin)
plan=create_mission_plan(payload['scope'],payload['options'])
print(json.dumps(dict(plan=plan,projection=project_mission(plan,payload['frame'])),sort_keys=True))
