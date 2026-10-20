import test from "node:test";
import assert from "node:assert/strict";
import { suiteHref } from "../src/lib/suite-navigation.ts";

const products = ["pasa", "duermo", "coches", "hq", "business"];
for (const locale of ["en", "es"]) {
  const expected = [
    `https://akipasa.com/${locale}`,
    `https://akiduermo.com/?lang=${locale}`,
    `https://akicoches.com/?lang=${locale}`,
    `https://akihq.app/${locale}/business`,
    `https://akibusiness.com/?locale=${locale}`,
  ];
  for (const [index, product] of products.entries()) {
    test(`${product} accepts ${locale} without resetting the destination language`, () => {
      assert.equal(suiteHref(product, locale), expected[index]);
    });
  }
}
test("localized destinations replace old locale once, without redirect loops", () => {
  assert.equal(
    suiteHref("hq", "es", { path: "/en/business/locations" }),
    "https://akihq.app/es/business/locations",
  );
  assert.equal(
    suiteHref("pasa", "en", { path: "/es/auth" }),
    "https://akipasa.com/en/auth",
  );
});
for (const path of [
  "https://evil.test",
  "//evil.test",
  "/\\evil.test",
  "/%2f%2fevil.test",
  "/auth?next=https://evil.test",
  "/auth#access_token=secret",
  "/a/../auth",
  "/a/./auth",
  "/ auth",
  "/auth\n",
]) {
  test(`reject unsafe destination ${JSON.stringify(path)}`, () => {
    for (const product of products)
      assert.throws(() => suiteHref(product, "en", { path }));
  });
}
test("public referral code survives all destinations but arbitrary values do not", () => {
  for (const product of products) {
    assert.equal(
      new URL(
        suiteHref(product, "es", { referralCode: "ALEX1234" }),
      ).searchParams.get("ref"),
      "ALEX1234",
    );
    for (const referralCode of [
      "bad",
      "alice@example.com",
      "ALEX1234&next=evil",
      "A".repeat(25),
    ]) {
      assert.equal(
        new URL(suiteHref(product, "es", { referralCode })).searchParams.has(
          "ref",
        ),
        false,
      );
    }
  }
});
test("runtime callers cannot select arbitrary origins", () => {
  assert.throws(() => suiteHref("__proto__", "en"));
  assert.throws(() => suiteHref("https://evil.test", "en"));
});
