#!/usr/bin/env node
// Dependency-free outbound-only agent. Pairing grants station printing, never general DB access.
import {readFile,open,unlink,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createConnection,isIP} from 'node:net';
import {spawn} from 'node:child_process';
export function validateConfig(c){
 const u=new URL(c.supabase_url);
 if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Use the HTTPS Supabase project URL');
 if(typeof c.publishable_key!=='string'||!c.publishable_key.startsWith('sb_publishable_'))throw Error('Use a Supabase publishable key, never a secret/service key');
 if(!/^[a-f0-9-]{36}$/.test(c.device_id)||!/^[a-f0-9]{64}$/.test(c.token))throw Error('Valid device pairing required');
 if(!c.routes||!Object.keys(c.routes).length||Object.keys(c.routes).some(s=>!['kitchen','bar','receipt'].includes(s)))throw Error('Configure kitchen, bar or receipt routes');
 for(const route of Object.values(c.routes)){
  if(![32,42,48].includes(route.columns))throw Error('Printer columns must be 32, 42 or 48');
  if(route.type==='tcp'){
   if(isIP(route.host)!==4||!(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(route.host))||!Number.isInteger(route.port)||route.port<1||route.port>65535)throw Error('TCP printer must use a literal private LAN IPv4 address and valid port');
  }else if(route.type==='cups'){
   if(!/^[A-Za-z0-9_.-]{1,80}$/.test(route.queue))throw Error('Invalid installed CUPS queue');
  }else throw Error('Route must be tcp (network ESC/POS) or cups (installed raw queue)');
 }
 return c;
}
// Plain ASCII fallback works without assuming a vendor-specific code page. No user
// text can inject ESC/POS commands (drawer kicks, resets, cuts or network setup).
export function safeText(value){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/€/g,'EUR').replace(/[^\x20-\x7e\n]/g,'?');}
export function ticketText(ticket,columns=42){
 const p=ticket.payload||{},o=p.order||p.after||{},rows=[];
 const line=v=>{for(const l of safeText(v).split('\n')){if(!l.length)rows.push('');for(let n=0;n<l.length;n+=columns)rows.push(l.slice(n,n+columns));}};
 const list=ls=>{for(const l of ls||[]){line(`${l.quantity} x ${l.name}`);if(l.seat)line(`Seat: ${l.seat}`);if(l.note)line(`NOTE: ${l.note}`);}};
 const amount=v=>`${(Number(v)/100).toFixed(2)} ${safeText(ticket.currency||'EUR')}`;
 line(ticket.business_name);line(`${ticket.station} / ${ticket.kind}`);if(p.copy_of)line('*** COPY / DUPLICADO ***');
 line(p.notice||'OPERATIONAL TICKET / NO ES FACTURA');line(p.instruction||'');line(o.label||'');line(o.note||'');
 if(ticket.kind==='preparation'){line('PREVIOUS:');list(p.previous);line('CURRENT REQUIRED:');list(p.current);}else list(o.lines);
 if(p.destination?.id){line(`DESTINATION: ${p.destination.label||p.destination.table_id||'Walk-in'}`);list(p.destination.lines);}
 if(p.reason)line(p.reason);
 if(p.total_cents!==undefined){line(`Total: ${amount(p.total_cents)}`);line(`Recorded payments: ${amount(p.paid_cents)}`);line(`Balance: ${amount(p.total_cents-p.paid_cents)}`);for(const pay of o.payments||[]){line(`${pay.method}: ${amount(pay.amount_cents)}`);if(pay.reference)line(pay.reference);if(pay.change_cents)line(`Change: ${amount(pay.change_cents)}`);}}
 line(`Order: ${o.id||ticket.order_id}`);line(`Ticket: ${ticket.id}`);line(ticket.created_at);return rows.join('\n')+'\n';
}
export function escpos(ticket,route){return Buffer.concat([Buffer.from([27,64]),Buffer.from(ticketText(ticket,route.columns),'ascii'),Buffer.from('\n\n\n'),route.cut===true?Buffer.from([29,86,0]):Buffer.alloc(0)]);}
export async function sendToPrinter(bytes,route){
 if(route.type==='tcp')return new Promise((resolve,reject)=>{
  const socket=createConnection({host:route.host,port:route.port});let done=false;
  const finish=e=>{if(done)return;done=true;socket.destroy();e?reject(e):resolve();};
  socket.setTimeout(10000,()=>finish(Error('Printer timed out; delivery is uncertain')));
  socket.on('error',finish);socket.once('connect',()=>socket.end(bytes,()=>finish()));
 });
 return new Promise((resolve,reject)=>{
  const child=spawn('lp',['-d',route.queue,'-o','raw','-t','AkiHQ ticket'],{stdio:['pipe','pipe','pipe'],shell:false});
  const timeout=setTimeout(()=>{child.kill();reject(Error('Print spool timed out; delivery is uncertain'));},15000);
  child.once('error',e=>{clearTimeout(timeout);reject(e)});child.stdin.on('error',()=>{});
  child.stdout.resume();child.stderr.resume();child.once('exit',code=>{clearTimeout(timeout);code===0?resolve():reject(Error(`Print spool exited ${code}; inspect printer`));});child.stdin.end(bytes);
 });
}
export async function durableWrite(path,value){
 await mkdir(dirname(path),{recursive:true,mode:0o700});
 const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value));await f.sync();}finally{await f.close();}
}
export function rpcClient(config,fetcher=fetch){return async(name,args={})=>{
 const r=await fetcher(`${config.supabase_url.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{method:'POST',redirect:'error',headers:{apikey:config.publishable_key,'Content-Type':'application/json'},body:JSON.stringify({p_device:config.device_id,p_token:config.token,...args}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const e=Error(`Printer service refused request (${r.status}); inspect queue and pairing`);e.status=r.status;throw e;}
 return r.json();
};}
export async function processTicket(ticket,{config,rpc,journal,send=sendToPrinter,write=durableWrite,remove=unlink}){
 const route=config.routes[ticket.station];if(!route)throw Error('No configured route for claimed ticket; inspect queue');
 // The durable file is created before authorizing a print. An existing file stops
 // startup; a crash or lost response never automatically repeats physical output.
 await write(journal,{ticket_id:ticket.id,device_id:config.device_id,attempted_at:new Date().toISOString()});
 await rpc('crm_printer_report',{p_ticket:ticket.id,p_action:'begin'});
 await send(escpos(ticket,route),route);
 // "spooled" means bytes accepted, not proof that paper left the printer.
 await rpc('crm_printer_report',{p_ticket:ticket.id,p_action:'spooled'});
 await remove(journal);
}
async function main(){
 const [, ,configPath,flag,ticketId]=process.argv;
 if(!configPath||configPath==='--help'){console.log('Usage: node agent.mjs /protected/path/printer.json\nRecovery after inspecting the printer and queue: add --acknowledge-uncertain TICKET_ID\nNo automatic reprints. Pairing configuration is a secret; do not commit it.');return;}
 const config=validateConfig(JSON.parse(await readFile(configPath,'utf8'))),journal=resolve(configPath)+'.pending.json',lock=resolve(configPath)+'.lock';
 let pending;try{pending=JSON.parse(await readFile(journal,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(flag==='--acknowledge-uncertain'){if(!pending||pending.ticket_id!==ticketId)throw Error('Ticket ID does not match pending journal');await unlink(journal);console.log('Local hold cleared. Request a marked copy in AkiHQ if needed; the original will not be reprinted.');return;}
 if(pending)throw Error(`Uncertain ticket ${pending.ticket_id}. Inspect printer and queue; acknowledge it before restarting.`);
 let lockFile;try{lockFile=await open(lock,'wx',0o600);await lockFile.writeFile(String(process.pid));await lockFile.sync();}catch{throw Error('Agent lock exists. Stop the other agent; after an unclean exit inspect pending ticket before removing the stale lock.');}
 const rpc=rpcClient(config);let stop=false;process.once('SIGINT',()=>{stop=true});process.once('SIGTERM',()=>{stop=true});
 try{
  console.log('AkiHQ print agent connected. Keep this process running on the printer network.');
  let failures=0;
  while(!stop){let ticket;try{ticket=await rpc('crm_printer_next');failures=0;}catch(e){if(e.status&&e.status<500&&e.status!==429)throw e;failures++;console.error('Printer service temporarily unreachable; waiting to reconnect. Check any claimed jobs in AkiHQ.');await new Promise(r=>setTimeout(r,Math.min(30000,2500*failures)));continue;}if(ticket){await processTicket(ticket,{config,rpc,journal});console.log(`Spooled ${ticket.id} (${ticket.station}); physical output is not automatically verified.`);}await new Promise(r=>setTimeout(r,2500));}
 }finally{await lockFile.close();await unlink(lock).catch(()=>{});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1});
