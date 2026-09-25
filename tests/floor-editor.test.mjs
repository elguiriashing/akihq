import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from '../cloudflare/node_modules/jsdom/lib/api.js';
const source=readFileSync(new URL('../assets/floor-editor.js',import.meta.url),'utf8');
test('drag geometry clamps move and resize inside page',()=>{const d=new JSDOM('',{runScripts:'outside-only'});d.window.eval(source);const g=d.window.AkiFloorEditor.geometry,t={x:20,y:30,width:25,height:20};assert.equal(g(t,100,-200).x,75);assert.equal(g(t,100,-200).y,0);assert.equal(g(t,100,-200,true).width,80);assert.equal(g(t,100,-200,true).height,5);d.window.close();});
test('pointer drag, cancelled resize and keyboard editing change draft without saving it',()=>{
 const d=new JSDOM('<div class="hp-floor"><button data-floor-edit data-id="one"><span data-floor-resize></span></button></div>',{runScripts:'outside-only'});const w=d.window;w.eval(source);let draft={tables:[{id:'one',x:10,y:20,width:20,height:20}]};const el=w.document.querySelector('button');el.parentElement.getBoundingClientRect=()=>({width:100,height:100});const editor=w.AkiFloorEditor.create({document:w.document,getDraft:()=>draft});
 const fire=(name,target,x,y)=>{const e=new w.Event(name,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:x,clientY:y});target.dispatchEvent(e);};
 fire('pointerdown',el,10,20);fire('pointermove',el,40,60);fire('pointerup',el,40,60);assert.equal(draft.tables[0].x,40);assert.equal(draft.tables[0].y,60);
 fire('pointerdown',el.firstElementChild,40,60);fire('pointermove',el,80,80);fire('pointercancel',el,80,80);assert.equal(draft.tables[0].width,20);
 el.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,shiftKey:true}));assert.equal(draft.tables[0].x,35);
 editor.dispose();d.window.close();
});
