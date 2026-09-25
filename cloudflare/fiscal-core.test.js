import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const require=createRequire(import.meta.url), core=require('../assets/fiscal-core.js');
test('integer-cent mixed IVA and fractional quantity calculations match documented round-half-up policy',()=>{
 const result=core.calculate([{unit_price_cents:1100,quantity:'1',rate_bps:1000},{unit_price_cents:1210,quantity:'1',rate_bps:2100},{unit_price_cents:101,quantity:'0.5',rate_bps:400}]);
 assert.equal(result.total_cents,2361); assert.equal(result.tax_cents,312); assert.equal(result.taxable_base_cents,2049);
 assert.equal(core.calculateLine({unit_price_cents:101,quantity:'0.005',rate_bps:1000}).total_cents,1);
});
test('money previews reject exponent notation, excessive precision, invalid IVA and overflows',()=>{
 for(const quantity of ['1e2','-1','0','1.00001','NaN']) assert.throws(()=>core.calculateLine({unit_price_cents:100,quantity,rate_bps:2100}));
 assert.throws(()=>core.calculateLine({unit_price_cents:100,quantity:'1',rate_bps:500}));
 assert.throws(()=>core.calculateLine({unit_price_cents:2000000000,quantity:'2',rate_bps:2100}));
});
test('NIF/NIE/CIF checksums and scope checks reject invalid or unsupported identity',()=>{
 assert.equal(core.validSpanishTaxId('12345678Z'),true); assert.equal(core.validSpanishTaxId('X1234567L'),true); assert.equal(core.validSpanishTaxId('B12345674'),true);
 assert.equal(core.validSpanishTaxId('B12345670'),false); assert.equal(core.validSpanishTaxId('12345678A'),false);
 assert.equal(core.readiness({},{}).ready,false);
});
test('repeated fractional refunds conserve base/tax/gross and reject over-refunds',()=>{
 const original={quantity:'3',base_cents:275,total_cents:303};
 const refunds=[0,1,2].map(q=>core.refundAllocation(original,String(q),'1'));
 assert.equal(refunds.reduce((s,r)=>s+r.total_cents,0),-303); assert.equal(refunds.reduce((s,r)=>s+r.tax_cents,0),-28); assert.equal(refunds.reduce((s,r)=>s+r.base_cents,0),-275);
 assert.throws(()=>core.refundAllocation(original,'2','2'),/exceeds/);
});

test('fiscal ledger uses stable server snapshot, all pages, workspace checks and spreadsheet-safe text',async()=>{
 const make=(i)=>({id:String(i).padStart(8,'0'),workspace_id:'ws_a',document_number:`F2-${i}`,document_type:'F2',issue_date:'2026-09-23',operation_date:'2026-09-23',issuer_snapshot:{tax_id:'B12345674'},customer_snapshot:{},currency:'EUR',taxable_base_cents:100,tax_cents:21,total_cents:121,lines:[{line_number:1,sku:'00123',description:'=HYPERLINK("evil")',quantity:1,unit_price_cents:121,discount_bps:0,rate_bps:2100,treatment:'taxable',reason:'',base_cents:100,tax_cents:21,total_cents:121}],tax_summary:[{rate_bps:2100,treatment:'taxable',reason:'',base_cents:100,tax_cents:21,total_cents:121}]});
 const calls=[], records=Array.from({length:251},(_,i)=>make(i));
 const client={rpc:async(name,args)=>{calls.push(args);return{data:{documents:args.p_after?records.slice(250):records.slice(0,250),as_of:'2026-09-23T00:00:00Z'}}}};
 const result=await core.collectLedger(client,{workspace:'ws_a',from:'2026-09-01',through:'2026-09-23'}); assert.equal(result.documents.length,251); assert.equal(calls[0].p_as_of,null); assert.equal(calls[1].p_as_of,'2026-09-23T00:00:00Z');
 const XLSX=require('../assets/vendor/xlsx-0.20.3.min.js'), workbook=core.ledgerWorkbook(XLSX,result), bytes=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}), back=XLSX.read(bytes,{type:'buffer'});
 assert.equal(back.Sheets.Lines.D2.v,'00123'); assert.equal(back.Sheets.Lines.E2.t,'s'); assert.equal(back.Sheets.Lines.E2.f,undefined);
 await assert.rejects(core.collectLedger({rpc:async()=>({data:{as_of:'now',documents:[{...make(1),workspace_id:'other'}]}})},{workspace:'ws_a',from:'2026-09-01',through:'2026-09-23'}),/workspace/);
 await assert.rejects(core.collectLedger({rpc:async()=>({error:{message:'permission denied'}})},{workspace:'ws_a',from:'2026-09-01',through:'2026-09-23'}),/permission denied/);
});
test('sub-cent partial refunds never invert IVA or create base on a zero-gross return',()=>{
 const original={quantity:'4',base_cents:2,total_cents:3};
 const parts=[0,1,2,3].map(q=>core.refundAllocation(original,String(q),'1'));
 for(const p of parts){assert.ok(p.total_cents<=0);assert.ok(p.base_cents<=0);assert.ok(p.tax_cents<=0);if(p.total_cents===0)assert.equal(p.base_cents,0);}
 assert.equal(parts.reduce((s,p)=>s+p.total_cents,0),-3);assert.equal(parts.reduce((s,p)=>s+p.base_cents,0),-2);
});
