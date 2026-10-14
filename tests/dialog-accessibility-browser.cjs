/* Optional real-browser presentation acceptance. No backend or external requests.
   AKIHQ_PLAYWRIGHT_PATH=/path/to/@playwright/test BROWSER_PATH=/path/to/chromium
   node tests/dialog-accessibility-browser.cjs */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.AKIHQ_PLAYWRIGHT_PATH || '@playwright/test');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/app-v32.js'), 'utf8');
const seam = `
  authUser={id:'audit-fixture',email:'fixture@example.invalid'};authRole='administrator';state=seedState();
  state.currentUserId=authUser.id;state.workspace.canAdminister=true;state.workspace.canOperate=true;
  state.employees=[{id:authUser.id,name:'Disposable operator',role:'Administrator'}];
  state.deals=[{id:'fixture-deal',title:'Disposable deal',pipelineId:'venue',stageId:'discovered',value:20}];
  getSupabaseClient=()=>null;
  window.__audit={set:(locale,theme)=>{ui.route='crm';state.settings.locale=locale;state.settings.theme=theme;render();},paint:render,portal:renderPortal,payment:()=>{renderView=()=>'<div class="hp-v4-overlay"><section class="hp-v4-dialog" role="dialog" aria-modal="true" aria-label="Record payment"><form data-form="hp-payment"><input name="reference"><button>Record</button></form></section></div>';render();},debug:()=>({key:dialogFocus.current?.key,frames:[...dialogFocus.frames].map(([key,value])=>({key,opener:value.opener&&{attrs:value.opener.attrs,text:value.opener.text}}))})};render();
})();`;
assert.match(app, /  boot\(\);\s*\}\)\(\);\s*$/);
const fixtureApp = app.replace(/  boot\(\);\s*\}\)\(\);\s*$/, seam);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture.invalid');
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
  if (url.pathname === '/assets/app-v32.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fixtureApp); return; }
  if (url.pathname === '/assets/supabase.js' || url.pathname === '/config.js') { res.setHeader('Content-Type', 'text/javascript'); res.end('window.AKIHQ_CONFIG={};window.supabase={createClient:()=>null};'); return; }
  try { res.setHeader('Content-Type', ({ '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml', '.png':'image/png' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || undefined, headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const output = path.join(root, 'test-results/dialog-accessibility'); fs.mkdirSync(output, { recursive: true });
  await page.goto(base); await page.waitForFunction(() => window.__audit);
  let cases = 0;
  try {
    for (const [width, height] of [[360,780], [600,780], [1280,800], [640,400]]) for (const locale of ['en','es']) for (const theme of ['light','dark']) {
      await page.setViewportSize({ width, height }); await page.evaluate(([l,t]) => window.__audit.set(l,t), [locale,theme]);
      const opener = page.locator('[data-action="open-form"][data-entity="deal"]').first(); await opener.click();
      const dialog = page.getByRole('dialog', { name:'New Deal' }); await dialog.waitFor();
      const close = dialog.locator('.close-btn'); assert.equal(await close.evaluate(element => element === document.activeElement), true);
      for (const field of await dialog.locator('input[id^="entity-field-"],select[id^="entity-field-"],textarea[id^="entity-field-"]').all()) assert.equal(await field.evaluate(element => element.labels?.length), 1);
      const submit = dialog.locator('[type="submit"]'); await submit.focus(); await page.keyboard.press('Tab'); assert.equal(await close.evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Shift+Tab'); assert.equal(await submit.evaluate(element => element === document.activeElement), true);
      const title = dialog.locator('[name="title"]'); await title.fill('Unsubmitted draft'); await title.focus(); await title.evaluate(element => element.setSelectionRange(2,8));
      await page.evaluate(() => window.__audit.paint());
      assert.deepEqual(await page.locator('[name="title"]').evaluate(element => [element === document.activeElement,element.value,element.selectionStart,element.selectionEnd]), [true,'Unsubmitted draft',2,8]);
      const focusState=await page.evaluate(()=>window.__audit.debug());
      await page.keyboard.press('Escape'); assert.equal(await opener.evaluate(element => element === document.activeElement), true, `${locale}/${theme}/${width} after Escape: ${JSON.stringify(focusState)} ${await page.evaluate(()=>document.activeElement.tagName+' '+document.activeElement.dataset.action)}`);
      await opener.click(); await page.getByRole('dialog').locator('.close-btn').click(); assert.equal(await opener.evaluate(element => element === document.activeElement), true);
      await opener.click(); await page.screenshot({ path:path.join(output,`${locale}-${theme}-${width}x${height}.png`) }); await page.keyboard.press('Escape');
      cases++;
    }
    await page.evaluate(()=>window.__audit.payment());
    const reference=page.locator('[name="reference"]'); await reference.fill('Unsubmitted external reference'); await reference.focus(); await reference.evaluate(element=>element.setSelectionRange(2,8));
    await page.keyboard.press('Control+k'); assert.equal(await page.locator('.command-palette').count(),0); assert.equal(await reference.evaluate(element=>element===document.activeElement),true);
    await page.evaluate(()=>window.__audit.paint()); assert.deepEqual(await reference.evaluate(element=>[element===document.activeElement,element.selectionStart,element.selectionEnd]),[true,2,8]);
    await page.evaluate(()=>{const dialog=document.createElement('dialog');dialog.innerHTML='<input id="native-focus">';document.body.appendChild(dialog);dialog.showModal();});
    await page.locator('#native-focus').focus(); await page.keyboard.press('Control+k'); assert.equal(await page.locator('.command-palette').count(),0); assert.equal(await page.locator('#native-focus').evaluate(element=>element===document.activeElement),true);
    await page.evaluate(()=>document.querySelector('dialog').close());
    assert.deepEqual(errors, []); console.log(`AkiHQ dialog browser acceptance passed ${cases} locale/theme/viewport cases and hospitality/native shortcut layering; no provider or backend requests.`);
  } finally { await browser.close(); server.close(); }
})().catch(error => { server.close(); console.error(error); process.exitCode=1; });
