import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildProductRelease } from '../tools/build-product-release.mjs';

for (const enabled of [false, true]) {
  test(`isolated ${enabled ? 'AkiBusiness' : 'legacy AkiHQ'} release preserves operations and initiating-origin authentication`, async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), 'akisuite-release-'));
    try {
      const output = await buildProductRelease(path.join(temporary, 'site'), enabled);
      const read = file => readFile(path.join(output, file), 'utf8');
      const source = await read('assets/app-v32.js');
      const original = await readFile(new URL('../assets/app-v32.js', import.meta.url), 'utf8');
      const product = enabled ? 'AkiBusiness' : 'AkiHQ';
      assert.match(await read('index.html'), new RegExp(`<title>${product}</title>`));
      // Cloudflare Pages SPA rewrites nested routes back to index.html; base URL
      // must stay rooted so /es/business loads /assets and /config.js.
      assert.match(await read('index.html'), /<base href="\/"\s*\/>/);
      assert.equal(JSON.parse(await read('manifest.webmanifest')).name, product);
      assert.equal(JSON.parse(await read('release-source.json')).roleSwap, enabled);
      assert.equal(typeof JSON.parse(await read('release-source.json')).sourceTreeDirty, 'boolean');
      if (enabled) assert.doesNotMatch(source, /void client\.rpc\("queue_suite_portal_welcome"/);
      else assert.match(source, /void client\.rpc\("queue_suite_portal_welcome"/);
      assert.match(await read('_redirects'), /^\/\* \/index.html 200\s*$/);
      assert.match(await read('config.js'), new RegExp(`CRM_URL: +"https://${enabled ? 'akibusiness.com' : 'akihq.app'}"`));
      // Permissions, workspace selection and operational implementations are byte-identical.
      const operations = text => text.slice(text.indexOf('  async function loadAccessibleWorkspaces('), text.indexOf('  async function loadAccessibleWorkspaces(') + 3800);
      assert.equal(operations(source), operations(original));
      for (const file of ['assets/hospitality-pos.js', 'assets/inventory-ops.js', 'assets/checkout-session.js', 'assets/supabase.js']) {
        assert.equal(await read(file), await readFile(new URL('../' + file, import.meta.url), 'utf8'));
      }
      const version = (await read('index.html')).match(/app-v32.js\?v=\d+/)[0];
      assert.ok((await read('sw.js')).includes(version));
      for (const origin of ['https://akibusiness.com', 'https://akihq.app', 'https://crm.akipasa.com', 'https://exact-preview.pages.dev']) {
        const handlers = {};
        let oauth;
        const elements = new Map(['google-login-btn', 'login-form'].map(id => [id, { addEventListener: (event, fn) => { handlers[`${id}:${event}`] = fn; }, querySelector: () => ({ textContent: '' }) }]));
        const context = { appRoot: {}, portal: {}, state: { settings: { locale: 'en' } }, applySettings() {}, escapeHtml: String,
          window: { location: { origin }, scrollTo() {} }, document: { getElementById: id => elements.get(id) }, requestAnimationFrame: fn => fn(),
          getSupabaseClient: () => ({ auth: { signInWithOAuth: async options => { oauth = options; return {}; } } }) };
        const login = source.slice(source.indexOf('  function renderLoginScreen('), source.indexOf('  function renderAccessDenied('));
        vm.runInNewContext(`${login}\nrenderLoginScreen();`, context);
        assert.match(context.appRoot.innerHTML, new RegExp(`Sign in to ${product}`));
        assert.match(context.appRoot.innerHTML, /suite-product-card active" href="\/"/);
        if (enabled) assert.match(context.appRoot.innerHTML, /href="https:\/\/akihq.app\/"/);
        await handlers['google-login-btn:click']();
        assert.equal(oauth.options.redirectTo, origin);
      }
    } finally { await rm(temporary, { recursive: true, force: true }); }
  });
}

test('release builder refuses to overwrite any existing directory', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'akisuite-release-'));
  try { await assert.rejects(buildProductRelease(temporary, true), /new directory/); }
  finally { await rm(temporary, { recursive: true, force: true }); }
});
