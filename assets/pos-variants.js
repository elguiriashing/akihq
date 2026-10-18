/* Inventory-backed choices. This module never creates prices, tax rates or stock. */
(function(root){
 'use strict';
 const MAX=12;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=v=>JSON.parse(JSON.stringify(v));
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const own=(v,k)=>object(v)&&Object.prototype.hasOwnProperty.call(v,k);
 const words=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const strings={
  en:{title:'Sizes & variants',choose:'Choose an option',options:'options',edit:'Edit choices',setup:'Set up choices',cancel:'Close',save:'Save choices',remove:'Remove chooser',removeConfirm:'Remove the chooser? This button will sell its original Inventory product directly.',search:'Find Inventory products',group:'Chooser title',selected:'Selected options',available:'Available products',empty:'No matching products',count:'Choose 2–12 distinct products.',help:'Each choice sells one actual Inventory product at its own price. Create sizes in Inventory first. This is not a paid extra or a recipe.',stock:'Check stock',stockHelp:'Recorded Main stock only. Open orders do not reserve it.',missing:'Unavailable product',stale:'The menu or bill changed. Reload and review the choices.',reload:'Reload choices',discard:'Discard your unsaved choices and reload?',manager:'Manager permission required.',blocked:'Resolve pending requests and reconnect before choosing.',invalid:'This chooser needs a manager to repair it. No product has been added.',price:'Prices shown are the current bill prices where already recorded; otherwise the catalogue prices. The server validates the final amount.',removeOption:'Remove option',moveUp:'Move up',moveDown:'Move down',actual:'Inventory product',course:'Course',asap:'Immediate service',notice:'Options may also remain as separate buttons. Hide those buttons in the menu designer if needed.',changed:'The available products changed. Reload before saving.',closed:'The order is no longer available.',limit:'A chooser can contain at most 12 products.',noPrice:'Price unavailable'},
  es:{title:'Tamaños y variantes',choose:'Elige una opción',options:'opciones',edit:'Editar opciones',setup:'Configurar opciones',cancel:'Cerrar',save:'Guardar opciones',remove:'Quitar selector',removeConfirm:'¿Quitar el selector? Este botón venderá directamente su producto original de Inventario.',search:'Buscar productos de Inventario',group:'Título del selector',selected:'Opciones seleccionadas',available:'Productos disponibles',empty:'No hay productos coincidentes',count:'Elige entre 2 y 12 productos distintos.',help:'Cada opción vende un producto real de Inventario a su propio precio. Crea primero los tamaños en Inventario. No es un suplemento ni una receta.',stock:'Revisar existencias',stockHelp:'Solo existencias registradas en Main. Los pedidos abiertos no las reservan.',missing:'Producto no disponible',stale:'El menú o la cuenta han cambiado. Recarga y revisa las opciones.',reload:'Recargar opciones',discard:'¿Descartar las opciones sin guardar y recargar?',manager:'Se requiere permiso de responsable.',blocked:'Resuelve las solicitudes pendientes y reconecta antes de elegir.',invalid:'Un responsable debe corregir este selector. No se ha añadido ningún producto.',price:'Se muestran los precios ya registrados en la cuenta, o los del catálogo si aún no existen. El servidor valida el importe final.',removeOption:'Quitar opción',moveUp:'Subir',moveDown:'Bajar',actual:'Producto de Inventario',course:'Tiempo',asap:'Servicio inmediato',notice:'Las opciones también pueden aparecer como botones independientes. Puedes ocultarlos en el diseñador del menú.',changed:'Han cambiado los productos disponibles. Recarga antes de guardar.',closed:'La cuenta ya no está disponible.',limit:'Un selector admite un máximo de 12 productos.',noPrice:'Precio no disponible'}
 };
 const text=()=>strings[root.document?.documentElement?.lang?.startsWith('es')?'es':'en'];
 function configured(layout,id){return own(layout?.menu?.variants,String(id));}
 function config(layout,id){
  if(!configured(layout,id))return null;
  const c=layout.menu.variants[String(id)];
  if(!object(c)||c.version!==1||typeof c.title!=='string'||!c.title.trim()||c.title.length>80||!Array.isArray(c.items)||c.items.length<2||c.items.length>MAX||c.items.some(x=>typeof x!=='string'||!x||x.length>80)||new Set(c.items).size!==c.items.length)return {invalid:true};
  return {version:1,title:c.title,items:[...c.items]};
 }
 function unitPrice(product,order){
  const line=order?.lines?.find(l=>String(l.item_id)===String(product.id));
  const raw=line?line.unit_price_cents:product.sale_price_cents;
  if(raw==null||raw==='')return null;
  const price=Number(raw);
  return Number.isSafeInteger(price)&&price>=0?price:null;
 }
 function choices(layout,catalogue,id,order){
  const c=config(layout,id);if(!c||c.invalid)return [];
  return c.items.map(id=>{const p=catalogue.find(p=>String(p.id)===id&&p.active!==false);return {id,product:p||null,price:p?unitPrice(p,order):null};});
 }
 function badge(layout,catalogue,id,order,currency){
  const c=config(layout,id);if(!c)return '';
  const rows=choices(layout,catalogue,id,order).filter(x=>x.product&&x.price!==null);
  const money=cents=>new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'EUR'}).format(cents/100);
  const min=rows.length?Math.min(...rows.map(x=>x.price)):null,max=rows.length?Math.max(...rows.map(x=>x.price)):null;
  const price=min===null?null:money(min)+(min!==max?' – '+money(max):'');
  return '<small class="hp-variant-badge">'+esc(c.invalid?text().invalid:rows.length+' '+text().options+(price?' · '+price:''))+'</small>';
 }
 function fingerprint(data,order,parent){
  return JSON.stringify([data?.layout_version,data?.can_manage,data?.course_contract_version,order?.id,order?.version,order?.paid_cents,config(data?.layout,parent),choices(data?.layout,data?.catalogue||[],parent,order).map(x=>[x.id,x.product?.name,x.product?.active,x.product?.sale_price_cents,x.price,x.product?.on_hand])]);
 }
 function validate(title,ids,catalogue){
  if(typeof title!=='string'||!title.trim()||title.trim().length>80||ids.length<2||ids.length>MAX||new Set(ids).size!==ids.length)throw Error(text().count);
  if(ids.some(id=>!catalogue.some(p=>String(p.id)===id&&p.active!==false)))throw Error(text().changed);
  return {version:1,title:title.trim(),items:[...ids]};
 }
 function editorButton(layout,id){return '<button class="action-btn hp-variant-setup" type="button" data-action="hp-variant-edit" data-id="'+esc(id)+'">'+esc(configured(layout,id)?text().edit:text().setup)+'</button>';}
 function create(ctx){
  let state=null,disposed=false,localError='';
  const doc=root.document;
  const button=(action,label,attrs='')=>'<button class="action-btn" type="button" data-action="hp-variant-'+action+'" '+attrs+'>'+esc(label)+'</button>';
  const blocked=()=>disposed||!ctx.isActive()||!ctx.getData()||ctx.isBlocked();
  function stale(){
   if(!state)return true;
   const d=ctx.getData(),o=ctx.getOrder(state.orderId);
   return !d||state.layoutVersion!==d.layout_version||(state.mode==='choose'&&(ctx.currentId()!==state.orderId||!o||state.fingerprint!==fingerprint(d,o,state.parent)))||(state.mode==='edit'&&!d.can_manage);
  }
  function close(){const s=state;state=null;localError='';ctx.refresh();if(s){const action=s.mode==='edit'?'hp-variant-edit':'hp-add';[...doc.querySelectorAll('[data-action="'+action+'"]')].find(e=>e.dataset.id===s.parent)?.focus?.({preventScroll:true});}}
  function captureFocus(){
   if(!state)return null;const e=doc.activeElement;
   if(!e?.closest?.('.hp-variant-dialog'))return {key:'dialog'};
   return {key:e.dataset.variantFocus||'dialog',start:e.selectionStart,end:e.selectionEnd};
  }
  function restoreFocus(saved){
   if(!state)return;const dialog=doc.querySelector('.hp-variant-dialog');if(!dialog)return;
   const el=saved&&[...dialog.querySelectorAll('[data-variant-focus]')].find(e=>e.dataset.variantFocus===saved.key&&!e.disabled);
   (el||dialog).focus?.({preventScroll:true});if(el&&saved.start!=null&&el.setSelectionRange)el.setSelectionRange(saved.start,saved.end);
  }
  function onKey(e){
   if(!state||!doc.querySelector('.hp-variant-dialog'))return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
   if(e.key!=='Tab')return;
   const dialog=doc.querySelector('.hp-variant-dialog'),els=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(el=>!el.hidden);
   const first=els[0],last=els.at(-1);if(!first){e.preventDefault();dialog.focus();return;}
   if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===dialog)||!e.shiftKey&&(doc.activeElement===last||!dialog.contains(doc.activeElement))){e.preventDefault();(e.shiftKey?last:first).focus();}
  }
  function onInput(e){
   if(state?.mode!=='edit'||!e.target?.closest?.('.hp-variant-dialog'))return;
   if(e.target.name==='variant_title'){state.title=e.target.value;state.dirty=true;localError='';}
   if(e.target.name==='variant_search'){state.query=e.target.value.slice(0,120);ctx.refresh();}
  }
  function onChange(e){
   if(state?.mode!=='edit'||!e.target?.matches?.('[data-variant-option]'))return;
   if(blocked()||stale()){localError=text().stale;ctx.refresh();return;}
   const id=e.target.dataset.variantOption;
   if(e.target.checked&&!state.items.includes(id)){
    if(state.items.length>=MAX)localError=text().limit;
    else if(ctx.getData().catalogue.some(p=>String(p.id)===id&&p.active!==false)){state.items.push(id);localError='';}
   }else state.items=state.items.filter(x=>x!==id);
   state.dirty=true;ctx.refresh();
  }
  doc.addEventListener('keydown',onKey,true);doc.addEventListener('input',onInput);doc.addEventListener('change',onChange);
  async function open(parent,mode,orderId){
   if(blocked())throw Error(text().blocked);
   if(!await ctx.flushTaps())throw Error(text().blocked);
   const d=ctx.getData(),o=ctx.getOrder(orderId),p=d?.catalogue.find(p=>String(p.id)===parent&&p.active!==false);
   if(!p)throw Error(text().missing);
   if(mode==='edit'&&!d.can_manage)throw Error(text().manager);
   if(mode==='choose'&&(!o||ctx.currentId()!==orderId||Number(o.paid_cents)>0))throw Error(text().closed);
   const c=config(d.layout,parent);
   if(mode==='choose'&&!c)throw Error(text().stale);
   state={mode,parent,orderId,layoutVersion:d.layout_version,fingerprint:fingerprint(d,o,parent),title:c&&!c.invalid?c.title:String(p.name),items:c&&!c.invalid?[...c.items]:[parent],query:'',dirty:false,course:ctx.entryCourse(orderId)};
   localError='';ctx.refresh();restoreFocus(null);
  }
  async function action(target){
   const a=target.dataset.action.slice('hp-variant-'.length),id=String(target.dataset.id||'');
   if(a==='edit')return open(id,'edit',null);
   if(a==='close')return close();
   if(!state)return;
   if(a==='reload'){
    if(state.dirty&&!root.confirm(text().discard))return;
    const s={...state};await ctx.reload();return open(s.parent,s.mode,s.orderId);
   }
   if(blocked())throw Error(text().blocked);
   if(stale())throw Error(text().stale);
   if(a==='choose'&&state.mode==='choose'){
    const d=ctx.getData(),o=ctx.getOrder(state.orderId),choice=choices(d.layout,d.catalogue,state.parent,o).find(x=>x.id===id);
    if(!choice?.product||choice.price===null)throw Error(text().missing);
    const s=state;state=null;localError='';
    // Only the existing server-owned SKU is queued. No prices or synthetic totals.
    ctx.enqueue(s.orderId,id,s.course);ctx.refresh();
    [...doc.querySelectorAll('[data-action="hp-add"]')].find(e=>e.dataset.id===s.parent)?.focus?.({preventScroll:true});return;
   }
   if(state.mode!=='edit')return;
   if(!ctx.getData().can_manage)throw Error(text().manager);
   if(a==='deselect'){state.items=state.items.filter(x=>x!==id);state.dirty=true;ctx.refresh();return;}
   if(a==='up'||a==='down'){
    const i=state.items.indexOf(id),j=i+(a==='up'?-1:1);if(i>=0&&j>=0&&j<state.items.length){[state.items[i],state.items[j]]=[state.items[j],state.items[i]];state.dirty=true;ctx.refresh();}return;
   }
   if(a==='remove'){
    if(!root.confirm(text().removeConfirm))return;
    const d=ctx.getData(),layout=copy(d.layout);layout.menu={...layout.menu,variants:{...layout.menu?.variants}};delete layout.menu.variants[state.parent];
    await ctx.saveLayout(layout,state.layoutVersion);close();
   }
  }
  async function save(){
   if(!state||state.mode!=='edit')return;
   if(blocked())throw Error(text().blocked);
   if(stale())throw Error(text().stale);
   const d=ctx.getData();if(!d.can_manage)throw Error(text().manager);
   const value=validate(state.title,state.items,d.catalogue),layout=copy(d.layout);
   layout.menu={...layout.menu,variants:{...layout.menu?.variants,[state.parent]:value}};
   await ctx.saveLayout(layout,state.layoutVersion);close();
  }
  function render(){
   const d=ctx.getData();if(!state||!d||disposed||!ctx.isActive())return '';
   const t=text(),editing=state.mode==='edit',isStale=stale(),disabled=blocked()||isStale;
   const o=ctx.getOrder(state.orderId),p=d.catalogue.find(p=>String(p.id)===state.parent),currency=ctx.currency||'EUR';
   const money=n=>n===null?t.noPrice:new Intl.NumberFormat(undefined,{style:'currency',currency}).format(n/100);
   const warning=localError||(isStale?t.stale:blocked()?t.blocked:'');
   let body='';
   if(editing){
    const active=d.catalogue.filter(p=>p.active!==false),match=active.filter(p=>{const q=words(state.query);return !q||words([p.name,p.sku,root.AkiPosV4?.meta(d.layout,p).label].join(' ')).includes(q);});
    body='<form class="hp-variant-form" data-form="hp-variant-save"><div class="hp-variant-scroll" data-pos-scroll="variant-editor"><p>'+esc(t.help)+'</p><label>'+esc(t.group)+'<input name="variant_title" data-variant-focus="title" maxlength="80" required value="'+esc(state.title)+'" '+(disabled?'disabled':'')+'></label><section><h3>'+esc(t.selected)+' <span>'+state.items.length+'/'+MAX+'</span></h3><ol class="hp-variant-selected">'+state.items.map((id,i)=>{const product=active.find(p=>String(p.id)===id);return '<li><span>'+esc(product?.name||t.missing)+'<small>'+esc(product?money(unitPrice(product)):id)+'</small></span><div>'+button('up','↑','data-id="'+esc(id)+'" data-variant-focus="up-'+esc(id)+'" aria-label="'+esc(t.moveUp+' '+(product?.name||''))+'" '+(disabled||i===0?'disabled':''))+button('down','↓','data-id="'+esc(id)+'" data-variant-focus="down-'+esc(id)+'" aria-label="'+esc(t.moveDown+' '+(product?.name||''))+'" '+(disabled||i===state.items.length-1?'disabled':''))+button('deselect','×','data-id="'+esc(id)+'" data-variant-focus="remove-'+esc(id)+'" aria-label="'+esc(t.removeOption+' '+(product?.name||''))+'" '+(disabled?'disabled':''))+'</div></li>';}).join('')+'</ol></section><section><h3>'+esc(t.available)+'</h3><label>'+esc(t.search)+'<input type="search" name="variant_search" data-variant-focus="search" maxlength="120" value="'+esc(state.query)+'"></label><div class="hp-variant-products">'+(match.map(product=>'<label class="hp-variant-product"><input type="checkbox" data-variant-option="'+esc(product.id)+'" data-variant-focus="option-'+esc(product.id)+'" '+(state.items.includes(String(product.id))?'checked ':'')+(disabled?'disabled':'')+'><span>'+esc(product.name)+'<small>'+esc(money(unitPrice(product)))+'</small></span></label>').join('')||'<p>'+esc(t.empty)+'</p>')+'</div></section><p class="hp-variant-note">'+esc(t.notice)+'</p></div><footer><span>'+esc(t.count)+'</span><button class="action-btn primary" type="submit" data-variant-focus="save" '+(disabled||state.items.length<2||state.items.length>MAX?'disabled':'')+'>'+esc(t.save)+'</button></footer></form>';
   }else{
    const c=config(d.layout,state.parent),rows=choices(d.layout,d.catalogue,state.parent,o);
    body='<div class="hp-variant-scroll" data-pos-scroll="variant-choices"><p>'+esc(o?.label||'')+' · '+esc(state.course?t.course+' '+state.course:t.asap)+'</p>'+(c?.invalid?'<p role="alert">'+esc(t.invalid)+'</p>':'<div class="hp-variant-options">'+rows.map(x=>{const low=x.product?.on_hand!=null&&Number(x.product.on_hand)<=0;return '<button class="action-btn hp-variant-option" type="button" data-action="hp-variant-choose" data-id="'+esc(x.id)+'" data-variant-focus="choose-'+esc(x.id)+'" '+(disabled||!x.product||x.price===null?'disabled':'')+'><strong>'+esc(x.product?.name||t.missing)+'</strong><span>'+esc(money(x.price))+'</span>'+(low?'<small title="'+esc(t.stockHelp)+'">'+esc(t.stock)+'</small>':'')+'</button>';}).join('')+'</div>')+'<p class="hp-variant-note">'+esc(t.price)+'</p><p class="hp-variant-note">'+esc(t.stockHelp)+'</p></div>';
   }
   return '<div class="hp-variant-overlay"><section class="hp-variant-dialog" role="dialog" aria-modal="true" aria-labelledby="hp-variant-title" tabindex="-1"><header><div><small>'+esc(editing?t.title:t.choose)+'</small><h2 id="hp-variant-title">'+esc(editing?p?.name||state.title:state.title)+'</h2></div>'+button('close',t.cancel,'data-variant-focus="close"')+'</header>'+(warning?'<div class="hp-variant-alert" role="alert">'+esc(warning)+button('reload',t.reload,'data-variant-focus="reload"')+'</div>':'')+body+(editing&&configured(d.layout,state.parent)?'<div class="hp-variant-remove">'+button('remove',t.remove,'data-variant-focus="remove" '+(disabled?'disabled':''))+'</div>':'')+'</section></div>';
  }
  const report=fn=>async(...args)=>{try{return await fn(...args);}catch(e){localError=e.message;ctx.refresh();throw e;}};
  return {render,action:report(action),save:report(save),open:report(open),captureFocus,restoreFocus,active:()=>!!state,dispose(){disposed=true;state=null;doc.removeEventListener('keydown',onKey,true);doc.removeEventListener('input',onInput);doc.removeEventListener('change',onChange);}};
 }
 root.AkiPosVariants={configured,config,choices,unitPrice,badge,validate,editorButton,fingerprint,text,create};
})(typeof window==='undefined'?globalThis:window);
