// Keep the deployed adapter identical to the independently tested Worker module.
import {readFileSync,writeFileSync} from 'node:fs';
for(const name of ['privacy.js','privacy-edge.js'])writeFileSync(new URL('../supabase/functions/akihq-privacy/'+name,import.meta.url),readFileSync(new URL('../cloudflare/'+name,import.meta.url)));
