import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(new URL('../cloudflare/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const source = await readFile(new URL('../assets/app-v32.js', import.meta.url), 'utf8');
const seam = `
  authUser={id:'fixture',email:'fixture@example.invalid'};authRole='administrator';
  state=seedState();state.workspace.canAdminister=true;state.workspace.canOperate=true;state.currentUserId='fixture';
  state.employees=[{id:'fixture',name:'Fixture operator',role:'Administrator'}];
  state.deals=[{id:'fixture-deal',title:'Fixture deal',pipelineId:'venue',stageId:'discovered',value:20}];
  getSupabaseClient=()=>null;
  window.__dialogAudit={
    open:openEntityForm,paint:render,portal:renderPortal,
    locale:value=>{state.settings.locale=value;render();},
    drawer:()=>{ui.drawer={type:'deal',id:'fixture-deal'};renderPortal();},
    field:renderField,
    rootDialog:()=>{renderView=()=>'<section class="hp-v4-dialog" role="dialog" aria-modal="true" aria-label="Record payment"><form data-form="hp-payment"><input name="reference"><button>Record</button></form></section>';render();},
    custom:html=>{captureDialogFocus();document.getElementById('audit-dialog')?.remove();if(html)appRoot.insertAdjacentHTML('beforeend',html);syncDialogFocus();}
  };render();
})();`;
assert.match(source, /  boot\(\);\s*\}\)\(\);\s*$/);

async function fixture() {
  const dom = new JSDOM('<div id="app"></div><div id="portal"></div><input id="import-file" type="file"><input id="media-file" type="file">', { url: 'https://fixture.invalid/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.scrollTo = () => {};
  w.fetch = () => { throw new Error('Network is forbidden in this fixture'); };
  w.HTMLElement.prototype.getClientRects = function () { return this.hidden || this.style.display === 'none' ? [] : [{ width: 100, height: 44 }]; };
  for (const file of ['support-desk.js', 'company-manager.js', 'checkout-session.js']) w.eval(await readFile(new URL('../assets/' + file, import.meta.url), 'utf8'));
  w.eval(source.replace(/  boot\(\);\s*\}\)\(\);\s*$/, seam));
  return { dom, w, d: w.document, audit: w.__dialogAudit };
}
function key(w, name, shiftKey = false) { w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true })); }
function opener(d) { const button = d.querySelector('[data-action="open-quick-create"]'); button.focus(); return button; }

test('generated entity fields have unique labels and preserve help, validation and names', async () => {
  const { dom, d, audit } = await fixture();
  try {
    for (const type of ['deal', 'lead', 'contact', 'company', 'task', 'project', 'event', 'product', 'invoice', 'campaign', 'page', 'form', 'automation', 'employee', 'article']) {
      audit.open(type);
      const dialog = d.querySelector('#portal [role="dialog"]');
      assert.ok(dialog);
      assert.equal(dialog.getAttribute('aria-labelledby'), 'entity-form-title');
      for (const field of dialog.querySelectorAll('[id^="entity-field-"]')) {
        if (!field.matches('input,select,textarea')) continue;
        assert.equal(field.labels.length, 1, `${type}.${field.name}`);
        assert.ok(field.labels[0].textContent.trim());
        assert.equal(d.querySelectorAll(`[id="${field.id}"]`).length, 1);
      }
    }
    const holder = d.createElement('div');
    holder.innerHTML = audit.field({ name: 'sample', label: 'Sample', required: true, min: 1, max: 5, step: 1, help: 'Bounded quantity' }, { sample: 3 }, 'fixture');
    const field = holder.querySelector('input');
    assert.equal(field.name, 'sample'); assert.equal(field.value, '3'); assert.equal(field.min, '1'); assert.equal(field.max, '5'); assert.equal(field.step, '1'); assert.ok(field.required);
    assert.equal(holder.querySelector(`#${field.getAttribute('aria-describedby')}`).textContent, 'Bounded quantity');
  } finally { dom.window.close(); }
});

test('opening enters the modal; Tab wraps and programmatic background focus stays contained', async () => {
  const { dom, w, d, audit } = await fixture();
  try {
    const background = opener(d); audit.open('deal');
    const dialog = d.querySelector('#portal [role="dialog"]');
    const first = dialog.querySelector('button'); const last = dialog.querySelector('[type="submit"]');
    assert.equal(d.activeElement, first);
    last.focus(); key(w, 'Tab'); assert.equal(d.activeElement, first);
    key(w, 'Tab', true); assert.equal(d.activeElement, last);
    background.focus(); assert.ok(dialog.contains(d.activeElement));
  } finally { dom.window.close(); }
});

test('Escape, close button and backdrop restore the actual opening control', async () => {
  const { dom, w, d, audit } = await fixture();
  try {
    for (const dismissal of ['escape', 'button', 'backdrop']) {
      const background = opener(d); audit.open('deal');
      if (dismissal === 'escape') key(w, 'Escape');
      else d.querySelector(dismissal === 'button' ? '#portal button[data-action="close-modal"]' : '#portal .modal-backdrop').click();
      assert.equal(d.querySelector('#portal [role="dialog"]'), null);
      assert.equal(d.activeElement, background, dismissal);
    }
  } finally { dom.window.close(); }
});

test('real portal and app renders preserve the focused draft and caret; root replacement restores equivalent opener', async () => {
  const { dom, w, d, audit } = await fixture();
  try {
    opener(d); audit.open('deal');
    const field = d.querySelector('[name="title"]'); field.value = 'Unsubmitted draft'; field.focus(); field.setSelectionRange(2, 8);
    for (const repaint of [audit.portal, audit.paint]) {
      repaint(); const replaced = d.querySelector('[name="title"]');
      assert.equal(d.activeElement, replaced); assert.equal(replaced.value, 'Unsubmitted draft'); assert.equal(replaced.selectionStart, 2); assert.equal(replaced.selectionEnd, 8);
    }
    key(w, 'Escape'); assert.equal(d.activeElement.dataset.action, 'open-quick-create');
    audit.paint(); assert.equal(d.activeElement.dataset.action, 'open-quick-create');
  } finally { dom.window.close(); }
});

test('closing a form returns to the underlying drawer control, then restores its original opener', async () => {
  const { dom, w, d, audit } = await fixture();
  try {
    const background = opener(d); audit.drawer();
    const edit = d.querySelector('.drawer [data-action="edit-entity"]'); edit.focus(); edit.click();
    assert.equal(d.querySelectorAll('#portal [role="dialog"]').length, 2);
    key(w, 'Escape'); assert.equal(d.activeElement.dataset.action, 'edit-entity');
    key(w, 'Escape'); assert.equal(d.activeElement, background);
  } finally { dom.window.close(); }
});

test('shared hospitality-style dialog skips hidden/disabled controls and loading-only dialogs remain focused', async () => {
  const { dom, w, d, audit } = await fixture();
  try {
    const background = opener(d);
    audit.custom('<section id="audit-dialog" class="hp-v4-dialog" role="dialog" aria-modal="true" aria-label="Record payment"><button hidden>Hidden</button><button disabled>Disabled</button><input name="amount"><button>Record</button></section>');
    assert.equal(d.activeElement.name, 'amount');
    d.querySelector('#audit-dialog button:last-child').focus(); key(w, 'Tab'); assert.equal(d.activeElement.name, 'amount');
    audit.custom('<section id="audit-dialog" class="hp-v4-dialog" role="dialog" aria-modal="true" aria-label="Loading">Loading</section>');
    assert.equal(d.activeElement.id, 'audit-dialog'); key(w, 'Tab'); assert.equal(d.activeElement.id, 'audit-dialog');
    audit.custom(''); assert.equal(d.activeElement, background);
  } finally { dom.window.close(); }
});

test('Spanish close name is localized', async () => {
  const { dom, d, audit } = await fixture();
  try { audit.locale('es'); audit.open('deal'); assert.equal(d.querySelector('.close-btn').getAttribute('aria-label'), 'Cerrar'); }
  finally { dom.window.close(); }
});

test('native browser dialogs retain their own focus behavior', async () => {
  const { dom, d, audit } = await fixture();
  try {
    opener(d); audit.open('deal');
    d.body.insertAdjacentHTML('beforeend', '<dialog open><input id="native-dialog-control"></dialog>');
    const field = d.getElementById('native-dialog-control'); field.focus(); audit.portal();
    assert.equal(d.activeElement, field);
  } finally { dom.window.close(); }
});

test('root-owned hospitality payment drafts preserve focus and caret after root values restore', async () => {
  const { dom, d, audit } = await fixture();
  try {
    opener(d); audit.rootDialog();
    const reference = d.querySelector('[name="reference"]'); reference.value='Unsubmitted external reference'; reference.focus(); reference.setSelectionRange(2,8);
    audit.paint(); const replaced = d.querySelector('[name="reference"]');
    assert.equal(d.activeElement, replaced); assert.equal(replaced.value, 'Unsubmitted external reference'); assert.equal(replaced.selectionStart,2); assert.equal(replaced.selectionEnd,8);
  } finally { dom.window.close(); }
});

test('global command shortcut cannot capture focus behind an existing modal', async () => {
  const { dom, w, d, audit } = await fixture();
  const shortcut = () => d.dispatchEvent(new w.KeyboardEvent('keydown', { key:'k', ctrlKey:true, bubbles:true, cancelable:true }));
  try {
    opener(d); audit.open('deal'); shortcut();
    assert.equal(d.querySelector('.command-palette'), null);
    key(w, 'Escape'); shortcut();
    assert.ok(d.querySelector('.command-palette')); key(w, 'Escape');
    audit.rootDialog(); const reference=d.querySelector('[name="reference"]'); reference.focus(); shortcut();
    assert.equal(d.querySelector('.command-palette'), null); assert.equal(d.activeElement, reference);
    d.body.insertAdjacentHTML('beforeend','<dialog open><input id="native-shortcut"></dialog>'); d.getElementById('native-shortcut').focus(); shortcut();
    assert.equal(d.querySelector('.command-palette'), null); assert.equal(d.activeElement.id,'native-shortcut');
  } finally { dom.window.close(); }
});
