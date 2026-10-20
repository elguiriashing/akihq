import { build } from "esbuild";
import { chromium } from "@playwright/test";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd(),
  output = path.join(root, "test-results/akipulse-scoped");
await fs.mkdir(output, { recursive: true });
await build({
  entryPoints: ["tests/fixtures/akipulse-scoped-browser.tsx"],
  bundle: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  outfile: path.join(output, "fixture.js"),
  loader: { ".module.css": "local-css" },
  tsconfig: "tsconfig.json",
});
// Use the actual shared parent rule, with a sibling so :only-child cannot mask a missing span.
const dashboardCSS = (await fs.readFile("src/app/globals.css", "utf8")).match(
  /^\.dashboard-grid\s*\{[^}]+\}/m,
)?.[0];
assert(dashboardCSS, "Production dashboard grid rule must be available");
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>${dashboardCSS}:root{--line:#c4cad5;--surface:#fff;--muted:#4e5667;--primary:#f26b1d;color-scheme:light;background:#f7f8fa;color:#172238;font-family:system-ui}html[data-theme=dark]{--line:#45546c;--surface:#1c2d4b;--muted:#b4bfd1;color-scheme:dark;background:#14213d;color:#faf7f2}*{box-sizing:border-box}body{margin:0;padding:1rem;max-width:85rem;margin-inline:auto}button{padding:.65rem;border-radius:.6rem;border:1px solid var(--line);background:var(--surface);color:inherit;font:inherit}a{color:inherit}p{line-height:1.5}</style></head><body><main id="fixture"></main><script type="module" src="/fixture.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
  const name = new URL(req.url, "http://localhost").pathname;
  if (name === "/") {
    res.setHeader("content-type", "text/html");
    res.end(html);
    return;
  }
  if (!["/fixture.js", "/fixture.css"].includes(name)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader(
    "content-type",
    name.endsWith("css") ? "text/css" : "text/javascript",
  );
  res.end(await fs.readFile(path.join(output, name.slice(1))));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
const evidence = [];
try {
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  for (const [width, height] of [
    [390, 844],
    [820, 1180],
    [1180, 820],
    [1440, 900],
  ])
    for (const locale of ["en", "es"])
      for (const theme of ["light", "dark"])
        for (const kind of ["venue", "property", "fleet", "organisation"]) {
          const page = await browser.newPage({ viewport: { width, height } });
          const errors = [];
          page.on("pageerror", (error) => errors.push(String(error)));
          const url = `http://127.0.0.1:${server.address().port}/?${new URLSearchParams({ locale, theme, kind })}`;
          await page.goto(url);
          await page.locator("table").waitFor();
          const gridBox = await page
            .locator("[data-fixture-dashboard]")
            .boundingBox();
          const panelBox = await page
            .locator('[aria-labelledby="pulse-booking-title"]')
            .boundingBox();
          assert(
            gridBox && panelBox && Math.abs(panelBox.width - gridBox.width) < 2,
            "Scoped panel must span the complete production dashboard grid",
          );

          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          for (const control of await page
            .locator("button,select,summary,nav a")
            .all()) {
            const box = await control.boundingBox();
            assert(
              box && box.height >= 43.5,
              JSON.stringify({ locale, kind, box }),
            );
          }
          await page.locator("summary").first().click();
          if (kind !== "fleet")
            assert(
              (await page.locator("body").innerText()).includes(
                locale === "es" ? "Clics de reserva" : "Booking clicks",
              ),
            );
          await page.locator("summary").last().click();
          assert(
            (await page.locator("body").innerText()).includes(
              locale === "en" ? "verified adapter" : "adaptador verificado",
            ),
          );
          await page.locator("select[name=pulseResource]").focus();
          await page.keyboard.press("Tab");
          assert(
            await page.evaluate(() => document.activeElement !== document.body),
          );
          const screenshot = `${kind}-${locale}-${theme}-${width}x${height}.png`;
          await page.screenshot({
            path: path.join(output, screenshot),
            fullPage: true,
          });
          await page.goto(url + "&denied=1");
          await page.getByRole("alert").waitFor();
          assert.equal(await page.locator("table").count(), 0);
          assert.deepEqual(errors, []);
          evidence.push({
            kind,
            locale,
            theme,
            width,
            height,
            status: "passed",
            screenshot,
            scope:
              "real component, labelled synthetic report, no provider requests",
          });
          await page.close();
        }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.writeFile(
    path.join(output, "evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
}
console.log(
  `${evidence.length} scoped Pulse component browser combinations passed`,
);
