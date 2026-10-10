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
  let view='terminal',category='All',designerCategory='All',panel='',panelLine='',paymentAmount=null,immersive=false,data=null,error='',selected='',page='',busy=false,disposed=false,started=false,timer=null,last='',printTicket=null,printAttempted=false,layoutDraft=null,layoutVersion=null,pairedDevice=null,printerDevices=[],printerFilter='kitchen',printerStation='all',printerSelected='',printerSettings=false,tapJobs=[],tapTimer=null,tapDrain=null,tapInFlight=0;
  const key=`akihq:hospitality:${ctx.actor}:${ctx.workspace.id}`;
  function refresh(){
   if(disposed)return;
   const expanded=new Set([...root.document.querySelectorAll('.hp-shell details[open]')].map(d=>d.querySelector(':scope > summary')?.textContent));
   ctx.refresh();
   for(const d of root.document.querySelectorAll('.hp-shell details'))if(expanded.has(d.querySelector(':scope > summary')?.textContent))d.open=true;
  }
  const markDirty=e=>{const f=e.target.closest?.('.hp-form, .hp-v4-form, .hp-v4-inline-form, .hp-v4-product-row, .hp-ps-copy form, .hp-ps-pair, .hp-ps-copy form, .hp-ps-pair');if(f)f.dataset.dirty='true';};
  root.document.addEventListener('input',markDirty);
  const escapePanel=e=>{if(e.key==='Escape'&&panel){panel='';panelLine='';refresh();}};
  root.document.addEventListener('keydown',escapePanel);
  const printerOnChange=e=>{if(e.target?.matches?.('[data-printer-station]')){printerStation=e.target.value;printerSelected='';refresh();}};
  root.document.addEventListener('change',printerOnChange);
  const floorEditor=root.AkiFloorEditor?.create({document:root.document,getDraft:()=>layoutDraft,onChange:()=>{}});
  const active=()=>!disposed&&ctx.isActive();
  function pending(){try{return JSON.parse(root.localStorage.getItem(key)||'null')}catch{throw Error('Saved request is unreadable. Do not clear browser storage; contact support.')}}
  async function rpc(name,args={}){if(disposed)throw Error('Workspace changed');const r=await ctx.client.rpc(name,{p_workspace:ctx.workspace.id,...args});if(disposed)throw Error('Workspace changed');if(r.error)throw Error(r.error.message);return r.data;}
  async function load(){if(busy||!active())return;try{const next=await rpc('crm_hospitality_overview');if(!active())return;const signature=JSON.stringify({...next,server_time:null});data=next;error='';if(signature!==last){last=signature;const focused=root.document.activeElement;if(!layoutDraft&&!focused?.closest?.('.hp-form, .hp-v4-form, .hp-v4-inline-form, .hp-v4-product-row')&&!root.document.querySelector('.hp-form[data-dirty], .hp-v4-form[data-dirty], .hp-v4-inline-form[data-dirty], .hp-v4-product-row[data-dirty], .hp-ps-copy form[data-dirty], .hp-ps-pair[data-dirty]'))refresh();}}catch(e){if(!active())return;data=null;error=e.message;refresh();}}
  function start(){if(started)return;started=true;Promise.resolve().then(load);timer=root.setInterval(load,2500);}

  // Tap intents are batched locally, then committed by the normal versioned RPC.
  // This queue never guesses whether an ambiguous network response was saved.
  const tapDelayMs=85;
  const outstandingTaps=()=>tapInFlight+tapJobs.reduce((n,x)=>n+Math.abs(x.delta),0);
  function enqueueTap(kind,orderId,id,delta){
   if(!active())throw Error('Workspace changed');
   if(pending()&&!busy)throw Error('Resolve the pending order request before taking new taps.');
   const o=data?.orders.find(x=>x.id===orderId);
   if(!o)throw Error('Order no longer open');
   if(Number(o.paid_cents)>0)throw Error('Reverse recorded payments before editing this order.');
   if(!Number.isInteger(delta)||!delta)throw Error('Invalid tap');
   const previous=tapJobs.find(x=>x.kind===kind&&x.orderId===orderId&&x.id===id);
   if(previous){
    if(Math.abs(previous.delta+delta)>999)throw Error('Too many pending taps');
    previous.delta+=delta;
    if(previous.delta===0)tapJobs.splice(tapJobs.indexOf(previous),1);
   }else{
    if(tapJobs.length>=50)throw Error('Please wait for pending items to save');
    tapJobs.push({kind,orderId,id,delta});
   }
   if(!tapDrain&&tapTimer===null&&tapJobs.length)
    tapTimer=root.setTimeout(()=>{tapTimer=null;void flushTaps();},tapDelayMs);
   refresh();
  }
  async function commitTap(job){
   const o=data?.orders.find(x=>x.id===job.orderId);
   if(!o)throw Error('Order has closed or moved; review the bill.');
   if(Number(o.paid_cents)>0)throw Error('Cannot change an order after recording payment.');
   if(job.kind==='line'){
    const l=o.lines.find(x=>x.id===job.id);
    if(!l){if(job.delta<0)return;throw Error('Item was removed; review the bill.');}
    const qty=Math.max(0,Number(l.quantity)+job.delta);
    if(qty!==Number(l.quantity))
     await executeDirect({action:'line',order_id:o.id,version:o.version,line_id:l.id,quantity:qty,note:l.note||'',seat:l.seat||'',station:l.station||'kitchen'});
    return;
   }
   if(job.kind!=='product'||job.delta<=0)throw Error('Invalid product tap');
   if(!data.catalogue.some(x=>String(x.id)===job.id))throw Error('Product no longer available.');
   // Prepared/seat-specific variants remain separate lines.
   const plain=o.lines.find(l=>String(l.item_id)===job.id&&!String(l.note||'').trim()&&!String(l.seat||'').trim()&&l.station==='kitchen');
   if(plain){
    await executeDirect({action:'line',order_id:o.id,version:o.version,line_id:plain.id,quantity:Number(plain.quantity)+job.delta,note:'',seat:'',station:'kitchen'});
    return;
   }
   await executeDirect({action:'add',order_id:o.id,version:o.version,item_id:job.id});
   if(job.delta>1){
    const updated=data?.orders.find(x=>x.id===o.id);
    const l=updated?.lines.find(x=>String(x.item_id)===job.id&&!String(x.note||'').trim()&&!String(x.seat||'').trim()&&x.station==='kitchen');
    if(!l)throw Error('First item saved but its new line was not reloaded; review the bill.');
    await executeDirect({action:'line',order_id:updated.id,version:updated.version,line_id:l.id,quantity:Number(l.quantity)+job.delta-1,note:'',seat:'',station:'kitchen'});
   }
  }
  async function flushTaps(){
   if(tapTimer!==null){root.clearTimeout(tapTimer);tapTimer=null;}
   if(tapDrain)return tapDrain;
   if(!tapJobs.length)return true;
   tapDrain=(async()=>{
    while(tapJobs.length&&active()){
     const job=tapJobs.shift();tapInFlight=Math.abs(job.delta);
     try{await commitTap(job);tapInFlight=0;}
     catch(e){
      const dropped=tapJobs.reduce((sum,j)=>sum+Math.abs(j.delta),0);tapInFlight=0;tapJobs.length=0;error=e.message;
      ctx.toast('Check the bill',e.message+(dropped?' · '+dropped+' later tap(s) were not submitted.':'')+' Check any pending request before retrying.','warning');
      refresh();return false;
     }
    }
    return active();
   })();
   try{return await tapDrain;}
   finally{
    tapDrain=null;
    if(tapJobs.length&&active()&&tapTimer===null)tapTimer=root.setTimeout(()=>{tapTimer=null;void flushTaps();},tapDelayMs);
    refresh();
   }
  }

  async function execute(command,retry=false){
   const hadTaps=!!(tapJobs.length||tapTimer!==null||tapDrain);
   if(hadTaps&&!retry){
    if(!await flushTaps())throw Error('Review the current bill before continuing.');
    // Send and pre-bill are safe to rebase after this device's queued taps.
    if(['send','prebill'].includes(command?.action)){
     const o=data?.orders.find(x=>x.id===command.order_id);
     if(!o)throw Error('Order no longer open');
     command={...command,version:o.version};
    }
   }
   return executeDirect(command,retry);
  }
  async function executeDirect(command,retry=false){
   if(!root.navigator.locks?.request)throw Error('Use an up-to-date browser over HTTPS to safely record orders.');
   // Queue behind another tab's short command, but never bypass a pending unknown result.
   return root.navigator.locks.request(key,{},async lock=>{
    if(!lock)throw Error('Unable to lock this order; review the other tab.');
    return executeLocked(command,retry);
   });
  }
  async function executeLocked(command,retry=false){
   if(busy)throw Error('Another request is in progress');busy=true;
   try{
    let p=pending();if(!retry){if(p)throw Error('Resolve the pending request first');p={key:root.crypto.randomUUID(),command};root.localStorage.setItem(key,JSON.stringify(p));}if(!p)throw Error('No pending request');
    const result=await rpc('crm_hospitality_command',{p_key:p.key,p_command:p.command});
    root.localStorage.removeItem(key);
    if(result.order_id&&(p.command.action==='open'||(p.command.order_id&&(!selected||selected===p.command.order_id)))){if(selected!==result.order_id)panel='';selected=result.status==='closed'?'':result.order_id;}
    if(p.command.action==='layout'){layoutDraft=null;layoutVersion=null;}
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
   const o=current(),layout=layoutDraft||data.layout;page=layout.pages.some(x=>x.id===page)?page:layout.pages[0]?.id||'';
   const floor=layout.mode==='restaurant'?`<section class="panel hp-card"><nav class="hp-toolbar">${data.can_manage?layoutDraft?btn('layout-save','Save layout')+btn('layout-discard','Discard changes'):btn('layout-edit','Arrange tables'):''}${layout.pages.map(p=>btn('page',p.name,`data-id="${esc(p.id)}" aria-pressed="${p.id===page}"`)).join('')}</nav><p>${layoutDraft?'Drag tables to move them; drag the corner to resize. Keyboard: arrows move, Alt + arrows resize, Shift uses larger steps.':'Tap a table to open its order.'}</p><div class="hp-floor" aria-label="Tables">${layout.tables.filter(t=>t.page===page).map(t=>{const order=data.orders.find(o=>o.table_id===t.id);return `<button class="hp-table ${order?'occupied':''} ${t.shape}" style="left:${Number(t.x)}%;top:${Number(t.y)}%;width:${Number(t.width)}%;height:${Number(t.height)}%" ${layoutDraft?'data-floor-edit="true"':'data-action="hp-table"'} data-id="${esc(t.id)}"><strong>${esc(t.name)}</strong><small>${t.seats} seats${order?` · ${esc(money(order.total_cents,ctx.workspace.currency))}`:''}</small>${layoutDraft?'<span data-floor-resize aria-hidden="true" class="hp-resize">↘</span>':''}</button>`}).join('')||'<p>Add a page and tables in Floor settings.</p>'}</div></section>`:'';
   const orders=`<section class="panel hp-card"><h3>Open orders</h3><div class="hp-toolbar">${data.orders.map(x=>btn('select',`${tableName(x)} · ${money(x.total_cents-x.paid_cents,ctx.workspace.currency)} due`, `data-id="${x.id}" aria-pressed="${x.id===selected}"`)).join('')||'<p>No open orders</p>'}</div></section>`;
   const groups=root.AkiPosV4.groups(layout,data.catalogue);
   if(!groups.some(g=>g.id===category))category='All';
   const catalogue=o?`<section class="hp-terminal-catalogue">${root.AkiPosV4.categoryButtons(layout,data.catalogue,category)}${root.AkiPosV4.itemButtons(layout,data.catalogue,category,o,ctx.workspace.currency)}<div class="hp-tap-status" role="status" aria-live="polite">${tapJobs.length||tapDrain?'Saving '+outstandingTaps()+' item tap(s)…':''}</div></section>`:'';

   const details=o?`<section class="panel hp-card"><h2>${esc(tableName(o))}</h2><p>Order ${esc(o.id.slice(0,8))} · revision ${o.version}</p>${form('note',input('Order notes','note',o.note,'text','maxlength="2000"')+input('Guests','guests',o.guests,'number','min="1" max="999" required'),orderAttrs(o))}<div class="hp-lines">${o.lines.map(l=>`<details><summary>${esc(l.quantity)} × ${esc(l.name)} · ${esc(money(l.unit_price_cents,ctx.workspace.currency))} each ${esc(l.note)}</summary>${form('line',input('Quantity (0 removes)','quantity',l.quantity,'number','min="0" max="999999" step="0.001" required')+input('Preparation notes','note',l.note,'text','maxlength="1000"')+input('Seat','seat',l.seat,'text','maxlength="30"')+select('Station','station',[['kitchen','Kitchen'],['bar','Bar']],l.station),`${orderAttrs(o)} data-line="${l.id}"`)}</details>`).join('')||'<p>Choose a product to start.</p>'}</div><p><b>Total ${esc(money(o.total_cents,ctx.workspace.currency))}</b> · Paid ${esc(money(o.paid_cents,ctx.workspace.currency))} · Due ${esc(money(o.total_cents-o.paid_cents,ctx.workspace.currency))}</p><div class="hp-toolbar">${btn('send','Send kitchen / bar revision',orderAttrs(o))}${btn('prebill','Queue pre-bill',orderAttrs(o))}</div><details><summary>Move order or split items</summary>${form('move',select('Move whole order to','table_id',tables()),orderAttrs(o))}${form('transfer',select('Transfer selected quantities to','table_id',tables())+o.lines.map(l=>input(`${l.name} (up to ${l.quantity})`,`qty_${l.id}`,0,'number',`min="0" max="${l.quantity}" step="0.001"`)).join(''),`${orderAttrs(o)} data-destinations="${esc(JSON.stringify(Object.fromEntries(data.orders.filter(x=>x.table_id).map(x=>[x.table_id,x.version]))))}"`)}</details><details><summary>Record payment / split bill</summary><p>Record money already collected using cash or an external terminal. This does not charge a card or issue an invoice.</p>${form('payment',input('Amount','amount',((o.total_cents-o.paid_cents)/100).toFixed(2),'number','min="0.01" step="0.01" required')+select('Method','method',[['cash','Cash'],['card','External card terminal'],['other','Other external payment']])+input('Cash tendered (optional)','tendered','','number','min="0.01" step="0.01"')+input('External payment reference','reference','','text','maxlength="120"'),orderAttrs(o))}${form('equal',input('Number of remaining shares','shares',2,'number','min="2" max="100" required'),orderAttrs(o))}<p>Equal shares rounds down to cents; the final payer covers the remainder.</p>${o.payments.map(p=>`<p>${esc(p.method)} · ${esc(money(p.amount_cents,ctx.workspace.currency))} ${esc(p.reference||p.reason||'')}</p>`).join('')}</details>${data.can_manage?`<details><summary>Administrator corrections</summary>${form('reprice',input('Reason for catalogue repricing','reason','','text','required minlength="3" maxlength="500"'),orderAttrs(o))}${form('reverse_payment',select('Payment to reverse','payment_id',o.payments.filter(p=>p.amount_cents>0&&!o.payments.some(r=>r.reverses===p.id)).map(p=>[p.id,`${p.method} ${money(p.amount_cents,ctx.workspace.currency)}`]))+input('Reason (record an actual refund separately)','reason','','text','required minlength="3" maxlength="500"'),orderAttrs(o))}${form('cancel',input('Cancellation reason','reason','','text','required minlength="3" maxlength="500"'),orderAttrs(o))}</details>`:''}</section>`:'<section class="panel hp-card"><h2>Select a table or start a walk-in</h2><p>Staff use their own AkiHQ accounts on phones. Orders sync while connected.</p></section>';
   const tileFloor=layout.mode==='restaurant'?`<section class="hp-tile-floor"><div class="hp-tile-heading"><strong>Choose a table</strong><span>${layout.tables.filter(t=>t.page===page).length} tables</span></div><div class="hp-tile-grid">${layout.tables.filter(t=>t.page===page).map(t=>{const activeOrder=data.orders.find(o=>o.table_id===t.id);return `<button type="button" class="hp-tile-table ${activeOrder?'occupied':''}" data-action="hp-table" data-id="${esc(t.id)}"><span aria-hidden="true">▣</span><strong>${esc(t.name)}</strong><small>${activeOrder?esc(money(activeOrder.total_cents-activeOrder.paid_cents,ctx.workspace.currency))+' due':esc(t.seats)+' seats · Available'}</small></button>`}).join('')||'<p>Add tables using the Designer.</p>'}</div></section>`:'';
   const quickBill=o?`<section class="hp-quick-bill"><div class="hp-quick-heading"><strong>Current bill</strong><button type="button" class="action-btn" data-action="hp-order-panel">⚙ Order settings</button></div><div class="hp-quick-lines">${o.lines.map(l=>`<div class="hp-quick-line"><button type="button" class="hp-item-name hp-v4-edit-item" data-action="hp-edit-item" data-id="${esc(l.id)}" aria-label="Edit ${esc(l.name)}"><strong>${esc(l.name)}</strong>${l.note?`<small>${esc(l.note)}</small>`:""}</button><div class="hp-qty-stepper"><button type="button" data-action="hp-quick-qty" data-delta="-1" data-line="${esc(l.id)}" ${orderAttrs(o)} aria-label="Remove one">−</button><span>${esc(l.quantity)}</span><button type="button" data-action="hp-quick-qty" data-delta="1" data-line="${esc(l.id)}" ${orderAttrs(o)} aria-label="Add one">+</button></div><strong>${esc(money(Number(l.unit_price_cents)*Number(l.quantity),ctx.workspace.currency))}</strong></div>`).join('')||'<p>Tap an item to add it to the bill.</p>'}</div><div class="hp-quick-total"><span>Paid ${esc(money(o.paid_cents,ctx.workspace.currency))} · Due <strong>${esc(money(o.total_cents-o.paid_cents,ctx.workspace.currency))}</strong></span><strong>${esc(money(o.total_cents,ctx.workspace.currency))}</strong></div><div class="hp-quick-actions">${btn('send','Send',orderAttrs(o))}${btn('prebill','Pre-bill',orderAttrs(o))}<button type="button" class="action-btn" data-action="hp-split-panel">Split / Move</button><button type="button" class="action-btn primary" data-action="hp-payment-panel">Pay</button></div><div class="hp-v4-utilities">${data.can_manage?btn("admin-panel","Manager corrections"):""}<span>Operational tickets · No es factura</span></div></section>`:'';
   const switcher=`<nav class="hp-mode-switch">${btn('switch-view','Terminal', 'data-id="terminal" aria-pressed="'+(view==='terminal')+'"')}${data.can_manage?btn('switch-view','PoS designer','data-id="designer" aria-pressed="'+(view==='designer')+'"'):''}${view==="terminal"?btn("immersive",immersive?"Exit full screen":"⛶ Full screen",`aria-pressed="${immersive}"`):""}<span class="status-pill success">Shared orders · ${esc(layout.mode)}</span></nav>`;
   const exports=data.can_export?`<details class="panel hp-card"><summary>Accountant evidence export</summary><p>Operational evidence only, not an official tax book.</p>${form('export',input('From','from','','date','required')+input('Through','through','','date','required'))}</details>`:'';
   if(view==='designer'&&data.can_manage)return `<div class="hp-shell hp-designer hp-v4-design-host" aria-busy="${busy}">${switcher}${error?`<p role="alert">${esc(error)}</p>`:''}${recovery}${root.AkiPosV4.designer(data,designerCategory)}<div class="hp-v4-design-floors"><h2>Floor & table designer</h2>${floor}${settings()}</div><div class="hp-v4-design-printers"><section class="panel hp-card"><h2>Printer station</h2><p>Manage the print queue and paired printers without leaving the designer.</p>${btn("printer-panel","Open printer station")}</section></div>${exports}${panel==="printer"?printerView():""}</div>`;

   return `<div class="hp-shell hp-terminal ${immersive?"hp-immersive ":""}${o?'hp-order-open':'hp-floor-open'}" aria-busy="${busy}">${switcher}${error?`<p role="alert">${esc(error)}</p>`:''}${recovery}<div class="hp-terminal-top"><div class="hp-toolbar">${o?btn('back','← All tables'):btn('open','+ Walk-in')}${o?`<strong class="hp-register-table">${esc(tableName(o))}</strong>`:''}${btn('printer-panel',`Print queue (${root.AkiPrinterStation.decorate(data.tickets,data.orders,data.recent).filter(t=>t.active&&t.status==='queued').length})`)}${btn('refresh','Refresh')}</div>${layout.mode==='restaurant'&&!o?`<nav class="hp-floor-tabs">${layout.pages.map(p=>btn('page',p.name,`data-id="${esc(p.id)}" aria-pressed="${p.id===page}"`)).join('')}</nav>`:''}</div>${o?`<div class="hp-terminal-body hp-register-menu">${catalogue}</div><aside class="hp-terminal-bill hp-register-ticket" aria-label="Active ticket">${quickBill}</aside>`:`<div class="hp-terminal-body">${tileFloor}${layout.mode==='till'?orders:''}</div>`}${panel==="printer"?printerView():o&&panel?root.AkiPosDialogs.view(panel,o,{...data,currency:ctx.workspace.currency},panelLine,paymentAmount):""}</div>`;
  }
  function tableName(o){return o.table_id?data.layout.tables.find(t=>t.id===o.table_id)?.name||o.table_id:o.label;}
  function settings(){const l=data.layout;return `<details class="panel hp-card"><summary>Floor settings</summary>${form('mode',select('PoS view','mode',[['till','Till only'],['restaurant','Restaurant / bar']],l.mode),`data-version="${data.layout_version}"`)}${form('page',input('New page name','name','','text','required maxlength="80"'),`data-version="${data.layout_version}"`)}${l.pages.map(p=>`<details><summary>Page: ${esc(p.name)}</summary>${form('page_edit',input('Page name','name',p.name,'text','required maxlength="80"')+select('Action','operation',[['rename','Rename'],['delete','Delete empty page']]),`data-id="${esc(p.id)}" data-version="${data.layout_version}"`)}</details>`).join('')}<h3>Tables</h3><p>Position and dimensions are percentages of the page. Names can be table numbers. Occupied tables cannot be deleted.</p>${l.pages.length?[...l.tables,{id:'',name:'',page:l.pages[0].id,shape:'rectangle',x:5,y:5,width:15,height:15,seats:4}].map(t=>`<details><summary>${esc(t.name||'Add table')}</summary>${form('table_edit',input('Number / name','name',t.name,'text','required maxlength="80"')+select('Page','page',l.pages.map(p=>[p.id,p.name]),t.page)+select('Shape','shape',[['rectangle','Rectangle'],['circle','Circle / oval'],['rounded','Rounded rectangle']],t.shape)+['x','y','width','height','seats'].map(k=>input(k,k,t[k],'number',`required min="${['x','y'].includes(k)?0:k==='seats'?1:5}" max="${k==='seats'?999:100}" step="1"`)).join('')+select('Action','operation',[['save','Save table'],['delete','Delete table']]),`data-id="${esc(t.id)}" data-version="${data.layout_version}"`)}</details>`).join(''):''}</details>`;}
  function printerView(){
   return root.AkiPrinterStation.render({
    tickets:data?.tickets||[],orders:data?.orders||[],recent:data?.recent||[],current:printTicket,attempted:printAttempted,
    tab:printerFilter,station:printerStation,selectedId:printerSelected,
    canManage:!!data?.can_manage,settings:printerSettings,
    devices:printerDevices,paired:pairedDevice
   });
  }
  async function action(target){const a=target.dataset.action.slice(3);try{
   if(a==='devices'){printerDevices=await rpc('crm_printer_manage',{p_action:'list'});refresh();return;}
   if(a==='device-revoke'){await rpc('crm_printer_manage',{p_action:'revoke',p_details:{id:target.dataset.id}});printerDevices=await rpc('crm_printer_manage',{p_action:'list'});refresh();return;}
   if(a==='pair-download'){
    if(!pairedDevice)throw Error('Pair a device first');
    const config={supabase_url:root.AKIHQ_CONFIG.SUPABASE_URL,publishable_key:root.AKIHQ_CONFIG.SUPABASE_ANON_KEY,device_id:pairedDevice.device_id,token:pairedDevice.token,routes:Object.fromEntries(pairedDevice.stations.map(s=>[s,{type:'tcp',host:'CONFIGURE_PRINTER_LAN_IP',port:9100,columns:42,cut:false}]))};
    const url=root.URL.createObjectURL(new root.Blob([JSON.stringify(config,null,2)],{type:'application/json'}));const link=root.document.createElement('a');link.href=url;link.download='akihq-printer.local.json';link.click();root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);pairedDevice=null;refresh();return;
   }
   if(a==='layout-edit'){layoutDraft=JSON.parse(JSON.stringify(data.layout));layoutVersion=data.layout_version;refresh();return;}
   if(a==='layout-discard'){layoutDraft=null;layoutVersion=null;refresh();return;}
   if(a==='layout-save'){await execute({action:'layout',version:layoutVersion,layout:layoutDraft});layoutDraft=null;layoutVersion=null;refresh();return;}
   if(a==='quick-qty'){enqueueTap('line',target.dataset.order,target.dataset.line,Number(target.dataset.delta));return;}
   if(a==='split-panel'){panel='split';refresh();return;}
   if(a==='payment-panel'){panel='payment';paymentAmount=null;refresh();return;}
   if(a==='printer-panel'){panel='printer';printerSettings=false;printerSelected='';refresh();return;}
   if(a==='printer-filter'){printerFilter=target.dataset.filter;printerSelected='';refresh();return;}
   if(a==='printer-select'){printerSelected=target.dataset.id;refresh();return;}
   if(a==='printer-view'){if(!data.can_manage)throw Error('Manager permission required');printerSettings=target.dataset.view==='settings';if(printerSettings)printerDevices=await rpc('crm_printer_manage',{p_action:'list'});refresh();return;}
   if(a==='printer-confirm'){const id=target.dataset.id;const checked=root.document.querySelector('.hp-ps-paper-check[data-ticket="'+id+'"]')?.checked;if(!checked)throw Error('Inspect the physical paper and tick the confirmation box first.');await execute({action:'confirm_ticket',ticket_id:id});if(printTicket?.id===id){printTicket=null;printAttempted=false;}refresh();return;}
   if(a==='order-panel'){panel='order';refresh();return;}
   if(a==='admin-panel'){if(!data.can_manage)throw Error('Manager permission required');panel='admin';refresh();return;}
   if(a==='edit-item'){panel='line';panelLine=target.dataset.id;refresh();return;}
   if(a==='panel-close'){panel='';panelLine='';refresh();return;}
   if(a==='payment-amount'){const el=root.document.querySelector('.hp-v4-dialog [name="amount"]');if(el)el.value=(Number(target.dataset.cents)/100).toFixed(2);return;}
   if(a==='payment-share'){const o=current(),n=Number(target.dataset.count);if(!o||!Number.isInteger(n)||n<2||n>5)throw Error('Invalid shares');paymentAmount=Math.floor((o.total_cents-o.paid_cents)/n);panel='payment';refresh();return;}
   if(a==='note-preset'){const field=root.document.querySelector('.hp-v4-dialog [name="note"]');if(field){const val=target.dataset.note||'';field.value=[field.value.trim(),val].filter(Boolean).join(', ').slice(0,1000);}return;}
   if(a==='designer-category'){designerCategory=target.dataset.id;refresh();return;}
   if(a==='immersive'){immersive=!immersive;refresh();return;}
   if(a==='switch-view'){view=target.dataset.id==='designer'?'designer':'terminal';panel='';selected='';refresh();return;}
   if(a==='category'){category=target.dataset.id;refresh();return;}
   if(a==='back'){selected='';panel='';refresh();return;}
   if(a==='refresh'){await load();refresh();return;}
   if(a==='page'){page=target.dataset.id;refresh();return;}if(a==='select'){selected=target.dataset.id;panel='';panelLine='';refresh();return;}
   if(a==='retry'){await execute(null,true);return;}
   if(a==='abandon'){if(!root.navigator.locks?.request)throw Error('Use an up-to-date browser over HTTPS');await root.navigator.locks.request(key,{ifAvailable:true},async lock=>{if(!lock)throw Error('Another tab is recording an order');const p=pending();if(p){const r=await rpc('crm_hospitality_command',{p_key:root.crypto.randomUUID(),p_command:{action:'abandon',key:p.key}});root.localStorage.removeItem(key);if(r.response?.order_id)selected=r.response.order_id;ctx.toast('Request resolved',r.already_completed?'It was already recorded.':'Unrecorded request cancelled.');}await load();refresh();});return;}
   if(a.startsWith('print')){if(!printTicket||printAttempted)throw Error('Inspect the printer; request a marked copy if another print is needed');const w=root.open('','_blank','width=420,height=650');if(!w)throw Error('Allow the print window in this browser');w.opener=null;try{await execute({action:'begin_print',ticket_id:printTicket.id});printAttempted=true;}catch(e){w.close();throw e;}w.document.write(ticketHTML(printTicket,ctx.workspace,a==='print58'?58:80));w.document.close();w.focus();w.print();refresh();return;}
   let c={action:a,order_id:target.dataset.order,version:Number(target.dataset.version)};
   if(a==='open')c={action:'open',label:'Walk-in'};
   if(a==='table'){const t=data.layout.tables.find(t=>t.id===target.dataset.id);c={action:'open',table_id:t.id,label:`Table ${t.name}`};}
   if(a==='add'){enqueueTap('product',target.dataset.order,target.dataset.id,1);return;}
   if(['claim','confirm','uncertain'].includes(a)){c={action:`${a}_ticket`,ticket_id:target.dataset.id};if(a==='claim'){printerSelected=target.dataset.id;}}
   await execute(c);if(['confirm','uncertain'].includes(a)){printTicket=null;refresh();}
  }catch(e){if(disposed)return;error=e.message;ctx.toast('PoS needs attention',error,'warning');refresh();}}
  async function submit(f){try{
   const a=f.dataset.form.slice(3),v=Object.fromEntries(new root.FormData(f));
   if(a.startsWith('menu-')){
    if(!data?.can_manage)throw Error('Manager permission required');
    const layout=JSON.parse(JSON.stringify(data.layout)),cfg=root.AkiPosV4.menu(layout);
    cfg.categories=cfg.categories.map(x=>({...x}));
    cfg.products=JSON.parse(JSON.stringify(cfg.products));
    if(a==='menu-category'){
     const name=String(v.name||'').trim();
     if(name.length<1||name.length>48||root.AkiPosV4.groups(layout,data.catalogue).some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('Category name must be unique (1–48 characters)');
     if(cfg.categories.length>=30)throw Error('Category limit reached');
     cfg.categories.push({id:name,name,color:root.AkiPosV4.color(v.color)});
     designerCategory=name;
    }else if(a==='menu-category-edit'){
     const name=String(v.name||'').trim(),id=f.dataset.id;
     if(name.length<1||name.length>48||cfg.categories.some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase()))throw Error('Invalid category name');
     const idx=cfg.categories.findIndex(x=>x.id===id);
     if(idx>=0)cfg.categories[idx]={...cfg.categories[idx],name,color:root.AkiPosV4.color(v.color)};
     else cfg.categories.push({id,name,color:root.AkiPosV4.color(v.color)});
    }else if(a==='menu-product'){
     const p=data.catalogue.find(x=>String(x.id)===f.dataset.id);
     if(!p)throw Error('Product no longer available');
     const name=String(v.label||'').trim();
     if(!name||name.length>80)throw Error('Button name must be 1–80 characters');
     const valid=root.AkiPosV4.groups(layout,data.catalogue).some(g=>g.id===v.category);
     if(!valid||v.category==='All')throw Error('Select a valid category');
     cfg.products[p.id]={...cfg.products[p.id],label:name,category:v.category,color:root.AkiPosV4.color(v.color),hidden:v.hidden==='on'};
    }else if(a==='menu-presets'){
     cfg.presets=[...new Set(String(v.presets||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,12);
     if(cfg.presets.some(x=>x.length>45))throw Error('Shorten notes to 45 characters each');
    }
    layout.menu=cfg;
    await execute({action:'layout',version:data.layout_version,layout});
    return;
   }
   if(a==='pair'){
    pairedDevice=await rpc('crm_printer_manage',{p_action:'pair',p_details:{name:v.name,stations:v.stations==='all'?['kitchen','bar','receipt']:[v.stations]}});printerDevices=await rpc('crm_printer_manage',{p_action:'list'});refresh();return;
   }
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
   if(['payment','move','transfer','line','note','reprice','reverse_payment','cancel'].includes(a)){
    const settled=a==='payment'&&!selected;
    panel=settled?'printer':'';
    if(settled){printerSettings=false;printerFilter='paid';printerSelected='';}
    panelLine='';paymentAmount=null;refresh();
   }
  }catch(e){if(disposed)return;error=e.message;ctx.toast('PoS needs attention',error,'warning');refresh();}}
  return {render,action,submit,dispose(){disposed=true;if(tapTimer!==null)root.clearTimeout(tapTimer);tapJobs.length=0;root.clearInterval(timer);floorEditor?.dispose();root.document.removeEventListener('input',markDirty);root.document.removeEventListener('keydown',escapePanel);root.document.removeEventListener('change',printerOnChange);data=null;printTicket=null;pairedDevice=null;printerDevices=[];}};
 }
 root.AkiHospitality={create,ticketHTML};
})(typeof window==='undefined'?globalThis:window);
