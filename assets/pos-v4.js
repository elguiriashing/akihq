/* Touch-first PoS menu, cross-device settings stored in versioned floor layout. */
(function(root){
"use strict";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const color=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||""))?v:"#8175db";
const money=(v,c)=>new Intl.NumberFormat(undefined,{style:"currency",currency:c||"EUR"}).format(Number(v)/100);
const base=p=>String(p.category_name||p.category||p.group_name||p.group||"Other").trim()||"Other";
const menu=l=>({categories:Array.isArray(l?.menu?.categories)?l.menu.categories:[],products:l?.menu?.products&&typeof l.menu.products==="object"?l.menu.products:{},presets:Array.isArray(l?.menu?.presets)?l.menu.presets:["No ice","Extra ice","No salt","Well done"]});
const meta=(l,p)=>menu(l).products[String(p.id)]||{};
function groups(l,items){
 const names=[...new Set(items.map(p=>String(meta(l,p).category||base(p))))];
 const configured=menu(l).categories.filter(c=>c?.id&&c.name).map(c=>({id:String(c.id),name:String(c.name),color:color(c.color)}));
 return [{id:"All",name:"All",color:"#8068ec"},...configured,...names.filter(x=>!configured.some(c=>c.id===x)).map(id=>({id,name:id,color:"#697eab"}))];
}
function items(l,all,selected){
 return all.filter(p=>{const m=meta(l,p);return !m.hidden&&(selected==="All"||String(m.category||base(p))===selected)}).sort((a,b)=>Number(meta(l,a).rank||999)-Number(meta(l,b).rank||999)||String(a.name).localeCompare(String(b.name)));
}
function categoryButtons(l,all,selected){
 return '<nav class="hp-category-grid" aria-label="Categories">'+groups(l,all).map(c=>'<button class="action-btn" type="button" data-action="hp-category" data-id="'+esc(c.id)+'" aria-pressed="'+(c.id===selected)+'" style="--pos-color:'+color(c.color)+'">'+esc(c.name)+'</button>').join("")+'</nav>';
}
function itemButtons(l,all,selected,o,currency){
 return '<div class="hp-product-scroll"><div class="hp-product-buttons">'+(items(l,all,selected).map(p=>{const m=meta(l,p);return '<button type="button" class="action-btn hp-v4-product" data-action="hp-add" data-order="'+esc(o.id)+'" data-version="'+esc(o.version)+'" data-id="'+esc(p.id)+'" style="--pos-color:'+color(m.color)+'"><span>'+esc(m.label||p.name)+'</span><small>'+esc(money(p.sale_price_cents,currency))+'</small></button>'}).join("")||'<p>No items in this category.</p>')+'</div></div>';
}
function designer(data,active){
 const l=data.layout,all=groups(l,data.catalogue),chosen=all.find(x=>x.id===active)||all[0],configured=menu(l);
 let out='<section class="hp-v4-designer"><header><h2>Visual menu designer</h2><p>Organise the actual products from Inventory into category and product buttons.</p><button type="button" class="action-btn" data-action="navigate" data-route="inventory">Add products / edit prices in Inventory ↗</button></header>';
 out+='<section class="hp-v4-section"><h3>Categories</h3><div class="hp-v4-categories">'+all.filter(x=>x.id!=="All").map(c=>'<button class="hp-v4-category" type="button" data-action="hp-designer-category" data-id="'+esc(c.id)+'" aria-pressed="'+(chosen.id===c.id)+'" style="--pos-color:'+color(c.color)+'"><strong>'+esc(c.name)+'</strong><small>'+items(l,data.catalogue,c.id).length+' visible</small></button>').join("")+'</div>';
 out+='<form class="hp-v4-inline-form" data-form="hp-menu-category"><label>New category<input name="name" maxlength="48" placeholder="Cocktails" required></label><label>Colour<input type="color" name="color" value="#826deb"></label><button type="submit" class="action-btn primary">Add category</button></form>';
 if(chosen.id!=="All")out+='<form class="hp-v4-inline-form" data-form="hp-menu-category-edit" data-id="'+esc(chosen.id)+'"><label>Selected category<input name="name" maxlength="48" required value="'+esc(chosen.name)+'"></label><label>Colour<input name="color" type="color" value="'+color(chosen.color)+'"></label><button type="submit" class="action-btn primary">Save category</button></form>';
 out+='</section><section class="hp-v4-section"><h3>Product buttons</h3><p>Display labels, button colour, category and visibility are stored on the shared PoS layout. Prices remain in Inventory.</p><div class="hp-v4-items">';
 out+=(data.catalogue||[]).map(p=>{const m=meta(l,p),category=m.category||base(p);return '<form class="hp-v4-product-row" data-form="hp-menu-product" data-id="'+esc(p.id)+'"><div class="hp-v4-swatch" style="--pos-color:'+color(m.color)+'"><strong>'+esc(m.label||p.name)+'</strong><small>'+esc(money(p.sale_price_cents))+'</small></div><label>Button name<input name="label" required maxlength="80" value="'+esc(m.label||p.name)+'"></label><label>Category<select name="category">'+all.filter(c=>c.id!=="All").map(c=>'<option value="'+esc(c.id)+'" '+(category===c.id?"selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select></label><label>Colour<input type="color" name="color" value="'+color(m.color)+'"></label><label class="hp-v4-check"><input type="checkbox" name="hidden" '+(m.hidden?"checked":"")+'> Hide</label><button type="submit" class="action-btn primary">Apply</button></form>'}).join("")||'<p>Create products in Inventory to populate this menu.</p>';
 out+='</div></section><section class="hp-v4-section"><h3>Quick preparation notes</h3><p>Text-only instructions, not priced modifiers.</p><form class="hp-v4-inline-form" data-form="hp-menu-presets"><label>Comma-separated notes<input name="presets" maxlength="300" value="'+esc(configured.presets.join(", "))+'"></label><button class="action-btn primary" type="submit">Save notes</button></form></section></section>';
 return out;
}
root.AkiPosV4={esc,color,money,base,menu,meta,groups,items,categoryButtons,itemButtons,designer};
})(typeof window==="undefined"?globalThis:window);