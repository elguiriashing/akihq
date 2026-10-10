import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(new URL('../cloudflare/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const source = await readFile(new URL('../assets/app-v32.js', import.meta.url), 'utf8');
const boot = /  boot\(\);\s*\}\)\(\);\s*$/;
assert.ok(boot.test(source), 'test seam must replace only the final boot call');
// Execute the real app and route renderer; expose closures only in the test copy.
const testSource = source.replace(boot, `
  window.__chat = {
    select({id='workspace-a', role, platformRole='user', enabled=true, populated=true}={}) {
      authUser={id:'self',email:'self@example.test'}; authRole=platformRole;
      state=seedState();
      state.workspace={...state.workspace,id,role,toolKeys:enabled?['collaboration']:[]};
      state.currentUserId='self';
      state.employees=[{id:'self',name:'Me',role:'Staff',email:authUser.email}];
      state.teamChat={workspaceId:id,activeChannelId:populated?'general':null,
        channels:populated?[{id:'general',name:'general',description:'Team updates'}]:[],
        messages:populated?{general:[
          {id:'own',authorId:'self',authorName:'Me',text:'My update',at:new Date().toISOString()},
          {id:'other',authorId:'other',authorName:'Colleague',text:'Their update',at:new Date().toISOString()}
        ]}:{}
      };
      ui.route='collaboration'; ui.activeTeamChannel=null;
    },
    switchWorkspace(id,role) { state.workspace={...state.workspace,id,role}; },
    paint() { document.querySelector('#app').innerHTML=renderView(); },
    canManage:canManageTeamChat
  };
})();`);

function setup(t) {
  const dom = new JSDOM('<main id="app"></main><div id="portal"></div><input id="import-file" type="file"><input id="media-file" type="file">', {
    url:'https://qa.akihq.example/#/collaboration', runScripts:'outside-only'
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.structuredClone = structuredClone;
  window.createCompanyManager = () => ({reset(){}});
  window.createSupportDesk = () => ({reset(){}});
  window.setInterval = () => 0;
  window.eval(testSource);
  return { api:window.__chat, document:window.document };
}

for (const role of ['owner','admin','manager','staff','viewer',undefined]) {
  test(`Team Chat renders and scopes management controls to workspace role ${role}`, t => {
    const { api, document } = setup(t);
    api.select({role});
    api.paint();
    assert.ok(document.querySelector('.team-chat-suite'));
    assert.match(document.body.textContent, /Their update/);
    const manager = ['owner','admin','manager'].includes(role);
    assert.equal(!!document.querySelector('[data-action="create-team-channel"]'), manager);
    assert.equal(!!document.querySelector('[data-action="delete-team-channel"]'), manager);
    assert.ok(document.querySelector('[data-action="delete-team-message"][data-msg-id="own"]'));
    assert.equal(!!document.querySelector('[data-action="delete-team-message"][data-msg-id="other"]'), manager);
  });
}

test('an empty platform Team Chat renders without a workspace reference error', t => {
  const {api,document} = setup(t);
  api.select({id:'ws_akipasa',role:'admin',platformRole:'administrator',populated:false});
  api.paint();
  assert.ok(document.querySelector('.team-chat-suite'));
  assert.ok(document.querySelector('[data-action="create-team-channel"]'));
});

test('switching workspaces removes old messages and uses the new role', t => {
  const {api,document} = setup(t);
  api.select({role:'owner',platformRole:'administrator'});
  api.paint();
  api.switchWorkspace('workspace-b','staff');
  api.paint();
  assert.equal(api.canManage(),false);
  assert.equal(document.querySelector('[data-action="create-team-channel"]'),null);
  assert.doesNotMatch(document.body.textContent,/Their update|My update/);
  api.switchWorkspace('workspace-c','manager');
  api.paint();
  assert.ok(document.querySelector('[data-action="create-team-channel"]'));
});

test('Team Chat remains unavailable when the workspace tool is disabled', t => {
  const {api,document} = setup(t);
  api.select({role:'owner',enabled:false});
  api.paint();
  assert.match(document.body.textContent,/Tool not enabled/);
  assert.equal(document.querySelector('.team-chat-suite'),null);
});
