// Synthetic fixture only. Never connect this schema generator to production.
import {setupKitchenDatabase} from './pos-kds-fixture.mjs';
const parts=[];
await setupKitchenDatabase({async exec(sql){parts.push(sql);}});
process.stdout.write(parts.join('\n'));
