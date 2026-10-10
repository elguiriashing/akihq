/* Modal workflows for shared AkiHQ hospitality commands. */
(function(root){
"use strict";
const E=v=>root.AkiPosV4.esc(v),cash=(v,c)=>root.AkiPosV4.money(v,c);
const form=(name,o,body,extra="")=>'<form class="hp-v4-form" data-form="hp-'+name+'" data-order="'+E(o.id)+'" data-version="'+E(o.version)+'" '+extra+'>'+body+'</form>';
const field=(name,label,value="",type="text",extra="")=>'<label>'+E(label)+'<input name="'+name+'" type="'+type+'" value="'+E(value)+'" '+extra+'></label>';
const select=(name,choices,selected="")=>'<select name="'+name+'">'+choices.map(([v,label])=>'<option value="'+E(v)+'" '+(String(v)===String(selected)?"selected":"")+'>'+E(label)+'</option>').join("")+'</select>';
function view(type,o,data,lineId,amount){
 if(!o)return "";
 const m=root.AkiPosV4.menu(data.layout),cur=data.currency||"EUR",due=Math.max(0,Number(o.total_cents)-Number(o.paid_cents));
 let title="",description="",body="";
 if(type==="payment"){
  title="Record payment";description="Cash collected or payment already completed externally. AkiHQ does not charge cards.";
  body='<div class="hp-v4-amount"><span>Outstanding</span><strong>'+E(cash(due,cur))+'</strong></div><div class="hp-v4-shortcuts">'+[["Full",due],["Half",Math.floor(due/2)],["Third",Math.floor(due/3)],["Quarter",Math.floor(due/4)]].map(([label,cents])=>'<button class="action-btn" type="button" data-action="hp-payment-amount" data-cents="'+cents+'">'+label+'<small>'+E(cash(cents,cur))+'</small></button>').join("")+'</div>';
  body+=form("payment",o,field("amount","Amount (€)",((amount??due)/100).toFixed(2),"number",'min="0.01" max="'+(due/100).toFixed(2)+'" step="0.01" required')+'<label>Payment method'+select("method",[["cash","Cash collected"],["card","External card terminal"],["other","Other external payment"]])+'</label>'+field("tendered","Cash tendered (€), optional","","number",'min="0.01" step="0.01" placeholder="Optional"')+field("reference","External terminal reference","","text",'maxlength="120" placeholder="Required for card / other"')+'<button type="submit" class="action-btn primary">Record payment</button>');
  body+='<p class="hp-v4-warning">Operational payment record, not a fiscal invoice or an automatic bank charge.</p>';
 }else if(type==="split"){
  title="Split & move";description="Split remaining payment or move all or part of the order.";
  body='<h3>Split payment into equal shares</h3><div class="hp-v4-shortcuts">'+[2,3,4,5].map(n=>'<button type="button" class="action-btn" data-action="hp-payment-share" data-count="'+n+'">'+n+' people<small>'+E(cash(Math.floor(due/n),cur))+' each*</small></button>').join("")+'</div><p class="hp-v4-warning">*The final share takes any remainder. Select a share to open payment, then confirm.</p>';
  const tables=[["","New walk-in"],...(data.layout.tables||[]).map(t=>[t.id,t.name])];
  const versions=Object.fromEntries(data.orders.filter(x=>x.table_id).map(x=>[x.table_id,x.version]));
  body+='<details class="hp-v4-detail"><summary>Move entire order</summary>'+form("move",o,'<label>Destination '+select("table_id",tables)+'</label><button class="action-btn primary" type="submit">Move order</button>')+'</details>';
  body+='<details class="hp-v4-detail"><summary>Transfer selected items</summary>'+form("transfer",o,'<label>Destination '+select("table_id",tables)+'</label>'+o.lines.map(l=>field("qty_"+l.id,l.name+" (up to "+l.quantity+")","0","number",'min="0" max="'+E(l.quantity)+'" step="0.001"')).join("")+'<button class="action-btn primary" type="submit">Transfer items</button>','data-destinations="'+E(JSON.stringify(versions))+'"')+'</details>';
 }else if(type==="line"){
  const l=o.lines.find(x=>x.id===lineId);if(!l)return "";
  title="Edit "+l.name;description="Preparation instructions, seats and quantity.";
  body='<div class="hp-v4-shortcuts">'+m.presets.map(p=>'<button type="button" class="action-btn" data-action="hp-note-preset" data-note="'+E(p)+'">'+E(p)+'</button>').join("")+'</div>';
  body+=form("line",o,field("quantity","Quantity",l.quantity,"number",'required min="0" max="999999" step="0.001"')+'<label>Preparation note<textarea name="note" maxlength="1000" rows="3">'+E(l.note||"")+'</textarea></label>'+field("seat","Seat",l.seat||"","text",'maxlength="30"')+'<label>Send to'+select("station",[["bar","Bar"],["kitchen","Kitchen"]],l.station||"bar")+'</label><button type="submit" class="action-btn primary">Save item</button>','data-line="'+E(l.id)+'"');
  body+='<p class="hp-v4-warning">Quick notes do not change price. Monetary modifiers must be created as products in Inventory.</p>';
 }else if(type==="order"){
  title="Order settings";description=o.label||"Active order";
  body=form("note",o,field("guests","Guests",o.guests,"number",'min="1" max="999" required')+'<label>Order note<textarea name="note" maxlength="2000" rows="4">'+E(o.note||"")+'</textarea></label><button type="submit" class="action-btn primary">Save order</button>');
 }else if(type==="admin"){
  title="Manager corrections";description="Audited actions. An external refund must be performed separately.";
  body=form("reprice",o,field("reason","Repricing reason","","text",'required minlength="3" maxlength="500"')+'<button class="action-btn primary" type="submit">Update pricing from catalogue</button>');
  const payments=o.payments.filter(p=>p.amount_cents>0&&!o.payments.some(x=>x.reverses===p.id)).map(p=>[p.id,p.method+" "+cash(p.amount_cents,cur)]);
  body+=form("reverse_payment",o,'<label>Payment to reverse'+select("payment_id",payments)+'</label>'+field("reason","Reason","","text",'required minlength="3" maxlength="500"')+'<button type="submit" class="action-btn">Record reversal</button>');
  body+=form("cancel",o,field("reason","Cancellation reason","","text",'required minlength="3" maxlength="500"')+'<button type="submit" class="action-btn">Cancel order</button>');
 }
 if(!title)return "";
 return '<div class="hp-v4-overlay"><button type="button" class="hp-v4-backdrop" data-action="hp-panel-close" aria-label="Close dialog"></button><section class="hp-v4-dialog" role="dialog" aria-modal="true" aria-label="'+E(title)+'"><header><div><h2>'+E(title)+'</h2><p>'+E(description)+'</p></div><button type="button" class="action-btn" data-action="hp-panel-close" aria-label="Close">✕</button></header><div class="hp-v4-dialog-body">'+body+'</div></section></div>';
}
root.AkiPosDialogs={view};
})(typeof window==="undefined"?globalThis:window);