import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as XLSX from 'xlsx';
const root=new URL('../assets/',import.meta.url);
function reader(){
 const context={XLSX,crypto,Uint8Array,Map,Set,Array,Number,String,Error,JSON,module:undefined,importScripts(){},self:{}};
 context.self=context;vm.createContext(context);
 vm.runInContext(readFileSync(new URL('company-import-core.js',root),'utf8'),context);
 vm.runInContext(readFileSync(new URL('company-import-worker.js',root),'utf8'),context);
 return async(action,payload)=>{let answer;context.postMessage=x=>answer=x;await context.onmessage({data:{id:1,action,payload}});if(answer.error)throw new Error(answer.error);return JSON.parse(JSON.stringify(answer.result));};
}
test('only explicitly selected worksheet is parsed, required mapping gates preview, ignored system fields never become live IDs',async()=>{
 const workbook=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Province','Count'],['Madrid',999]]),'Coverage');
 XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['id','name','address','city','type','catalogueVenueId','status'],['source-ref','Cafe Test','Calle Uno 1','Madrid','Venue','fake','Customer']]),'Companies');
 XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['name','address'],['Do not import','Calle Other 9']]),'Other data');
 const call=reader();const metadata=await call('open',{bytes:XLSX.write(workbook,{type:'array',bookType:'xlsx'})});
 assert.deepEqual(metadata.sheets,['Coverage','Companies','Other data']);
 let selected=await call('sheet',{sheet:'Coverage'});await assert.rejects(call('preview',{mapping:selected.mapping}),/business name and street address/);
 selected=await call('sheet',{sheet:'Companies'});assert.equal(selected.total,1);assert.equal(selected.mapping.type,4);
 const preview=await call('preview',{mapping:selected.mapping});assert.equal(preview.valid,1);
 const batch=await call('batch',{mapping:selected.mapping,offset:0});assert.equal(batch[0].externalId,'source-ref');assert.equal(batch[0].id,undefined);assert.equal(batch[0].catalogueVenueId,undefined);assert.equal(batch[0].status,undefined);
 await assert.rejects(call('sheet',{sheet:'Missing'}),/worksheet/);
});
test('formula cells and oversized data are rejected without truncating or evaluating values',async()=>{
 const wb=XLSX.utils.book_new();const sheet=XLSX.utils.aoa_to_sheet([['name','address'],['Formula cafe','Calle One 1']]);sheet.A2.f='WEBSERVICE("https://untrusted.example")';XLSX.utils.book_append_sheet(wb,sheet,'Companies');
 const call=reader();await call('open',{bytes:XLSX.write(wb,{type:'array',bookType:'xlsx'})});const selected=await call('sheet',{sheet:'Companies'});const preview=await call('preview',{mapping:selected.mapping});assert.equal(preview.invalid,1);assert.match(preview.sample[0].error,/Formula/);
 const wide=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wide,{'!ref':'A1:DX300001',A1:{t:'s',v:'name'}},'Huge');await call('open',{bytes:XLSX.write(wide,{type:'array',bookType:'xlsx'})});await assert.rejects(call('sheet',{sheet:'Huge'}),/250,000/);
});
test('actual Spain workbook reads Companies only and retains all 107,357 rows', {skip:!process.env.AKIPASA_IMPORT_FIXTURE},async()=>{
 const call=reader(),buffer=readFileSync(process.env.AKIPASA_IMPORT_FIXTURE);const bytes=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
 const start=performance.now(),meta=await call('open',{bytes});assert.equal(meta.sheets.length,4);
 const selected=await call('sheet',{sheet:'Companies'});assert.equal(selected.total,107357);
 const preview=await call('preview',{mapping:selected.mapping});assert.equal(preview.total,107357);assert.equal(preview.valid+preview.invalid,107357);
 const last=await call('batch',{mapping:selected.mapping,offset:107250});assert.equal(last.length,107);
 console.log(JSON.stringify({fixtureRows:preview.total,valid:preview.valid,invalid:preview.invalid,elapsedMs:Math.round(performance.now()-start)}));
});
