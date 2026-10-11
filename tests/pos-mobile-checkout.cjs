"use strict";
const {readFileSync}=require("node:fs");
const assert=require("node:assert/strict");
const css=readFileSync("assets/pos-responsive.css","utf8");
const html=readFileSync("index.html","utf8");
const sw=readFileSync("sw.js","utf8");
const rules=[
  "@media (max-width:900px)",
  "@media (max-width:767px)",
  "@media (max-width:500px)",
  "orientation:landscape",
  "height:auto!important",
  "overflow:visible!important",
  "padding-bottom:calc(100px + env(safe-area-inset-bottom,0px))",
  ".hp-order-open .hp-quick-actions",
  "grid-template-columns:repeat(2,minmax(0,1fr))!important",
  "min-height:52px!important",
  "body:has(.hp-terminal.hp-immersive)",
  "body:has(.hp-terminal.hp-order-open) .mobile-tabbar",
  "body:has(.hp-terminal.hp-order-open) .content-shell",
  ".hp-order-open > .hp-register-menu",
  ".hp-order-open > .hp-register-ticket",
  "overflow:hidden!important",
  "min-height:252px!important",
  "max-height:670px",
  "min-width:768px"
];
for(const rule of rules)assert.ok(css.includes(rule),"Missing PoS responsive rule: "+rule);
assert.match(html,/pos-responsive\.css\?v=2/);
assert.match(sw,/pos-responsive\.css\?v=2/);
console.log("PoS mobile checkout CSS contracts passed; physical browser layout still requires device acceptance.");
