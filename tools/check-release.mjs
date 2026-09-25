// Read-only production preflight. Public configuration only; no user impersonation.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const scope={window:{}};vm.runInNewContext(readFileSync(new URL('../config.js',import.meta.url),'utf8'),scope);const c=scope.window.AKIHQ_CONFIG;
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw Error(`Release prerequisite failed: ${new URL(url).pathname} HTTP ${r.status}`);return r.json();}
const db=await json(c.SUPABASE_URL+'/rest/v1/rpc/crm_release_readiness',{method:'POST',headers:{apikey:c.SUPABASE_ANON_KEY,'content-type':'application/json'},body:'{}'});
if(db.release!=='2026-09-25-pos-1'||db.database_ready!==true||db.fiscal_issuance_enabled!==false)throw Error('Database release is not ready or fiscal gate differs');
const edge=await json(c.PRIVACY_GATEWAY_URL+'/health');
if(edge.release!==db.release||edge.capabilities?.privacy!==1||edge.marketing_enabled!==false)throw Error('Privacy backend release is not ready');
const denied=await fetch(c.PRIVACY_GATEWAY_URL+'/overview',{headers:{'x-workspace-id':'ws_akipasa'},signal:AbortSignal.timeout(20000)});
if(denied.status!==401)throw Error('Anonymous privacy request did not fail closed');
console.log('Database and privacy backend release match; anonymous privacy access denied; fiscal issuance and marketing remain disabled.');
