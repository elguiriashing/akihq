import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
const provider = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
);
assert.equal(
  provider.hostname,
  "127.0.0.1",
  "Disposable browser fixture requires loopback build configuration",
);
const appPort = Number(process.env.MANAGEMENT_BROWSER_PORT || 3414),
  base = `http://127.0.0.1:${appPort}`;
const identity = "11111111-1111-4111-8111-111111111111",
  property = "22222222-2222-4222-8222-222222222222";
const user = {
  id: identity,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.invalid",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const requests = [];
const fixture = http.createServer((req, res) => {
  requests.push(req.url);
  res.setHeader("content-type", "application/json");
  if (req.url.startsWith("/auth/v1/user")) res.end(JSON.stringify(user));
  else if (req.url.startsWith("/rest/v1/profiles"))
    res.end(
      JSON.stringify(
        req.headers.accept?.includes("object+json")
          ? { terms_version: "2026-07-23", app_role: "consumer" }
          : [{ terms_version: "2026-07-23", app_role: "consumer" }],
      ),
    );
  else if (req.url.startsWith("/rest/v1/rpc/")) res.end("false");
  else res.end("[]");
});
await new Promise((resolve, reject) =>
  fixture
    .listen(Number(provider.port), "127.0.0.1", resolve)
    .once("error", reject),
);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(appPort),
  ],
  {
    env: { ...process.env, AKISUITE_ACCOMMODATION_READY: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (data) => (output += data));
server.stderr.on("data", (data) => (output += data));
let browser;
try {
  for (let n = 0; n < 60; n++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    if (n === 59) throw new Error(output);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const payload = {
    sub: identity,
    aud: "authenticated",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "disposable",
  ].join(".");
  const session = {
    access_token: token,
    refresh_token: "disposable-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: payload.exp,
    user,
  };
  await mkdir("test-results/independent-management", { recursive: true });
  for (const locale of ["en", "es"])
    for (const width of [390, 820, 1440])
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme: theme,
        });
        await context.addCookies([
          {
            name: "sb-127-auth-token",
            value:
              "base64-" +
              Buffer.from(JSON.stringify(session)).toString("base64url"),
            url: base,
            httpOnly: false,
            sameSite: "Lax",
          },
        ]);
        const mutations = [];
        await context.route("**/*", async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== base) return route.abort();
          if (url.pathname === "/api/business/accommodations") {
            if (route.request().method() === "POST") {
              mutations.push(route.request().postDataJSON());
              return route.fulfill({ json: { property } });
            }
            if (!url.searchParams.has("property"))
              return route.fulfill({
                json: { properties: [], hasMore: false },
              });
            if (url.searchParams.get("section") === "team")
              return route.fulfill({
                json: {
                  canManageTeam: true,
                  ownerProfileId: property,
                  members: [
                    {
                      profile_id: "33333333-3333-4333-8333-333333333333",
                      role: "manager",
                    },
                  ],
                  total: 1,
                },
              });
            return route.fulfill({
              json: Object.fromEntries(
                [
                  "profile",
                  "room_types",
                  "units",
                  "nightly_rates",
                  "unit_blocks",
                  "booking_settings",
                  "reservations",
                  "property_media",
                ].map((key) => [key, { rows: [] }]),
              ),
            });
          }
          return route.continue();
        });
        const page = await context.newPage();
        await page.goto(`${base}/${locale}/business/accommodations`, {
          waitUntil: "networkidle",
        });
        await page
          .getByRole("heading", {
            name: locale === "es" ? "Mis alojamientos" : "My accommodation",
            exact: true,
          })
          .waitFor();
        await page.getByLabel("Aki Apps", { exact: true }).click();
        const settings = page.getByRole("link", {
          name: locale === "es" ? "Ajustes" : "Settings",
          exact: true,
        });
        assert.equal(await settings.getAttribute("href"), `/${locale}/account`);
        await page
          .getByRole("button", {
            name: locale === "es" ? "Cerrar sesión" : "Log out",
            exact: true,
          })
          .waitFor();
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", {
            name:
              locale === "es"
                ? "Cerrar opciones de privacidad"
                : "Close privacy choices",
            exact: true,
          })
          .click();
        await page
          .getByLabel(locale === "es" ? "Nombre" : "Name", { exact: true })
          .fill("Disposable private stay");
        assert.ok(
          await page
            .getByLabel(locale === "es" ? "Nombre" : "Name", { exact: true })
            .evaluate(
              (input) =>
                parseFloat(getComputedStyle(input).borderTopWidth) >= 1 &&
                input.getBoundingClientRect().height >= 44,
            ),
        );
        await page
          .getByRole("button", {
            name: locale === "es" ? "Crear" : "Create",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name:
              locale === "es"
                ? "Todos mis alojamientos"
                : "All my accommodation",
          })
          .waitFor();
        assert.deepEqual(mutations, [
          { action: "create", name: "Disposable private stay" },
        ]);
        await page
          .getByRole("button", {
            name: locale === "es" ? "Tipos de habitación" : "Room types",
            exact: true,
          })
          .click();
        await page
          .getByLabel(locale === "es" ? "Nombre" : "Name", { exact: true })
          .fill("Disposable room");
        await page
          .getByRole("button", {
            name: locale === "es" ? "Guardar" : "Save",
            exact: true,
          })
          .click();
        await page.waitForFunction(
          () => !document.querySelector("fieldset")?.disabled,
        );
        assert.equal(mutations[1].property, property);
        assert.equal(mutations[1].action, "room_type");
        assert.equal("venueId" in mutations[1], false);
        await page
          .getByRole("button", {
            name: locale === "es" ? "Equipo" : "Team",
            exact: true,
          })
          .click();
        const member = "33333333-3333-4333-8333-333333333333";
        await page
          .getByLabel(
            locale === "es"
              ? "UUID de la cuenta verificada"
              : "Verified account UUID",
          )
          .fill(member);
        await page
          .getByRole("button", {
            name: locale === "es" ? "Conceder gestión" : "Grant management",
          })
          .click();
        await page
          .getByLabel(
            locale === "es"
              ? "UUID de la cuenta verificada"
              : "Verified account UUID",
          )
          .waitFor();
        assert.deepEqual(mutations[2], {
          action: "member",
          property,
          profile: member,
          role: "manager",
        });
        await page
          .getByRole("button", {
            name: locale === "es" ? "Revocar acceso" : "Revoke access",
          })
          .click();
        await page
          .getByLabel(
            locale === "es"
              ? "UUID de la cuenta verificada"
              : "Verified account UUID",
          )
          .waitFor();
        assert.deepEqual(mutations[3], {
          action: "member",
          property,
          profile: member,
          role: null,
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
        );
        await page.screenshot({
          path: `test-results/independent-management/${locale}-${width}-${theme}.png`,
          fullPage: true,
        });
        await context.close();
      }
  assert.ok(requests.some((path) => path.startsWith("/auth/v1/user")));
  console.log(
    "PASS 8 disposable authenticated management browser cases; no live provider, booking, publication or email acceptance implied.",
  );
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await browser?.close();
  server.kill();
  await new Promise((resolve) => fixture.close(resolve));
}
