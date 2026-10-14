import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/app-v32.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../cloudflare/wrangler.toml', import.meta.url), 'utf8');
const allowedOrigins = config.match(/^ALLOWED_ORIGINS = "([^"]+)"/m)[1];

// Exercise the production login handler without initializing business data or a backend.
for (const origin of ['https://akihq.app', 'https://crm.akipasa.com', 'http://127.0.0.1:8080']) {
  test(`OAuth stays on its initiating origin: ${origin}`, async () => {
    const handlers = {};
    let oauth;
    const elements = new Map();
    for (const id of ['google-login-btn', 'login-form']) elements.set(id, {
      addEventListener: (event, fn) => { handlers[`${id}:${event}`] = fn; },
      querySelector: () => ({ textContent: '' })
    });
    const context = {
      appRoot: {}, portal: {}, applySettings() {}, escapeHtml: String,
      window: { location: { origin }, scrollTo() {} },
      document: { getElementById: id => elements.get(id) }, requestAnimationFrame: fn => fn(),
      getSupabaseClient: () => ({ auth: { signInWithOAuth: async options => { oauth = options; return {}; } } })
    };
    const login = source.slice(source.indexOf('  function renderLoginScreen('), source.indexOf('  function renderAccessDenied('));
    vm.runInNewContext(`${login}\nrenderLoginScreen();`, context);
    assert.match(context.appRoot.innerHTML, /suite-product-card active" href="\/"/);
    await handlers['google-login-btn:click']();
    assert.equal(oauth.options.redirectTo, origin);
    assert.equal(oauth.provider, 'google');
  });
}

test('gateway permits both HQ domains and rejects unrelated origins', () => {
  const start = worker.indexOf('function corsHeaders(');
  const end = worker.indexOf('\nfunction withCors(', start);
  const cors = vm.runInNewContext(`${worker.slice(start, end)}\ncorsHeaders`);
  for (const origin of ['https://akihq.app', 'https://crm.akipasa.com', 'http://127.0.0.1:8080', 'https://akihq.app.attacker.invalid', 'https://unrelated.invalid']) {
    const request = new Request('https://gateway.invalid/api/health', { headers: { origin } });
    const result = cors(request, { ALLOWED_ORIGINS: allowedOrigins });
    assert.equal(result['access-control-allow-origin'], allowedOrigins.split(',').includes(origin) ? origin : 'null');
    assert.equal(result.vary, 'Origin');
  }
});
