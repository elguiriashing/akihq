"""Course UI acceptance with synthetic data; no live orders, payment or printers."""
from pathlib import Path
import functools,json,os,threading,re
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'pos-courses'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}/tests/fixtures/pos-courses.html'
 results=[]
 def bounds(page,selector,label):
  b=page.locator(selector).first.bounding_box();assert b,(label,'missing')
  assert b['x']>=-1 and b['x']+b['width']<=page.viewport_size['width']+1,(label,'horizontal',b)
  assert b['y']>=-1 and b['y']+b['height']<=page.viewport_size['height']+1,(label,'vertical',b)
 def enter(page,lang='en',theme='dark'):
  query=f'?lang={lang}&theme={theme}'
  if not os.environ.get('POS_BROWSER_INLINE'):page.goto(base+query)
  else:
   fixture=ROOT/'tests/fixtures/pos-courses.html';html=fixture.read_text()
   html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(fixture.parent/m[1]).resolve().read_text()+'</style>',html)
   scripts=re.findall(r'<script src="([^"]+)"></script>',html)
   html=re.sub(r'<script src="[^"]+"></script>','',html);page.set_content(html)
   page.evaluate("""query=>{window.__posFixtureQuery=query;const values=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}});Object.defineProperty(navigator,'locks',{value:{request:async(k,o,f)=>f({})}});if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};}""",query)
   for script in scripts:page.add_script_tag(content=(fixture.parent/script).resolve().read_text())
  page.locator('[data-action="hp-table"]').first.wait_for()
  page.evaluate('fixture.controller.action({dataset:{action:"hp-service-open",id:"o0"}})')
  page.locator('[data-action="hp-course-open"]').wait_for();page.locator('[data-action="hp-immersive"]').click()
 def fire(page):
  page.locator('[name="confirmed"]').check();page.locator('.hp-course-form button[type="submit"]').click()
  page.wait_for_function("fixture.commands.some(c=>c.action==='course_fire') && !localStorage.getItem('akihq:hospitality:fixture-user:fixture-workspace')")
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or None,headless=True,args=['--no-sandbox'])
   sizes=[(1280,800),(1024,768),(800,1280),(768,1024),(650,900),(360,800),(320,640),(900,500)]
   if os.environ.get('POS_BROWSER_SIZES'):sizes=[tuple(map(int,v.split('x'))) for v in os.environ['POS_BROWSER_SIZES'].split(',')]
   for w,h in sizes:
    for lang in ['en','es']:
     for theme in ['dark','light']:
      label=f'{w}x{h}-{lang}-{theme}';print('COURSES',label,flush=True)
      context=browser.new_context(viewport={'width':w,'height':h},has_touch=True,reduced_motion='reduce');page=context.new_page();page.set_default_timeout(6000);errors=[]
      page.on('pageerror',lambda e:errors.append(str(e)));enter(page,lang,theme)
      bounds(page,'.hp-course-entry',label+' entry');bounds(page,'.hp-quick-actions',label+' checkout')
      assert page.locator('.hp-course-entry').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
      page.locator('[data-action="hp-course-open"]').click()
      bounds(page,'.hp-course-dialog',label+' dialog');bounds(page,'.hp-course-form>footer',label+' footer')
      assert page.locator('.hp-course-dialog').evaluate("e=>getComputedStyle(e).backgroundColor.startsWith('rgb(')"),(label,'dialog must be opaque')
      assert page.locator('.hp-course-dialog').evaluate('e=>e.contains(document.activeElement)')
      assert page.locator('.hp-course-review li').count()==2
      assert page.locator('[name="confirmed"]').is_checked()==False
      if (w,h,lang,theme) in [(1280,800,'en','dark'),(360,800,'es','light')]:page.screenshot(path=str(OUT/f'courses-{label}.png'))
      fire(page);page.locator('.hp-course-dialog').wait_for(state='hidden')
      assert page.evaluate("fixture.db.orders[0].lines.filter(l=>l.course===3).every(l=>l.course_held)")
      assert page.evaluate("fixture.commands.filter(c=>c.action==='course_fire').length")==1
      assert not errors,(label,errors);results.append({'viewport':[w,h],'language':lang,'theme':theme,'passed':True});context.close()
   page=browser.new_page(viewport={'width':1280,'height':800});page.set_default_timeout(8000);enter(page)
   # Course choice changes require fresh confirmation, even without an order revision.
   page.locator('[data-action="hp-course-open"]').click();page.locator('[name="confirmed"]').check()
   page.locator('[data-action="hp-course-choose"][data-course="3"]').click();assert not page.locator('[name="confirmed"]').is_checked()
   # A simultaneous waiter edit invalidates the snapshot; reload never keeps consent.
   page.locator('[name="confirmed"]').check();page.evaluate('fixture.db.orders[0].version++;fixture.controller.action({dataset:{action:"hp-refresh"}})')
   assert page.locator('.hp-course-form button[type="submit"]').is_disabled();assert not page.locator('[name="confirmed"]').is_checked()
   page.locator('[data-action="hp-course-reload"]').click();assert not page.locator('[name="confirmed"]').is_checked()
   # Keyboard focus stays in the dialog and returns to its launcher on Escape.
   page.locator('.hp-course-form button[type="submit"]').focus();page.keyboard.press('Tab')
   assert page.locator('.hp-course-dialog').evaluate('e=>e.contains(document.activeElement)')
   page.keyboard.press('Escape');assert page.locator('.hp-course-dialog').count()==0
   assert page.locator('[data-action="hp-course-open"]').evaluate('e=>e===document.activeElement')
   # Batch entry captures the course at each tap, not when queued taps later flush.
   page.locator('[data-pos-entry-course]').select_option('2')
   page.locator('[data-action="hp-add"][data-id="p0"]').click(click_count=3,delay=5)
   page.locator('[data-pos-entry-course]').select_option('3')
   page.locator('[data-action="hp-add"][data-id="p0"]').click()
   page.wait_for_function("fixture.db.orders[0].lines.filter(l=>l.item_id==='p0').length===2 && !localStorage.getItem('akihq:hospitality:fixture-user:fixture-workspace')")
   quantities=page.evaluate("fixture.db.orders[0].lines.filter(l=>l.item_id==='p0').map(l=>[l.course,l.quantity,l.course_held]).sort((a,b)=>a[0]-b[0])")
   assert quantities==[[2,3,True],[3,1,True]],quantities
   # Per-item reassignment updates one versioned line; fired items have a disabled selector.
   page.locator('[data-action="hp-edit-item"][data-id="starter-a"]').click();assert page.locator('[name="course"]').is_disabled();page.keyboard.press('Escape')
   page.locator('[data-action="hp-edit-item"][data-id="main-a"]').click();page.locator('[name="course"]').select_option('4')
   page.locator('.hp-v4-form button[type="submit"]').click();page.wait_for_function("fixture.db.orders[0].lines.find(l=>l.id==='main-a').course===4")
   # A committed fire with a dropped response retries the exact UUID, not another fire.
   page.locator('[data-action="hp-course-open"]').click();page.locator('[data-action="hp-course-choose"][data-course="4"]').click();page.evaluate('window.fixtureDropReply=true')
   page.locator('[name="confirmed"]').check();page.locator('.hp-course-form button[type="submit"]').click()
   page.wait_for_function("fixture.commands.some(c=>c.action==='course_fire'&&c.course===4)");page.keyboard.press('Escape')
   page.locator('[data-action="hp-retry"]').click();page.wait_for_function("!localStorage.getItem('akihq:hospitality:fixture-user:fixture-workspace')")
   assert page.evaluate("fixture.commands.filter(c=>c.action==='course_fire'&&c.course===4).length")==1
   # Missing migration or revoked access cannot expose a working course action.
   page.evaluate('delete fixture.db.course_contract_version;fixture.controller.action({dataset:{action:"hp-refresh"}})')
   assert page.locator('[data-action="hp-course-open"]').count()==0
   page.evaluate('window.fixtureDenied=true;fixture.controller.action({dataset:{action:"hp-refresh"}})');assert page.locator('[data-action="hp-course-open"]').count()==0
   page.close();browser.close()
 finally:server.shutdown()
 (OUT/'browser-results.json').write_text(json.dumps({'cases':results,'interaction_checks':True,'synthetic_data':True,'native_browser_storage':not bool(os.environ.get('POS_BROWSER_INLINE'))},indent=2))
 print(f'Passed {len(results)} course layout/language/theme cases plus interaction checks.',flush=True)
if __name__=='__main__':main()
