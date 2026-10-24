import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";
it("publishes only server schema readers while independent database and library gates remain authoritative", () => {
  const parsed = ts.parseConfigFileTextToJson(
    "wrangler.jsonc",
    readFileSync("wrangler.jsonc", "utf8"),
  );
  expect(parsed.error).toBeUndefined();
  const vars = parsed.config.vars;
  expect(vars.AKISUITE_LISTING_LIMITS_READY).toBe("true");
  expect(vars.AKISUITE_LISTING_UPLOADS_READY).toBe("true");
  expect(vars.AKISUITE_FEATURES_READY).toBe("false");
  expect(vars.AKISUITE_SUBSCRIPTIONS_READY).toBe("false");
  expect(vars.AKISUITE_LISTING_LIBRARY_READY).not.toBe("true");
  expect(vars.NEXT_PUBLIC_AKISUITE_LISTING_UPLOADS_READY).toBeUndefined();
});
