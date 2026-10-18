import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("AkiHQ links to the central AkiSuite membership hub in EN/ES", () => {
  const source = readFileSync(new URL("../assets/app-v32.js", import.meta.url), "utf8");
  assert.match(source, /account\/subscription\?from=akihq/);
  assert.match(source, /Membresías AkiSuite/);
  assert.match(source, /AkiSuite memberships/);
  assert.match(source, /state\.settings\?\.locale === "es"/);
});

test("the membership navigation bundle has a fresh and consistent offline cache key", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(html, /app-v32\.js\?v=42/);
  assert.match(sw, /app-v32\.js\?v=42/);
  const cache = sw.match(/^const CACHE = "akihq-v(\d+)";/m);
  assert.ok(cache, "Service-worker cache must carry an explicit release version");
  assert.ok(Number(cache[1]) >= 120, "Membership navigation must not reuse a pre-navigation cache");
  const replacements = JSON.parse(readFileSync(new URL("../tools/operations-product-release.json", import.meta.url), "utf8"))["sw.js"];
  const cacheReplacement = replacements.find(entry => entry.from.startsWith("const CACHE = "));
  assert.equal(cacheReplacement?.from.trim(), cache[0], "Paid-product cache transform must match this source release");
  const paidCache = cacheReplacement.to.match(/^const CACHE = "akihq-v(\d+)";/);
  assert.ok(paidCache && Number(paidCache[1]) > Number(cache[1]), "Paid-product release needs a distinct, newer cache");
});
