import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {ticketText} from '../tools/print-agent/agent.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const root={document:{documentElement:{lang:'en'}}};
for(const f of ['pos-courses.js','pos-service.js','pos-kds.js'])vm.runInNewContext(read('assets/'+f),root);
const api=root.AkiPosCourses;
const l={id:'a',item_id:'p',name:'Croquetas',quantity:2,unit_price_cents:850,station:'kitchen',course:2,course_held:true,note:'Sin sal',seat:'1'};
const order={id:'o',version:2,label:'Terrace 5',lines:[l,{...l,id:'b',course:3},{...l,id:'c',course:0,course_held:false}],sent:[],paid_cents:0};
test('course feature is hidden until server explicitly advertises the matching contract',()=>{
 assert.equal(api.available({}),false);assert.equal(api.available({course_contract_version:2}),false);assert.equal(api.available({course_contract_version:1}),true);assert.equal(api.rail(order,{}),'');assert.equal(api.itemFields(l,order,{}),'');
});
test('groups separate held courses and preserve item details without changing the order',()=>{
 const before=JSON.stringify(order);const groups=api.groups(order);assert.equal(groups.length,3);assert.equal(groups.find(g=>g.id===2).held.length,1);assert.equal(JSON.stringify(order),before);
});
test('immediate and fired lines are not held; sendable filtering is shared with service review',()=>{
 assert.deepEqual(Array.from(api.sendable(order),l=>l.id),['c']);const prep=root.AkiPosService.preparation(order);assert.equal(prep.changes.length,1);assert.equal(prep.changes[0].id,'c');assert.equal(prep.held,2);
 const onlyHeld={...order,lines:[l]};assert.equal(root.AkiPosService.preparation(onlyHeld).changed,false);
});
test('sent-item course selection is disabled, but unpriced instructions remain elsewhere editable',()=>{
 assert.match(api.itemFields(l,{...order,sent:[l]},{course_contract_version:1}),/<select name="course" disabled>/);
 assert.doesNotMatch(api.itemFields(l,order,{course_contract_version:1}),/<select name="course" disabled>/);
});
test('old snapshots and disconnected controls cannot submit a course',()=>{
 for(const [live,options] of [[{...order,version:3},{}],[order,{blocked:true}],[order,{staleConnection:true}],[undefined,{}]]){
  const html=api.dialog(order,live,2,options);assert.match(html,/<button type="submit"[^>]*disabled/);assert.match(html,/<input type="checkbox"[^>]*disabled/);
 }
});
test('only the selected course appears in the firing review, not all held dishes',()=>{
 const html=api.dialog(order,order,2);assert.equal((html.match(/<li>/g)||[]).length,1);assert.match(html,/name="confirmed" value="true" required/);assert.doesNotMatch(html,/<button type="submit"[^>]*disabled/);
});
test('empty course cannot be fired',()=>assert.match(api.dialog(order,order,6),/<button type="submit"[^>]*disabled/));
test('course labels, line names and notes are escaped',()=>{
 const bad={...order,label:'<img src=x onerror=bad()>',lines:[{...l,name:'<script>bad()</script>',note:'<svg onload=bad()>',seat:'" autofocus="true'}]};
 const html=api.dialog(bad,bad,2);assert.doesNotMatch(html,/<img|<script|<svg/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&quot;/);
});
test('course labels are English and Spanish, independently of the older POS strings',()=>{
 assert.match(api.badge(l),/Mains.*On hold/);root.document.documentElement.lang='es';assert.match(api.badge(l),/Principales.*En espera/);assert.match(api.dialog(order,order,2),/Marchar tiempo/);root.document.documentElement.lang='en';
});
test('KDS badge uses the course firing timestamp, not the original order age',()=>{
 const fired={...l,course_held:false,course_fired_at:'2026-10-18T12:00:00Z'};assert.match(api.badge(fired,{kitchen:true,now:Date.parse('2026-10-18T12:07:00Z')}),/7 min since firing/);
 assert.doesNotMatch(api.badge(fired),/min since/);assert.doesNotMatch(api.badge({...fired,course_fired_at:'invalid'},{kitchen:true}),/NaN/);
});
test('held dishes have a final-payment warning without pretending to process payment',()=>{
 assert.match(api.paymentWarning(order),/partial payment/);assert.equal(api.paymentWarning({...order,lines:api.sendable(order)}),'');
});
test('native printer output separates newly fired dishes from previous-order reference',()=>{
 const fired={...l,course_held:false};const ticket={id:'t',station:'kitchen',kind:'preparation',payload:{course:2,order:{label:'Terrace 5'},released:[fired],previous:[{...fired,name:'Earlier starter'}],current:[fired]}};
 const text=ticketText(ticket,48);assert.match(text,/NEWLY FIRED \/ MARCHAR/);assert(text.indexOf('Croquetas')<text.indexOf('PREVIOUS / CURRENT ARE REFERENCE ONLY'));assert(text.indexOf('Earlier starter')>text.indexOf('REFERENCE ONLY'));assert.doesNotMatch(text,/HOLD \/ EN ESPERA/);
});
test('pre-bills mark held courses but do not instruct the kitchen to cook',()=>{
 const text=ticketText({id:'t',station:'receipt',kind:'prebill',payload:{order:{lines:[l]}}},48);assert.match(text,/HOLD \/ EN ESPERA: 2/);assert.doesNotMatch(text,/NEWLY FIRED/);
});
test('all changed course assets are versioned in both document and service-worker cache',()=>{
 for(const f of ['pos-courses.js?v=1','pos-courses.css?v=1','pos-service.js?v=3','pos-kds.js?v=2','pos-v4-dialogs.js?v=2','hospitality-pos.js?v=17']){assert(read('index.html').includes(f));assert(read('sw.js').includes(f));}
});
test('course confirmation includes the reviewed bill version and explicit checkbox',()=>{
 const html=api.dialog(order,order,2);assert.match(html,/data-order="o" data-version="2" data-course="2"/);assert.match(html,/name="confirmed"/);assert.doesNotMatch(html,/name="confirmed"[^>]*checked/);
});
