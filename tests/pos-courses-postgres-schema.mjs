// Synthetic fixture only. This generator must never be applied to production.
import {readFileSync} from 'node:fs';
import {setupKitchenDatabase} from './pos-kds-fixture.mjs';
const parts=[];
await setupKitchenDatabase({async exec(sql){parts.push(sql);}});
parts.push(readFileSync(new URL('../supabase/migrations/20261018184327_pos_course_control.sql',import.meta.url),'utf8'));
process.stdout.write(parts.join('\n'));
