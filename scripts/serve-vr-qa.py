#!/usr/bin/env python3
"""Development-only loopback proxy with visible IWER controls.

Run production Unit Mode on 127.0.0.1:8096 first. This harness serves the same
built assets/API through a separate disposable browser origin on :8097.
It never ships in dist, changes production runtime, bypasses TLS or drives a
browser. Operate its visible controls manually / through authorized UI tools.
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import argparse

ROOT = Path(__file__).resolve().parents[1]
HARNESS = r'''
<script src="/_vrqa/iwer.js"></script><script>
const device = new IWER.XRDevice(IWER.metaQuest3);
device.installRuntime({forceInstall:true});device.controlMode='programmatic';device.stereoEnabled=true;
device.quaternion.set(0,0,0,1);
let session=null,deny=false,reference=null,views=0,frames=0,last=0,intervals=[],faults=[];
const request=navigator.xr.requestSession.bind(navigator.xr);
navigator.xr.requestSession=async(...args)=>{
 if(deny){deny=false;throw new DOMException('QA permission denied','NotAllowedError');}
 session=await request(...args);reference=await session.requestReferenceSpace('local');
 session.addEventListener('end',()=>{session=null;reference=null;});
 const frame=(time,f)=>{if(!session)return;views=f.getViewerPose(reference)?.views.length??0;frames++;if(last)intervals.push(time-last);last=time;if(intervals.length>12000)intervals.shift();session.requestAnimationFrame(frame);};
 last=0;intervals=[];session.requestAnimationFrame(frame);return session;
};
window.addEventListener('error',e=>faults.push(String(e.error?.stack??e.message)));
window.addEventListener('unhandledrejection',e=>faults.push(String(e.reason?.stack??e.reason)));
addEventListener('DOMContentLoaded',()=>{
 const panel=document.createElement('aside');panel.id='vrqa';panel.style='position:fixed;right:8px;top:8px;z-index:99999;width:290px;background:#101b26;color:white;padding:10px;border:2px solid #68ddff;font:12px system-ui;max-height:95vh;overflow:auto';
 panel.innerHTML='<details open><summary>IWER SOFTWARE QA — NOT A HEADSET</summary><p>Production bundle / test-only emulator</p><div id="qa-buttons"></div><pre id="qa-status" style="white-space:pre-wrap"></pre></details>';document.body.append(panel);
 const button=(label,run)=>{const b=document.createElement('button');b.textContent=label;b.style='margin:3px;padding:5px';b.onclick=async()=>{try{await run();}catch(e){faults.push(String(e.stack??e));}};panel.querySelector('#qa-buttons').append(b);};
 const ray=async(hand,x,y)=>{
 if(!session)throw Error('Enter VR first');const c=device.controllers[hand];c.position.set(x,y-.4,0);c.quaternion.set(0,0,0,1);
 const frame=()=>new Promise(r=>session.requestAnimationFrame(r));await frame();await frame();c.updateButtonValue('trigger',1);await frame();await frame();c.updateButtonValue('trigger',0);await frame();
 };
 button('Deny next entry',()=>{deny=true;});button('System exit',()=>session?.end());
 button('Hidden',()=>device.updateVisibilityState('hidden'));button('Blurred',()=>device.updateVisibilityState('visible-blurred'));button('Visible',()=>device.updateVisibilityState('visible'));
 for(const hand of ['left','right']){
  button(hand+' contact 1',()=>ray(hand,-.98,1.3));button(hand+' contact 2',()=>ray(hand,-.98,1.16));
  button(hand+' next page',()=>ray(hand,-.98,.67));button(hand+' designate',()=>ray(hand,0,1.83));
  button(hand+' type',()=>ray(hand,0,1.68));button(hand+' identity',()=>ray(hand,0,1.53));button(hand+' classify',()=>ray(hand,0,1.38));
  button(hand+' hold',()=>ray(hand,0,1.23));button(hand+' RF',()=>ray(hand,0,1.08));button(hand+' kinetic',()=>ray(hand,0,.93));button(hand+' confirm',()=>ray(hand,0,.78));
  button(hand+' start/pause',()=>ray(hand,.98,1.37));button(hand+' view',()=>ray(hand,.98,1.22));button(hand+' cancel',()=>ray(hand,.98,1.07));button(hand+' exit',()=>ray(hand,.98,.92));
 }
 button('Head look left',()=>device.quaternion.set(0,Math.sin(.3),0,Math.cos(.3)));button('Head neutral',()=>device.quaternion.set(0,0,0,1));
 button('Lose graphics context',()=>{const canvas=document.querySelector('canvas[data-engine^="three.js"]');canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();});
 button('Reset frame sample',()=>{intervals=[];last=0;frames=0;});
 button('Remove right controller',()=>{device.controllers.right.connected=false;});
 button('Restore right controller',()=>{device.controllers.right.connected=true;});
 setInterval(()=>{const sorted=[...intervals].sort((a,b)=>a-b);panel.querySelector('#qa-status').textContent=JSON.stringify({emulator:'IWER 2.6.0',physical_headset:false,session:!!session,views,frames,controllerInputs:session?Array.from(session.inputSources).map(s=>({hand:s.handedness,mode:s.targetRayMode})):[],frame_ms:sorted.length?{samples:sorted.length,median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)}:null,faults},null,2);},1000);
});
</script>'''

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_GET(self): self.forward()
    def do_POST(self): self.forward()
    def do_PUT(self): self.forward()
    def do_DELETE(self): self.forward()
    def forward(self):
        if self.path=='/_vrqa/iwer.js':
            data=(ROOT/'client/node_modules/iwer/build/iwer.min.js').read_bytes();self.send_response(200);self.send_header('Content-Type','text/javascript');self.end_headers();self.wfile.write(data);return
        length=int(self.headers.get('Content-Length',0));data=self.rfile.read(length) if length else None
        headers={k:v for k,v in self.headers.items() if k.lower() not in ('host','connection','accept-encoding','content-length')}
        req=Request('http://127.0.0.1:'+str(self.server.upstream)+self.path,data=data,headers=headers,method=self.command)
        try: response=urlopen(req,timeout=180)
        except HTTPError as error: response=error
        typ=response.headers.get('Content-Type','')
        if 'text/event-stream' in typ:
            self.send_response(response.status)
            self.send_header('Content-Type',typ);self.send_header('Cache-Control','no-store');self.end_headers()
            try:
                while line := response.readline():self.wfile.write(line);self.wfile.flush()
            except (BrokenPipeError,ConnectionResetError):pass
            finally:response.close()
            return
        body=response.read()
        if self.path.split('?')[0]=='/' and 'text/html' in typ: body=body.replace(b'<head>',b'<head>'+HARNESS.encode(),1)
        self.send_response(response.status)
        for k,v in response.headers.items():
            if k.lower() not in ('content-length','connection','transfer-encoding','content-encoding'):self.send_header(k,v)
        self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--port',type=int,default=8097);parser.add_argument('--upstream',type=int,default=8096);args=parser.parse_args()
    if not (ROOT/'client/node_modules/iwer/build/iwer.min.js').exists():raise SystemExit('Run npm ci in client first; IWER is dev-only.')
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler);server.upstream=args.upstream
    print(f'IWER test-only origin http://127.0.0.1:{args.port}/',flush=True);server.serve_forever()
