#!/usr/bin/env python3
"""Generate measured manifest after green tests/build. Never certify physical tests."""
import argparse,json,re,sys,subprocess
from datetime import datetime,timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.evidence import ROOT,source_hash
p=argparse.ArgumentParser();p.add_argument('--backend',type=Path,required=True);p.add_argument('--frontend',type=Path,required=True);p.add_argument('--build',type=Path,required=True);args=p.parse_args()
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
acceptance='Software candidate validated; Stage 6 acceptance pending '+', '.join(pending)+'.' if pending else 'Recorded Stage 6 acceptance checks passed; see measurement scope below.'
experiment=read('experiment-results.json')
manifest={'schema_version':1,'validated_at':datetime.now(timezone.utc).isoformat(),'source_tree_sha256':source_hash(),'validation_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'baseline_commit':'2ad6403bdfab09aa303a802b5282355ba52af318','automated':{'backend_passed':backend,'frontend_passed':frontend,'parity':{'original':51,'director':72,'advanced':135,'rural':54},'build':'passed','offline_assets':assets},'acceptance':acceptance,'physical':physical,'deployment':read('deployment.json'),'walkthrough':read('walkthrough.json'),'performance':{'scale':read('performance-scale.json'),'unit':read('performance-unit.json'),'browser':read('performance-browser.json'),'android':read('performance-android.json'),'weak_laptop':read('performance-laptop.json')},'experiment':{k:v for k,v in experiment.items() if k in ['label','method','summary']},'remaining':(['Pending acceptance: '+', '.join(pending)+'.'] if pending else [])+['No human efficacy study conducted. Consent-gated pre/post tooling is available.','Trusted LAN prototype. No production authentication; do not expose publicly.','All threat/sensor/learning/audio values illustrative, not operational validation.','Plain LAN HTTP cold reload with local server absent is browser-security constrained.','Rain, crew roles, hardware feeds and production identity remain deferred.','HMAC integrity is neither donor authentication nor non-repudiation. Recorded practice has no tactical scoring or invented impacts.']}
(folder/'evidence.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Evidence manifest generated; physical checks retain their independently recorded status.')
