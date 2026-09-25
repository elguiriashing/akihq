/* Pointer/touch and keyboard geometry editor. Saving uses the original server version. */
(function(root){
 'use strict';
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 function geometry(table,dx,dy,resize=false){
  const result={...table};
  if(resize){result.width=clamp(Math.round((Number(table.width)+dx)*10)/10,5,100-Number(table.x));result.height=clamp(Math.round((Number(table.height)+dy)*10)/10,5,100-Number(table.y));}
  else {result.x=clamp(Math.round((Number(table.x)+dx)*10)/10,0,100-Number(table.width));result.y=clamp(Math.round((Number(table.y)+dy)*10)/10,0,100-Number(table.height));}
  return result;
 }
 function create({document,getDraft,onChange}){
  let drag=null;
  function paint(el,t){for(const k of ['x','y','width','height'])el.style[{x:'left',y:'top',width:'width',height:'height'}[k]]=`${t[k]}%`;}
  function down(e){
   const el=e.target.closest?.('[data-floor-edit]'),draft=getDraft();
   if(!el||!draft||e.button>0)return;
   const table=draft.tables.find(t=>t.id===el.dataset.id),box=el.closest('.hp-floor').getBoundingClientRect();
   if(!table||!box.width||!box.height)return;e.preventDefault();
   drag={el,table:{...table},box,x:e.clientX,y:e.clientY,pointer:e.pointerId,resize:!!e.target.closest('[data-floor-resize]')};
   el.setPointerCapture?.(e.pointerId);
  }
  function move(e){if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();const t=geometry(drag.table,(e.clientX-drag.x)*100/drag.box.width,(e.clientY-drag.y)*100/drag.box.height,drag.resize);const draft=getDraft();if(!draft)return;draft.tables=draft.tables.map(x=>x.id===t.id?t:x);paint(drag.el,t);onChange?.(t);}
  function up(e){if(!drag||e.pointerId!==drag.pointer)return;drag.el.releasePointerCapture?.(e.pointerId);drag=null;}
  function cancel(e){if(!drag||e.pointerId!==drag.pointer)return;const draft=getDraft();if(draft){draft.tables=draft.tables.map(t=>t.id===drag.table.id?drag.table:t);paint(drag.el,drag.table);}drag=null;}
  function key(e){const el=e.target.closest?.('[data-floor-edit]'),draft=getDraft();if(!el||!draft||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const t=draft.tables.find(t=>t.id===el.dataset.id);const step=e.shiftKey?5:1;const next=geometry(t,e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0,e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0,e.altKey);draft.tables=draft.tables.map(x=>x.id===t.id?next:x);paint(el,next);onChange?.(next);}
  for(const [name,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',cancel],['keydown',key]])document.addEventListener(name,handler);
  return {dispose(){for(const [name,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',cancel],['keydown',key]])document.removeEventListener(name,handler);drag=null;}};
 }
 root.AkiFloorEditor={create,geometry};
})(typeof window==='undefined'?globalThis:window);
