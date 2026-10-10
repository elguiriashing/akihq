/* Run with: node tests/pos-v4-smoke.cjs
   A local, dependency-free controller contract test; hardware is not emulated. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const files=["assets/pos-v4.js","assets/pos-v4-dialogs.js","assets/hospitality-pos.js"];
const layout={mode:"restaurant",pages:[{id:"f",name:"Floor"}],tables:[{id:"t1",name:"1",page:"f",shape:"rectangle",x:5,y:5,width:15,height:15,seats:4}]};
const order={id:"o1",label:"Table 1",table_id:"t1",version:1,guests:2,note:"",lines:[{id:"l1",name:"Beer",quantity:2,unit_price_cents:250,note:"",seat:"",station:"bar"}],payments:[],total_cents:500,paid_cents:0};
let db={layout,layout_version:0,orders:[order],catalogue:[{id:"p1",name:"Beer",category:"Drinks",sale_price_cents:250},{id:"p2",name:"Fries",category:"Snacks",sale_price_cents:150}],tickets:[],can_manage:true,can_export:true};
const copy=x=>JSON.parse(JSON.stringify(x)),storage=new Map(),commands=[],toasts=[];let sequence=0;
const root={
 document:{querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,addEventListener(){},removeEventListener(){}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 navigator:{locks:{request:async(k,o,fn)=>fn({})}},crypto:{randomUUID:()=>"00000000-0000-4000-a000-"+String(++sequence).padStart(12,"0")},
 FormData:class{constructor(form){return form.fields}},setInterval:()=>0,clearInterval(){}
};
for(const file of files)new Function("window","globalThis",read(file))(root,root);
const h=root.AkiHospitality.create({
 actor:"u",workspace:{id:"w",currency:"EUR",name:"Test"},
 refresh(){},toast(...a){toasts.push(a.join(" "))},isActive:()=>true,
 client:{rpc:async(name,args)=>{
  if(name==="crm_hospitality_overview")return{data:copy(db)};
  if(name==="crm_hospitality_command"){
   const cmd=args.p_command;commands.push(cmd);
   if(cmd.action==="layout"){assert.equal(cmd.version,db.layout_version);db.layout=cmd.layout;db.layout_version++;return{data:{layout_version:db.layout_version}}}
   if(cmd.action==="line"){order.lines[0].quantity=cmd.quantity;order.total_cents=cmd.quantity*250;order.version++}
   return{data:{order_id:"o1",status:"open"}};
  }
  return{error:{message:"Unexpected RPC "+name}};
 }}
});
async function run(){
 h.render();for(let i=0;i<100;i++)await Promise.resolve();
 assert.match(h.render(),/hp-tile-table/);
 await h.action({dataset:{action:"hp-select",id:"o1"}});
 assert.match(h.render(),/hp-v4-product/);
 await h.action({dataset:{action:"hp-payment-panel"}});
 assert.match(h.render(),/Record payment/);
 await h.action({dataset:{action:"hp-split-panel"}});
 assert.match(h.render(),/Transfer selected items/);
 await h.action({dataset:{action:"hp-edit-item",id:"l1"}});
 assert.match(h.render(),/name="station"/);
 await h.action({dataset:{action:"hp-immersive"}});
 assert.match(h.render(),/hp-immersive/);
 await h.action({dataset:{action:"hp-panel-close"}});
 await h.action({dataset:{action:"hp-printer-panel"}});
 assert.match(h.render(),/Printer station/);
 await h.action({dataset:{action:"hp-panel-close"}});
 await h.action({dataset:{action:"hp-switch-view",id:"designer"}});
 assert.match(h.render(),/hp-v4-designer/);
 await h.submit({dataset:{form:"hp-menu-category"},fields:[["name","Cocktails"],["color","#aabbcc"]]});
 assert.ok(db.layout.menu.categories.some(c=>c.id==="Cocktails"));
 await h.submit({dataset:{form:"hp-menu-product",id:"p1"},fields:[["label","Pint"],["category","Cocktails"],["color","#112233"]]});
 assert.equal(db.layout.menu.products.p1.label,"Pint");
 await h.submit({dataset:{form:"hp-menu-presets"},fields:[["presets","No ice, Less sugar"]]});
 assert.ok(db.layout.menu.presets.includes("Less sugar"));
 await h.action({dataset:{action:"hp-switch-view",id:"terminal"}});
 await h.action({dataset:{action:"hp-select",id:"o1"}});
 assert.match(h.render(),/Cocktails/);
 await h.action({dataset:{action:"hp-quick-qty",order:"o1",line:"l1",delta:"1"}});
 assert.ok(commands.some(c=>c.action==="line"&&c.line_id==="l1"&&c.quantity===3));
 await h.submit({dataset:{form:"hp-payment",order:"o1",version:order.version},fields:[["amount","2.50"],["method","cash"],["tendered","2.50"],["reference",""]]});
 assert.ok(commands.some(c=>c.action==="payment"&&c.amount_cents===250));
 assert.deepEqual(toasts,[]);
 const css=read("assets/pos-v4.css"),base=read("assets/hospitality-pos.css");
 for(const rule of ["@media(min-width:901px)","@media(max-width:900px)","@media(max-width:560px)","orientation:landscape",":has(.hp-terminal.hp-immersive)"])assert.ok((css+"\n"+base).includes(rule),"Missing responsive rule: "+rule);
 h.dispose();
 console.log("PoS v4 controller, persistence, checkout and responsive contracts passed.");
}
run().catch(e=>{console.error(e);process.exitCode=1});
