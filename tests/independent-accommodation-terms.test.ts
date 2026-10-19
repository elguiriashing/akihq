import { expect, it, vi } from "vitest";
import { config } from "../src/lib/config";
import { accommodationApiTerms } from "../src/lib/accommodation-api-terms";

it("checks the caller's persisted current terms and fails closed on missing or unavailable profiles", async () => {
  for (const [data, error, expected] of [
    [{ terms_version: config.currentTermsVersion }, null, null],
    [{ terms_version: "old" }, null, "terms_required"],
    [null, null, "terms_required"],
    [null, { message: "unavailable" }, "unavailable"],
  ] as const) {
    const q = {
      select: vi.fn(() => q),
      eq: vi.fn(() => q),
      maybeSingle: vi.fn(async () => ({ data, error })),
    };
    const from = vi.fn(() => q);
    expect(
      await accommodationApiTerms(
        { from } as unknown as Parameters<typeof accommodationApiTerms>[0],
        "caller-id",
      ),
    ).toBe(expected);
    expect(from).toHaveBeenCalledWith("profiles");
    expect(q.eq).toHaveBeenCalledWith("id", "caller-id");
  }
});
