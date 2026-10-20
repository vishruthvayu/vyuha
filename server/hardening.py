"""Bounded JSON ingress for trusted-LAN prototype APIs."""
import json,math
from starlette.responses import JSONResponse
MAX_BODY=8*1024*1024
class BoundedJSON:
 def __init__(self,app):self.app=app
 async def __call__(self,scope,receive,send):
  if scope['type']!='http' or scope['method']!='POST' or not scope['path'].startswith('/api/'):
   return await self.app(scope,receive,send)
  async def reject(status,text):await JSONResponse({'detail':text},status_code=status)(scope,receive,send)
  size=0;chunks=[]
  while True:
   message=await receive()
   if message['type']=='http.disconnect':return
   body=message.get('body',b'');size+=len(body)
   if size>MAX_BODY:return await reject(413,'JSON payload exceeds 8 MiB limit')
   chunks.append(body)
   if not message.get('more_body'):break
  raw=b''.join(chunks)
  try:
   value=json.loads(raw,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('Non-finite number')))
   stack=[(value,0)];nodes=0
   while stack:
    item,depth=stack.pop();nodes+=1
    if depth>20 or nodes>400000:raise ValueError('JSON nesting or item limit exceeded')
    if isinstance(item,float) and not math.isfinite(item):raise ValueError('Non-finite JSON number')
    if isinstance(item,dict):stack.extend((v,depth+1) for v in item.values())
    elif isinstance(item,list):stack.extend((v,depth+1) for v in item)
   if not isinstance(value,dict):raise ValueError('JSON request must be an object')
  except (ValueError,RecursionError):return await reject(422,'Malformed, non-finite or excessively nested JSON')
  used=False
  async def replay():
   nonlocal used
   if not used:used=True;return {'type':'http.request','body':raw,'more_body':False}
   return await receive()
  await self.app(scope,replay,send)
