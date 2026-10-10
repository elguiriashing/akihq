/* Closed bill lookup + operational trading-day reports. All figures returned by guarded RPC. */
(function(root){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(n,c="EUR")=>new Intl.NumberFormat(undefined,{style:"currency",currency:c}).format(Number(n||0)/100);
const dateTime=(d,tz)=>{try{return new Intl.DateTimeFormat(undefined,{timeZone:tz||"Europe/Madrid",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(d))}catch{return "Date unavailable"}};
const labelDay=(d,tz)=>String(d.label||"").trim()||"Trading day · "+dateTime(d.started_at,tz);
const button=(action,label,attrs="",klass="")=>'<button type="button" class="action-btn '+klass+'" data-action="hp-'+action+'" '+attrs+'>'+esc(label)+'</button>';
const formatShift=(d,tz,c)=>'<span>'+esc(labelDay(d,tz))+'</span><small>'+esc(dateTime(d.started_at,tz))+' → '+(d.ended_at?esc(dateTime(d.ended_at,tz)):'In progress')+'</small><strong>'+money(d.total_cents,c)+'</strong>';
const percent=raw=>Number.isFinite(Number(raw))?Number(raw):0;
function summary(p){
 const z=p.data?.summary||{},c=p.currency,active=p.data?.active_day;
 const groups=[["Current trading day",z.active_cents,z.active_count,active?"Running total":"No active day"],["Today (calendar)",z.calendar_cents,z.calendar_count,"Local midnight to now"],["This week",z.week_cents,z.week_count,"Monday to now"]];
 return '<div class="hp-ledger-metrics">'+groups.map(([name,amount,count,desc])=>'<div class="hp-ledger-metric"><span>'+esc(name)+'</span><strong>'+money(amount,c)+'</strong><small>'+esc(count||0)+' closed bills · '+esc(desc)+'</small></div>').join("")+'</div>';
}
function shiftPanel(p){
 const active=p.data?.active_day,canManage=p.canManage,tz=p.data?.timezone;
 if(!active)return '<section class="hp-day-panel hp-day-idle"><div><span class="hp-ledger-kicker">TRADING DAY</span><h3>No trading day started</h3><p>Closed bills remain in the full audit even without a trading day. Start one when the venue opens to group sales across midnight.</p></div>'+(canManage?button("day-start","▶ Start trading day","","primary"):'<span class="hp-ledger-muted">A manager can start the trading day.</span>')+'</section>';
 return '<section class="hp-day-panel hp-day-live"><div><span class="hp-ledger-kicker">● TRADING DAY LIVE</span><h3>'+esc(labelDay(active,tz))+'</h3><p>Started '+esc(dateTime(active.started_at,tz))+' · Continues across midnight until manually ended.</p></div><div class="hp-day-actions">'+button("ledger-open-day","View running report",'data-id="'+esc(active.id)+'"')+(canManage?button("day-end","End trading day","","primary"):'')+'</div></section>';
}
function chooser(p){
 const f=p.filters||{},staff=p.data?.staff||[],days=p.data?.trading_days||[],tz=p.data?.timezone;
 const field=(name,label,value="",type="text",place="")=>'<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" placeholder="'+esc(place)+'"></label>';
 return '<form class="hp-ledger-filters" data-form="hp-ledger-search">'+
 '<div class="hp-ledger-filter-row">'+field("from_date","From date",f.from_date||"","date")+field("to_date","Through date",f.to_date||"","date")+field("table","Table",f.table||"","text","Table 12")+
 '<label>Closing account<select name="account"><option value="">All staff</option>'+staff.map(a=>'<option value="'+esc(a.actor_id)+'" '+(a.actor_id===f.account?"selected":"")+'>'+esc(a.actor_name)+'</option>').join("")+'</select></label></div>'+
 '<div class="hp-ledger-filter-row">'+field("item","Product / item",f.item||"","text","Beer, Coke, fries...")+field("min_eur","Min bill (€)",f.min_eur||"","number","0.00")+field("max_eur","Max bill (€)",f.max_eur||"","number","0.00")+
 '<label>Trading day<select name="trading_day"><option value="">All trading days</option><option value="unassigned" '+(f.trading_day==="unassigned"?"selected":"")+'>Before tracking / unassigned</option>'+days.map(d=>'<option value="'+esc(d.id)+'" '+(d.id===f.trading_day?"selected":"")+'>'+esc(labelDay(d,tz))+'</option>').join("")+'</select></label></div>'+
 '<div class="hp-ledger-filter-actions"><button class="action-btn primary" type="submit">Search closed bills</button>'+button("ledger-reset","Clear filters")+'</div></form>';
}
function results(p){
 const d=p.data||{},rows=d.rows||[],pages=Math.ceil(Number(d.total_count||0)/Number(d.limit||30)),page=Math.floor(Number(d.offset||0)/Number(d.limit||30))+1;
 return '<div class="hp-ledger-results"><div class="hp-ledger-result-title"><h3>Closed bills</h3><span>'+Number(d.total_count||0).toLocaleString()+' results</span></div>'+
 (rows.length?'<div class="hp-ledger-list" role="list">'+rows.map(r=>'<button type="button" class="hp-ledger-bill" role="listitem" data-action="hp-ledger-bill" data-id="'+esc(r.id)+'"><span class="hp-ledger-bill-main"><strong>'+esc(r.label||"Walk-in")+'</strong><small>'+esc(dateTime(r.closed_at,d.timezone))+' · '+esc(r.closed_by_name||"Unknown account")+'</small></span><span class="hp-ledger-bill-items">'+esc((r.lines||[]).map(l=>l.quantity+" × "+l.name).slice(0,3).join(", "))+'</span><strong>'+money(r.total_cents,p.currency)+'</strong><span aria-hidden="true">›</span></button>').join("")+'</div>':
 '<div class="hp-ledger-empty">No closed bills match these filters. Try expanding the date range or clearing a filter.</div>')+
 '<div class="hp-ledger-pages"><span>Page '+page+' of '+Math.max(1,pages)+'</span>'+button("ledger-page","Previous",'data-offset="'+Math.max(0,Number(d.offset||0)-Number(d.limit||30))+'" '+(!d.offset?'disabled':''))+button("ledger-page","Next",'data-offset="'+(Number(d.offset||0)+Number(d.limit||30))+'" '+(page>=pages?'disabled':''))+'</div></div>';
}
function archives(p){
 const days=p.data?.trading_days||[],tz=p.data?.timezone;
 return '<div class="hp-ledger-archive"><div class="hp-ledger-result-title"><h3>Trading day archive</h3><span>Each day closes when the manager ends it, not at midnight.</span></div>'+
 (days.length?days.map(d=>'<button type="button" data-action="hp-ledger-open-day" data-id="'+esc(d.id)+'" class="hp-ledger-shift">'+formatShift(d,tz,p.currency)+'<span class="hp-ledger-shift-count">'+esc(d.bill_count||0)+' closed bills →</span></button>').join(""):'<div class="hp-ledger-empty">No trading days archived yet. Open a day above to begin tracking.</div>')+'</div>';
}
function billDetails(p){
 const b=(p.data?.rows||[]).find(x=>x.id===p.selected);
 if(!b)return '';
 const tz=p.data.timezone,c=p.currency;
 return '<div class="hp-ledger-backdrop"><button class="hp-ledger-dim" type="button" data-action="hp-ledger-close" aria-label="Close bill details"></button><section class="hp-ledger-drawer" role="dialog" aria-modal="true" aria-label="Closed bill details"><header><div><span class="hp-ledger-kicker">CLOSED BILL · '+esc(String(b.id).slice(0,8))+'</span><h2>'+esc(b.label||"Walk-in")+'</h2><p>'+esc(dateTime(b.closed_at,tz))+' · Closed by '+esc(b.closed_by_name||"Unknown account")+'</p></div>'+button("ledger-close","✕ Close")+'</header><div class="hp-ledger-drawer-scroll"><div class="hp-ledger-detail-total"><span>Final bill total</span><strong>'+money(b.total_cents,c)+'</strong></div><h3>Products</h3><div class="hp-ledger-detail-lines">'+(b.lines||[]).map(l=>'<div><span>'+esc(l.quantity)+' × '+esc(l.name)+'</span><strong>'+money(Number(l.quantity)*Number(l.unit_price_cents),c)+'</strong></div>').join("")+'</div><h3>Recorded payments</h3><div class="hp-ledger-detail-lines">'+(b.payments||[]).map(x=>'<div><span>'+esc(x.method||"Payment")+'</span><strong>'+money(x.amount_cents,c)+'</strong></div>').join("")+'</div><h3>Activity trail</h3><div class="hp-ledger-timeline">'+(b.history||[]).map(e=>'<div><strong>'+esc(e.action||"Event")+'</strong><small>'+esc(dateTime(e.at,tz))+' · '+esc(e.actor||"Staff")+'</small></div>').join("")+'</div><p class="hp-ledger-disclaimer">Operational ledger from persisted order and audit records. This is not a fiscal invoice or certified cash-drawer close.</p></div></section></div>';
}
function endConfirmation(p){
 const active=p.data?.active_day;
 if(!active||!p.confirmEnd)return "";
 return '<div class="hp-ledger-backdrop"><button class="hp-ledger-dim" data-action="hp-day-cancel" type="button" aria-label="Keep trading day open"></button><section class="hp-ledger-confirm" role="dialog" aria-modal="true" aria-label="End trading day"><h2>End this trading day?</h2><p>Sales will stop accumulating under this trading-day window. New closed bills will be unassigned until the next day is started.</p><div><strong>'+money(p.data?.summary?.active_cents,p.currency)+'</strong><small>'+esc(p.data?.summary?.active_count||0)+' closed bills recorded</small></div><p>Unpaid tables are not cancelled. If they are paid after the day ends, that sale belongs to the trading day active at settlement.</p><footer>'+button("day-cancel","Keep day open")+button("day-confirm","End & archive day",'','primary')+'</footer></section></div>';
}
function render(p){
 const d=p.data||{},active=p.mode||"bills";
 return '<div class="hp-ledger-shell">'+
 '<div class="hp-ledger-top"><div><span class="hp-ledger-kicker">AKIHQ / POINT OF SALE</span><h2>Sales lookup & trading days</h2><p>Every closed bill, searchable and grouped by your venue’s actual trading hours.</p></div>'+button("ledger-refresh","↻ Refresh records")+'</div>'+
 (p.error?'<div class="hp-ledger-error" role="alert">'+esc(p.error)+'</div>':'')+
 shiftPanel(p)+summary(p)+
 '<nav class="hp-ledger-tabs">'+button("ledger-mode","Closed bill lookup",'data-mode="bills" aria-pressed="'+(active==="bills")+'"')+button("ledger-mode","Trading day archive",'data-mode="days" aria-pressed="'+(active==="days")+'"')+'</nav>'+
 (active==="days"?archives(p):chooser(p)+results(p))+
 (p.loading?'<p class="hp-ledger-loading" role="status">Refreshing records…</p>':'')+
 '<p class="hp-ledger-disclaimer">Sales totals use fully settled closed bills; a partial payment does not count twice. Existing bills before tracking was enabled are still searchable, but may be unassigned to a trading day.</p>'+
 billDetails(p)+endConfirmation(p)+'</div>';
}
root.AkiPosLedger={render,money,dateTime,labelDay,esc};
})(typeof window==="undefined"?globalThis:window);