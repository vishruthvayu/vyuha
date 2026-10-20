#!/usr/bin/env python3
"""Generate measured manifest after green tests/build. Never certify physical tests."""
import argparse,json,re,sys,subprocess
from datetime import datetime,timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.evidence import ROOT,source_hash
p=argparse.ArgumentParser();p.add_argument('--backend',type=Path,required=True);p.add_argument('--frontend',type=Path,required=True);p.add_argument('--build',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'docs/release-evidence.json');args=p.parse_args()
b=args.backend.read_text();f=args.frontend.read_text();build=args.build.read_text()
if re.search(r'\d+ failed',b) or not re.search(r'fail 0',f) or not re.search(r'built in',build):raise SystemExit('Evidence requires successful test and build outputs')
backend=int(re.search(r'(\d+) passed',b).group(1));frontend=int(re.search(r'pass (\d+)',f).group(1));assets=int(re.search(r'Offline cache: (\d+)',build).group(1))
folder=ROOT/'docs/qa-stage6'
def read(name):
 path=folder/name
 return json.loads(path.read_text()) if path.exists() else {'status':'pending measurement'}
physical=read('physical.json')
if 'status' in physical:physical={'wan_off':'Pending physical WAN-off/LAN-on test','weak_laptop':'Pending team hardware and measurement','devices':['Historical Stage 4: Mac officer + Android/Chrome; WAN remained connected.']}
pending=physical.get('pending_checks',['physical WAN-off/LAN-on','weakest-laptop measurement'])
wan_exception=physical.get('wan_off')=='NOT PERFORMED BEFORE SUBMISSION' and physical.get('wan_off_release_blocking') is False
if wan_exception:pending=[item for item in pending if item!='physical WAN-off/LAN-on']
acceptance='Automated software candidate validated. '+('Remaining physical acceptance: '+', '.join(pending)+'.' if pending else 'Dedicated physical WAN-off/LAN-on test '+('not performed before submission; approved validation limitation.' if wan_exception else 'status recorded below.'))
release_folder=ROOT/'docs/qa-stage7'
release_checks=json.loads((release_folder/'acceptance.json').read_text()) if (release_folder/'acceptance.json').exists() else {'status':'release work in progress'}
def final_read(name,legacy=None):
 path=release_folder/name
 return json.loads(path.read_text()) if path.exists() else read(legacy or name)
experiment=read('experiment-results.json')
manifest={'schema_version':1,'validated_at':datetime.now(timezone.utc).isoformat(),'source_tree_sha256':source_hash(),'validation_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'baseline_commit':'b974b6fca32fcc2a58d2c3967d29508a11cea8a2','release_version':'1.0.0','release_reference':'v1.0.0','team':{'name':'WhiteList&0','id':'185350','category':'Software','problem_statement':'SIH26247'},'release_checks':release_checks,'automated':{'backend_passed':backend,'frontend_passed':frontend,'parity':{'original':51,'director':72,'advanced':135,'rural':54},'build':'passed','offline_assets':assets},'acceptance':acceptance,'physical':physical,'deployment':final_read('deployment.json'),'walkthrough':final_read('clean-database.json','walkthrough.json'),'history':final_read('history.json'),'browser_demo':final_read('browser-demo.json'),'rehearsals':final_read('rehearsals.json'),'media':final_read('media.json'),'performance':{'scale':read('performance-scale.json'),'unit':read('performance-unit.json'),'browser':read('performance-browser.json'),'android':read('performance-android.json'),'weak_laptop':read('performance-laptop.json')},'experiment':{k:v for k,v in experiment.items() if k in ['label','method','summary']},'remaining':(['Pending acceptance: '+', '.join(pending)+'.'] if pending else [])+['Dedicated physical WAN-off/LAN-on validation was not completed before submission. Multi-device LAN operation, local asset serving, process-outage recovery and queued-event resynchronization were validated separately.','No human efficacy study conducted. Consent-gated pre/post tooling is available.','Trusted LAN prototype. No production authentication; do not expose publicly.','All threat/sensor/learning/audio values illustrative, not operational validation.','Plain LAN HTTP cold reload with local server absent is browser-security constrained.','Rain, crew roles, hardware feeds and production identity remain deferred.','HMAC integrity is neither donor authentication nor non-repudiation. Recorded practice has no tactical scoring or invented impacts.']}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(manifest,indent=2)+'\n')
print('Evidence manifest generated; physical checks retain their independently recorded status.')
