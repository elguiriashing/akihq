"""Real Chromium geometry/interactions over synthetic orders, never a live venue."""
from pathlib import Path
import functools,json,os,threading,re
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'pos-variants'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}/tests/fixtures/pos-variants.html'
 results=[]
 def bounds(page,selector,label):
  b=page.locator(selector).first.bounding_box();assert b,(label,'missing')
  assert b['x']>=-1 and b['x']+b['width']<=page.viewport_size['width']+1,(label,'horizontal',b)
  assert b['y']>=-1 and b['y']+b['height']<=page.viewport_size['height']+1,(label,'vertical',b)
 def enter(page,lang='en',theme='dark',role='manager'):
  query=f'?lang={lang}&theme={theme}&role={role}'
  if not os.environ.get('POS_BROWSER_INLINE'):page.goto(base+query)
  else:
   fixture=ROOT/'tests/fixtures/pos-variants.html';html=fixture.read_text()
   html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(fixture.parent/m[1]).resolve().read_text()+'</style>',html)
   scripts=re.findall(r'<script src="([^"]+)"></script>',html)
   html=re.sub(r'<script src="[^"]+"></script>','',html);page.set_content(html)
   page.evaluate("""query=>{window.__posFixtureQuery=query;const values=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}});Object.defineProperty(navigator,'locks',{value:{request:async(k,o,f)=>f({})}});if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};}""",query)
   for script in scripts:page.add_script_tag(content=(fixture.parent/script).resolve().read_text())
  page.wait_for_function('fixture.db.layout.menu.variants?.p0 && document.querySelector("[data-action=hp-table]")')
  page.evaluate('fixture.controller.action({dataset:{action:"hp-service-open",id:"o0"}})')
  page.locator('[data-action="hp-immersive"]').click()
 def choose(page):
  page.locator('[data-action="hp-add"][data-id="p0"]').click()
  page.locator('.hp-variant-dialog').wait_for()
 def edit(page):
  page.evaluate('fixture.controller.action({dataset:{action:"hp-switch-view",id:"designer"}})')
  page.locator('[data-action="hp-variant-edit"][data-id="p0"]').click()
  page.locator('.hp-variant-form').wait_for()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or None,headless=True,args=['--no-sandbox'])
   sizes=[(1280,800),(1024,768),(800,1280),(768,1024),(650,900),(360,800),(320,640),(900,500)]
   if os.environ.get('POS_BROWSER_SIZES'):sizes=[tuple(map(int,v.split('x'))) for v in os.environ['POS_BROWSER_SIZES'].split(',')]
   for w,h in sizes:
    for lang in ['en','es']:
     for theme in ['dark','light']:
      label=f'{w}x{h}-{lang}-{theme}';print('VARIANTS',label,flush=True)
      context=browser.new_context(viewport={'width':w,'height':h},has_touch=True,reduced_motion='reduce');page=context.new_page();page.set_default_timeout(7000);errors=[]
      page.on('pageerror',lambda e:errors.append(str(e)));enter(page,lang,theme)
      bounds(page,'.hp-quick-actions',label+' checkout');choose(page)
      bounds(page,'.hp-variant-dialog',label+' chooser');bounds(page,'[data-action="hp-variant-close"]',label+' close')
      assert page.locator('.hp-variant-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
      assert page.locator('.hp-variant-dialog').evaluate('e=>e.contains(document.activeElement)')
      assert page.locator('[data-action="hp-variant-choose"]').count()==3
      assert page.locator('[data-action="hp-variant-choose"][data-id="p24"]').is_enabled()
      if (w,h,lang,theme) in [(1280,800,'en','dark'),(360,800,'es','light')]:page.screenshot(path=str(OUT/f'variants-{label}.png'))
      page.locator('[data-action="hp-variant-choose"][data-id="p12"]').click()
      page.wait_for_function("fixture.commands.some(c=>c.action==='add'&&c.item_id==='p12') && !localStorage.getItem('akihq:hospitality:fixture-user:fixture-workspace')")
      assert page.evaluate("fixture.commands.filter(c=>c.action==='add'&&c.item_id==='p12').length")==1
      assert page.evaluate("fixture.db.orders[0].lines.find(l=>l.item_id==='p12').unit_price_cents")==320
      edit(page);bounds(page,'.hp-variant-dialog',label+' editor');bounds(page,'.hp-variant-form>footer',label+' save')
      assert page.locator('.hp-variant-form').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
      if (w,h,lang,theme)==(1280,800,'en','dark'):page.screenshot(path=str(OUT/f'variant-editor-{label}.png'))
      page.locator('[name="variant_title"]').fill('Coffee sizes · '+lang)
      page.locator('[data-action="hp-variant-up"][data-id="p24"]').click()
      page.locator('.hp-variant-form button[type="submit"]').click()
      page.wait_for_function("fixture.db.layout.menu.variants.p0.items.join(',')==='p0,p24,p12' && !document.querySelector('.hp-variant-dialog')")
      assert not errors,(label,errors);results.append({'viewport':[w,h],'language':lang,'theme':theme,'passed':True});context.close()
   page=browser.new_page(viewport={'width':1280,'height':800});page.set_default_timeout(8000);enter(page)
   # No menu/bill write on opening; Escape keeps focus on the original item.
   choose(page);assert page.evaluate('fixture.commands.length')==0
   page.keyboard.press('Escape');assert page.locator('[data-action="hp-add"][data-id="p0"]').evaluate('e=>e===document.activeElement')
   # A waiter editing this bill requires a fresh explicit review.
   choose(page);page.evaluate('fixture.db.orders[0].version++;fixture.controller.action({dataset:{action:"hp-refresh"}})')
   assert page.locator('[data-action="hp-variant-choose"]').first.is_disabled()
   page.locator('[data-action="hp-variant-reload"]').click();assert page.locator('[data-action="hp-variant-choose"]').first.is_enabled()
   page.locator('[data-action="hp-variant-choose"]').last.focus();page.keyboard.press('Tab')
   assert page.locator('[data-action="hp-variant-close"]').evaluate('e=>e===document.activeElement')
   page.keyboard.press('Escape')
   # The course at choice opening is retained, without affecting the other SKU.
   page.locator('[data-pos-entry-course]').select_option('3');choose(page)
   page.locator('[data-action="hp-variant-choose"][data-id="p12"]').click()
   page.wait_for_function("fixture.db.orders[0].lines.some(l=>l.item_id==='p12'&&l.course===3&&l.course_held)")
   assert page.evaluate("fixture.commands.filter(c=>c.action==='add'&&c.item_id==='p0').length")==0
   # Manager search keeps focus/caret and unsaved selections through poll refresh.
   edit(page);search=page.locator('[name="variant_search"]');search.fill('cafe')
   assert search.input_value()=='cafe';assert search.evaluate('e=>e===document.activeElement')
   page.evaluate('fixture.controller.action({dataset:{action:"hp-refresh"}})');assert page.locator('[name="variant_search"]').input_value()=='cafe'
   page.locator('[data-variant-option="p12"]').uncheck();assert page.locator('.hp-variant-selected li').count()==2
   # Concurrent layout changes block stale saves rather than overwriting.
   page.evaluate('fixture.db.layout_version++;fixture.controller.action({dataset:{action:"hp-refresh"}})')
   assert page.locator('.hp-variant-form button[type="submit"]').is_disabled()
   page.keyboard.press('Escape');page.close()
   staff=browser.new_page(viewport={'width':360,'height':800});enter(staff,role='staff');choose(staff)
   assert staff.locator('[data-action="hp-variant-choose"]').first.is_enabled();staff.keyboard.press('Escape')
   staff.evaluate('fixture.controller.action({dataset:{action:"hp-variant-edit",id:"p0"}})')
   assert staff.locator('.hp-variant-form').count()==0
   staff.evaluate('window.fixtureDenied=true;fixture.controller.action({dataset:{action:"hp-refresh"}})')
   assert staff.locator('[data-action="hp-add"]').count()==0
   staff.close();browser.close()
 finally:server.shutdown()
 (OUT/'browser-results.json').write_text(json.dumps({'cases':results,'interaction_checks':True,'synthetic_data':True,'native_browser_storage':not bool(os.environ.get('POS_BROWSER_INLINE'))},indent=2))
 print(f'Passed {len(results)} chooser AND editor geometry cases plus interactions.',flush=True)
if __name__=='__main__':main()
