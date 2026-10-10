import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const css=readFileSync('assets/pos-v4.css','utf8');
const sw=readFileSync('sw.js','utf8');
const html=readFileSync('index.html','utf8');
test('phone and portrait tablet checkout is not clipped by viewport grid',()=>{
  const responsive=css.slice(css.indexOf('/* Responsive register:'));
  assert.match(responsive,/max-width:900px/);
  assert.match(responsive,/height:auto!important/);
  assert.match(responsive,/overflow:visible!important/);
  assert.match(responsive,/hp-register-ticket/);
  assert.match(responsive,/hp-quick-actions/);
  assert.match(responsive,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(responsive,/safe-area-inset-bottom/);
  assert.match(responsive,/orientation:landscape/);
});
test('responsive stylesheet is cache-busted for installed app',()=>{
  assert.match(sw,/akihq-v106/);
  assert.match(sw,/pos-v4.css\?v=3/);
  assert.match(html,/pos-v4.css\?v=3/);
});
