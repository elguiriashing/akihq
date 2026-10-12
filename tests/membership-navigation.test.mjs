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
