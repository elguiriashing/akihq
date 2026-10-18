/* Synthetic SKU choices layered onto the retained course/service browser fixture. */
'use strict';
const variantDB=window.fixture.db;
for(const [id,name,price,stock] of [['p0','Café pequeño',200,30],['p12','Café grande',320,24],['p24','Café doble',390,0]]){
 Object.assign(variantDB.catalogue.find(p=>p.id===id),{name,sale_price_cents:price,on_hand:stock});
}
variantDB.layout.menu.products.p0.label='Café con leche';
variantDB.layout.menu.variants={p0:{version:1,title:document.documentElement.lang==='es'?'Tamaño del café':'Coffee size',items:['p0','p12','p24']}};
variantDB.layout_version=4;
void window.fixture.controller.action({dataset:{action:'hp-refresh'}});
