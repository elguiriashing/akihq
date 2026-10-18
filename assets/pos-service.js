/* Read-only service intelligence. Order mutations still use the existing versioned RPC. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalise = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const copy = {
    en: {terminal:'Terminal',service:'Service',tools:'Tools',designer:'PoS designer',ledger:'Lookup & shifts',fullscreen:'Full screen',exit:'Exit full screen',searchProducts:'Search products',searchHint:'Name, button label or category',clear:'Clear search',favourites:'Favourites',favourite:'Favourite',matches:'matches',noProducts:'No matching products',resetProducts:'Clear search and favourites, or choose another category.',stock:'Check stock',stockDetail:'Recorded Main stock. Open orders do not reserve stock.',serviceTitle:'Service overview',serviceHint:'All open tables and walk-ins, without leaving the till.',open:'Open bills',guests:'Guests',due:'Outstanding',changes:'Unsent changes',all:'All bills',partial:'Part-paid',searchOrders:'Find a table or bill',allFloors:'All floors',walkins:'Walk-ins',sort:'Sort bills',attention:'Unsent first',oldest:'Oldest first',highest:'Highest balance',empty:'No bills match these filters.',emptyAll:'No open bills. Open a table or start a walk-in from Terminal.',unknown:'Preparation state unavailable',unchanged:'No unsent item changes',review:'Review changes',openBill:'Open bill',minutes:'min open',unknownAge:'Opening time unavailable',kitchen:'Kitchen',bar:'Bar',items:'lines',paid:'Recorded',close:'Close',prepTitle:'Preparation changes',prepHint:'Compare previously sent and current required items. Sending creates revision tickets; it does not confirm printing or that food is ready.',previous:'Previously sent',current:'Current required',nothing:'None',added:'Added',removed:'Removed',updated:'Changed',send:'Send revision',noChanges:'No item changes to send.',unknownPrep:'Reload this bill before sending. Its sent snapshot is unavailable.',emptyResults:'No matching bills',orderNote:'Order note',prepOnly:'Item changes only. Order-note changes have separate tickets.',searchCount:'Product results'},
    es: {terminal:'Terminal',service:'Servicio',tools:'Más',designer:'Diseñador TPV',ledger:'Historial y turnos',fullscreen:'Pantalla completa',exit:'Salir de pantalla completa',searchProducts:'Buscar productos',searchHint:'Nombre, etiqueta o categoría',clear:'Borrar búsqueda',favourites:'Favoritos',favourite:'Favorito',matches:'resultados',noProducts:'No hay productos coincidentes',resetProducts:'Borra la búsqueda y los favoritos, o elige otra categoría.',stock:'Revisar stock',stockDetail:'Stock registrado en Main. Las cuentas abiertas no reservan existencias.',serviceTitle:'Vista de servicio',serviceHint:'Todas las mesas y cuentas abiertas sin salir del TPV.',open:'Cuentas abiertas',guests:'Comensales',due:'Pendiente de cobro',changes:'Cambios sin enviar',all:'Todas',partial:'Pago parcial',searchOrders:'Buscar mesa o cuenta',allFloors:'Todas las salas',walkins:'Sin mesa',sort:'Ordenar cuentas',attention:'Sin enviar primero',oldest:'Más antiguas primero',highest:'Mayor saldo',empty:'Ninguna cuenta coincide con estos filtros.',emptyAll:'No hay cuentas abiertas. Abre una mesa o una cuenta desde Terminal.',unknown:'Estado de preparación no disponible',unchanged:'Sin cambios de artículos pendientes',review:'Revisar cambios',openBill:'Abrir cuenta',minutes:'min abierta',unknownAge:'Hora de apertura no disponible',kitchen:'Cocina',bar:'Barra',items:'líneas',paid:'Registrado',close:'Cerrar',prepTitle:'Cambios de preparación',prepHint:'Compara los artículos enviados con los necesarios ahora. Enviar crea tickets de revisión; no confirma la impresión ni que la comida esté lista.',previous:'Enviado antes',current:'Necesario ahora',nothing:'Ninguno',added:'Añadido',removed:'Eliminado',updated:'Modificado',send:'Enviar revisión',noChanges:'No hay cambios de artículos que enviar.',unknownPrep:'Recarga la cuenta antes de enviar. No está disponible la versión enviada.',emptyResults:'No hay cuentas coincidentes',orderNote:'Nota de la cuenta',prepOnly:'Solo cambios de artículos. Los cambios de notas tienen tickets separados.',searchCount:'Resultados de productos'}
  };
  const language = () => String(root.document?.documentElement?.lang || 'en').startsWith('es') ? 'es' : 'en';
  const text = () => copy[language()];
  const money = (cents, currency='EUR') => new Intl.NumberFormat(language()==='es'?'es-ES':'en-IE', {style:'currency',currency}).format(Number(cents || 0)/100);
  // Object-key order is irrelevant to PostgreSQL jsonb equality. Array order is not.
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  function preparation(order) {
    if (!Array.isArray(order?.lines) || !Array.isArray(order?.sent)) return {known:false, changed:false, changes:[]};
    const before = new Map(order.sent.map(line => [String(line.id),line]));
    const ready = order.lines.filter(line=>line.course_held!==true);
    const after = new Map(ready.map(line => [String(line.id),line]));
    const changes = [];
    for (const [id, line] of after) {
      const previous = before.get(id);
      if (!previous || canonical(previous)!==canonical(line)) changes.push({id,kind:previous?'updated':'added',previous:previous||null,current:line});
    }
    for (const [id, line] of before) if (!after.has(id)) changes.push({id,kind:'removed',previous:line,current:null});
    return {known:true,changed:canonical(ready)!==canonical(order.sent),held:order.lines.filter(line=>line.course_held===true).length,changes};
  }
  function billName(order, layout) {
    return String(layout?.tables?.find(table => table.id===order.table_id)?.name || order.label || order.id);
  }
  function age(order, now) {
    const created=Date.parse(order.created_at);
    return Number.isFinite(created) && Number.isFinite(now) ? Math.max(0, Math.floor((now-created)/60000)) : null;
  }
  function serviceOrders(data, filters={}, now=Date.now()) {
    const query=normalise(filters.query), tables=new Map((data.layout?.tables||[]).map(table=>[table.id,table]));
    return (data.orders||[]).filter(order=>!order.status||order.status==='open').map(order=>{
      const table=tables.get(order.table_id), prep=preparation(order);
      const floor=(data.layout?.pages||[]).find(page=>page.id===table?.page);
      return {order,table,floor,name:billName(order,data.layout),prep,minutes:age(order,now),balance:Number(order.total_cents||0)-Number(order.paid_cents||0)};
    }).filter(row=>{
      if (filters.floor==='__walkins__' && row.order.table_id) return false;
      if (filters.floor && filters.floor!=='__walkins__' && row.table?.page!==filters.floor) return false;
      if (filters.status==='changes' && !row.prep.changed) return false;
      if (filters.status==='partial' && !(Number(row.order.paid_cents)>0 && row.balance>0)) return false;
      return !query || query.split(/\s+/).every(token=>normalise([row.name,row.order.label,row.order.note,row.floor?.name].join(' ')).includes(token));
    }).sort((a,b)=>{
      if (filters.sort==='highest') return b.balance-a.balance || a.name.localeCompare(b.name);
      if (filters.sort!=='oldest' && a.prep.changed!==b.prep.changed) return Number(b.prep.changed)-Number(a.prep.changed);
      return (b.minutes??-1)-(a.minutes??-1) || a.name.localeCompare(b.name);
    });
  }
  function navigation({view,canManage,immersive,orders=0}) {
    const t=text();
    const button=(id,label)=>`<button type="button" class="action-btn" data-action="hp-switch-view" data-id="${id}" aria-pressed="${view===id}">${esc(label)}${id==='service'?`<span class="hp-service-count">${orders}</span>`:''}</button>`;
    return `<nav class="hp-mode-switch hp-service-nav" aria-label="PoS">${button('terminal',t.terminal)}${button('service',t.service)}<label class="hp-service-tools"><span class="hp-sr-only">${esc(t.tools)}</span><select data-pos-view aria-label="${esc(t.tools)}"><option value="" ${!['ledger','designer','kitchen'].includes(view)?'selected':''} disabled>${esc(t.tools)}</option><option value="ledger" ${view==='ledger'?'selected':''}>${esc(t.ledger)}</option>${root.AkiPosKDS?`<option value="kitchen" ${view==='kitchen'?'selected':''}>${esc(t.kitchen+' / '+t.bar)}</option>`:''}${canManage?`<option value="designer" ${view==='designer'?'selected':''}>${esc(t.designer)}</option>`:''}</select></label>${['terminal','service','kitchen'].includes(view)?`<button type="button" class="action-btn hp-service-fullscreen" data-action="hp-immersive" aria-pressed="${!!immersive}" aria-label="${esc(immersive?t.exit:t.fullscreen)}" title="${esc(immersive?t.exit:t.fullscreen)}"><span aria-hidden="true">${immersive?'↙':'⛶'}</span><span class="hp-fullscreen-label">${esc(immersive?t.exit:t.fullscreen)}</span></button>`:''}</nav>`;
  }
  function searchToolbar(query='', favourites=false) {
    const t=text();
    return `<div class="hp-search-tools"><label class="hp-product-search-label"><span class="hp-sr-only">${esc(t.searchProducts)}</span><span aria-hidden="true">⌕</span><input type="search" data-pos-product-search aria-label="${esc(t.searchProducts)}" placeholder="${esc(t.searchHint)}" value="${esc(query)}" maxlength="120" autocomplete="off" spellcheck="false"></label><button type="button" class="action-btn hp-search-clear" data-action="hp-product-reset" aria-label="${esc(t.clear)}" title="${esc(t.clear)}">×</button><button type="button" class="action-btn hp-favourites" data-action="hp-favourites" aria-pressed="${!!favourites}" title="${esc(t.favourites)}"><span aria-hidden="true">☆</span><span>${esc(t.favourites)}</span></button></div>`;
  }
  function matchesProduct(layout, product, query) {
    const meta=layout?.menu?.products?.[String(product.id)]||{};
    const category=meta.category || product.category_name || product.category || product.group_name || product.group || '';
    const name=layout?.menu?.categories?.find(c=>c.id===category)?.name||category;
    const haystack=normalise([product.name,meta.label,category,name].join(' '));
    return normalise(query).split(/\s+/).filter(Boolean).every(token=>haystack.includes(token));
  }
  function serviceBody(data, filters={}, currency='EUR', now=Date.now()) {
    const t=text(), all=serviceOrders(data,{},now), rows=serviceOrders(data,filters,now);
    const pending=all.filter(row=>row.prep.changed).length;
    const stat=(value,label)=>`<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
    const chip=(id,label,count)=>`<button type="button" class="action-btn" data-action="hp-service-filter" data-id="${id}" aria-pressed="${(filters.status||'all')===id}">${esc(label)}${count!==undefined?` <span>${count}</span>`:''}</button>`;
    return `<header class="hp-service-heading"><div><h2>${esc(t.serviceTitle)}</h2><p>${esc(t.serviceHint)}</p></div></header><div class="hp-service-summary">${stat(all.length,t.open)}${stat(all.reduce((n,row)=>n+Number(row.order.guests||0),0),t.guests)}${stat(pending,t.changes)}${stat(money(all.reduce((n,row)=>n+row.balance,0),currency),t.due)}</div><div class="hp-service-filters"><label class="hp-service-search"><span class="hp-sr-only">${esc(t.searchOrders)}</span><input type="search" data-pos-service-search placeholder="${esc(t.searchOrders)}" aria-label="${esc(t.searchOrders)}" value="${esc(filters.query||'')}" maxlength="120" autocomplete="off"></label><label><span class="hp-sr-only">${esc(t.allFloors)}</span><select data-pos-service-floor aria-label="${esc(t.allFloors)}"><option value="">${esc(t.allFloors)}</option><option value="__walkins__" ${filters.floor==='__walkins__'?'selected':''}>${esc(t.walkins)}</option>${(data.layout?.pages||[]).map(page=>`<option value="${esc(page.id)}" ${filters.floor===page.id?'selected':''}>${esc(page.name)}</option>`).join('')}</select></label><label><span class="hp-sr-only">${esc(t.sort)}</span><select data-pos-service-sort aria-label="${esc(t.sort)}">${[['attention',t.attention],['oldest',t.oldest],['highest',t.highest]].map(([key,label])=>`<option value="${key}" ${(filters.sort||'attention')===key?'selected':''}>${esc(label)}</option>`).join('')}</select></label></div><div class="hp-service-tabs">${chip('all',t.all,all.length)}${chip('changes',t.changes,pending)}${chip('partial',t.partial)}</div><div class="hp-service-list" data-pos-scroll="service"><div class="hp-service-cards">${rows.map(row=>card(row,currency)).join('')||`<div class="hp-service-empty"><strong>${esc(all.length?t.emptyResults:t.open)}</strong><p>${esc(all.length?t.empty:t.emptyAll)}</p></div>`}</div></div>`;
  }
  function card(row, currency) {
    const t=text(), {order,prep}=row;
    const stationCount=station=>(order.lines||[]).filter(line=>line.station===station).length;
    return `<article class="hp-service-card ${prep.changed?'needs-attention':''}"><header><div><small>${esc(row.floor?.name||t.walkins)}</small><h3>${esc(row.name)}</h3></div><span class="hp-service-age">${esc(row.minutes===null?t.unknownAge:row.minutes+' '+t.minutes)}</span></header><p class="hp-service-prep ${prep.changed?'pending':''}">${esc(!prep.known?t.unknown:prep.changed?t.changes:t.unchanged)}${prep.changed?` <b>${prep.changes.length||1}</b>`:''}</p><div class="hp-service-detail"><span>${Number(order.guests||0)} ${esc(t.guests.toLowerCase())}</span><span>${esc(t.kitchen)} ${stationCount('kitchen')} · ${esc(t.bar)} ${stationCount('bar')}</span></div>${root.AkiPosCourses?.heldLines(order).length?`<p class="hp-course-badge" data-held="true">${root.AkiPosCourses.heldLines(order).length} ${esc(root.AkiPosCourses.text().held)}</p>`:''}${order.note?`<p class="hp-service-note">${esc(order.note)}</p>`:''}<div class="hp-service-balance"><small>${esc(t.due)}${Number(order.paid_cents)>0?` · ${esc(t.paid)} ${esc(money(order.paid_cents,currency))}`:''}</small><strong>${esc(money(row.balance,currency))}</strong></div><footer><button type="button" class="action-btn" data-action="hp-service-review" data-id="${esc(order.id)}">${esc(t.review)}</button><button type="button" class="action-btn primary" data-action="hp-service-open" data-id="${esc(order.id)}">${esc(t.openBill)} ↗</button></footer></article>`;
  }
  function lineMarkup(line) {
    const t=text();
    return !line?`<span class="hp-prep-none">${esc(t.nothing)}</span>`:`<strong>${esc(line.quantity)} × ${esc(line.name)}</strong><small>${esc(line.station==='bar'?t.bar:t.kitchen)}${line.seat?` · ${esc(line.seat)}`:''}</small>${line.note?`<p>${esc(line.note)}</p>`:''}`;
  }
  function preparationPanel(order, layout, blocked=false) {
    if(!order)return '';
    const t=text(), prep=preparation(order);
    return `<div class="hp-v4-overlay hp-service-overlay"><button type="button" class="hp-v4-backdrop" data-action="hp-service-close" aria-label="${esc(t.close)}"></button><section class="hp-v4-dialog" role="dialog" aria-modal="true" aria-labelledby="hp-service-prep-title" tabindex="-1"><header><div><h2 id="hp-service-prep-title">${esc(t.prepTitle)}</h2><p>${esc(billName(order,layout))}</p></div><button type="button" class="action-btn" data-action="hp-service-close" aria-label="${esc(t.close)}">×</button></header><div class="hp-v4-dialog-body" data-pos-scroll="preparation"><p class="hp-v4-warning">${esc(t.prepHint)}</p>${prep.changes.map(change=>`<article class="hp-prep-change"><h3>${esc(t[change.kind])}</h3><div class="hp-prep-before"><span>${esc(t.previous)}</span>${lineMarkup(change.previous)}</div><div><span>${esc(t.current)}</span>${lineMarkup(change.current)}</div></article>`).join('')||`<p>${esc(prep.known?t.noChanges:t.unknownPrep)}</p>`}${order.note?`<section><h3>${esc(t.orderNote)}</h3><p>${esc(order.note)}</p></section>`:''}${root.AkiPosCourses?.heldLines(order).length?`<p class="hp-course-warning">${root.AkiPosCourses.heldLines(order).length} ${esc(root.AkiPosCourses.text().held)}. ${esc(root.AkiPosCourses.text().only)}</p>`:''}<small>${esc(t.prepOnly)}</small></div><footer class="hp-prep-footer"><button type="button" class="action-btn" data-action="hp-service-open" data-id="${esc(order.id)}">${esc(t.openBill)}</button><button type="button" class="action-btn primary" data-action="hp-service-send" data-order="${esc(order.id)}" data-version="${esc(order.version)}" ${blocked||!prep.known||!prep.changed?'disabled':''}>${esc(t.send)}</button></footer></section></div>`;
  }
  root.AkiPosService={esc,normalise,canonical,preparation,billName,age,serviceOrders,navigation,searchToolbar,matchesProduct,serviceBody,preparationPanel,text,money};
})(typeof window==='undefined'?globalThis:window);
