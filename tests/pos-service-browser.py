"""Real Chromium geometry/interaction checks against synthetic RPC fixtures, not production."""
from __future__ import annotations
import functools
import json
import os
import re
from pathlib import Path
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts" / "pos-service"
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    sizes = [(1280,800),(1024,768),(800,1280),(768,1024),(650,900),(360,800),(320,640),(900,500)]
    selected_sizes=os.environ.get('POS_BROWSER_SIZES')
    if selected_sizes=='interactions':
        sizes=[]
    elif selected_sizes:
        sizes=[tuple(map(int,size.split('x'))) for size in selected_sizes.split(',')]
    results=[]
    def load_fixture(page, lang='en', theme='dark'):
        if not os.environ.get('POS_BROWSER_INLINE'):
            page.goto(f'http://127.0.0.1:{server.server_port}/tests/fixtures/pos-service.html?lang={lang}&theme={theme}')
            return
        # Rendering-only fallback for environments whose browser blocks localhost.
        # It performs no network access and mocks storage/Web Locks for the fixture.
        fixture=ROOT/'tests/fixtures/pos-service.html'
        html=fixture.read_text()
        html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(fixture.parent/m[1]).resolve().read_text()+'</style>',html)
        scripts=re.findall(r'<script src="([^"]+)"></script>',html)
        html=re.sub(r'<script src="[^"]+"></script>','',html)
        page.set_content(html,wait_until='load')
        page.evaluate("""query=>{
            window.__posFixtureQuery=query;
            const storage=new Map();
            Object.defineProperty(window,'localStorage',{value:{
                getItem:k=>storage.get(k)||null,
                setItem:(k,v)=>storage.set(k,String(v)),
                removeItem:k=>storage.delete(k)
            }});
            Object.defineProperty(navigator,'locks',{value:{request:async(k,o,f)=>f({})}});
            if(!crypto.randomUUID)crypto.randomUUID=()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
        }""",f'?lang={lang}&theme={theme}')
        for src in scripts:
            page.add_script_tag(content=(fixture.parent/src).resolve().read_text())
    def bounds(page, selector, label):
        result=page.locator(selector).first.evaluate("""el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,viewport:innerHeight,wide:innerWidth}}""")
        assert result['w']>0 and result['h']>0, (label,'empty bounds',result)
        assert result['x']>=-1 and result['right']<=result['wide']+1, (label,'horizontal overflow',result)
        assert result['y']>=-1 and result['bottom']<=result['viewport']+1, (label,'clipped vertically',result)
    try:
        with sync_playwright() as p:
            executable=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
            browser=p.chromium.launch(headless=True,executable_path=executable or None,args=['--no-sandbox'])
            for w,h in sizes:
                for lang in ('en','es'):
                    for theme in ('dark','light'):
                        label=f'{w}x{h}-{lang}-{theme}'
                        context=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<901,has_touch=True,reduced_motion='reduce')
                        page=context.new_page();page.set_default_timeout(10000);errors=[]
                        page.on('pageerror',lambda error:(errors.append(str(error)),print('PAGE ERROR:',error,flush=True)))
                        load_fixture(page,lang,theme)
                        print('Testing',label,flush=True)
                        page.locator('[data-action="hp-switch-view"][data-id="service"]').click()
                        page.locator('[data-action="hp-immersive"]').click()
                        bounds(page,'.hp-service-host',label+' service')
                        bounds(page,'.hp-service-nav',label+' navigation')
                        assert page.locator('.hp-service-nav').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'),label
                        assert page.locator('.hp-service-card').count()==15,label
                        page.locator('[data-pos-service-search]').fill('TERRAZA 01')
                        assert page.locator('.hp-service-card').count()==1,label
                        page.locator('[data-pos-service-search]').fill('')
                        page.locator('[data-action="hp-service-review"][data-id="o0"]').click()
                        bounds(page,'.hp-prep-footer',label+' preparation footer')
                        assert page.locator('[role="dialog"]').evaluate('el=>el.contains(document.activeElement)'),label
                        page.evaluate("fixture.db.orders[0].version++;fixture.controller.action({dataset:{action:'hp-refresh'}})")
                        assert page.locator('[role="dialog"]').evaluate('el=>el.contains(document.activeElement)'),label+' dialog focus lost on refresh'
                        page.keyboard.press('Escape')
                        assert page.locator('[role="dialog"]').count()==0,label
                        assert page.locator('[data-action="hp-service-review"][data-id="o0"]').evaluate('el=>el===document.activeElement'),label
                        if (w,h,lang,theme) in [(1280,800,'en','dark'),(360,800,'es','light')]:
                            page.locator('.hp-service-list').evaluate('el=>el.scrollTop=0')
                            page.screenshot(path=str(ARTIFACTS/f'service-{label}.png'))
                        page.locator('[data-action="hp-service-open"][data-id="o0"]').click()
                        bounds(page,'.hp-order-open',label+' register')
                        assert not page.locator('.contextbar').is_visible(),label+' dashboard chrome remains in fullscreen'
                        for action in ('hp-send','hp-prebill','hp-split-panel','hp-payment-panel'):
                            bounds(page,f'.hp-quick-actions [data-action="{action}"]',label+' '+action)
                            assert page.locator(f'.hp-quick-actions [data-action="{action}"]').evaluate('el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'),label+' obscured '+action
                        field=page.locator('[data-pos-product-search]');field.fill('cafe')
                        assert page.locator('.hp-v4-product').count()==3,label
                        page.evaluate("fixture.controller.action({dataset:{action:'hp-refresh'}})")
                        assert field.input_value()=='cafe' and field.evaluate('el=>el===document.activeElement'),label+' search focus lost'
                        page.locator('[data-action="hp-favourites"]').click()
                        assert page.locator('.hp-v4-product').count()==1,label
                        page.locator('[data-action="hp-product-reset"]').click()
                        assert page.locator('.hp-v4-product').count()==3,label
                        if (w,h,lang,theme) in [(1280,800,'en','dark'),(360,800,'es','light')]:
                            page.screenshot(path=str(ARTIFACTS/f'register-{label}.png'))
                        page.locator('[data-action="hp-payment-panel"]').click()
                        bounds(page,'.hp-v4-dialog',label+' checkout dialog')
                        page.keyboard.press('Escape')
                        assert not errors,(label,errors)
                        results.append({'viewport':[w,h],'language':lang,'theme':theme,'passed':True})
                        context.close()
            # Interaction acceptance with real DOM and the unchanged versioned command controller.
            print('Checking versioned send, rapid taps and access revocation',flush=True)
            page=browser.new_page(viewport={'width':1280,'height':800});page.set_default_timeout(10000)
            load_fixture(page)
            page.locator('[data-action="hp-switch-view"][data-id="service"]').click()
            page.locator('[data-action="hp-service-review"][data-id="o0"]').click()
            page.locator('[data-action="hp-service-send"]').click()
            page.wait_for_function("fixture.commands.some(c=>c.action==='send')")
            assert page.locator('[data-action="hp-service-send"]').is_disabled()
            assert page.evaluate("fixture.commands.filter(c=>c.action==='send').length")==1
            page.keyboard.press('Escape')
            page.locator('[data-action="hp-service-open"][data-id="o0"]').click()
            for _ in range(8):
                page.locator('.hp-v4-product[data-id="p1"]').click()
            page.wait_for_function("fixture.db.orders[0].lines.some(l=>l.item_id==='p1'&&l.quantity===8)")
            assert page.evaluate("fixture.db.orders[0].lines.filter(l=>l.item_id==='p1').length")==1
            page.evaluate("window.fixtureDenied=true;fixture.controller.action({dataset:{action:'hp-refresh'}})")
            assert page.locator('.hp-service-card,.hp-v4-product').count()==0
            browser.close()
        (ARTIFACTS/('browser-results'+('-'+selected_sizes.replace(',','_') if selected_sizes else '')+'.json')).write_text(json.dumps({'cases':results,'interaction_acceptance':True,'scope':'Synthetic RPC fixtures; no production auth, hardware or payment claims.'},indent=2))
        print(f'{len(results)} real Chromium viewport/language/theme cases and service interactions passed.')
    finally:
        server.shutdown()
if __name__=='__main__':
    main()
