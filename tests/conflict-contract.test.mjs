import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('fresh HQ schema uses finite PT409 application conflicts',async()=>{
  for (const path of [
    'supabase/migrations/20260917145343_bulk_company_import.sql',
    'supabase/migrations/20260923001337_security_workspace_access.sql'
  ]) {
    const source=await read(path);
    assert.match(source,/errcode\s*=\s*'PT409'/i);
    assert.doesNotMatch(source,/errcode\s*=\s*'40001'/i);
  }
});

test('upgrade migration converts only the two HQ revision functions',async()=>{
  const source=await read('supabase/migrations/20261014122000_pt409_application_conflicts.sql');
  assert.match(source,/public\.crm_company_save\(text,integer,jsonb,boolean\)/);
  assert.match(source,/akihq_security\.write_workspace_snapshot\(text,jsonb,timestamp with time zone\)/);
  assert.match(source,/regexp_replace[\s\S]*40001[\s\S]*PT409/i);
  assert.match(source,/notify pgrst, 'reload schema'/i);
});
