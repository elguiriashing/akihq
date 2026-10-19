import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
const requestId = "7a7161ef-e18d-4715-8d5f-f40d8cfa4580";
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_AKISUITE_ROLE_SWAP", "true");
  vi.stubEnv("AKISUITE_PRIVATE_LOCATIONS_READY", "true");
  mocks.user.mockResolvedValue({
    supabase: { rpc: mocks.rpc },
    user: { id: "owner" },
  });
  mocks.redirect.mockImplementation((url) => {
    throw new Error(url);
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
const form = (locale: string) => {
  const f = new FormData();
  f.set("locale", locale);
  f.set("requestId", requestId);
  f.set("name", "  Private office  ");
  return f;
};
describe("explicit private operating location creation", () => {
  it.each(["en", "es"])(
    "uses authenticated idempotent RPC only in %s",
    async (locale) => {
      const { createPrivateLocation } = await import(
        "../src/app/[locale]/business/locations/actions"
      );
      mocks.rpc.mockResolvedValue({ data: "private-location", error: null });
      await expect(createPrivateLocation(form(locale))).rejects.toThrow(
        `/${locale}/business/locations?created=private-location`,
      );
      expect(mocks.user).toHaveBeenCalledWith(
        locale,
        `/${locale}/business/locations`,
      );
      expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
        "create_private_operating_location",
        { p_request_id: requestId, p_name: "Private office" },
      );
    },
  );
  it("preserves request ID and trimmed name on ambiguous unavailable response", async () => {
    const { createPrivateLocation } = await import(
      "../src/app/[locale]/business/locations/actions"
    );
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(createPrivateLocation(form("en"))).rejects.toThrow(
      `requestId=${requestId}&name=Private+office&error=unavailable`,
    );
  });
  it.each(["role", "readiness"])(
    "refuses writes with %s closed",
    async (gate) => {
      vi.stubEnv(
        gate === "role"
          ? "NEXT_PUBLIC_AKISUITE_ROLE_SWAP"
          : "AKISUITE_PRIVATE_LOCATIONS_READY",
        "false",
      );
      const { createPrivateLocation } = await import(
        "../src/app/[locale]/business/locations/actions"
      );
      await expect(createPrivateLocation(form("es"))).rejects.toThrow(
        "error=unavailable",
      );
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("does not turn a name conflict into another create request", async () => {
    const { createPrivateLocation } = await import(
      "../src/app/[locale]/business/locations/actions"
    );
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409" } });
    await expect(createPrivateLocation(form("en"))).rejects.toThrow(
      `requestId=${requestId}&name=Private+office&error=conflict`,
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("requires identity and validates explicit request identity", async () => {
    const { createPrivateLocation } = await import(
      "../src/app/[locale]/business/locations/actions"
    );
    mocks.user.mockRejectedValue(new Error("auth-required"));
    await expect(createPrivateLocation(form("en"))).rejects.toThrow(
      "auth-required",
    );
    const invalid = form("en");
    invalid.set("requestId", "invalid");
    await expect(createPrivateLocation(invalid)).rejects.toThrow(
      "error=validation",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
