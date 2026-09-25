import test from 'node:test';import assert from 'node:assert/strict';
import {privacyEdge} from './privacy-edge.js';
const base='https://project.supabase.co/functions/v1/akihq-privacy';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service',SUPABASE_PUBLISHABLE_KEY:'test-public'};
test('edge health/CORS is public metadata; foreign origins and sending endpoints are rejected',async()=>{
 const health=await privacyEdge(new Request(base+'/health'),env);assert.equal((await health.json()).marketing_enabled,false);
 const denied=await privacyEdge(new Request(base+'/overview',{headers:{origin:'https://other.example'}}),env);assert.equal(denied.status,403);
 const options=await privacyEdge(new Request(base+'/overview',{method:'OPTIONS',headers:{origin:'https://crm.akipasa.com'}}),env);assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),'https://crm.akipasa.com');
 const send=await privacyEdge(new Request(base+'/marketing/send',{method:'POST'}),env);assert.equal(send.status,404);
});
test('edge admin path rejects missing user session before privileged storage access',async()=>{
 const r=await privacyEdge(new Request(base+'/overview',{headers:{'x-workspace-id':'ws_akipasa'}}),env);assert.equal(r.status,401);
});
test('edge verifies live session and permission before returning scoped overview',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,opts});
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'10000000-0000-4000-8000-000000000001'});
 if(url.endsWith('/crm_privacy_access'))return Response.json(true);
 if(url.endsWith('/crm_privacy_overview')){assert.deepEqual(JSON.parse(opts.body),{p_workspace:'ws_akipasa',p_actor:'10000000-0000-4000-8000-000000000001'});return Response.json({settings:null,requests:[]});}
 throw Error('Unexpected request');};
 try{const r=await privacyEdge(new Request(base+'/overview',{headers:{authorization:'Bearer test-user','x-workspace-id':'ws_akipasa'}}),env);assert.equal(r.status,200);assert.equal(calls.length,3);}finally{globalThis.fetch=original;}
});
test('deployable edge bundle equals the tested source',async()=>{
 const {readFileSync}=await import('node:fs');for(const name of ['privacy.js','privacy-edge.js'])assert.equal(readFileSync(new URL('../supabase/functions/akihq-privacy/'+name,import.meta.url),'utf8'),readFileSync(new URL('./'+name,import.meta.url),'utf8'));
});
