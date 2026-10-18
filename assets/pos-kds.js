/* Kitchen/bar preparation progress, separate from payment and physical printing. */
(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normal=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const stages=['queued','preparing','ready','served'];
 const copy={
  en:{title:'Kitchen & bar',hint:'Sent orders only. Preparation status never confirms payment or printing.',all:'All stations',kitchen:'Kitchen',bar:'Bar',active:'Active',review:'Review changes',ready:'Ready',preparing:'Preparing',queued:'Waiting',served:'Served',history:'Completed',search:'Find table, dish or note',refresh:'Refresh',empty:'No matching kitchen cards.',waiting:'Connecting to the kitchen…',unavailable:'Kitchen unavailable. Progress controls are disabled. Reconnect before continuing.',disabled:'Kitchen display is not enabled for this workspace.',enable:'Enable kitchen display',handover:'Finish already-paid orders in the previous kitchen workflow before enabling. Open sent orders will be imported for manual review. Do not prepare imported food twice.',confirmEnable:'I have reconciled the previous service and am ready to switch.',sync:'Connected',seconds:'s since refresh',minutes:'min since first send',start:'Start',markReady:'Mark ready',markServed:'Mark served',lines:'lines',guests:'guests',seat:'Seat',order:'Order',reconcile:'Reconcile progress',previous:'Previously acknowledged',current:'Current required',compare:'Compare quantities, seats and notes. Choose the actual progress of every current line. Changed lines do not inherit readiness.',relocation:'Relocation: food may already be prepared. Reconcile with the other station; do not prepare it again.',imported:'Imported from the existing service. Confirm what has already been prepared.',cancelled:'Cancelled: confirm the kitchen has seen the cancellation.',ack:'I compared the changes and checked the actual preparation.',reason:'Reconciliation reason',save:'Confirm progress',close:'Close',none:'None',changed:'This card changed on another screen. Reload the review before confirming.',reload:'Reload review',recall:'Recall line',recallHint:'Manager correction: return this line to Waiting. This records a reason; it does not automatically prepare anything.',recallReason:'Reason for recalling this line',historyHint:'Most recent 50 completed cards. Original evidence remains retained.',needsReview:'Review required',lineState:'Actual preparation state',unknown:'Preparation data is unavailable.',enableConfirm:'Confirm activation',cancel:'Cancel',allActive:'All active',stale:'Connection is stale. Refresh before changing preparation.',pending:'Resolve the pending POS request before making more changes.',retry:'Reconnect',line:'Line'},
  es:{title:'Cocina y barra',hint:'Solo pedidos enviados. La preparación no confirma cobros ni impresiones.',all:'Todas las estaciones',kitchen:'Cocina',bar:'Barra',active:'Activos',review:'Revisar cambios',ready:'Listo',preparing:'Preparando',queued:'Pendiente',served:'Servido',history:'Completados',search:'Buscar mesa, plato o nota',refresh:'Actualizar',empty:'No hay comandas coincidentes.',waiting:'Conectando con cocina…',unavailable:'Cocina no disponible. Los controles están desactivados. Reconecta antes de continuar.',disabled:'La pantalla de cocina no está activada en este espacio.',enable:'Activar pantalla de cocina',handover:'Termina los pedidos ya cobrados en el sistema anterior antes de activar. Los pedidos abiertos enviados se importarán para revisión manual. No prepares dos veces la comida importada.',confirmEnable:'He conciliado el servicio anterior y estoy listo para cambiar.',sync:'Conectado',seconds:'s desde la actualización',minutes:'min desde el primer envío',start:'Empezar',markReady:'Marcar listo',markServed:'Marcar servido',lines:'líneas',guests:'comensales',seat:'Asiento',order:'Pedido',reconcile:'Conciliar preparación',previous:'Confirmado anteriormente',current:'Necesario ahora',compare:'Compara cantidades, asientos y notas. Elige el estado real de cada línea. Las líneas modificadas no heredan el estado anterior.',relocation:'Traslado: puede que la comida ya esté preparada. Consulta con la otra estación; no la prepares de nuevo.',imported:'Importado del servicio anterior. Confirma qué se ha preparado ya.',cancelled:'Cancelado: confirma que cocina ha visto la cancelación.',ack:'He comparado los cambios y comprobado la preparación real.',reason:'Motivo de la conciliación',save:'Confirmar preparación',close:'Cerrar',none:'Ninguno',changed:'Esta comanda cambió en otra pantalla. Recarga la revisión antes de confirmar.',reload:'Recargar revisión',recall:'Recuperar línea',recallHint:'Corrección de responsable: devuelve esta línea a Pendiente. Registra el motivo; no inicia la preparación automáticamente.',recallReason:'Motivo de recuperación',historyHint:'Últimas 50 comandas completadas. Se conserva el historial original.',needsReview:'Revisión necesaria',lineState:'Estado real de preparación',unknown:'Datos de preparación no disponibles.',enableConfirm:'Confirmar activación',cancel:'Cancelar',allActive:'Todos activos',stale:'Conexión desactualizada. Actualiza antes de cambiar la preparación.',pending:'Resuelve la solicitud pendiente del TPV antes de realizar más cambios.',retry:'Reconectar',line:'Línea'}
 };
 const text=()=>copy[String(root.document?.documentElement?.lang||'en').startsWith('es')?'es':'en'];
 function counts(card){const n={queued:0,preparing:0,ready:0,served:0};for(const l of card.source?.lines||[]){const state=card.progress?.[l.id];if(stages.includes(state))n[state]++;}return n;}
 function filtered(cards,filters={}){
  const query=normal(filters.query).split(/\s+/).filter(Boolean);
  return (cards||[]).filter(c=>{
   if(filters.station&&filters.station!=='all'&&c.station!==filters.station)return false;
   if(filters.status==='history'?!c.completed_at:!!c.completed_at)return false;
   if(filters.status==='review'&&!c.review_required)return false;
   if(['ready','preparing','queued'].includes(filters.status)&&(c.review_required||!counts(c)[filters.status]))return false;
   const haystack=normal([c.source?.label,c.source?.note,...(c.source?.lines||[]).flatMap(l=>[l.name,l.note])].join(' '));
   return query.every(q=>haystack.includes(q));
  }).sort((a,b)=>filters.status==='history'?Date.parse(b.completed_at)-Date.parse(a.completed_at):Number(b.review_required)-Number(a.review_required)||Date.parse(a.created_at)-Date.parse(b.created_at));
 }
 const button=(action,label,attrs='')=>`<button type="button" class="action-btn" data-action="hp-kds-${action}" ${attrs}>${esc(label)}</button>`;
 const attrs=c=>`data-order="${esc(c.order_id)}" data-station="${esc(c.station)}" data-version="${esc(c.version)}"`;
 function cardHTML(c,{blocked=false,manager=false,now=Date.now()}={}){
  const t=text(),n=counts(c),review=c.review_required,done=!!c.completed_at;
  const age=Math.max(0,Math.floor((now-Date.parse(c.created_at))/60000));
  const disabled=blocked?'disabled':'';
  const state=review?'review':done?'served':n.ready?'ready':n.preparing?'preparing':'queued';
  const next={queued:['preparing',t.start],preparing:['ready',t.markReady],ready:['served',t.markServed]};
  return `<article class="hp-kds-card" data-kds-card="${esc(c.order_id)}:${esc(c.station)}" data-stage="${state}"><header><div><span class="hp-kds-station">${esc(t[c.station]||c.station)}</span><h3>${esc(c.source.label)}</h3></div><span class="hp-kds-age">${Number.isFinite(age)?age:'?'} ${esc(t.minutes)}</span></header><p class="hp-kds-meta">${esc(c.source.guests)} ${esc(t.guests)} · ${esc(t.order)} ${esc(c.order_id.slice(0,8))}</p>${c.source.note?`<p class="hp-kds-note">${esc(c.source.note)}</p>`:''}${review?`<div class="hp-kds-warning"><strong>${esc(t.needsReview)}</strong><p>${esc(c.source.cancelled?t.cancelled:c.change_kind==='relocation'?t.relocation:c.change_kind==='imported'?t.imported:t.compare)}</p></div>`:''}<ul class="hp-kds-lines">${(c.source.lines||[]).map(l=>{
   const s=c.progress[l.id],step=next[s];
   return `<li data-state="${esc(s)}"><div><strong>${esc(l.quantity)} × ${esc(l.name)}</strong>${root.AkiPosCourses?.badge(l,{kitchen:true,now})||''}${l.seat?`<small>${esc(t.seat)} ${esc(l.seat)}</small>`:''}${l.note?`<p>${esc(l.note)}</p>`:''}<span class="hp-kds-state">${esc(review?t.needsReview:t[s]||t.unknown)}</span></div>${!review&&!done&&step?button('progress',step[1],`${attrs(c)} data-line="${esc(l.id)}" data-state="${step[0]}" ${disabled}`):manager&&!review&&!c.source.cancelled?button('recall',t.recall,`${attrs(c)} data-line="${esc(l.id)}" ${disabled}`):''}</li>`;
  }).join('')||`<li>${esc(t.none)}</li>`}</ul><footer>${review?button('review',t.review,`${attrs(c)} ${disabled}`):!done?stages.slice(0,3).filter(s=>n[s]>1).map(s=>button('progress',`${next[s][1]} · ${n[s]} ${t.lines}`,`${attrs(c)} data-line="*" data-state="${next[s][0]}" ${disabled}`)).join(''): `<span>${esc(t.history)}</span>`}</footer></article>`;
 }
 function create(ctx){
  let data=null,error='',loading=false,disposed=false,timer=null,started=false,lastAt=0,serverAt=0,filters={station:'all',status:'active',query:''},dialog=null;
  const doc=root.document;
  const isActive=()=>!disposed&&ctx.isActive();
  const now=()=>serverAt?serverAt+Math.max(0,Date.now()-lastAt):Date.now();
  const blocked=()=>ctx.isBlocked()||!data||Date.now()-lastAt>10000;
  const blockedMessage=()=>ctx.isBlocked()?text().pending:text().stale;
  const find=(id,station)=>data?.cards?.find(c=>c.order_id===id&&c.station===station);
  function captureFocus(){const el=doc.activeElement;if(!el?.closest?.('.hp-kds,.hp-kds-overlay'))return null;return {name:el.name,action:el.dataset?.action,line:el.dataset?.line,order:el.dataset?.order,station:el.dataset?.station,start:el.selectionStart,end:el.selectionEnd,inDialog:!!el.closest('.hp-kds-overlay')};}
  function restoreFocus(saved){if(!saved)return;const scope=saved.inDialog?doc.querySelector('.hp-kds-overlay'):doc.querySelector('.hp-kds');if(!scope)return;const el=[...scope.querySelectorAll('input,select,textarea,button')].find(x=>saved.name?x.name===saved.name:saved.action&&x.dataset.action===saved.action&&x.dataset.line===saved.line&&x.dataset.order===saved.order&&x.dataset.station===saved.station);(el||scope.querySelector('[role="dialog"]'))?.focus?.({preventScroll:true});if(el&&saved.start!=null&&['text','search'].includes(el.type))el.setSelectionRange?.(saved.start,saved.end);}
  async function load(){
   if(!isActive()||loading||ctx.isBlocked())return;
   loading=true;let timeout;
   try{
    const next=await Promise.race([ctx.rpc('crm_kds_overview'),new Promise((_,reject)=>{timeout=root.setTimeout(()=>reject(Error(text().unavailable)),8000);})]);
    if(!isActive())return;
    if(next?.contract_version!==1||!Array.isArray(next.cards))throw Error(text().unknown);
    data=next;lastAt=Date.now();serverAt=Date.parse(next.server_time)||lastAt;error='';
   }catch(e){if(isActive()){data=null;error=e.message;}}
   finally{root.clearTimeout(timeout);loading=false;if(isActive())ctx.refresh();}
  }
  function start(){if(started)return;started=true;Promise.resolve().then(load);timer=root.setInterval(load,2500);}
  const input=e=>{
   if(!isActive())return;
   if(e.type==='input'&&e.target.matches?.('[data-kds-search]')){const query=e.target.value.slice(0,120);if(filters.query!==query){filters.query=query;ctx.refresh();}}
   if(dialog&&e.target.closest?.('.hp-kds-form')){
    const el=e.target;if(el.name==='reason')dialog.reason=el.value;if(el.name==='confirmed')dialog.confirmed=el.checked;
    if(el.name?.startsWith('progress:'))dialog.progress[el.name.slice(9)]=el.value;
   }
  };
  const change=e=>{if(!isActive())return;if(e.target.matches?.('[data-kds-station]')&&filters.station!==e.target.value){filters.station=e.target.value;ctx.refresh();}if(e.target.closest?.('.hp-kds-form'))input(e);};
  function close(){const c=dialog?.card,kind=dialog?.kind;dialog=null;ctx.refresh();[...doc.querySelectorAll('[data-action^="hp-kds-"]')].find(el=>el.dataset.action===`hp-kds-${kind}`&&(!c||el.dataset.order===c.order_id&&el.dataset.station===c.station))?.focus?.({preventScroll:true});}
  const keyboard=e=>{if(!isActive()||!dialog)return;if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const modal=doc.querySelector('.hp-kds-overlay [role="dialog"]'),els=modal?[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')]:[],first=els[0],last=els.at(-1);if(first&&(e.shiftKey&&(doc.activeElement===first||doc.activeElement===modal)||!e.shiftKey&&doc.activeElement===last)){e.preventDefault();(e.shiftKey?last:first).focus();}}};
  doc.addEventListener('input',input);doc.addEventListener('change',change);doc.addEventListener('keydown',keyboard);
  function open(kind,c,line){dialog={kind,card:c?JSON.parse(JSON.stringify(c)):null,line,progress:{...c?.progress},reason:'',confirmed:false};ctx.refresh();doc.querySelector('.hp-kds-overlay [role="dialog"]')?.focus?.();}
  function dialogHTML(){
   if(!dialog)return '';
   const t=text(),d=dialog,c=d.card,current=c&&find(c.order_id,c.station),stale=c&&current?.version!==c.version;
   const title=d.kind==='enable'?t.enable:d.kind==='recall'?t.recall:t.reconcile;
   const list=s=>`<p>${esc(s?.label||'')} ${esc(s?.note||'')}</p><ul>${(s?.lines||[]).map(l=>`<li>${esc(l.quantity)} × ${esc(l.name)} · ${esc(l.seat?`${t.seat} ${l.seat}`:'')} ${esc(l.note)}</li>`).join('')||`<li>${esc(t.none)}</li>`}</ul>`;
   const content=d.kind==='enable'?`<p>${esc(t.handover)}</p>`:d.kind==='recall'?`<p>${esc(t.recallHint)}</p><strong>${esc(c.source.lines.find(l=>l.id===d.line)?.name)}</strong>`:`<p>${esc(t.compare)}</p>${c.change_kind==='relocation'?`<p class="hp-kds-warning">${esc(t.relocation)}</p>`:''}${c.source.cancelled?`<p class="hp-kds-warning">${esc(t.cancelled)}</p>`:''}<div class="hp-kds-comparison"><section><h4>${esc(t.previous)}</h4>${list(c.previous_source)}</section><section><h4>${esc(t.current)}</h4>${list(c.source)}</section></div>${!c.source.cancelled?(c.source.lines||[]).map(l=>`<label>${esc(l.quantity)} × ${esc(l.name)}<select name="progress:${esc(l.id)}" aria-label="${esc(t.lineState+' · '+l.name)}">${stages.map(s=>`<option value="${s}" ${d.progress[l.id]===s?'selected':''}>${esc(t[s])}</option>`).join('')}</select></label>`).join(''):''}`;
   return `<div class="hp-kds-overlay"><section role="dialog" aria-modal="true" aria-labelledby="hp-kds-dialog-title" tabindex="-1"><header><h3 id="hp-kds-dialog-title">${esc(title)}</h3>${button('close','×',`aria-label="${esc(t.close)}"`)}</header><form class="hp-form hp-kds-form" data-form="hp-kds-${d.kind}"><div class="hp-kds-dialog-body" data-pos-scroll="kds-dialog">${content}${stale?`<p role="alert" class="hp-kds-warning">${esc(t.changed)}</p>${button('reload',t.reload)}`:''}${d.kind!=='enable'?`<label>${esc(d.kind==='recall'?t.recallReason:t.reason)}<textarea name="reason" required minlength="3" maxlength="500">${esc(d.reason)}</textarea></label>`:''}${d.kind!=='recall'?`<label class="hp-kds-check"><input type="checkbox" name="confirmed" required ${d.confirmed?'checked':''}><span>${esc(d.kind==='enable'?t.confirmEnable:t.ack)}</span></label>`:''}</div><footer>${button('close',t.cancel)}<button class="action-btn primary" type="submit" ${blocked()||stale?'disabled':''}>${esc(d.kind==='enable'?t.enableConfirm:d.kind==='recall'?t.recall:t.save)}</button></footer></form></section></div>`;
  }
  function render(){
   start();const t=text();
   const header=`<header class="hp-kds-heading"><div><h2>${esc(t.title)}</h2><p>${esc(t.hint)}</p></div>${button('refresh',t.refresh)}</header>`;
   if(!data)return `<section class="hp-kds">${header}<div class="hp-kds-empty" role="status"><strong>${esc(error?t.unavailable:t.waiting)}</strong>${error?`<p>${esc(error)}</p>${button('refresh',t.retry)}`:''}</div></section>`;
   if(!data.enabled)return `<section class="hp-kds">${header}<div class="hp-kds-empty"><h3>${esc(t.disabled)}</h3><p>${esc(t.handover)}</p>${data.can_manage?button('enable',t.enable,blocked()?'disabled':''):''}</div></section>${dialogHTML()}`;
   const rows=filtered(data.cards,filters),active=data.cards.filter(c=>!c.completed_at),disabled=blocked()?'disabled':'';
   const tab=(id,label,count)=>button('filter',`${label}${count==null?'':' · '+count}`,`data-value="${id}" aria-pressed="${filters.status===id}"`);
   return `<section class="hp-kds">${header}<div class="hp-kds-toolbar"><label><span class="hp-sr-only">${esc(t.search)}</span><input name="kds-search" type="search" data-kds-search value="${esc(filters.query)}" placeholder="${esc(t.search)}" maxlength="120" autocomplete="off"></label><label><span class="hp-sr-only">${esc(t.all)}</span><select name="kds-station" data-kds-station>${['all','kitchen','bar'].map(s=>`<option value="${s}" ${filters.station===s?'selected':''}>${esc(t[s])}</option>`).join('')}</select></label><span class="hp-kds-sync" role="status">${esc(blocked()?blockedMessage():t.sync)} · ${Math.max(0,Math.floor((Date.now()-lastAt)/1000))} ${esc(t.seconds)}</span></div><nav class="hp-kds-filters" aria-label="${esc(t.title)}">${tab('active',t.allActive,active.length)}${tab('review',t.needsReview,active.filter(c=>c.review_required).length)}${tab('ready',t.ready,active.filter(c=>!c.review_required&&counts(c).ready).length)}${tab('history',t.history)}</nav>${filters.status==='history'?`<p class="hp-kds-history-hint">${esc(t.historyHint)}</p>`:''}<div class="hp-kds-scroll" data-pos-scroll="kds"><div class="hp-kds-grid">${rows.map(c=>cardHTML(c,{blocked:!!disabled,manager:data.can_manage,now:now()})).join('')||`<div class="hp-kds-empty">${esc(t.empty)}</div>`}</div></div></section>${dialogHTML()}`;
  }
  async function action(el){
   const a=el.dataset.action.slice(7);
   if(!isActive())return;
   if(a==='close'){close();return;}
   if(a==='filter'){filters.status=['active','review','ready','history'].includes(el.dataset.value)?el.dataset.value:'active';ctx.refresh();return;}
   if(a==='refresh'){await load();return;}
   if(a==='reload'){const d=dialog,c=d?.card&&find(d.card.order_id,d.card.station);if(c)open(d.kind,c,d.line);else close();return;}
   if(blocked())throw Error(blockedMessage());
   if(a==='enable'){if(!data.can_manage)throw Error('Manager access required');open('enable');return;}
   const c=find(el.dataset.order,el.dataset.station);
   if(!c||c.version!==Number(el.dataset.version))throw Error(text().changed);
   if(a==='review'){open('review',c);return;}
   if(a==='recall'){if(!data.can_manage)throw Error('Manager access required');open('recall',c,el.dataset.line);return;}
   if(a==='progress'){
    try{await ctx.execute({action:'kds_advance',order_id:c.order_id,station:c.station,version:c.version,line_id:el.dataset.line,state:el.dataset.state});}
    finally{await load();}
   }
  }
  async function submit(form){
   if(!isActive()||!dialog)return;
   if(blocked())throw Error(blockedMessage());
   const d=dialog,c=d.card,values=new root.FormData(form);
   if(c&&find(c.order_id,c.station)?.version!==c.version)throw Error(text().changed);
   let command;
   if(d.kind==='enable')command={action:'kds_enable',confirmed:values.get('confirmed')==='on'};
   else if(d.kind==='review')command={action:'kds_review',order_id:c.order_id,station:c.station,version:c.version,confirmed:values.get('confirmed')==='on',reason:values.get('reason'),progress:{...d.progress}};
   else command={action:'kds_recall',order_id:c.order_id,station:c.station,version:c.version,line_id:d.line,reason:values.get('reason')};
   await ctx.execute(command);dialog=null;await load();ctx.refresh();
  }
  return {render,action,submit,load,captureFocus,restoreFocus,dispose(){disposed=true;root.clearInterval(timer);doc.removeEventListener('input',input);doc.removeEventListener('change',change);doc.removeEventListener('keydown',keyboard);data=null;dialog=null;filters={};}};
 }
 root.AkiPosKDS={create,counts,filtered,cardHTML};
})(typeof window==='undefined'?globalThis:window);
