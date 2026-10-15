import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../assets/app-v32.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('  function selectInitialWorkspace('), source.indexOf('  async function bootWithSession('));
const select = vm.runInNewContext(helpers + '\nselectInitialWorkspace');
const workspaces = [{ id: 'saved', toolKeys: ['pos'] }, { id: 'target', toolKeys: ['inventory'] }, { id: 'unlicensed', toolKeys: [] }];

test('explicit authorised location wins over saved workspace', () => {
  assert.equal(select(workspaces, new URLSearchParams('workspace=target'), 'saved'), workspaces[1]);
});
for (const query of ['workspace=unknown', 'workspace=unlicensed', 'workspace=', 'workspace=target&workspace=saved']) {
  test(`explicit unavailable or ambiguous location never falls back: ${query}`, () => {
    assert.equal(select(workspaces, new URLSearchParams(query), 'saved'), null);
  });
}
test('normal workspace entry retains saved selection', () => {
  assert.equal(select(workspaces, new URLSearchParams(), 'saved'), workspaces[0]);
});
test('OAuth intent stores only requested IDs and restores them only on auth return', () => {
  const start = source.indexOf('  // Keep only the explicit location intent');
  const end = source.indexOf('  // Read before Supabase initializes', start);
  const data = new Map();
  const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const run = (search, hash = '') => {
    const params = new URLSearchParams(search);
    vm.runInNewContext(source.slice(start, end), { initialSearchParams: params, sessionStorage: storage, location: { hash } });
    return params;
  };
  run('workspace=target&access_token=must-not-store');
  assert.doesNotMatch([...data.values()].join(), /must-not-store/);
  assert.equal(run('').has('workspace'), false);
  assert.equal(run('code=provider-code').get('workspace'), 'target');
  assert.equal(data.size, 0);
});
test('denied explicit target exits before activating or loading any workspace', async () => {
  let activated = false, pending = false;
  const context = { initialSearchParams: new URLSearchParams('workspace=unlicensed'), localStorage: { getItem: () => 'saved' },
    availableWorkspaces: [], authUser: null, authRole: null,
    getSupabaseClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { app_role: 'user' } }) }) }) }) }),
    loadAccessibleWorkspaces: async () => workspaces,
    activateWorkspace: () => { activated = true; }, renderRequestedWorkspaceUnavailable: () => { pending = true; }, selectInitialWorkspace: select };
  const start = source.indexOf('  async function bootWithSession('), end = source.indexOf('\n  async function finishBoot(', start);
  vm.runInNewContext(source.slice(start, end) + '\nthis.boot = bootWithSession;', context);
  await context.boot({ user: { id: 'owner' } });
  assert.equal(pending, true); assert.equal(activated, false); assert.equal(context.authUser, null);
});
