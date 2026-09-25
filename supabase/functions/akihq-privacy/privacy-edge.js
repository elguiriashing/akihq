import {handlePrivacy} from './privacy.js';
const prefix='/akihq-privacy';
const allowed=new Map([['/overview','GET'],['/settings','POST'],['/consent','POST'],['/requests','POST'],['/request-action','POST'],['/subject-export','GET']]);
export async function privacyEdge(request,env){
 const origin=request.headers.get('origin'),headers={'cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};
 if(origin&&origin!=='https://crm.akipasa.com')return Response.json({ok:false,message:'Origin not allowed'},{status:403,headers});
 if(origin)Object.assign(headers,{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type, x-workspace-id'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url),path=url.pathname.startsWith('/functions/v1'+prefix+'/')?url.pathname.slice(('/functions/v1'+prefix).length):url.pathname.startsWith(prefix+'/')?url.pathname.slice(prefix.length):'';
 if(path==='/health'&&request.method==='GET')return Response.json({ok:true,release:'2026-09-25-pos-1',capabilities:{privacy:1},marketing_enabled:false},{headers});
 if(allowed.get(path)!==request.method)return Response.json({ok:false,message:'Endpoint unavailable'},{status:404,headers});
 // Every administrative path validates the user's session with Supabase Auth,
 // then checks live workspace membership before any service-role RPC.
 url.pathname='/api/privacy'+path;
 const response=await handlePrivacy(new Request(url,request),{...env,PRIVACY_MARKETING_ENABLED:'false'});
 const resultHeaders=new Headers(response.headers);for(const [k,v] of Object.entries(headers))resultHeaders.set(k,v);
 return new Response(response.body,{status:response.status,headers:resultHeaders});
}
