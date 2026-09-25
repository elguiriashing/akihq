/* Shared operational PoS. No card processing or fiscal invoice issuance. */
(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=(v,c='EUR')=>new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(v)/100);
 const btn=(action,label,attrs='')=>`<button type="button" class="action-btn" data-action="hp-${action}" ${attrs}>${esc(label)}</button>`;
 const input=(label,name,value='',type='text',attrs='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
 const select=(label,name,values,value='')=>`<label>${esc(label)}<select name="${name}">${values.map(([k,v])=>`<option value="${esc(k)}" ${String(k)===String(value)?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
 const form=(name,body,attrs='')=>`<form data-form="hp-${name}" class="hp-form" ${attrs}>${body}<button class="action-btn primary" type="submit">Save</button></form>`;
 function ticketHTML(ticket,workspace,width=80){
  const p=ticket.payload,o=p.order||p.after||{},currency=workspace.currency||'EUR';
  const list=lines=>`<ul>${(lines||[]).map(l=>`<li><b>${esc(l.quantity)} × ${esc(l.name)}</b> ${esc(l.seat?`Seat ${l.seat}`:'')}<br>${esc(l.note||'')}${ticket.station==='receipt'?`<br>${esc(money(l.unit_price_cents,currency))} each`:''}</li>`).join('')}</ul>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(ticket.kind)} ${esc(ticket.id)}</title><style>@page{size:${width===58?58:80}mm auto;margin:3mm}body{font:13px monospace;color:#000;width:${width===58?50:72}mm}h1{font-size:18px}li{margin:8px 0}ul{padding-left:16px}.notice{border:2px solid;padding:5px}small{overflow-wrap:anywhere}</style></head><body><h1>${esc(workspace.name)}</h1><h2>${esc(ticket.station)} · ${esc(ticket.kind)}</h2>${p.copy_of?'<h2>COPY / DUPLICADO</h2>':''}<p class="notice">${esc(p.notice||'OPERATIONAL TICKET — NO ES FACTURA')}</p><p>${esc(p.instruction||'')}</p><strong>${esc(o.label)}</strong><p>${esc(o.note)}</p>${ticket.kind==='preparation'?`<h3>Previous</h3>${list(p.previous)}<h3>Current required</h3>${list(p.current)}`:list(o.lines)}${p.destination?.id?`<h3>Destination ${esc(p.destination.table_id||'Walk-in')}</h3>${list(p.destination.lines)}`:''}${p.reason?`<p>${esc(p.reason)}</p>`:''}${p.total_cents!==undefined?`<p>Total ${esc(money(p.total_cents,currency))}<br>Recorded payments ${esc(money(p.paid_cents,currency))}<br>Balance ${esc(money(p.total_cents-p.paid_cents,currency))}</p>${(o.payments||[]).map(x=>`<p>${esc(x.method)} ${esc(money(x.amount_cents,currency))} ${esc(x.reference)}${x.change_cents?` · Change ${esc(money(x.change_cents,currency))}`:''}</p>`).join('')}`:''}<small>Order ${esc(o.id||ticket.order_id)}<br>Ticket ${esc(ticket.id)}<br>${esc(ticket.created_at)}${o.sale_id?`<br>Sale ${esc(o.sale_id)}`:''}</small><p>Keep with the final invoice where required.</p></body></html>`;
 }
 function create(ctx){
  let data=null,error='',selected='',page='',busy=false,disposed=false,started=false,timer=null,last='',printTicket=null,printAttempted=false;
  const key=`akihq:hospitality:${ctx.actor}:${ctx.workspace.id}`;
  function refresh(){
   if(disposed)return;
   const expanded=new Set([...root.document.querySelectorAll('.hp-shell details[open]')].map(d=>d.querySelector(':scope > summary')?.textContent));
   ctx.refresh();
   for(const d of root.document.querySelectorAll('.hp-shell details'))if(expanded.has(d.querySelector(':scope > summary')?.textContent))d.open=true;
  }
  const markDirty=e=>{const f=e.target.closest?.('.hp-form');if(f)f.dataset.dirty='true';};
  root.document.addEventListener('input',markDirty);
  const active=()=>!disposed&&ctx.isActive();
  function pending(){try{return JSON.parse(root.localStorage.getItem(key)||'null')}catch{throw Error('Saved request is unreadable. Do not clear browser storage; contact support.')}}
  async function rpc(name,args={}){if(disposed)throw Error('Workspace changed');const r=await ctx.client.rpc(name,{p_workspace:ctx.workspace.id,...args});if(disposed)throw Error('Workspace changed');if(r.error)throw Error(r.error.message);return r.data;}
  async function load(){if(busy||!active())return;try{const next=await rpc('crm_hospitality_overview');if(!active())return;const signature=JSON.stringify({...next,server_time:null});data=next;error='';if(signature!==last){last=signature;const focused=root.document.activeElement;if(!focused?.closest?.('.hp-form')&&!root.document.querySelector('.hp-form[data-dirty]'))refresh();}}catch(e){if(!active())return;data=null;error=e.message;refresh();}}
  function start(){if(started)return;started=true;Promise.resolve().then(load);timer=root.setInterval(load,2500);}
  async function execute(command,retry=false){
   if (!root.navigator.locks?.request) throw Error('Use an up-to-date browser over HTTPS to safely record orders.');
   return root.navigator.locks.request(key,{ifAvailable:true},async lock=>{
    if(!lock)throw Error('Another tab is recording an order. Review that tab first.');
    return executeLocked(command,retry);
   });
  }
  async function executeLocked(command,retry=false){
   if(busy)throw Error('Another request is in progress');busy=true;
   try{
    let p=pending();if(!retry){if(p)throw Error('Resolve the pending request first');p={key:root.crypto.randomUUID(),command};root.localStorage.setItem(key,JSON.stringify(p));}if(!p)throw Error('No pending request');
    const result=await rpc('crm_hospitality_command',{p_key:p.key,p_command:p.command});
    root.localStorage.removeItem(key);
    if(result.order_id)selected=result.status==='closed'?'':result.order_id;
    if(p.command.action==='claim_ticket'){printTicket=result;printAttempted=false;}
    return result;
   }finally{busy=false;await load();refresh();}
  }
  const current=()=>data?.orders.find(x=>x.id===selected);
  const orderAttrs=o=>`data-order="${esc(o.id)}" data-version="${o.version}"`;
  const tables=()=>[['','New walk-in order'],...(data?.layout.tables||[]).map(t=>[t.id,`${t.name} · ${data.layout.pages.find(p=>p.id===t.page)?.name||''}`])];
  function render(){
   start();let p=null;try{p=pending()}catch(e){error=e.message}
   const recovery=p?`<section class="panel hp-card"><h3>Request awaiting confirmation</h3><p>New changes are blocked until this request is resolved. Retry uses the original reference.</p>${btn('retry','Retry / check result')}${btn('abandon','Check result and cancel if unrecorded')}</section>`:'';
   if(!data)return `<div class="hp-shell">${recovery}<section class="panel hp-card"><h2>Shared Point of Sale</h2><p role="status">${esc(error||'Connecting to shared orders…')}</p>${btn('refresh','Reconnect')}<p>This view requires the hospitality database migration. Fiscal invoicing remains unavailable.</p></section></div>`;
   const o=current(),layout=data.layout;page=layout.pages.some(x=>x.id===page)?page:layout.pages[0]?.id||'';
   const floor=layout.mode==='restaurant'?`<section class="panel hp-card"><nav class="hp-toolbar">${layout.pages.map(p=>btn('page',p.name,`data-id="${esc(p.id)}" aria-pressed="${p.id===page}"`)).join('')}</nav><div class="hp-floor" aria-label="Tables">${layout.tables.filter(t=>t.page===page).map(t=>{const order=data.orders.find(o=>o.table_id===t.id);return `<button class="hp-table ${order?'occupied':''} ${t.shape}" style="left:${Number(t.x)}%;top:${Number(t.y)}%;width:${Number(t.width)}%;height:${Number(t.height)}%" data-action="hp-table" data-id="${esc(t.id)}"><strong>${esc(t.name)}</strong><small>${t.seats} seats${order?` · ${esc(money(order.total_cents,ctx.workspace.currency))}`:''}</small></button>`}).join('')||'<p>Add a page and tables in Floor settings.</p>'}</div></section>`:'';
   const orders=`<section class="panel hp-card"><h3>Open orders</h3><div class="hp-toolbar">${data.orders.map(x=>btn('select',`${tableName(x)} · ${money(x.total_cents-x.paid_cents,ctx.workspace.currency)} due`, `data-id="${x.id}" aria-pressed="${x.id===selected}"`)).join('')||'<p>No open orders</p>'}</div></section>`;
   const catalogue=o?`<section class="panel hp-card"><h3>Add products</h3><div class="pos-product-grid">${data.catalogue.map(p=>btn('add',`${p.name} · ${money(p.sale_price_cents,ctx.workspace.currency)}`,`${orderAttrs(o)} data-id="${p.id}"`)).join('')}</div></section>`:'';
   const details=o?`<section class="panel hp-card"><h2>${esc(tableName(o))}</h2><p>Order ${esc(o.id.slice(0,8))} · revision ${o.version}</p>${form('note',input('Order notes','note',o.note,'text','maxlength="2000"')+input('Guests','guests',o.guests,'number','min="1" max="999" required'),orderAttrs(o))}<div class="hp-lines">${o.lines.map(l=>`<details><summary>${esc(l.quantity)} × ${esc(l.name)} · ${esc(money(l.unit_price_cents,ctx.workspace.currency))} each ${esc(l.note)}</summary>${form('line',input('Quantity (0 removes)','quantity',l.quantity,'number','min="0" max="999999" step="0.001" required')+input('Preparation notes','note',l.note,'text','maxlength="1000"')+input('Seat','seat',l.seat,'text','maxlength="30"')+select('Station','station',[['kitchen','Kitchen'],['bar','Bar']],l.station),`${orderAttrs(o)} data-line="${l.id}"`)}</details>`).join('')||'<p>Choose a product to start.</p>'}</div><p><b>Total ${esc(money(o.total_cents,ctx.workspace.currency))}</b> · Paid ${esc(money(o.paid_cents,ctx.workspace.currency))} · Due ${esc(money(o.total_cents-o.paid_cents,ctx.workspace.currency))}</p><div class="hp-toolbar">${btn('send','Send kitchen / bar revision',orderAttrs(o))}${btn('prebill','Queue pre-bill',orderAttrs(o))}</div><details><summary>Move order or split items</summary>${form('move',select('Move whole order to','table_id',tables()),orderAttrs(o))}${form('transfer',select('Transfer selected quantities to','table_id',tables())+o.lines.map(l=>input(`${l.name} (up to ${l.quantity})`,`qty_${l.id}`,0,'number',`min="0" max="${l.quantity}" step="0.001"`)).join(''),`${orderAttrs(o)} data-destinations="${esc(JSON.stringify(Object.fromEntries(data.orders.filter(x=>x.table_id).map(x=>[x.table_id,x.version]))))}"`)}</details><details><summary>Record payment / split bill</summary><p>Record money already collected using cash or an external terminal. This does not charge a card or issue an invoice.</p>${form('payment',input('Amount','amount',((o.total_cents-o.paid_cents)/100).toFixed(2),'number','min="0.01" step="0.01" required')+select('Method','method',[['cash','Cash'],['card','External card terminal'],['other','Other external payment']])+input('Cash tendered (optional)','tendered','','number','min="0.01" step="0.01"')+input('External payment reference','reference','','text','maxlength="120"'),orderAttrs(o))}${form('equal',input('Number of remaining shares','shares',2,'number','min="2" max="100" required'),orderAttrs(o))}<p>Equal shares rounds down to cents; the final payer covers the remainder.</p>${o.payments.map(p=>`<p>${esc(p.method)} · ${esc(money(p.amount_cents,ctx.workspace.currency))} ${esc(p.reference||p.reason||'')}</p>`).join('')}</details>${data.can_manage?`<details><summary>Administrator corrections</summary>${form('reprice',input('Reason for catalogue repricing','reason','','text','required minlength="3" maxlength="500"'),orderAttrs(o))}${form('reverse_payment',select('Payment to reverse','payment_id',o.payments.filter(p=>p.amount_cents>0&&!o.payments.some(r=>r.reverses===p.id)).map(p=>[p.id,`${p.method} ${money(p.amount_cents,ctx.workspace.currency)}`]))+input('Reason (record an actual refund separately)','reason','','text','required minlength="3" maxlength="500"'),orderAttrs(o))}${form('cancel',input('Cancellation reason','reason','','text','required minlength="3" maxlength="500"'),orderAttrs(o))}</details>`:''}</section>`:'<section class="panel hp-card"><h2>Select a table or start a walk-in</h2><p>Staff use their own AkiHQ accounts on phones. Orders sync while connected.</p></section>';
   return `<div class="hp-shell" aria-busy="${busy}"><section class="panel hp-card"><div class="hp-toolbar"><h2>Point of Sale</h2><span class="status-pill success">Shared orders · ${esc(layout.mode)}</span>${btn('open','New walk-in')}${btn('refresh','Refresh')}</div><p class="text-warning">Operational records only. Fiscal invoice issuance is not activated.</p>${error?`<p role="alert">${esc(error)}</p>`:''}</section>${recovery}${floor}${orders}<div class="hp-grid">${catalogue}${details}</div>${printerPanel()}${data.can_export?`<details class="panel hp-card"><summary>Accountant evidence export</summary><p>Orders, partial payments, reversals, changes and tickets. Maximum 31 local days; this is not an official tax book.</p>${form('export',input('From','from','','date','required')+input('Through','through','','date','required'))}</details>`:''}${data.can_manage?settings():''}</div>`;
  }
  function tableName(o){return o.table_id?data.layout.tables.find(t=>t.id===o.table_id)?.name||o.table_id:o.label;}
  function settings(){const l=data.layout;return `<details class="panel hp-card"><summary>Floor settings</summary>${form('mode',select('PoS view','mode',[['till','Till only'],['restaurant','Restaurant / bar']],l.mode),`data-version="${data.layout_version}"`)}${form('page',input('New page name','name','','text','required maxlength="80"'),`data-version="${data.layout_version}"`)}${l.pages.map(p=>`<details><summary>Page: ${esc(p.name)}</summary>${form('page_edit',input('Page name','name',p.name,'text','required maxlength="80"')+select('Action','operation',[['rename','Rename'],['delete','Delete empty page']]),`data-id="${esc(p.id)}" data-version="${data.layout_version}"`)}</details>`).join('')}<h3>Tables</h3><p>Position and dimensions are percentages of the page. Names can be table numbers. Occupied tables cannot be deleted.</p>${l.pages.length?[...l.tables,{id:'',name:'',page:l.pages[0].id,shape:'rectangle',x:5,y:5,width:15,height:15,seats:4}].map(t=>`<details><summary>${esc(t.name||'Add table')}</summary>${form('table_edit',input('Number / name','name',t.name,'text','required maxlength="80"')+select('Page','page',l.pages.map(p=>[p.id,p.name]),t.page)+select('Shape','shape',[['rectangle','Rectangle'],['circle','Circle / oval'],['rounded','Rounded rectangle']],t.shape)+['x','y','width','height','seats'].map(k=>input(k,k,t[k],'number',`required min="${['x','y'].includes(k)?0:k==='seats'?1:5}" max="${k==='seats'?999:100}" step="1"`)).join('')+select('Action','operation',[['save','Save table'],['delete','Delete table']]),`data-id="${esc(t.id)}" data-version="${data.layout_version}"`)}</details>`).join(''):''}</details>`;}
  function printerPanel(){return `<details class="panel hp-card" ${printTicket?'open':''}><summary>Printer station · ${data.tickets.filter(t=>t.status==='queued').length} queued</summary><p>On the bar till, connect a receipt printer through the operating system (USB, network or Bluetooth if its driver supports it). Open a queued ticket and use the system print dialog. Phones send tickets here through shared orders.</p><p>Printing requires an operator. A claimed ticket is never automatically retried; inspect the printer before requesting a copy.</p>${printTicket?`<section><h3>${esc(printTicket.kind)} ready</h3>${!printAttempted?btn('print58','Print 58 mm')+btn('print80','Print 80 mm'):'<p>Print attempted. Check the paper before confirming or requesting a copy.</p>'}${btn('confirm','Confirm paper printed',`data-id="${printTicket.id}"`)}${btn('uncertain','Print failed / uncertain',`data-id="${printTicket.id}"`)}</section>`:''}<div class="hp-tickets">${data.tickets.map(t=>`<details><summary>${esc(t.station)} · ${esc(t.kind)} · ${esc(t.status)} · ${esc(new Date(t.created_at).toLocaleTimeString())}</summary><small>${esc(t.id)}</small>${t.status==='queued'?btn('claim','Open for printing',`data-id="${t.id}"`):`${t.status==='claimed'||t.status==='uncertain'?btn('confirm','Confirm paper printed',`data-id="${t.id}"`):''}${form('reprint',input('Why is another copy needed?','reason','','text','required minlength="3" maxlength="500"'),`data-id="${t.id}"`)}`}</details>`).join('')}</div></details>`;}
  async function action(target){const a=target.dataset.action.slice(3);try{
   if(a==='refresh'){await load();refresh();return;}
   if(a==='page'){page=target.dataset.id;refresh();return;}if(a==='select'){selected=target.dataset.id;refresh();return;}
   if(a==='retry'){await execute(null,true);return;}
   if(a==='abandon'){if(!root.navigator.locks?.request)throw Error('Use an up-to-date browser over HTTPS');await root.navigator.locks.request(key,{ifAvailable:true},async lock=>{if(!lock)throw Error('Another tab is recording an order');const p=pending();if(p){const r=await rpc('crm_hospitality_command',{p_key:root.crypto.randomUUID(),p_command:{action:'abandon',key:p.key}});root.localStorage.removeItem(key);if(r.response?.order_id)selected=r.response.order_id;ctx.toast('Request resolved',r.already_completed?'It was already recorded.':'Unrecorded request cancelled.');}await load();refresh();});return;}
   if(a.startsWith('print')){if(!printTicket||printAttempted)throw Error('Inspect the printer; request a marked copy if another print is needed');const w=root.open('','_blank','width=420,height=650');if(!w)throw Error('Allow the print window in this browser');w.opener=null;try{await execute({action:'begin_print',ticket_id:printTicket.id});printAttempted=true;}catch(e){w.close();throw e;}w.document.write(ticketHTML(printTicket,ctx.workspace,a==='print58'?58:80));w.document.close();w.focus();w.print();refresh();return;}
   let c={action:a,order_id:target.dataset.order,version:Number(target.dataset.version)};
   if(a==='open')c={action:'open',label:'Walk-in'};
   if(a==='table'){const t=data.layout.tables.find(t=>t.id===target.dataset.id);c={action:'open',table_id:t.id,label:`Table ${t.name}`};}
   if(a==='add')c.item_id=target.dataset.id;
   if(['claim','confirm','uncertain'].includes(a))c={action:`${a}_ticket`,ticket_id:target.dataset.id};
   await execute(c);if(['confirm','uncertain'].includes(a)){printTicket=null;refresh();}
  }catch(e){if(disposed)return;error=e.message;ctx.toast('PoS needs attention',error,'warning');refresh();}}
  async function submit(f){try{
   const a=f.dataset.form.slice(3),v=Object.fromEntries(new root.FormData(f));
   if(a==='export'){
    const period=root.AkiCommerceExport.period(v.from,v.through,ctx.workspace.timezone||'Europe/Madrid');
    const evidence=await rpc('crm_hospitality_export',{p_from:period.from,p_until:period.until});
    const blob=new root.Blob([JSON.stringify(evidence,null,2)],{type:'application/json'}),url=root.URL.createObjectURL(blob),anchor=root.document.createElement('a');
    anchor.href=url;anchor.download=`hospitality-${v.from}-${v.through}.json`;anchor.click();root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);return;
   }
   if(a==='equal'){const o=current(),amount=Math.floor((o.total_cents-o.paid_cents)/Number(v.shares))/100;const payment=f.closest('details').querySelector('[data-form="hp-payment"] [name="amount"]');payment.value=amount.toFixed(2);return;}
   let c={...v,action:a,order_id:f.dataset.order,version:Number(f.dataset.version)};
   if(['mode','page','page_edit','table_edit'].includes(a)){
    const l=JSON.parse(JSON.stringify(data.layout));
    if(a==='mode')l.mode=v.mode;
    if(a==='page')l.pages.push({id:root.crypto.randomUUID(),name:v.name});
    if(a==='page_edit'){if(v.operation==='delete'){if(l.tables.some(t=>t.page===f.dataset.id))throw Error('Move or delete this page’s tables first');l.pages=l.pages.filter(p=>p.id!==f.dataset.id);}else l.pages=l.pages.map(p=>p.id===f.dataset.id?{...p,name:v.name}:p);}
    if(a==='table_edit'){l.tables=l.tables.filter(t=>t.id!==f.dataset.id);if(v.operation!=='delete')l.tables.push({id:f.dataset.id||root.crypto.randomUUID(),name:v.name,page:v.page,shape:v.shape,...Object.fromEntries(['x','y','width','height','seats'].map(k=>[k,Number(v[k])]))});}
    c={action:'layout',version:Number(f.dataset.version),layout:l};
   }
   if(a==='line'){c.line_id=f.dataset.line;c.quantity=Number(v.quantity);}
   if(a==='note')c.guests=Number(v.guests);
   if(a==='payment'){if(!/^\d+(\.\d{1,2})?$/.test(v.amount))throw Error('Enter a payment with no more than two decimal places');c.amount_cents=Math.round(Number(v.amount)*100);if(v.method==='cash'&&v.tendered){if(!/^\d+(\.\d{1,2})?$/.test(v.tendered))throw Error('Enter cash tendered with no more than two decimal places');c.tendered_cents=Math.round(Number(v.tendered)*100);}}
   if(a==='transfer'){c.lines=Object.entries(v).filter(([k,q])=>k.startsWith('qty_')&&Number(q)>0).map(([k,q])=>({id:k.slice(4),quantity:Number(q)}));c.destination_version=JSON.parse(f.dataset.destinations||'{}')[v.table_id];}
   if(a==='reprint')c.ticket_id=f.dataset.id;
   await execute(c);
  }catch(e){if(disposed)return;error=e.message;ctx.toast('PoS needs attention',error,'warning');refresh();}}
  return {render,action,submit,dispose(){disposed=true;root.clearInterval(timer);root.document.removeEventListener('input',markDirty);data=null;printTicket=null;}};
 }
 root.AkiHospitality={create,ticketHTML};
})(typeof window==='undefined'?globalThis:window);
