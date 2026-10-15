import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../assets/app-v32.js', import.meta.url), 'utf8');

function fixture({ failure = false, dirty = false } = {}) {
  const sessions = { hq: true, akipasa: true, business: true };
  const calls = [];
  const auth = { signOut: async options => {
    calls.push(options?.scope || 'global');
    if (failure) return { error: new Error('offline') };
    if (options?.scope === 'local') sessions.hq = false;
    else Object.keys(sessions).forEach(key => { sessions[key] = false; });
    return {};
  } };
  const context = {
    ui: {}, authUser: { id: 'fixture-owner' }, authRole: 'administrator',
    workspaceMutationVersion: dirty ? 1 : 0, workspaceCommittedVersion: 0,
    getSupabaseClient: () => ({ auth }), renderPortal() {}, toast() {},
    clearSignedOutDeviceCache: id => { context.cleared = id; },
    renderLoginScreen: () => { context.login = true; },
  };
  vm.createContext(context);
  return { context, sessions, calls, auth };
}

const logoutStart = source.indexOf('      case "cloud-signout":');
const logoutEnd = source.indexOf('      case "set-telegram-tab":', logoutStart);
const logoutBody = source.slice(logoutStart, logoutEnd);

for (const action of ['cloud-signout', 'crm-signout']) {
  test(`${action} ends only the HQ session and preserves other product sessions`, async () => {
    const f = fixture();
    const run = vm.runInContext(`(async action => { switch(action) { ${logoutBody} } })`, f.context);
    await run(action);
    assert.deepEqual(f.calls, ['local']);
    assert.deepEqual(f.sessions, { hq: false, akipasa: true, business: true });
    assert.equal(f.context.cleared, 'fixture-owner');
    assert.equal(f.context.authUser, null);
    assert.equal(f.context.login, true);
  });
}

test('pending workspace changes block local logout before session or cache changes', async () => {
  const f = fixture({ dirty: true });
  const run = vm.runInContext(`(async () => { switch('crm-signout') { ${logoutBody} } })`, f.context);
  await assert.rejects(run(), /pending workspace changes/);
  assert.deepEqual(f.calls, []); assert.equal(f.sessions.hq, true); assert.equal(f.context.cleared, undefined);
});

test('failed provider logout does not pretend the HQ session or cache is cleared', async () => {
  const f = fixture({ failure: true });
  const run = vm.runInContext(`(async () => { switch('cloud-signout') { ${logoutBody} } })`, f.context);
  await assert.rejects(run(), /offline/);
  assert.equal(f.context.authUser.id, 'fixture-owner');
  assert.equal(f.context.cleared, undefined); assert.equal(f.context.login, undefined);
});

test('access-denied exit cannot revoke sessions in other products', async () => {
  const f = fixture(); let click;
  Object.assign(f.context, {
    appRoot: {}, portal: {}, applySettings() {}, escapeHtml: String, icon: () => '',
    document: { getElementById: () => ({ addEventListener: (_event, handler) => { click = handler; } }) },
  });
  const start = source.indexOf('  function renderAccessDenied(');
  const end = source.indexOf('\n  async function loadAccessibleWorkspaces(', start);
  vm.runInContext(`${source.slice(start, end)}\nrenderAccessDenied('fixture@example.invalid');`, f.context);
  await click();
  assert.deepEqual(f.calls, ['local']); assert.equal(f.sessions.akipasa, true); assert.equal(f.sessions.business, true);
});

test('failed workspace authorization closes only the current HQ session', async () => {
  const f = fixture();
  const client = { auth: f.auth, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { app_role: 'user' } }) }) }) }) };
  Object.assign(f.context, {
    getSupabaseClient: () => client, availableWorkspaces: [], loadAccessibleWorkspaces: async () => [],
    renderAccessDenied: () => { f.context.denied = true; },
  });
  const start = source.indexOf('  async function bootWithSession(');
  const end = source.indexOf('\n  async function finishBoot(', start);
  vm.runInContext(source.slice(start, end), f.context);
  await f.context.bootWithSession({ user: { id: 'fixture-owner', email: 'fixture@example.invalid' } });
  assert.deepEqual(f.calls, ['local']); assert.equal(f.context.denied, true);
  assert.deepEqual(f.sessions, { hq: false, akipasa: true, business: true });
});
