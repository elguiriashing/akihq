"""Chromium touch layout and interaction checks with synthetic RPC responses only."""
from pathlib import Path
import functools, json, os, threading, re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'pos-kitchen'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}/tests/fixtures/pos-kds.html'
 results=[]
 def bounds(page,selector,label):
  b=page.locator(selector).first.bounding_box();assert b,(label,'missing bounds')
  assert b['x']>=-1 and b['x']+b['width']<=page.viewport_size['width']+1,(label,'horizontal',b)
  assert b['y']>=-1 and b['y']+b['height']<=page.viewport_size['height']+1,(label,'vertical',b)
 def enter(page,lang='en',theme='dark',role='owner'):
  query=f'?lang={lang}&theme={theme}&role={role}'
  if not os.environ.get('POS_BROWSER_INLINE'):
   page.goto(base+query)
  else:
   # Restricted local runner only. Hosted CI uses native HTTP storage/Web Locks.
   fixture=ROOT/'tests/fixtures/pos-kds.html';html=fixture.read_text()
   html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(fixture.parent/m[1]).resolve().read_text()+'</style>',html)
   scripts=re.findall(r'<script src="([^"]+)"></script>',html)
   html=re.sub(r'<script src="[^"]+"></script>','',html)
   page.set_content(html)
   page.evaluate("""query=>{
    window.__posFixtureQuery=query;
    const storage=new Map();
    Object.defineProperty(window,'localStorage',{value:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)}});
    Object.defineProperty(navigator,'locks',{value:{request:async(k,o,f)=>f({})}});
    if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
   }""",query)
   for src in scripts:page.add_script_tag(content=(fixture.parent/src).resolve().read_text())
  page.locator('[data-pos-view]').select_option('kitchen')
  page.locator('.hp-kds-card').first.wait_for()
  page.locator('[data-action="hp-immersive"]').click()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or None,headless=True,args=['--no-sandbox'])
   sizes=[(1280,800),(1024,768),(800,1280),(768,1024),(650,900),(360,800),(320,640),(900,500)]
   requested=os.environ.get('POS_BROWSER_SIZES')
   if requested:sizes=[tuple(map(int,v.split('x'))) for v in requested.split(',')]
   for w,h in sizes:
    for lang in ['en','es']:
     for theme in ['dark','light']:
      label=f'{w}x{h}-{lang}-{theme}';print('KDS',label,flush=True)
      context=browser.new_context(viewport={'width':w,'height':h},has_touch=True,reduced_motion='reduce');page=context.new_page();page.set_default_timeout(6000);errors=[]
      page.on('pageerror',lambda e:errors.append(str(e)))
      enter(page,lang,theme)
      bounds(page,'.hp-kds-host',label);bounds(page,'.hp-service-nav',label+' nav');bounds(page,'.hp-kds-toolbar',label+' filters')
      assert page.locator('.hp-service-nav').evaluate('el=>el.scrollWidth<=el.clientWidth+1'),label
      assert page.locator('.hp-kds-card').count()==15,label
      assert not page.locator('.contextbar').is_visible(),label
      page.locator('[data-kds-station]').select_option('bar');assert page.locator('.hp-kds-card').count()==5,label
      page.locator('[data-kds-station]').select_option('all')
      field=page.locator('[data-kds-search]');field.fill('cafe');assert page.locator('.hp-kds-card').count()==8,label
      page.locator('[data-action="hp-kds-refresh"]').click();assert field.input_value()=='cafe'
      field.fill('');page.locator('[data-action="hp-kds-filter"][data-value="review"]').click()
      assert page.locator('.hp-kds-card').count()==1
      page.locator('[data-action="hp-kds-review"]').click();bounds(page,'.hp-kds-overlay [role="dialog"]',label+' modal');bounds(page,'.hp-kds-form>footer',label+' footer')
      assert page.locator('[role="dialog"]').evaluate('el=>el.contains(document.activeElement)')
      page.locator('[name="reason"]').fill('Checked with the previous station')
      page.locator('[name="confirmed"]').check()
      page.locator('[name="progress:k3"]').select_option('ready')
      page.locator('.hp-kds-form button[type="submit"]').click()
      page.wait_for_function('fixture.kds.cards[3].review_required===false')
      assert page.locator('[role="dialog"]').count()==0
      assert page.evaluate('fixture.kds.cards[3].progress.k3')=='ready'
      page.locator('[data-action="hp-kds-filter"][data-value="active"]').click()
      if (w,h,lang,theme) in [(1280,800,'en','dark'),(360,800,'es','light')]:
       page.screenshot(path=str(OUT/f'kitchen-{label}.png'))
      assert not errors,(label,errors)
      results.append({'viewport':[w,h],'language':lang,'theme':theme,'passed':True});context.close()
   page=browser.new_page(viewport={'width':1280,'height':800});page.set_default_timeout(8000);enter(page)
   # Real browser storage and Web Locks; unknown reply retried under the original UUID.
   page.evaluate('window.fixtureDropReply=true')
   page.locator('[data-action="hp-kds-progress"][data-order="o0"][data-line="k0"]').click()
   page.locator('[data-action="hp-retry"]').wait_for()
   assert page.evaluate('fixture.kds.cards[0].progress.k0')=='preparing'
   page.locator('[data-action="hp-retry"]').click()
   page.wait_for_function("!localStorage.getItem('akihq:hospitality:fixture-user:fixture-workspace')")
   assert page.evaluate("fixture.commands.filter(c=>c.action==='kds_advance'&&c.order_id==='o0').length")==1
   await_refresh=page.locator('[data-action="hp-kds-refresh"]').first;await_refresh.click()
   # Recall changes are exposed only to managers, with a reason form.
   page.locator('[data-action="hp-kds-filter"][data-value="ready"]').click()
   page.locator('[data-action="hp-kds-progress"][data-order="o2"][data-line="k2"]').click()
   page.locator('[data-action="hp-kds-filter"][data-value="history"]').click()
   page.locator('[data-action="hp-kds-recall"][data-order="o2"]').click()
   page.locator('[name="reason"]').fill('Served button pressed by mistake');page.locator('.hp-kds-form button[type="submit"]').click()
   assert page.evaluate('fixture.kds.cards[2].progress.k2')=='queued'
   # Stale review cannot silently overwrite a newer kitchen snapshot.
   page.locator('[data-action="hp-kds-filter"][data-value="review"]').click();page.locator('[data-action="hp-kds-review"]').click()
   page.locator('[name="reason"]').fill('Review draft must survive refresh')
   page.evaluate('fixture.kds.cards[3].version++; fixture.controller.action({dataset:{action:"hp-kds-refresh"}})')
   page.locator('[data-action="hp-kds-reload"]').wait_for()
   assert page.locator('[name="reason"]').input_value()=='Review draft must survive refresh'
   assert page.locator('.hp-kds-form button[type="submit"]').is_disabled()
   page.keyboard.press('Escape');assert page.locator('[role="dialog"]').count()==0
   # Missing migration is isolated from the terminal, not portrayed as offline service.
   page.evaluate('window.fixtureMissing=true');await_refresh.click()
   assert page.locator('.hp-kds-card').count()==0
   assert page.locator('.hp-kds-empty').inner_text().find('unavailable')>=0
   page.locator('[data-action="hp-switch-view"][data-id="terminal"]').click();assert page.locator('[data-action="hp-table"]').count()>0
   # Role revocation removes kitchen data and disables controls.
   page.evaluate('window.fixtureMissing=false');page.locator('[data-pos-view]').select_option('kitchen');await_refresh.click()
   page.evaluate('window.fixtureDenied=true');await_refresh.click();assert page.locator('.hp-kds-card').count()==0
   # Screen without manager permissions has no activation or recall controls.
   page.close();page=browser.new_page(viewport={'width':360,'height':800});enter(page,role='staff')
   assert page.locator('[data-action="hp-kds-recall"]').count()==0
   page.evaluate('fixture.kds.enabled=false');page.locator('[data-action="hp-kds-refresh"]').click();assert page.locator('[data-action="hp-kds-enable"]').count()==0
   browser.close()
 finally:
  server.shutdown();(OUT/'browser-results.json').write_text(json.dumps(results,indent=2))
 print(f'{len(results)} viewport/language/theme cases plus recovery, revision, recall and permission interactions passed.')
if __name__=='__main__':main()
