/* AkiHQ printer station: ticket inbox, explicit print/review steps, manager device settings.
   This view never assumes paper was printed or retries uncertain jobs automatically. */
(function(root){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const short=v=>String(v||"").slice(0,8);
const time=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"Unknown time":d.toLocaleString(undefined,{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"})};
const statusText={queued:"Ready to print",claimed:"Printing / awaiting check",uncertain:"Needs paper check",confirmed:"Confirmed printed",spooled:"Spool accepted · check paper",superseded:"Archived after settlement"};
const stationText={kitchen:"Kitchen",bar:"Bar",receipt:"Receipt"};
const ticketText={preparation:"Preparation",prebill:"Pre-bill",payment:"Payment receipt",relocation:"Table transfer",cancellation:"Cancellation",note_change:"Note update"};
const button=(action,label,more="",klass="")=>'<button type="button" class="action-btn '+klass+'" data-action="hp-'+action+'" '+more+'>'+esc(label)+'</button>';
const scope=(x)=>'data-id="'+esc(x.id)+'"';
const destinationOf=t=>{
 if(t.kind==="payment")return "paid";
 if(t.kind==="prebill")return "unpaid";
 if(t.station==="kitchen"||t.station==="bar")return "kitchen";
 return "archive";
};
function effectiveState(t,orders=[],recent=[]){
 if(t.order_status==="open"||t.order_status==="closed"||t.order_status==="cancelled")return t.order_status;
 const order=[...orders,...recent].find(o=>String(o.id)===String(t.order_id));
 return order?.status||"unknown";
}
function decorate(tickets,orders=[],recent=[]){
 return (tickets||[]).map(t=>{
  const order_status=effectiveState(t,orders,recent);
  const group=destinationOf(t);
  // A closed table is no longer a preparation/unpaid job. Final payment
  // receipts remain available until printing; all original tickets stay in evidence.
  const active=order_status==="open"&&["kitchen","unpaid"].includes(group)&&["queued","claimed","uncertain"].includes(t.status)
    ||order_status==="closed"&&group==="paid"&&["queued","claimed","uncertain"].includes(t.status);
  const order_label=t.order_label||[...orders,...recent].find(o=>String(o.id)===String(t.order_id))?.label||"Order";
  return {...t,order_status,order_label,group,active};
 });
}
const count=(tickets,group)=>tickets.filter(t=>t.active&&t.group===group).length;
function summaryCards(tickets){
 const counts={kitchen:count(tickets,"kitchen"),unpaid:count(tickets,"unpaid"),paid:count(tickets,"paid"),archive:tickets.filter(t=>!t.active).length};
 return '<div class="hp-ps-stats hp-ps-dest-stats"><div><strong>'+counts.kitchen+'</strong><span>Kitchen / Bar</span></div><div><strong>'+counts.unpaid+'</strong><span>Unpaid bills</span></div><div><strong>'+counts.paid+'</strong><span>Paid bills</span></div><div><strong>'+counts.archive+'</strong><span>History & reviews</span></div></div>';
}
function ticketName(t){
 if(t.kind==="prebill")return "Client bill · unpaid";
 if(t.kind==="payment")return "Client bill · paid";
 return ticketText[t.kind]||String(t.kind||"Ticket").replace(/_/g," ");
}
function stationName(t){return stationText[t.station]||t.station||"Other"}
function filtered(tickets,tab,station,orders=[],recent=[]){
 const decorated=decorate(tickets,orders,recent);
 const visible=decorated.filter(t=>tab==="archive"?!t.active:t.active&&t.group===tab)
   .filter(t=>tab!=="kitchen"||station==="all"||t.station===station);
 return visible.sort((a,b)=>tab==="archive"?new Date(b.created_at)-new Date(a.created_at):new Date(a.created_at)-new Date(b.created_at));
}
function printActions(t,current,attempted){
 if(t.status==="superseded"||(!t.active&&t.status==="queued")||t.order_status==="unknown")return '<div class="hp-ps-done"><strong>Archived · no longer in the active print queue</strong><p>This job is retained for review. It will not print automatically or be re-sent after the bill is settled.</p></div>';
 if(t.status==="spooled")return '<div class="hp-ps-warning">Sent to the printer spool. This does not confirm paper output. Check the device before requesting a marked copy.</div>';
 const active=current?.id===t.id;
 if(t.status==="queued"){
  return '<div class="hp-ps-primary-action">'+button("claim","Open ticket for printing",scope(t),"primary")+'</div><p class="hp-ps-hint">Opening reserves this ticket for your device. Choose paper width before printing.</p>';
 }
 if(t.status==="claimed"&&active&&t.active&&!attempted){
  return '<div class="hp-ps-primary-action"><p>Choose receipt paper width</p><div class="hp-ps-print-width">'+button("print58","Print 58 mm","","primary")+button("print80","Print 80 mm","","primary")+'</div></div><p class="hp-ps-hint">The print dialog will open. A cancelled print still requires you to check the paper before marking the result.</p>';
 }
 if(t.status==="claimed"||t.status==="uncertain"){
  const uncertain=t.status==="uncertain";
  return '<div class="hp-ps-review"><p class="hp-ps-warning">'+(uncertain?'This ticket has an uncertain print outcome. Inspect the printer and paper before acting.':'Another session may have claimed this ticket, or the print dialogue was interrupted. Inspect the paper before acting.')+'</p><label class="hp-ps-verify"><input type="checkbox" class="hp-ps-paper-check" data-ticket="'+esc(t.id)+'"> I personally checked that this ticket printed correctly</label><div class="hp-ps-primary-action">'+button("printer-confirm","Confirm paper printed",scope(t),"primary")+(active?button("uncertain","Mark uncertain",scope(t)):"")+'</div></div>';
 }
 return '<div class="hp-ps-done"><strong>✓ Printing confirmed</strong><p>Kept as a completed ticket in the history.</p></div>';
}
function copyForm(t){
 if(t.status==="superseded"||(t.order_status==="closed"&&t.group!=="paid")||t.order_status==="unknown")return "";
 return '<details class="hp-ps-copy"><summary>Need another copy?</summary><p>Only request a new copy after checking the original. The new ticket is explicitly marked COPY.</p><form data-form="hp-reprint" data-id="'+esc(t.id)+'"><label>Reason for another copy<input name="reason" type="text" minlength="3" maxlength="500" required placeholder="e.g. Paper jam on the original"></label><button type="submit" class="action-btn">Queue marked COPY</button></form></details>';
}
function preview(t,current){
 const payload=current?.id===t.id?current.payload:null;
 if(!payload)return '<div class="hp-ps-no-preview">The protected ticket contents become available when you open a queued ticket for printing. Existing claimed tickets must be checked at the printer before requesting a copy.</div>';
 const ord=payload.order||payload.after||{};
 const lines=Array.isArray(payload.current)?payload.current:Array.isArray(ord.lines)?ord.lines:[];
 return '<div class="hp-ps-preview"><h4>Ticket preview</h4><div class="hp-ps-order-label">'+esc(ord.label||"Order")+'</div>'+ (payload.instruction?'<p>'+esc(payload.instruction)+'</p>':'')+(lines.length?'<ul>'+lines.slice(0,35).map(l=>'<li><strong>'+esc(l.quantity)+' × '+esc(l.name)+'</strong><span>'+esc(l.note||"")+'</span></li>').join("")+'</ul>':'<p>No line preview available for this ticket.</p>')+'</div>';
}
function ticketDetail(t,current,attempted){
 if(!t)return '<div class="hp-ps-empty-detail"><span>🧾</span><h3>No tickets in this view</h3><p>Try a different status or printer destination.</p></div>';
 return '<div class="hp-ps-detail"><div class="hp-ps-detail-head"><span class="hp-ps-destination">'+esc(stationName(t))+'</span><span class="hp-ps-status status-'+esc(t.status)+'">'+esc(statusText[t.status]||t.status)+'</span></div><h3>'+esc(ticketName(t))+'</h3><p class="hp-ps-order-label">'+esc(t.order_label||"Order")+'</p><p class="hp-ps-subheading">'+esc(time(t.created_at))+' · Ticket #'+esc(short(t.id))+'</p>'+preview(t,current)+printActions(t,current,attempted)+copyForm(t)+'<p class="hp-ps-legal">Operational ticket only. Printing is not evidence of fiscal invoice issuance.</p></div>';
}
function list(tickets,selectedId){
 if(!tickets.length)return '<div class="hp-ps-empty"><strong>Nothing here</strong><p>Tickets will appear here when orders are sent or billed.</p></div>';
 return tickets.map(t=>'<button type="button" class="hp-ps-ticket '+(selectedId===t.id?'selected':'')+'" data-action="hp-printer-select" '+scope(t)+' aria-pressed="'+(selectedId===t.id)+'"><span class="hp-ps-ticket-main"><strong>'+esc(ticketName(t))+'</strong><small>'+esc(t.order_label||"Order")+' · '+esc(stationName(t))+' · '+esc(time(t.created_at))+'</small></span><span class="hp-ps-ticket-status status-'+esc(t.status)+'">'+esc(statusText[t.status]||t.status)+'</span><span class="hp-ps-ticket-arrow" aria-hidden="true">›</span></button>').join("");
}
function devicesView(devices,paired){
 return '<div class="hp-ps-devices"><div class="hp-ps-setup-intro"><h3>Paired printer stations</h3><p>For unattended printing, run the paired AkiHQ print agent on the bar computer. Pairing does not prove a printer is online.</p></div>'+button("devices","Refresh device list")+'<div class="hp-ps-device-list">'+(devices.length?devices.map(d=>'<div class="hp-ps-device"><div><strong>'+esc(d.name)+'</strong><small>'+esc(d.revoked_at?'Revoked':'Paired · Expires '+String(d.expires_at||"").slice(0,10))+'</small><small>Last seen: '+esc(d.last_seen_at||"Never")+'</small></div>'+(!d.revoked_at?button("device-revoke","Revoke",scope(d)):'')+'</div>').join(""):'<p>No paired devices listed. Use Refresh to check current connections.</p>')+'</div>'+
 '<form class="hp-ps-pair" data-form="hp-pair"><h4>Pair a new print agent</h4><label>Device name<input name="name" required maxlength="80" placeholder="e.g. Bar till"></label><label>Print destinations<select name="stations"><option value="all">Kitchen, bar and receipts</option><option value="kitchen">Kitchen only</option><option value="bar">Bar only</option><option value="receipt">Receipts only</option></select></label><button type="submit" class="action-btn primary">Create pairing</button></form>'+
 (paired?'<div class="hp-ps-pair-ready"><strong>One-time pairing file ready</strong><p>Download now and store outside the website folder. The secret is shown only once.</p>'+button("pair-download","Download pairing file","","primary")+'</div>':'')+
 '<div class="hp-ps-hint">Supports network ESC/POS and configured CUPS queues through the local agent. Spooling does not confirm physical paper output.</div></div>';
}
function render(p){
 const ticketData=Array.isArray(p.tickets)?p.tickets:[],tab=p.tab||"kitchen",station=p.station||"all",
  all=decorate(ticketData,p.orders,p.recent);
 const visible=filtered(ticketData,tab,station,p.orders,p.recent),
  sel=visible.find(x=>x.id===p.selectedId)||visible[0]||null;
 const tabs=[["kitchen","Kitchen / Bar"],["unpaid","Client Bill Unpaid"],["paid","Client Bill Paid"],["archive","History & Review"]];
 const stationOptions=[["all","Kitchen + Bar"],["kitchen","Kitchen"],["bar","Bar"]];
 return '<div class="hp-v4-overlay hp-ps-overlay"><button class="hp-v4-backdrop" data-action="hp-panel-close" type="button" aria-label="Close printer station"></button><section class="hp-v4-dialog hp-printer-dialog" role="dialog" aria-modal="true" aria-label="Printer station"><header class="hp-ps-header"><div><span class="hp-ps-eyebrow">AKIHQ / PRINTING</span><h2>Printer station</h2><p>Send preparation changes, print an unpaid bill, then give the customer their paid bill.</p></div><div class="hp-ps-header-actions">'+(p.canManage?button("printer-view",p.settings?"Ticket queues":"Printer settings",'data-view="'+(p.settings?"tickets":"settings")+'"'):"")+button("panel-close","Close")+'</div></header><div class="hp-ps-body">'+(p.settings?devicesView(p.devices||[],p.paired):summaryCards(all)+'<div class="hp-ps-flow-guide"><span><strong>1</strong> Send changes to Kitchen / Bar</span><span><strong>2</strong> Pre-bill when requested</span><span><strong>3</strong> Paid bill when settled</span></div><div class="hp-ps-controls"><nav class="hp-ps-filters hp-ps-destinations" aria-label="Ticket destination">'+tabs.map(([id,label])=>button("printer-filter",label,'data-filter="'+id+'" aria-pressed="'+(tab===id)+'"')).join("")+'</nav>'+(tab==="kitchen"?'<label class="hp-ps-station-label">Station <select class="hp-ps-station-select" data-printer-station>'+stationOptions.map(([id,label])=>'<option value="'+id+'" '+(id===station?'selected':'')+'>'+label+'</option>').join("")+'</select></label>':'')+'</div><div class="hp-ps-workspace"><div class="hp-ps-list" aria-label="Tickets">'+list(visible,sel?.id)+'</div>'+ticketDetail(sel,p.current,p.attempted)+'</div><p class="hp-ps-archive-hint">Paid tables leave Kitchen / Bar and Unpaid automatically. Old jobs remain in History for audit and printer-failure review. Only the final paid bill remains printable.</p>')+'</div></section></div>';
}

root.AkiPrinterStation={render,filtered,decorate,destinationOf,statusText};
})(typeof window==="undefined"?globalThis:window);
