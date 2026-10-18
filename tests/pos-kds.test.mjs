import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../assets/pos-kds.js',import.meta.url),'utf8');
const document={documentElement:{lang:'en'}};const context={document};vm.runInNewContext(code,context);const api=context.AkiPosKDS;
const now=Date.parse('2026-10-18T12:00:00Z');
function card(extra={}){return {order_id:'a',station:'kitchen',version:1,created_at:'2026-10-18T11:45:00Z',completed_at:null,review_required:false,progress:{x:'queued'},source:{label:'Terraza 5',guests:2,note:'Sin azúcar',lines:[{id:'x',quantity:2,name:'Café con leche',note:'Extra caliente',seat:'1'}]},...extra};}
test('accent-insensitive multiword search matches table, dish and preparation note',()=>{
 assert.equal(api.filtered([card()],{query:'cafe azucar'}).length,1);
 assert.equal(api.filtered([card()],{query:'terraza caliente'}).length,1);
 assert.equal(api.filtered([card()],{query:'cafe missing'}).length,0);
});
test('station filter separates bar and kitchen cards',()=>{
 assert.equal(api.filtered([card(),card({station:'bar'})],{station:'bar'}).length,1);
});
test('completed cards never appear active and review cards are not advertised as ready',()=>{
 const rows=[card({completed_at:new Date(now).toISOString()}),card({review_required:true,progress:{x:'ready'}}),card({progress:{x:'ready'}})];
 assert.equal(api.filtered(rows,{status:'active'}).length,2);
 assert.equal(api.filtered(rows,{status:'review'}).length,1);
 assert.equal(api.filtered(rows,{status:'ready'}).length,1);
 assert.equal(api.filtered(rows,{status:'history'}).length,1);
});
test('unacknowledged changes sort before ordinary preparation, then oldest first',()=>{
 const a=card({order_id:'old',created_at:'2026-10-18T10:00:00Z'}),b=card({order_id:'review',review_required:true}),c=card({order_id:'new'});
 assert.deepEqual(Array.from(api.filtered([c,a,b]),c=>c.order_id),['review','old','new']);
});
test('history sorts newest completed first, without inventing missing records',()=>{
 const a=card({order_id:'old',completed_at:'2026-10-18T10:00:00Z'}),b=card({order_id:'new',completed_at:'2026-10-18T11:00:00Z'});
 assert.deepEqual(Array.from(api.filtered([a,b],{status:'history'}),c=>c.order_id),['new','old']);
});
test('counts refer to current lines, not stray progress keys or dish quantity',()=>{
 const c=card({progress:{x:'ready',removed:'ready'}});assert.equal(api.counts(c).ready,1);
 assert.equal(api.counts(card({progress:{x:'unexpected'}})).queued,0);
});
test('untrusted names, notes, labels and line IDs are escaped',()=>{
 const c=card();c.source.label='<img src=x onerror=alert(1)>';c.source.note='<script>bad()</script>';c.source.lines[0].id='" onfocus="bad';c.source.lines[0].name='<svg/onload=bad()>';c.progress={[c.source.lines[0].id]:'queued'};
 const html=api.cardHTML(c,{now});assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(!html.includes('<svg'));assert(html.includes('&lt;img'));assert(html.includes('&quot;'));
});
test('review card exposes reconciliation, never ordinary preparation controls',()=>{
 const html=api.cardHTML(card({review_required:true}),{now,manager:true});assert(html.includes('hp-kds-review'));assert(!html.includes('hp-kds-progress'));assert(!html.includes('hp-kds-recall'));
});
test('disconnected or pending command blocks all progress controls',()=>{
 assert.match(api.cardHTML(card(),{now,blocked:true}),/data-action="hp-kds-progress"[^>]+disabled/);
});
test('served line can be recalled by a manager, not ordinary staff',()=>{
 const c=card({progress:{x:'served'},completed_at:new Date(now).toISOString()});
 assert(api.cardHTML(c,{now,manager:true}).includes('hp-kds-recall'));
 assert(!api.cardHTML(c,{now,manager:false}).includes('hp-kds-recall'));
 c.source.cancelled=true;assert(!api.cardHTML(c,{now,manager:true}).includes('hp-kds-recall'));
});
test('one-line cards do not duplicate the single action with an all-lines action',()=>{
 assert(!api.cardHTML(card(),{now}).includes('data-line="*"'));
 const c=card();c.source.lines.push({...c.source.lines[0],id:'y'});c.progress.y='queued';assert(api.cardHTML(c,{now}).includes('data-line="*"'));
});
test('English and Spanish controls use the current document language',()=>{
 document.documentElement.lang='en';assert(api.cardHTML(card(),{now}).includes('Start'));
 document.documentElement.lang='es';assert(api.cardHTML(card(),{now}).includes('Empezar'));
 document.documentElement.lang='en';
});
test('elapsed label explicitly means first send and never shows a negative age',()=>{
 assert(api.cardHTML(card(),{now}).includes('15 min since first send'));
 assert(api.cardHTML(card({created_at:new Date(now+60000).toISOString()}),{now}).includes('0 min since first send'));
});
test('new assets are included in both source and offline shell manifests, not offline writes',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const file of ['pos-kds.js?v=2','pos-kds.css?v=1']){assert(html.includes(file));assert(sw.includes(file));}
 assert(html.indexOf('pos-kds.js?v=2')<html.indexOf('hospitality-pos.js?v=17'));
});
