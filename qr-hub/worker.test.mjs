import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

const base = "https://qr.akihq.app/";

test("serves an accessible two-path hub and five canonical destinations", async () => {
  const response = await worker.fetch(new Request(base));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  for (const path of ["#business", "#explore", "#home"])
    assert.ok(html.includes(`href="${path}"`));
  for (const domain of [
    "akihq.app",
    "akibusiness.com",
    "akipasa.com",
    "akiduermo.com",
    "akicoches.com",
  ]) {
    assert.ok(html.includes(`href="https://${domain}/"`), `Missing ${domain}`);
  }
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /focus\(\{preventScroll:true\}\)/);
  assert.match(
    response.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
});

test("HEAD, robots, unknown routes and mutation requests behave safely", async () => {
  const head = await worker.fetch(new Request(base, { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const robots = await worker.fetch(new Request(`${base}robots.txt`));
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Allow: \/$/m);
  const missing = await worker.fetch(new Request(`${base}login`));
  assert.equal(missing.status, 404);
  const post = await worker.fetch(new Request(base, { method: "POST" }));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, HEAD");
});

test("QR product cards use the approved AkiSuite colour identities", async () => {
  const html = await (await worker.fetch(new Request(base))).text();
  const expected = [
    ["hq", "https://akihq.app/", "#ffc533"],
    ["business-product", "https://akibusiness.com/", "#c49dff"],
    ["pasa", "https://akipasa.com/", "#ff9857"],
    ["duermo", "https://akiduermo.com/", "#86e4c4"],
    ["coches", "https://akicoches.com/", "#ff958e"],
  ];
  for (const [className, href, accent] of expected) {
    assert.ok(
      html.includes(`class="destination ${className}" href="${href}"`),
      `Wrong destination class for ${href}`,
    );
    assert.ok(
      html.includes(`.${className} {--accent:${accent};`),
      `Wrong theme colour for ${className}`,
    );
  }
});
