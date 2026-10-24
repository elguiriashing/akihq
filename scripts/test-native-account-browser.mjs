import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
const root = process.cwd(),
  out = await mkdtemp(path.join(tmpdir(), "native-account-")),
  product = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  ).name;
const artifacts = path.join(root, "test-results/native-account");
await mkdir(artifacts, { recursive: true });
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{SharedAccount}from ${JSON.stringify(path.join(root, "src/components/SharedAccount.tsx"))};SharedAccount({locale:window.__locale,product:${JSON.stringify(product)},home:'/account',membership:'/membership',path:'/settings'}).then(tree=>createRoot(document.getElementById('app')).render(tree));`;
const stubs = {
  "next/link": `import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
  "@/lib/auth": `export async function requireUser(){return{user:{id:'fixture-owner',email:'fixture@example.test'},supabase:{from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{display_name:'Shared member',username:'shared_member',bio:'Fixture biography',phone:'123',locality:'Fuengirola',province:'Málaga',preferred_locale:window.__locale,profile_visibility:'private',contact_visibility:'members'},error:null})};return q;}}}}`,
  "@/lib/shared-account-actions": `const record=(name,data)=>{window.__submissions.push({name,values:Object.fromEntries(data)});};export async function saveSharedProfile(data){record('profile',data)};export async function changeSharedEmail(data){record('email',data)};export async function resetSharedPassword(data){record('reset',data)};export async function uploadSharedProfileMedia(data){record('photo',data)};`,
  "./SharedMembershipPanel": `import React from 'react';export function SharedMembershipPanel(){return <section><h2>Membership fixture</h2><p>Shared billing is verified separately by identity-isolation tests.</p></section>}`,
};
await build({
  stdin: {
    contents: entry,
    resolveDir: root,
    sourcefile: "native-account-fixture.tsx",
    loader: "tsx",
  },
  bundle: true,
  outfile: path.join(out, "fixture.js"),
  format: "esm",
  jsx: "automatic",
  plugins: [
    {
      name: "disposable-account-boundaries",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(next\/link|@\/lib\/(auth|shared-account-actions)|\.\/SharedMembershipPanel)$/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents: stubs[args.path],
          loader: "tsx",
          resolveDir: root,
        }));
      },
    },
  ],
});
await writeFile(
  path.join(out, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{font-family:system-ui;margin:0;background:#101425;color:#f5f4ff}html[data-theme=light] body{background:#faf8fe;color:#22243a}</style></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>`,
);
if (process.argv.includes("--build-only")) {
  await rm(out, { recursive: true, force: true });
  console.log("Native account browser fixture compiled");
  process.exit(0);
}
const server = http.createServer(async (req, res) => {
  const file = new URL(req.url, "http://fixture").pathname;
  try {
    res.setHeader(
      "content-type",
      file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : "text/html",
    );
    res.end(await readFile(path.join(out, file === "/" ? "index.html" : file)));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser,
  cases = 0;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const locale of ["en", "es"])
    for (const theme of ["light", "dark"])
      for (const viewport of [
        { width: 360, height: 800 },
        { width: 768, height: 1024 },
        { width: 1440, height: 900 },
      ]) {
        const context = await browser.newContext({
          viewport,
          serviceWorkers: "block",
        });
        await context.addInitScript(
          ({ locale, theme }) => {
            window.__locale = locale;
            window.__submissions = [];
            document.addEventListener(
              "DOMContentLoaded",
              () => (document.documentElement.dataset.theme = theme),
            );
          },
          { locale, theme },
        );
        const external = [],
          page = await context.newPage(),
          errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await context.route("**/*", (route) => {
          if (new URL(route.request().url()).origin === base)
            return route.continue();
          external.push(route.request().url());
          return route.abort();
        });
        await page.goto(base);
        await page
          .getByRole("heading", {
            name: locale === "es" ? "Tu cuenta" : "Your account",
            exact: true,
          })
          .waitFor();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page
          .getByLabel(locale === "es" ? "Nombre" : "Display name", {
            exact: true,
          })
          .fill("Updated fixture name");
        await page
          .getByRole("button", {
            name:
              locale === "es"
                ? "Guardar perfil compartido"
                : "Save shared profile",
            exact: true,
          })
          .click();
        await page.waitForFunction(() => window.__submissions.length === 1);
        assert.equal(
          await page.evaluate(() => window.__submissions[0].values.displayName),
          "Updated fixture name",
        );
        const link = page.getByRole("link", {
          name: locale === "es" ? "Membresía" : "Membership",
          exact: true,
        });
        assert.equal(await link.getAttribute("href"), "/membership");
        await page
          .getByText(
            locale === "es"
              ? "Fotos de perfil y portada"
              : "Profile and cover photos",
            { exact: true },
          )
          .click();
        assert.equal(await page.locator("input[type=file]").count(), 2);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page
          .getByRole("button", {
            name:
              locale === "es"
                ? "Enviar enlace de recuperación"
                : "Send password reset link",
            exact: true,
          })
          .click();
        await page.waitForFunction(() => window.__submissions.length === 2);
        assert.equal(
          await page.evaluate(() => window.__submissions[1].name),
          "reset",
        );
        await page.screenshot({
          path: path.join(
            artifacts,
            `${locale}-${theme}-${viewport.width}.png`,
          ),
          fullPage: true,
        });
        assert.deepEqual(errors, []);
        assert.deepEqual(external, []);
        await context.close();
        cases++;
      }
  await writeFile(
    path.join(artifacts, "receipt.json"),
    JSON.stringify(
      {
        cases,
        product,
        scope:
          "Actual shared account component; disposable identity/actions; no production mutations",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ cases, product, status: "passed" }));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await rm(out, { recursive: true, force: true });
}
