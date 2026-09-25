import {privacyEdge} from './privacy-edge.js';
Deno.serve((request: Request)=>privacyEdge(request,{
 SUPABASE_URL:Deno.env.get('SUPABASE_URL'),
 SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 SUPABASE_PUBLISHABLE_KEY:Deno.env.get('SUPABASE_ANON_KEY')
}));
