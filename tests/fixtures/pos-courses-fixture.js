/* Isolated synthetic data only. No authentication, network service, printer or payment provider. */
'use strict';
const params=new URLSearchParams(window.__posFixtureQuery || location.search);
document.documentElement.lang=params.get('lang')||'en';
document.documentElement.dataset.theme=params.get('theme')||'dark';
const copy=value=>JSON.parse(JSON.stringify(value));
const names=['Café con leche','Cerveza','Tostada con tomate','Patatas bravas','Agua mineral','Ensalada mixta','Copa de vino','Hamburguesa','Croquetas','Zumo de naranja','Tarta de queso','Espresso'];
const catalogue=Array.from({length:36},(_,i)=>({id:'p'+i,name:names[i%names.length]+(i>=12?' '+(Math.floor(i/12)+1):''),category:i%3===0?'Coffee':i%3===1?'Drinks':'Food',sale_price_cents:200+(i%9)*75,on_hand:i===7?0:50,active:true}));
const layout={mode:'restaurant',pages:[{id:'terrace',name:'Terraza'},{id:'inside',name:'Restaurant'}],tables:Array.from({length:12},(_,i)=>({id:'t'+i,name:String(i+1).padStart(2,'0'),page:i<6?'terrace':'inside',shape:'rectangle',seats:4,x:5+(i%3)*30,y:5+Math.floor(i/3)*20,width:22,height:16})),menu:{categories:[{id:'Coffee',name:'Coffee',color:'#B88652'},{id:'Drinks',name:'Drinks',color:'#439FCB'},{id:'Food',name:'Food',color:'#699A5E'}],products:{p0:{favourite:true,label:'Café con leche',color:'#B88652'},p1:{favourite:true,color:'#439FCB'},p2:{favourite:true,color:'#699A5E'},p35:{hidden:true}},presets:['No ice','Sin azúcar','Gluten-free request']}};
const orders=Array.from({length:15},(_,i)=>{
 const lines=Array.from({length:1+i%5},(_,j)=>({id:'l'+i+'-'+j,item_id:'p'+j,name:catalogue[j].name,unit_price_cents:catalogue[j].sale_price_cents,quantity:j===0?2:1,station:j<2?'bar':'kitchen',note:j===0&&i===0?'Sin azúcar':'',seat:String(j+1)}));
 return {id:'o'+i,table_id:i<12?'t'+i:null,label:i<12?'Table '+(i+1):'Walk-in '+(i-11),created_at:new Date(Date.now()-(i+1)*4*60000).toISOString(),updated_at:new Date().toISOString(),version:2,status:'open',guests:1+i%4,note:i===0?'Birthday table · drinks first':i===3?'Allergy request: check ingredients with the guest':'',lines,sent:i%3===0?[]:copy(lines),payments:[],paid_cents:i===4?200:0,total_cents:lines.reduce((sum,l)=>sum+l.quantity*l.unit_price_cents,0)};
});
const db={layout,layout_version:0,catalogue,orders,tickets:[],recent:[],can_manage:params.get('role')!=='staff',can_export:false};
db.course_contract_version=1;
const first=db.orders[0];first.label='Terraza 01';first.note='Birthday table · serve courses separately';first.guests=4;
first.lines=[
 {id:'starter-a',item_id:'p2',name:'Croquetas de jamón',quantity:2,unit_price_cents:850,station:'kitchen',note:'',seat:'1',course:1,course_held:false,course_fired_at:new Date(Date.now()-600000).toISOString()},
 {id:'starter-b',item_id:'p3',name:'Patatas bravas',quantity:1,unit_price_cents:650,station:'kitchen',note:'Salsa aparte',seat:'2',course:1,course_held:false,course_fired_at:new Date(Date.now()-600000).toISOString()},
 {id:'main-a',item_id:'p7',name:'Hamburguesa de la casa',quantity:2,unit_price_cents:1400,station:'kitchen',note:'One medium, one well done',seat:'1, 3',course:2,course_held:true},
 {id:'main-b',item_id:'p8',name:'Lubina a la plancha',quantity:1,unit_price_cents:1800,station:'kitchen',note:'No butter. Check ingredients with the guest.',seat:'2',course:2,course_held:true},
 {id:'dessert-a',item_id:'p10',name:'Tarta de queso',quantity:3,unit_price_cents:650,station:'kitchen',note:'Birthday candle',seat:'',course:3,course_held:true},
 {id:'dessert-b',item_id:'p11',name:'Café cortado',quantity:2,unit_price_cents:230,station:'bar',note:'Decaf',seat:'',course:3,course_held:true},
 {id:'immediate',item_id:'p1',name:'Agua mineral',quantity:2,unit_price_cents:250,station:'bar',note:'',seat:''}
];first.sent=copy(first.lines.filter(l=>l.course_fired_at));first.total_cents=first.lines.reduce((n,l)=>n+l.quantity*l.unit_price_cents,0);
const kds={contract_version:1,enabled:true,can_manage:db.can_manage,history_limit:50,cards:orders.map((o,i)=>({workspace_id:'fixture-workspace',order_id:o.id,station:i%3===0?'bar':'kitchen',version:1,source:{label:i<12?'Table '+(i+1):o.label,table_id:o.table_id,note:o.note,guests:o.guests,cancelled:false,lines:[{id:'k'+i,item_id:'p'+i,name:i%2?'Hamburguesa completa':'Café con leche',quantity:i%3+1,note:i===0?'Sin azúcar':i===3?'No nuts: confirm allergy procedure':'',seat:'1',station:i%3===0?'bar':'kitchen'}]},previous_source:{lines:[]},progress:{['k'+i]:['queued','preparing','ready'][i%3]},previous_progress:{},review_required:i===3,change_kind:i===3?'relocation':'new',created_at:o.created_at,updated_at:o.updated_at,changed_at:o.updated_at,completed_at:null}))};
const commands=[],notices=[],replies=new Map();let sequence=0;
const host=document.getElementById('fixture-host');
const controller=window.AkiHospitality.create({actor:'fixture-user',workspace:{id:'fixture-workspace',currency:'EUR',name:'AkiBusiness Demo'},isActive:()=>true,refresh(){host.innerHTML=controller.render();},toast(...args){notices.push(args);},client:{async rpc(name,args){
 if(window.fixtureDenied)return {error:{message:'point-of-sale access required'}};
 if(name==='crm_hospitality_overview')return {data:{...copy(db),server_time:new Date().toISOString()}};
 if(name==='crm_kds_overview')return window.fixtureMissing?{error:{message:'Kitchen migration has not been applied'}}:{data:{...copy(kds),server_time:new Date().toISOString()}};
 if(name==='crm_course_command'){
  if(replies.has(args.p_key))return copy(replies.get(args.p_key));
  const c=args.p_command,o=db.orders.find(o=>o.id===c.order_id);if(!o||o.version!==c.version)return {error:{message:'Order changed; reload and review'}};
  const released=o.lines.filter(l=>l.course===c.course&&l.course_held);if(!c.confirmed||!released.length)return {error:{message:'Confirm held dishes'}};
  commands.push(copy(c));for(const l of released){l.course_held=false;l.course_fired_at=new Date().toISOString();}o.sent.push(...copy(released));o.version++;
  const result={data:{order_id:o.id,version:o.version,course:c.course,fired_lines:released.length}};replies.set(args.p_key,copy(result));
  if(window.fixtureDropReply){window.fixtureDropReply=false;return {error:{message:'Connection interrupted after command commit'}};}return result;
 }
 if(name==='crm_kds_command'){
  if(replies.has(args.p_key))return copy(replies.get(args.p_key));
  const c=args.p_command,k=kds.cards.find(k=>k.order_id===c.order_id&&k.station===c.station);
  commands.push(copy(c));
  if(c.action==='kds_enable'){kds.enabled=true;return {data:{enabled:true}};}
  if(!k||k.version!==c.version)return {error:{message:'Kitchen card changed; reload and review'}};
  if(c.action==='kds_review'){k.progress=copy(c.progress);k.review_required=false;}
  if(c.action==='kds_recall')k.progress[c.line_id]='queued';
  if(c.action==='kds_advance')for(const id of Object.keys(k.progress))if(c.line_id==='*'||c.line_id===id){const prior={preparing:'queued',ready:'preparing',served:'ready'}[c.state];if(k.progress[id]===prior)k.progress[id]=c.state;}
  k.version++;k.completed_at=!k.review_required&&Object.values(k.progress).every(s=>s==='served')?new Date().toISOString():null;
  const r={data:{kds_order_id:k.order_id,station:k.station,version:k.version}};replies.set(args.p_key,copy(r));
  if(window.fixtureDropReply){window.fixtureDropReply=false;return {error:{message:'Connection interrupted after command commit'}};}
  return r;
 }
 if(name==='crm_pos_ledger')return {data:{active_day:null,days:[],bills:[],summary:{},pagination:{offset:0,limit:30,total:0}}};
 if(name!=='crm_hospitality_command')return {error:{message:'Unexpected fixture RPC'}};
 if(replies.has(args.p_key))return copy(replies.get(args.p_key));
 const c=args.p_command,order=db.orders.find(o=>o.id===c.order_id);commands.push(copy(c));
 if(c.action==='layout'){db.layout=c.layout;db.layout_version++;return {data:{layout_version:db.layout_version}};}
 if(!order||c.version!==order.version)return {error:{message:'Order changed on another device; reload and review'}};
 if(c.action==='send')order.sent=copy(order.lines.filter(l=>!l.course_held));
 if(c.action==='add'){const p=db.catalogue.find(p=>p.id===c.item_id);order.lines.push({id:'new'+(++sequence),item_id:p.id,name:p.name,unit_price_cents:p.sale_price_cents,quantity:1,station:'kitchen',note:'',seat:'',...(c.course?{course:c.course,course_held:true}:{})});}
 if(c.action==='line'){const line=order.lines.find(l=>l.id===c.line_id);Object.assign(line,{quantity:c.quantity,note:c.note,seat:c.seat,station:c.station});if(c.course!==undefined&&c.course!==(line.course||0)){line.course=c.course;line.course_held=c.course>0;}order.lines=order.lines.filter(l=>l.quantity>0);}
 order.version++;order.total_cents=order.lines.reduce((sum,l)=>sum+l.quantity*l.unit_price_cents,0);
 const result={data:{order_id:order.id,status:'open'}};replies.set(args.p_key,copy(result));return result;
}}});
window.fixture={controller,db,kds,commands,notices};
document.addEventListener('click',event=>{const button=event.target.closest('[data-action^="hp-"]');if(button){event.preventDefault();void controller.action(button);}});
document.addEventListener('submit',event=>{if(event.target.matches('[data-form^="hp-"]')){event.preventDefault();void controller.submit(event.target);}});
host.innerHTML=controller.render();
