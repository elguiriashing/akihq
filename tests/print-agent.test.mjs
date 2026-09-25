import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateConfig,ticketText,escpos,processTicket,sendToPrinter} from '../tools/print-agent/agent.mjs';
const config={supabase_url:'https://test.supabase.co',publishable_key:'sb_publishable_test',device_id:'00000000-0000-0000-0000-000000000001',token:'a'.repeat(64),routes:{bar:{type:'tcp',host:'192.168.1.50',port:9100,columns:42,cut:true}}};
const job={id:'ticket-1',station:'bar',kind:'preparation',business_name:'Café',payload:{order:{label:'Table 4'},previous:[],current:[{name:'Café',quantity:2,note:'No sugar\x1b\x70 MALICIOUS'}]}};
test('printer config rejects secret keys, remote addresses and shell queue injection',()=>{
 assert.equal(validateConfig(config),config);
 for(const changed of [{publishable_key:'sb_secret_wrong'},{supabase_url:'http://test.supabase.co'},{routes:{bar:{...config.routes.bar,host:'printer.evil.example'}}},{routes:{bar:{type:'cups',queue:'x;rm -rf /',columns:42}}}])assert.throws(()=>validateConfig({...config,...changed}));
});
test('receipt encoding strips control commands and preserves revision and copy instructions',()=>{
 const text=ticketText({...job,payload:{...job.payload,copy_of:'original'}},32);assert.match(text,/COPY \/ DUPLICADO/);assert.match(text,/PREVIOUS/);assert.match(text,/CURRENT REQUIRED/);assert(!text.includes('\x1b'));assert(text.split('\n').every(l=>l.length<=32));
 const bytes=escpos(job,config.routes.bar);assert.equal([...bytes].filter(b=>b===27).length,1);
});
test('agent sends exactly once only after durable attempt and server begin; unknown outcome retains hold',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'akihq-printer-'));const journal=join(dir,'pending.json');let sends=0;
 try{
  await assert.rejects(processTicket(job,{config,journal,rpc:async(_n,a)=>{if(a.p_action==='spooled')throw Error('Connection lost after printing')},send:async()=>{assert.equal(JSON.parse(await readFile(journal,'utf8')).ticket_id,job.id);sends++;}}),/Connection lost/);
  assert.equal(sends,1);
  await assert.rejects(processTicket(job,{config,journal,rpc:async()=>{},send:async()=>{sends++;}}),/EEXIST/);assert.equal(sends,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('printer transport writes ESC/POS bytes to an actual loopback TCP socket (emulator, not hardware)',async()=>{
 const chunks=[];let finish;const received=new Promise(r=>finish=r);const server=createServer(socket=>{socket.on('data',b=>chunks.push(b));socket.on('end',finish);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const bytes=escpos(job,config.routes.bar);await sendToPrinter(bytes,{type:'tcp',host:'127.0.0.1',port:server.address().port});await received;assert.deepEqual(Buffer.concat(chunks),bytes);}finally{await new Promise(r=>server.close(r));}
});
