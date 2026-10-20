import test from 'node:test';
import assert from 'node:assert/strict';
import { SSEDecoder, abortableDelay, consumeStream } from './live-stream';
test('SSE preserves split CRLF, multiple frames, cursor and escaped annotation text',()=>{
 const p=new SSEDecoder();assert.deepEqual(p.push('id: 7\r'),[]);
 assert.deepEqual(p.push('\nevent: update\r\ndata: {"commands":[],"text":"line\\nnext"}\r'),[]);
 assert.deepEqual(p.push('\n\r\n: heartbeat\r\n\r\nevent: closed\ndata: {}\n\n'),[{event:'update',id:'7',data:{commands:[],text:'line\nnext'}},{event:'closed',id:null,data:{}}]);
});
test('malformed JSON and oversized unfinished frames fail closed',()=>{
 assert.throws(()=>new SSEDecoder().push('data: nope\n\n'));
 assert.throws(()=>new SSEDecoder().push('x'.repeat(1048577)),/limit/);
});
test('aborted reconnect delay resolves promptly instead of leaving listeners/timers alive',async()=>{
 const c=new AbortController();const p=abortableDelay(60000,c.signal);c.abort();await p;
 await abortableDelay(60000,c.signal);
});
test('stream uses explicit headers and canceled readers; closed notification exits without update',async()=>{
 const original=globalThis.fetch;let canceled=false;const seen:unknown[]=[];
 globalThis.fetch=(async(_url,init)=>{assert.equal(init?.credentials,'omit');return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('event: update\ndata: {"seq":1}\n\nevent: closed\ndata: {}\n\n'));},cancel(){canceled=true;}}),{headers:{'Content-Type':'text/event-stream'}});}) as typeof fetch;
 try {await consumeStream('/instructor/stream',v=>{seen.push(v);},new AbortController().signal);assert.deepEqual(seen,[{seq:1}]);assert.equal(canceled,true);}finally{globalThis.fetch=original;}
});
