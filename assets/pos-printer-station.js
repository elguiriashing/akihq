/* AkiHQ printer station: ticket inbox, explicit print/review steps, manager device settings.
   This view never assumes paper was printed or retries uncertain jobs automatically. */
(function(root){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const short=v=>String(v||"").slice(0,8);
const time=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"Unknown time":d.toLocaleString(undefined,{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"})};
const statusText={queued:"Ready to print",claimed:"Printing / awaiting check",uncertain:"Needs paper check",confirmed:"Confirmed printed"};
const stationText={kitchen:"Kitchen",bar:"Bar",receipt:"Receipt"};
const ticketText={preparation:"Preparation",prebill:"Pre-bill",payment:"Payment receipt",relocation:"Table transfer",cancellation:"Cancellation",note_change:"Note update"};
const button=(action,label,more="",klass="")=>'<button type="button" class="action-btn '+klass+'" data-action="hp-'+action+'" '+more+'>'+esc(label)+'</button>';
const scope=(x)=>'data-id="'+esc(x.id)+'"';
const count=(tickets,status)=>tickets.filter(t=>t.status===status).length;
function summaryCards(tickets){
 const n={queued:count(tickets,"queued"),claimed:count(tickets,"claimed"),uncertain:count(tickets,"uncertain"),confirmed:count(tickets,"confirmed")};
 return '<div class="hp-ps-stats"><div><strong>'+n.queued+'</strong><span>To print</span></div><div><strong>'+n.claimed+'</strong><span>Awaiting check</span></div><div class="'+(n.uncertain?'hp-ps-alert':'')+'"><strong>'+n.uncertain+'</strong><span>Needs review</span></div><div><strong>'+n.confirmed+'</strong><span>Confirmed</span></div></div>';
}
function ticketName(t){return ticketText[t.kind]||String(t.kind||"Ticket").replace(/_/g," ")}
function stationName(t){return stationText[t.station]||t.station||"Other"}
function filtered(tickets,tab,station){
 let a=tickets.filter(t=>station==="all"||t.station===station);
 if(tab==="pending")a=a.filter(t=>t.status!=="confirmed");
 else if(tab==="queued")a=a.filter(t=>t.status==="queued");
 else if(tab==="review")a=a.filter(t=>t.status==="uncertain"||t.status==="claimed");
 else if(tab==="history")a=a.filter(t=>t.status==="confirmed");
 return a.slice().sort((a,b)=>tab==="history"?new Date(b.created_at)-new Date(a.created_at):new Date(a.created_at)-new Date(b.created_at));
}
function printActions(t,current,attempted){
 const active=current?.id===t.id;
 if(t.status==="queued"){
  return '<div class="hp-ps-primary-action">'+button("claim","Open ticket for printing",scope(t),"primary")+'</div><p class="hp-ps-hint">Opening reserves this ticket for your device. Choose paper width before printing.</p>';
 }
 if(t.status==="claimed"&&active&&!attempted){
  return '<div class="hp-ps-primary-action"><p>Choose receipt paper width</p><div class="hp-ps-print-width">'+button("print58","Print 58 mm","","primary")+button("print80","Print 80 mm","","primary")+'</div></div><p class="hp-ps-hint">The print dialog will open. A cancelled print still requires you to check the paper before marking the result.</p>';
 }
 if(t.status==="claimed"||t.status==="uncertain"){
  const uncertain=t.status==="uncertain";
  return '<div class="hp-ps-review"><p class="hp-ps-warning">'+(uncertain?'This ticket has an uncertain print outcome. Inspect the printer and paper before acting.':'Another session may have claimed this ticket, or the print dialogue was interrupted. Inspect the paper before acting.')+'</p><label class="hp-ps-verify"><input type="checkbox" class="hp-ps-paper-check" data-ticket="'+esc(t.id)+'"> I personally checked that this ticket printed correctly</label><div class="hp-ps-primary-action">'+button("printer-confirm","Confirm paper printed",scope(t),"primary")+(active?button("uncertain","Mark uncertain",scope(t)):"")+'</div></div>';
 }
 return '<div class="hp-ps-done"><strong>✓ Printing confirmed</strong><p>Kept as a completed ticket in the history.</p></div>';
}
function copyForm(t){
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
 return '<div class="hp-ps-detail"><div class="hp-ps-detail-head"><span class="hp-ps-destination">'+esc(stationName(t))+'</span><span class="hp-ps-status status-'+esc(t.status)+'">'+esc(statusText[t.status]||t.status)+'</span></div><h3>'+esc(ticketName(t))+'</h3><p class="hp-ps-subheading">'+esc(time(t.created_at))+' · Ticket #'+esc(short(t.id))+'</p>'+preview(t,current)+printActions(t,current,attempted)+copyForm(t)+'<p class="hp-ps-legal">Operational ticket only. Printing is not evidence of fiscal invoice issuance.</p></div>';
}
function list(tickets,selectedId){
 if(!tickets.length)return '<div class="hp-ps-empty"><strong>Nothing here</strong><p>Tickets will appear here when orders are sent or billed.</p></div>';
 return tickets.map(t=>'<button type="button" class="hp-ps-ticket '+(selectedId===t.id?'selected':'')+'" data-action="hp-printer-select" '+scope(t)+' aria-pressed="'+(selectedId===t.id)+'"><span class="hp-ps-ticket-main"><strong>'+esc(ticketName(t))+'</strong><small>'+esc(stationName(t))+' · '+esc(time(t.created_at))+'</small></span><span class="hp-ps-ticket-status status-'+esc(t.status)+'">'+esc(statusText[t.status]||t.status)+'</span><span class="hp-ps-ticket-arrow" aria-hidden="true">›</span></button>').join("");
}
function devicesView(devices,paired){
 return '<div class="hp-ps-devices"><div class="hp-ps-setup-intro"><h3>Paired printer stations</h3><p>For unattended printing, run the paired AkiHQ print agent on the bar computer. Pairing does not prove a printer is online.</p></div>'+button("devices","Refresh device list")+'<div class="hp-ps-device-list">'+(devices.length?devices.map(d=>'<div class="hp-ps-device"><div><strong>'+esc(d.name)+'</strong><small>'+esc(d.revoked_at?'Revoked':'Paired · Expires '+String(d.expires_at||"").slice(0,10))+'</small><small>Last seen: '+esc(d.last_seen_at||"Never")+'</small></div>'+(!d.revoked_at?button("device-revoke","Revoke",scope(d)):'')+'</div>').join(""):'<p>No paired devices listed. Use Refresh to check current connections.</p>')+'</div>'+
 '<form class="hp-ps-pair" data-form="hp-pair"><h4>Pair a new print agent</h4><label>Device name<input name="name" required maxlength="80" placeholder="e.g. Bar till"></label><label>Print destinations<select name="stations"><option value="all">Kitchen, bar and receipts</option><option value="kitchen">Kitchen only</option><option value="bar">Bar only</option><option value="receipt">Receipts only</option></select></label><button type="submit" class="action-btn primary">Create pairing</button></form>'+
 (paired?'<div class="hp-ps-pair-ready"><strong>One-time pairing file ready</strong><p>Download now and store outside the website folder. The secret is shown only once.</p>'+button("pair-download","Download pairing file","","primary")+'</div>':'')+
 '<div class="hp-ps-hint">Supports network ESC/POS and configured CUPS queues through the local agent. Spooling does not confirm physical paper output.</div></div>';
}
function render(p){
 const t=Array.isArray(p.tickets)?p.tickets:[],tab=p.tab||"pending",station=p.station||"all";
 const visible=filtered(t,tab,station),sel=visible.find(x=>x.id===p.selectedId)||visible[0]||null;
 const tabs=[["pending","Attention"],["queued","To print"],["review","Check paper"],["history","History"],["all","All"]];
 const stationOptions=[["all","All printers"],["kitchen","Kitchen"],["bar","Bar"],["receipt","Receipts"]];
 return '<div class="hp-v4-overlay hp-ps-overlay"><button class="hp-v4-backdrop" data-action="hp-panel-close" type="button" aria-label="Close printer station"></button><section class="hp-v4-dialog hp-printer-dialog" role="dialog" aria-modal="true" aria-label="Printer station"><header class="hp-ps-header"><div><span class="hp-ps-eyebrow">AKIHQ / PRINTING</span><h2>Printer station</h2><p>Review tickets, print once, and confirm the result.</p></div><div class="hp-ps-header-actions">'+(p.canManage?button("printer-view",p.settings?"Ticket queue":"Printer settings",'data-view="'+(p.settings?"tickets":"settings")+'"'):"")+button("panel-close","Close")+'</div></header><div class="hp-ps-body">'+(p.settings?devicesView(p.devices||[],p.paired):summaryCards(t)+'<div class="hp-ps-controls"><nav class="hp-ps-filters" aria-label="Ticket status">'+tabs.map(([id,label])=>button("printer-filter",label,'data-filter="'+id+'" aria-pressed="'+(tab===id)+'"')).join("")+'</nav><label class="hp-ps-station-label">Destination <select class="hp-ps-station-select" data-printer-station>'+stationOptions.map(([id,label])=>'<option value="'+id+'" '+(id===station?'selected':'')+'>'+label+'</option>').join("")+'</select></label></div><div class="hp-ps-workspace"><div class="hp-ps-list" aria-label="Tickets">'+list(visible,sel?.id)+'</div>'+ticketDetail(sel,p.current,p.attempted)+'</div>')+'</div></section></div>';
}
root.AkiPrinterStation={render,filtered,statusText};
})(typeof window==="undefined"?globalThis:window);
