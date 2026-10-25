import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import nextConfig from "../next.config";
import { ANDROID_RETURN_SCRIPT } from "../src/lib/android-auth";
const mocks = vi.hoisted(() => ({
  userAgent: "Chrome",
  client: vi.fn(),
  exchange: vi.fn(),
  oauth: vi.fn(),
  cookie: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ host: "akihq.app", "user-agent": mocks.userAgent }),
  cookies: async () => mocks.cookie,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error("redirect"), { path });
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.client,
}));
vi.mock("@/lib/account-eligibility", () => ({
  accountFeaturesAllowed: async () => true,
  accountCompletionUrl: () => "/en/account",
}));
import { GET } from "../src/app/[locale]/auth/callback/route";
import { signInWithGoogle } from "../src/app/[locale]/auth/actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userAgent = "Chrome";
  mocks.exchange.mockResolvedValue({ error: null });
  mocks.oauth.mockResolvedValue({
    data: { url: "https://accounts.google.com/oauth" },
    error: null,
  });
  mocks.client.mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchange,
      signInWithOAuth: mocks.oauth,
    },
  });
});
it("external browser returns only the authorization code before opening a Supabase client", async () => {
  const response = await GET(
    new Request(
      "https://akihq.app/en/auth/callback?android=1&code=one-time&access_token=secret&refresh_token=secret&error_description=%22%3Cscript%3E",
    ),
    { params: Promise.resolve({ locale: "en" }) },
  );
  const html = await response.text();
  expect(html).toContain("akihq://auth/callback?locale=en&amp;code=one-time");
  expect(html).not.toContain("secret");
  expect(html).not.toContain("<script>");
  expect(html).toContain("setTimeout(function(){location.assign(");
  expect(html).toContain("return-seconds");
  expect(html).toContain("brand/v3/hq.svg");
  expect(html).toContain("--accent:#f4c653");
  expect(html).toContain("},5000)");
  expect(response.headers.get("content-security-policy")).toMatch(
    /script-src 'nonce-[a-f0-9]+'/,
  );
  expect(mocks.client).not.toHaveBeenCalled();
  expect(mocks.exchange).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
it.each(["?code=one-time", "?android=1&native=1&code=one-time"])(
  "exchanges code only in the ordinary or native-return callback %s",
  async (query) => {
    const response = await GET(
      new Request(`https://akihq.app/en/auth/callback${query}`),
      { params: Promise.resolve({ locale: "en" }) },
    );
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith("one-time");
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
  },
);
it("the final Next header rule permits exactly the serialized timer and suppresses callback referrers", async () => {
  const rules = await nextConfig.headers!();
  const rule = rules.at(-1)!;
  expect(rule.source).toBe("/:locale(en|es)/auth/callback");
  expect(rule.has).toEqual([{ type: "query", key: "android", value: "1" }]);
  expect(rule.missing).toEqual([{ type: "query", key: "native", value: "1" }]);
  const response = await GET(
    new Request("https://akihq.app/en/auth/callback?android=1&error=synthetic"),
    { params: Promise.resolve({ locale: "en" }) },
  );
  const html = await response.text();
  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
  expect(script).toBe(ANDROID_RETURN_SCRIPT);
  const hash = createHash("sha256").update(script).digest("base64");
  expect(rule.headers).toContainEqual({
    key: "Referrer-Policy",
    value: "no-referrer",
  });
  expect(
    rule.headers.find((header) => header.key === "Content-Security-Policy")
      ?.value,
  ).toContain(`script-src 'sha256-${hash}'`);
});
it.each(["AkiHQAndroid/1.0.0", "Chrome"])(
  "marks the OAuth callback only for the matching app user agent %s",
  async (agent) => {
    mocks.userAgent = agent;
    const form = new FormData();
    form.set("locale", "en");
    form.set("acceptTerms", "accepted");
    form.set("next", "/en/business");
    await expect(signInWithGoogle(form)).rejects.toMatchObject({
      path: "https://accounts.google.com/oauth",
    });
    const callback = new URL(mocks.oauth.mock.calls[0][0].options.redirectTo);
    expect(callback.origin).toBe("https://akihq.app");
    expect(callback.pathname).toBe("/en/auth/callback");
    expect(callback.searchParams.get("android")).toBe(
      agent.startsWith("AkiHQAndroid/") ? "1" : null,
    );
    expect(mocks.cookie.set).toHaveBeenCalled();
  },
);

it("recognises the user agent emitted by the actual Android application", async () => {
  const activity = readFileSync(
    new URL(
      "../Android/app/src/main/java/com/akipasa/akihq/MainActivity.java",
      import.meta.url,
    ),
    "utf8",
  );
  const marker = activity.match(
    /" (Aki[A-Za-z]+Android\/)" \+ BuildConfig.VERSION_NAME/,
  );
  expect(marker?.[1]).toBe("AkiHQAndroid/");
  mocks.userAgent = `Mozilla/5.0 ${marker![1]}1.0.1`;
  const form = new FormData();
  form.set("locale", "en");
  form.set("acceptTerms", "accepted");
  form.set("next", "/en/business");
  await expect(signInWithGoogle(form)).rejects.toMatchObject({
    path: "https://accounts.google.com/oauth",
  });
  const callback = new URL(mocks.oauth.mock.calls[0][0].options.redirectTo);
  expect(callback.searchParams.get("android")).toBe("1");
});
