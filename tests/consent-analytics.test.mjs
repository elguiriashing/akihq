import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const canonicalHost = "akihq.app";
const source = readFileSync(
  new URL("../src/components/ConsentAnalytics.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function fixture({
  id = "G-TEST000001",
  host = canonicalHost,
  analytics = false,
  marketing = false,
  trackingAllowed = true,
} = {}) {
  let choices = { analytics, marketing };
  let cleanup;
  const scripts = [];
  const writes = [];
  const listeners = new Map();
  const w = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => {
      if (listeners.get(name) === fn) listeners.delete(name);
    },
  };
  const document = {
    getElementById: (id) => scripts.find((script) => script.id === id),
    createElement: (tag) => ({ tag }),
    head: { appendChild: (script) => scripts.push(script) },
    get cookie() {
      return "_ga=visitor; _ga_TEST000001=session; akipasa_consent=kept; session=kept";
    },
    set cookie(value) {
      writes.push(value);
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "react") return { useEffect: (fn) => (cleanup = fn()) };
      if (name === "../lib/privacy-consent") {
        return { readPrivacyChoices: () => choices };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
    process: { env: id === null ? {} : { NEXT_PUBLIC_GA4_MEASUREMENT_ID: id } },
    window: w,
    document,
    location: { hostname: host },
  });
  const mount = (allowed = trackingAllowed) => {
    exports.ConsentAnalytics({ trackingAllowed: allowed });
  };
  mount();
  return {
    w,
    scripts,
    writes,
    listeners,
    mount,
    unmount: () => cleanup?.(),
    change: (next) => {
      choices = { ...choices, ...next };
      listeners.get("akipasa:consent-changed")?.();
    },
    commands: () => Array.from(w.dataLayer || [], (entry) => Array.from(entry)),
  };
}

for (const id of [
  null,
  "",
  "not-a-tag",
  "AW-18500420718",
  "G-PW8547QDGD",
  'G-TEST"<script>',
]) {
  test(`missing, invalid or AkiPasa ID is closed: ${String(id)}`, () => {
    const f = fixture({ id, analytics: true });
    assert.equal(f.scripts.length, 0);
    assert.equal(f.w.gtag, undefined);
  });
}
for (const host of [
  "localhost",
  "preview.workers.dev",
  "preview.pages.dev",
  `evil.${canonicalHost}`,
  `${canonicalHost}.evil.test`,
]) {
  test(`does not track noncanonical host ${host}`, () => {
    const f = fixture({ host, analytics: true });
    assert.equal(f.scripts.length, 0);
    assert.equal(f.w.gtag, undefined);
  });
}

test("default consent is denied and does not load any Google script", () => {
  const f = fixture();
  assert.equal(f.scripts.length, 0);
  assert.equal(f.w["ga-disable-G-TEST000001"], true);
  assert.deepEqual(
    f.commands().map((c) => c.slice(0, 2)),
    [
      ["consent", "default"],
      ["consent", "update"],
    ],
  );
  for (const command of f.commands()) {
    for (const key of [
      "analytics_storage",
      "ad_storage",
      "ad_user_data",
      "ad_personalization",
    ]) {
      assert.equal(command[2][key], "denied");
    }
  }
});

test("gtag enqueues native Arguments objects rather than arrays", () => {
  const f = fixture({ analytics: true });
  assert.ok(f.w.dataLayer.length > 0);
  for (const entry of f.w.dataLayer) {
    assert.equal(Array.isArray(entry), false);
    assert.equal(Object.prototype.toString.call(entry), "[object Arguments]");
  }
});

test("grant uses only the configured destination after denied defaults", () => {
  const f = fixture();
  f.change({ analytics: true });
  assert.equal(f.scripts.length, 1);
  assert.equal(
    f.scripts[0].src,
    "https://www.googletagmanager.com/gtag/js?id=G-TEST000001",
  );
  const commands = f.commands();
  assert.equal(commands[0][0], "consent");
  assert.equal(commands[0][1], "default");
  const configs = commands.filter((c) => c[0] === "config");
  assert.equal(configs.length, 1);
  assert.equal(configs[0][1], "G-TEST000001");
  assert.equal(configs[0][2].allow_google_signals, false);
  assert.equal(configs[0][2].allow_ad_personalization_signals, false);
});

test("marketing consent never enables the AkiPasa advertising campaign", () => {
  const f = fixture({ marketing: true });
  assert.equal(f.scripts.length, 0);
  f.change({ analytics: true });
  for (const c of f.commands().filter((c) => c[0] === "consent")) {
    assert.equal(c[2].ad_storage, "denied");
    assert.equal(c[2].ad_user_data, "denied");
    assert.equal(c[2].ad_personalization, "denied");
  }
  assert.equal(
    f.commands().some((c) => c[1] === "AW-18500420718"),
    false,
  );
});

test("server tracking restriction overrides both stored and changed consent", () => {
  const f = fixture({
    analytics: true,
    marketing: true,
    trackingAllowed: false,
  });
  f.change({ analytics: true, marketing: true });
  assert.equal(f.scripts.length, 0);
  assert.equal(f.w["ga-disable-G-TEST000001"], true);
  assert.equal(
    f.commands().some((c) => c[0] === "config"),
    false,
  );
});

test("repeated grants and effect remounts do not duplicate the loader or config", () => {
  const f = fixture({ analytics: true });
  f.change({ analytics: true });
  f.unmount();
  f.mount();
  f.change({ analytics: true });
  assert.equal(f.scripts.length, 1);
  assert.equal(f.commands().filter((c) => c[0] === "config").length, 1);
  assert.equal(
    f.commands().filter((c) => c[0] === "consent" && c[1] === "default").length,
    1,
  );
  assert.equal(f.w["ga-disable-G-TEST000001"], false);
});

test("revocation disables measurement and clears only analytics cookies", () => {
  const f = fixture({ analytics: true, host: `www.${canonicalHost}` });
  f.change({ analytics: false });
  assert.equal(f.w["ga-disable-G-TEST000001"], true);
  assert.equal(f.commands().at(-1)[2].analytics_storage, "denied");
  assert.ok(f.writes.some((c) => c.includes(`Domain=${canonicalHost}`)));
  assert.ok(f.writes.some((c) => c.includes(`Domain=www.${canonicalHost}`)));
  assert.ok(
    f.writes.every((c) => c.startsWith("_ga") && c.includes("Max-Age=0")),
  );
  assert.equal(
    f.writes.some((c) => c.includes("akipasa.com")),
    false,
  );
});

test("account policy changes revoke tracking without duplicate registration", () => {
  const f = fixture({ analytics: true });
  f.unmount();
  f.mount(false);
  assert.equal(f.w["ga-disable-G-TEST000001"], true);
  f.unmount();
  f.mount(true);
  assert.equal(f.w["ga-disable-G-TEST000001"], false);
  assert.equal(f.commands().filter((c) => c[0] === "config").length, 1);
});

test("effect cleanup removes the listener and denies further analytics", () => {
  const f = fixture({ analytics: true });
  f.unmount();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.w["ga-disable-G-TEST000001"], true);
  assert.equal(f.commands().at(-1)[2].analytics_storage, "denied");
});
