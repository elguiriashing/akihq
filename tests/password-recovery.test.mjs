import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../cloudflare/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const source = readFileSync(new URL('../assets/app-v32.js', import.meta.url), 'utf8');
const recovery = source.slice(source.indexOf('  function renderPasswordRecovery('), source.indexOf('  function renderAccessDenied('));

function fixture({ auth = {}, locale = 'en', active = false } = {}) {
  const dom = new JSDOM('<div id="app"></div><div id="portal"></div>', { url: 'https://akihq.app/' });
  const handlers = new Map();
  const document = dom.window.document;
  const originalGet = document.getElementById.bind(document);
  document.getElementById = id => {
    const element = originalGet(id);
    if (element) element.addEventListener = (event, handler) => handlers.set(`${id}:${event}`, handler);
    return element;
  };
  const context = {
    appRoot: originalGet('app'), portal: originalGet('portal'), document,
    state: { settings: { locale } }, applySettings() {}, escapeHtml: value => String(value).replaceAll('<', '&lt;'),
    window: dom.window, history: dom.window.history, passwordRecoveryActive: active,
    getSupabaseClient: () => ({ auth }), renderLoginScreen: message => { context.login = message ?? ''; },
  };
  vm.createContext(context);
  vm.runInContext(recovery, context);
  const render = session => vm.runInContext(`renderPasswordRecovery(${session})`, context);
  const submit = () => handlers.get('recovery-form:submit')({ preventDefault() {} });
  const fill = (id, value) => { originalGet(id).value = value; };
  const message = () => originalGet('recovery-message').textContent;
  return { context, dom, render, submit, fill, message, handlers };
}

test('recovery emails return only to the current HQ origin and disclose no account existence', async () => {
  let request;
  const f = fixture({ auth: { resetPasswordForEmail: async (...args) => { request = args; return {}; } } });
  f.render(false); f.fill('recovery-email', 'operator@example.invalid');
  await f.submit();
  assert.equal(request[0], 'operator@example.invalid');
  assert.equal(request[1].redirectTo, 'https://akihq.app/');
  assert.match(f.message(), /If an account exists/);
  assert.equal(f.dom.window.document.getElementById('recovery-submit').disabled, false);
});

test('provider error details never enter recovery UI', async () => {
  const f = fixture({ auth: { resetPasswordForEmail: async () => ({ error: { message: '<private provider account>' } }) } });
  f.render(false); f.fill('recovery-email', 'operator@example.invalid'); await f.submit();
  assert.match(f.message(), /Could not send/); assert.doesNotMatch(f.message(), /private provider/);
});

test('mismatched passwords cannot call the account API', async () => {
  let called = false;
  const f = fixture({ auth: { getUser: async () => { called = true; } } });
  f.render(true); f.fill('recovery-password', 'password-A'); f.fill('recovery-confirm', 'password-B'); await f.submit();
  assert.equal(called, false); assert.match(f.message(), /both passwords match/);
});

test('expired recovery session cannot change any password', async () => {
  let updated = false;
  const f = fixture({ auth: { getUser: async () => ({ data: { user: null }, error: { message: 'expired' } }), updateUser: async () => { updated = true; } } });
  f.render(true); f.fill('recovery-password', 'password-A'); f.fill('recovery-confirm', 'password-A'); await f.submit();
  assert.equal(updated, false); assert.match(f.message(), /expired/);
});

test('verified password recovery updates the current user, explicitly revokes all sessions and returns to login', async () => {
  const calls = [];
  const f = fixture({ active: true, auth: {
    getUser: async () => { calls.push('verify'); return { data: { user: { id: 'fixture-user' } } }; },
    updateUser: async value => { calls.push(['update', value.password]); return {}; },
    signOut: async options => { calls.push(['signout', options.scope]); return {}; },
  } });
  f.render(true); f.fill('recovery-password', 'password-A'); f.fill('recovery-confirm', 'password-A'); await f.submit();
  assert.deepEqual(calls, ['verify', ['update', 'password-A'], ['signout', 'global']]);
  assert.equal(f.context.passwordRecoveryActive, false); assert.match(f.context.login, /Password updated/);
  assert.equal(f.dom.window.location.href, 'https://akihq.app/');
});

test('failed recovery-session closure preserves recovery guard', async () => {
  const f = fixture({ active: true, auth: {
    getUser: async () => ({ data: { user: { id: 'fixture-user' } } }), updateUser: async () => ({}),
    signOut: async () => ({ error: { message: 'offline' } }),
  } });
  f.render(true); f.fill('recovery-password', 'password-A'); f.fill('recovery-confirm', 'password-A'); await f.submit();
  assert.equal(f.context.passwordRecoveryActive, true); assert.equal(f.context.login, undefined);
  assert.match(f.message(), /Close this recovery session/);
});

test('cancelling recovery closes only its current session without a password change', async () => {
  const scopes = [];
  const f = fixture({ active: true, auth: { signOut: async options => { scopes.push(options.scope); return {}; } } });
  f.render(true); await f.handlers.get('recovery-back:click')();
  assert.deepEqual(scopes, ['local']); assert.equal(f.context.passwordRecoveryActive, false);
  assert.equal(f.context.login, '');
});

test('Spanish recovery uses labelled accessible inputs', () => {
  const f = fixture({ locale: 'es' }); f.render(true);
  assert.match(f.dom.window.document.querySelector('h1').textContent, /nueva contraseña/);
  assert.equal(f.dom.window.document.getElementById('recovery-password').autocomplete, 'new-password');
  assert.equal(f.dom.window.document.getElementById('recovery-message').getAttribute('aria-live'), 'polite');
});

test('recovery callback bypasses workspace boot until password is changed', async () => {
  const start = source.indexOf('  async function finishBoot(');
  const end = source.indexOf('\n  async function boot()', start);
  let recovery;
  const context = { applySettings() {}, appRoot: {}, passwordRecoveryActive: true,
    renderPasswordRecovery: (...args) => { recovery = args; },
    bootWithSession() { throw new Error('must not initialize workspace on recovery'); },
  };
  vm.createContext(context); vm.runInContext(source.slice(start, end), context);
  await context.finishBoot({ auth: { getSession: async () => ({ data: { session: { user: { id: 'fixture-user' } } } }) } });
  assert.equal(recovery[0], true);
});
