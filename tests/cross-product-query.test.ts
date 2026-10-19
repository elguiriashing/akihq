import { describe, expect, it } from "vitest";
import { stripCrossProductCredentials } from "../src/lib/cross-product-query";

const encode = (value: string, rounds: number) => {
  for (let round = 0; round < rounds; round++)
    value = encodeURIComponent(value);
  return value;
};

describe("bounded cross-product query credential removal", () => {
  it.each([
    "/en/auth/callback?code=qa-dummy",
    "/es/oauth/callback?state=qa-dummy",
    "/account#access_token=qa-dummy",
    "/map?provider_token=qa-dummy",
    "https://user:qa-dummy@example.test/return",
    "//user:qa-dummy@example.test/return",
    '{"return":{"access_token":"qa-dummy"}}',
    '[{"provider_refresh_token":"qa-dummy"}]',
    '{"return":"https://user:qa-dummy@example.test/"}',
    '{"\\u0063ode":"qa-dummy"}',
    '{"return":{"\\u0061ccess_token":"qa-dummy"}}',
    '{"return":" https://user:qa-dummy@example.test/map"}',
    '{"return":"/map?code=qa-dummy"}',
    '{"return":{"a":{"b":{"c":{"d":"safe"}}}}}',
    encode("/en/auth/callback?code=qa-dummy", 3),
    encode("/map?CODE=qa-dummy", 4),
    encode("/map?q=safe", 6),
    "%E0%A4%A",
    "%ZZ",
    "stray%",
    "/map?oauth_token_secret=qa-dummy",
    "/map?authorization=qa-dummy",
    "/map?api_key=qa-dummy",
    "/map?token[]=qa-dummy",
    "/map?code[0]=qa-dummy",
    "/map?code+%3Dqa-dummy",
    '"code=qa-dummy"',
    '{"safe":"\\u0063ode=qa-dummy"}',
    '{"safe":[{"ACCESS_TOKEN":"qa-dummy"}]}',
    '{"code":qa-dummy}',
    "Visit https://user:qa-dummy@example.test/map",
    "safe.refresh_token=qa-dummy",
    "safe[access_token]=qa-dummy",
    "returnTo[safe][access_token]=qa-dummy",
    "/map?safe[access_token]=qa-dummy",
    "/map?safe%5Baccess_token%5D=qa-dummy",
    "ftp://user:qa-dummy@example.test/map",
    "/map?token=qa-dummy\u0000",
  ])(
    "removes unsafe nested value %s while retaining ordinary filters",
    (next) => {
      const target = new URL(
        "https://akibusiness.com/en/business?tab=fleet&q=Malaga",
      );
      target.searchParams.set("context", next);
      stripCrossProductCredentials(target);
      expect([...target.searchParams]).toEqual([
        ["tab", "fleet"],
        ["q", "Malaga"],
      ]);
      expect(target.origin).toBe("https://akibusiness.com");
      expect(target.pathname).toBe("/en/business");
    },
  );

  it("removes encoded, wrapped and case-variant keys and all their duplicates", () => {
    const target = new URL("https://akibusiness.com/?q=Malaga");
    for (const key of [
      "API_KEY",
      "%63ode",
      "payload[access_token]",
      "context.token",
      "code[0]",
    ])
      target.searchParams.append(key, "qa-dummy");
    target.searchParams.append("context", "/map?q=Malaga");
    target.searchParams.append("context", "/auth/callback?code=qa-dummy");
    stripCrossProductCredentials(target);
    expect([...target.searchParams]).toEqual([["q", "Malaga"]]);
  });

  it("preserves safe repeated filters, JSON context and harmless auth-like text", () => {
    const target = new URL(
      "https://akibusiness.com/en/business?tab=fleet&q=Malaga&q=Sevilla",
    );
    target.searchParams.set("context", '{"filters":{"q":"Malaga","page":2}}');
    target.searchParams.set("label", "author and postcode");
    const expected = target.href;
    stripCrossProductCredentials(target);
    expect(target.href).toBe(expected);
  });

  it.each([
    "next",
    "NEXT",
    "next[0]",
    "redirect",
    "redirect_to",
    "redirectUri",
    "return-url",
    "returnTo",
    "callback_url",
    "continue",
    "destination",
    "url",
  ])(
    "drops opaque navigation wrapper %s even when its value looks safe",
    (key) => {
      const target = new URL(
        "https://akibusiness.com/?q=Malaga&lang=es&page=2&tab=fleet",
      );
      target.searchParams.set(key, "/map?q=Malaga");
      stripCrossProductCredentials(target);
      expect([...target.searchParams]).toEqual([
        ["q", "Malaga"],
        ["lang", "es"],
        ["page", "2"],
        ["tab", "fleet"],
      ]);
    },
  );

  it("clears an oversized query instead of forwarding partially inspected input", () => {
    for (const query of [
      `q=${"a".repeat(8192)}`,
      Array.from({ length: 65 }, (_, i) => `q${i}=safe`).join("&"),
    ]) {
      const target = new URL(`https://akibusiness.com/en/business?${query}`);
      stripCrossProductCredentials(target);
      expect(target.href).toBe("https://akibusiness.com/en/business");
    }
  });
});
