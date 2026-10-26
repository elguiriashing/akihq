import { build } from "esbuild";
import exercisePointerBrowsing from "./selector-pointer-acceptance.cjs";
import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, readFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const product = process.argv[2] || "pasa";
const folder = await mkdtemp(path.join(tmpdir(), "workspace-selector-"));
const output =
  process.env.SELECTOR_EVIDENCE_DIR ||
  "test-results/native-account/workspace-selector";
await mkdir(output, { recursive: true });
await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{WorkspaceSelector}from'./src/components/WorkspaceSelector';const locale=new URLSearchParams(location.search).get('lang')||'en';createRoot(document.getElementById('root')).render(<><label>Email<input aria-label="Draft email" defaultValue="fixture@example.invalid"/></label><WorkspaceSelector current=${JSON.stringify(product)} locale={locale}/></>);`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: path.join(folder, "app.js"),
  bundle: true,
  external: ["/assets/fonts/*"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "next-image-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "image",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents:
            "import React from 'react';export default function Image({unoptimized,priority,...props}){return React.createElement('img',props)}",
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://fixture");
  try {
    if (url.pathname === "/app.js" || url.pathname === "/app.css") {
      res.setHeader(
        "Content-Type",
        url.pathname.endsWith("js") ? "text/javascript" : "text/css",
      );
      res.end(await readFile(path.join(folder, url.pathname.slice(1))));
      return;
    }
    if (url.pathname === "/assets/fonts/aki-selector-poppins-semibold.woff2") {
      res.setHeader("Content-Type", "font/woff2");
      res.end(await readFile(path.join(process.cwd(), "public", url.pathname)));
      return;
    }
    if (
      /^\/brand\/v3\/(pasa|duermo|coches|hq|business)\.svg$/.test(url.pathname)
    ) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.end(await readFile(path.join(process.cwd(), "public", url.pathname)));
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html data-theme="${url.searchParams.get("theme") === "light" ? "light" : "dark"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>*{box-sizing:border-box}html{--surface:#17213a;--ink:#f6f4f1;--muted:#b4bfd1;--line:#ffffff30;background:#11192e;color:var(--ink)}html[data-theme=light]{--surface:#fff;--ink:#172238;--muted:#526078;--line:#d5dce6;background:#f8f9fc}body{margin:0;padding:24px;font:16px system-ui}#root{max-width:480px;margin:0 auto}label{display:grid;gap:8px}input{min-height:44px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`,
    );
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const locale of ["en", "es"])
    for (const theme of ["light", "dark"])
      for (const width of [390, 820, 1440]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: theme === "dark" ? "reduce" : "no-preference",
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          `http://127.0.0.1:${server.address().port}/?lang=${locale}&theme=${theme}&ref=AKI12345`,
        );
        await expect(page.getByRole("link")).toHaveCount(5);
        await exercisePointerBrowsing(page, expect, locale);
        if (locale === "en" && theme === "light" && width === 820) {
          const scene = page.locator(".aks-selector__scene");
          const first = page.getByRole("link", {
            name: "AkiPasa",
            exact: true,
          });
          const second = page.getByRole("link", {
            name: "AkiDuermo",
            exact: true,
          });
          await page.locator('[data-selected="true"]').focus();
          await page.keyboard.press("Home");
          await expect(first).toHaveAttribute("data-energized", "true");
          await expect
            .poll(() =>
              first
                .locator(".aks-selector__effect")
                .evaluate((node) => +getComputedStyle(node).opacity),
            )
            .toBeGreaterThan(0.6);
          const before = await second.getAttribute("style");
          await second.hover();
          await expect(second).toHaveAttribute("data-energized", "true");
          await expect(first).toHaveAttribute("data-selected", "true");
          expect(await second.getAttribute("style")).toBe(before);
          // Sample real interpolated frames, including both incoming and outgoing
          // material. A display:none switch fails this assertion.
          const crossfade = await page.evaluate(async () => {
            await new Promise((resolve) => setTimeout(resolve, 90));
            return [...document.querySelectorAll(".aks-selector__card")]
              .filter((node) =>
                ["AkiPasa", "AkiDuermo"].includes(
                  node.getAttribute("aria-label"),
                ),
              )
              .map(
                (node) =>
                  +getComputedStyle(node.querySelector(".aks-selector__effect"))
                    .opacity,
              );
          });
          expect(
            crossfade.every((opacity) => opacity > 0 && opacity < 0.65),
          ).toBe(true);
          await page.mouse.move(0, 0);
          await expect(first).toHaveAttribute("data-energized", "true");
          await first.focus();
          for (const name of ["pasa", "duermo", "coches", "hq", "business"]) {
            await expect
              .poll(() =>
                page
                  .locator('[data-energized="true"] .aks-selector__effect')
                  .evaluate((node) => +getComputedStyle(node).opacity),
              )
              .toBeGreaterThan(0.6);
            const story = page.locator(
              '[data-energized="true"] .aks-selector__arrival-actor',
            );
            await expect
              .poll(() =>
                story.evaluate((node) => +getComputedStyle(node).opacity),
              )
              .toBeGreaterThan(0.4);
            expect(
              await story.evaluate(
                (node) => getComputedStyle(node).animationIterationCount,
              ),
            ).toBe("1");
            await scene.screenshot({
              path: path.join(output, `arrival-${name}.png`),
            });
            await expect
              .poll(() =>
                story.evaluate((node) => +getComputedStyle(node).opacity),
              )
              .toBe(0);
            await expect
              .poll(() =>
                page
                  .locator('[data-energized="true"] .aks-selector__sustain')
                  .evaluate((node) => +getComputedStyle(node).opacity),
              )
              .toBe(1);
            await scene.screenshot({
              path: path.join(output, `material-${name}.png`),
            });
            await page.keyboard.press("ArrowRight");
          }
          // Interrupted transitions must converge to the last input.
          await page.keyboard.press("End");
          await page.keyboard.press("Home");
          await page.keyboard.press("ArrowRight");
          await expect(second).toHaveAttribute("data-energized", "true");
          await expect
            .poll(() =>
              first
                .locator(".aks-selector__effect")
                .evaluate((node) => +getComputedStyle(node).opacity),
            )
            .toBe(0);
          await expect(page.locator('[data-energized="true"]')).toHaveCount(1);
          await page.emulateMedia({ reducedMotion: "reduce" });
          expect(
            await page
              .locator(".aks-selector__ignition")
              .first()
              .evaluate((node) => getComputedStyle(node).display),
          ).toBe("none");
          expect(
            await page
              .locator(".aks-selector__arrival")
              .first()
              .evaluate((node) => getComputedStyle(node).display),
          ).toBe("none");
          await page.emulateMedia({ reducedMotion: "no-preference" });
        }
        const current = page.locator(
          '.aks-selector__card[data-selected="true"]',
        );
        await current.focus();
        await page.keyboard.press("Home");
        for (const name of [
          "AkiPasa",
          "AkiDuermo",
          "AkiCoches",
          "AkiHQ",
          "AkiBusiness",
        ]) {
          await expect(
            page.getByRole("link", { name, exact: true }),
          ).toHaveAttribute("data-selected", "true");
          await expect(
            page.getByRole("link", { name, exact: true }),
          ).toBeFocused();
          await expect(
            page.getByRole("textbox", { name: "Draft email" }),
          ).toHaveValue("fixture@example.invalid");
          const link = page.getByRole("link", { name, exact: true });
          expect(
            new URL(await link.getAttribute("href")).searchParams.get("ref"),
          ).toBe("AKI12345");
          await page.keyboard.press("ArrowRight");
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        expect(
          await page
            .locator(".aks-selector__symbol img")
            .evaluateAll((images) =>
              images.every((image) => image.complete && image.naturalWidth > 0),
            ),
        ).toBe(true);
        const buttons = await page
          .locator(".aks-selector__card[data-selected=true]")
          .evaluateAll((nodes) =>
            nodes.map((node) => ({
              width: node.getBoundingClientRect().width,
              height: node.getBoundingClientRect().height,
            })),
          );
        for (const bounds of buttons) {
          expect(bounds.width).toBeGreaterThanOrEqual(44);
          expect(bounds.height).toBeGreaterThanOrEqual(44);
        }
        if (theme === "dark")
          expect(
            await page
              .locator(".aks-selector__effect-orbit")
              .first()
              .evaluate((node) => getComputedStyle(node).animationName),
          ).toBe("none");
        expect(
          await page
            .locator(".aks-selector__scene")
            .evaluate((node) => node.scrollLeft),
        ).toBe(0);
        expect(errors).toEqual([]);
        for (
          let i = 0;
          i < ["pasa", "duermo", "coches", "hq"].indexOf(product);
          i++
        )
          await page.keyboard.press("ArrowRight");
        await page.screenshot({
          path: path.join(output, `${product}-${locale}-${theme}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await expect(
          page.locator(".aks-selector__footer, .aki-workspace-picker__action"),
        ).toHaveCount(0);
        const opened = [];
        await page.route(
          /^https:\/\/(akipasa\.com|akiduermo\.com|akicoches\.com|akihq\.app|akibusiness\.com)\//,
          (route) => {
            opened.push(route.request().url());
            return route.fulfill({
              contentType: "text/html",
              body: "<h1>Workspace destination</h1>",
            });
          },
        );
        await page.locator(".aks-selector__card[data-selected=true]").focus();
        await page.keyboard.press("Home");
        const scene = page.locator(".aks-selector__scene");
        await scene.dispatchEvent("pointerdown", {
          pointerType: "touch",
          isPrimary: true,
          pointerId: 7,
          clientX: 240,
          clientY: 80,
          bubbles: true,
        });
        await scene.dispatchEvent("pointerup", {
          pointerType: "touch",
          isPrimary: true,
          pointerId: 7,
          clientX: 130,
          clientY: 82,
          bubbles: true,
        });
        await expect(
          page.getByRole("link", { name: "AkiDuermo", exact: true }),
        ).toHaveAttribute("data-selected", "true");
        await page
          .getByRole("link", { name: "AkiPasa", exact: true })
          .dispatchEvent("click", { bubbles: true, cancelable: true });
        await expect(
          page.getByRole("textbox", { name: "Draft email" }),
        ).toHaveValue("fixture@example.invalid");
        expect(opened).toEqual([]);
        // A real tap on a neighbouring icon follows its href immediately.
        await page
          .getByRole("link", { name: "AkiCoches", exact: true })
          .click();
        await expect(page).toHaveURL(
          `https://akicoches.com/account?lang=${locale}&ref=AKI12345`,
        );
        expect(opened).toHaveLength(1);
        await page.close();
      }
  console.log(
    JSON.stringify({
      product,
      cases: 12,
      status: "passed",
      scope:
        "Real AkiSelector login adapter; language/theme/viewport/keyboard/referral/draft/reduced-motion fixtures",
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(folder, { recursive: true, force: true });
}
