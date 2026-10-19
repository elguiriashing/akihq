const managementName =
  process.env.NEXT_PUBLIC_AKISUITE_ROLE_SWAP === "true"
    ? "AkiHQ"
    : "AkiBusiness";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.BUSINESS_TEST_URL || "http://127.0.0.1:3013";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
await mkdir("test-results/business", { recursive: true });
let cases = 0;
try {
  for (const locale of ["en", "es"])
    for (const width of [390, 820, 1440])
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme: theme,
        });
        await context.route("**/*", (route) =>
          new URL(route.request().url()).origin === new URL(base).origin
            ? route.continue()
            : route.abort(),
        );
        const page = await context.newPage();
        const response = await page.goto(`${base}/${locale}/business`, {
          waitUntil: "networkidle",
        });
        assert.equal(response.status(), 200);
        const csp = response.headers()["content-security-policy"];
        assert.ok(csp.includes("https://akipasa.supabase.co"));
        assert.ok(csp.includes("https://vhpbvcfkcteswlsdjrfl.supabase.co"));
        assert.ok(csp.includes("wss://vhpbvcfkcteswlsdjrfl.supabase.co"));
        assert.equal(csp.includes("*.supabase.co"), false);
        assert.match(page.url(), new RegExp(`/${locale}/auth\\?next=`));
        assert.equal(await page.title(), managementName);
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.equal(
          await page.locator("body").getAttribute("data-product"),
          "akibusiness",
        );
        assert.equal(await page.locator('input[name="email"]').count(), 1);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          true,
        );
        await page
          .getByRole("button", {
            name: locale === "es" ? "Rechazar opcionales" : "Reject optional",
            exact: true,
          })
          .click();
        const recovery = await page.goto(
          `${base}/${locale}/auth?mode=recover&next=/${locale}/business/venue/123`,
          { waitUntil: "networkidle" },
        );
        assert.equal(recovery.status(), 200);
        assert.equal(
          await page.locator('input[name="next"]').inputValue(),
          `/${locale}/business/venue/123`,
        );
        const manifest = await context.request.get(
          `${base}/manifest.webmanifest`,
        );
        assert.equal((await manifest.json()).name, managementName);
        const health = await context.request.get(`${base}/api/health`);
        assert.equal((await health.json()).product, "akibusiness");
        const blocked = await context.request.post(
          `${base}/api/stripe/webhook`,
          { data: {} },
        );
        assert.equal(blocked.status(), 404);
        const external = await context.request.get(
          `${base}/${locale}/account/subscription?from=akibusiness&code=fixture-code&access_token=fixture-token&ACCESS_TOKEN=fixture-token&client_secret=fixture-secret&next=%2Fauth%2Fcallback%3Fcode%3Dfixture-code&context=%7B%22code%22%3A%22fixture-code%22%7D`,
          { maxRedirects: 0 },
        );
        assert.equal(external.status(), 307);
        const target = new URL(external.headers().location);
        assert.equal(target.origin, "https://akipasa.com");
        assert.equal(target.searchParams.get("from"), "akibusiness");
        assert.equal(target.searchParams.has("code"), false);
        assert.equal(target.searchParams.has("access_token"), false);
        assert.equal(target.searchParams.has("ACCESS_TOKEN"), false);
        assert.equal(target.searchParams.has("client_secret"), false);
        assert.equal(target.searchParams.has("next"), false);
        assert.equal(target.searchParams.has("context"), false);
        assert.equal(target.hash, "#redirected");
        const untrusted = await context.request.get(`${base}/api/health`, {
          headers: { host: "attacker.test" },
          maxRedirects: 0,
        });
        assert.equal(untrusted.status(), 421);
        await page.screenshot({
          path: `test-results/business/${locale}-${width}-${theme}.png`,
          fullPage: true,
        });
        await context.close();
        cases++;
      }
  console.log(
    `PASS ${cases} local anonymous EN/ES mobile/desktop light/dark cases. Authenticated/provider acceptance remains pending.`,
  );
} finally {
  await browser.close();
}
