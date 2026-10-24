// @vitest-environment node
import { beforeEach, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  email: vi.fn(),
  reset: vi.fn(),
  guard: vi.fn(),
  billing: vi.fn(),
  result: {
    data: { id: "verified-owner" },
    error: null as { code: string } | null,
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "local-product.test" }),
}));
vi.mock("@/lib/public-request-origin", () => ({
  publicRequestOrigin: () => "https://local-product.test",
}));
vi.mock("@/lib/shared-membership", () => ({
  sharedAccountBilling: (...args: unknown[]) => f.billing(...args),
}));
vi.mock("@/lib/auth", () => ({
  requireUser: async (...args: unknown[]) => {
    f.guard(...args);
    const q = {
      update: (value: unknown) => {
        f.update(value);
        return q;
      },
      eq: (key: string, value: string) => {
        f.eq(key, value);
        return q;
      },
      select: () => q,
      maybeSingle: async () => f.result,
    };
    return {
      user: { id: "verified-owner", email: "old@example.test" },
      supabase: {
        from: () => q,
        auth: {
          updateUser: (...values: unknown[]) => f.email(...values),
          resetPasswordForEmail: (...values: unknown[]) => f.reset(...values),
        },
        storage: {
          from: () => ({
            upload: (...values: unknown[]) => f.upload(...values),
            remove: (...values: unknown[]) => f.remove(...values),
            getPublicUrl: () => ({
              data: { publicUrl: "https://storage.example.test/own-photo" },
            }),
          }),
        },
      },
    };
  },
}));
import {
  saveSharedProfile,
  changeSharedEmail,
  resetSharedPassword,
  openSharedBillingPortal,
  uploadSharedProfileMedia,
} from "../src/lib/shared-account-actions";
beforeEach(() => {
  vi.clearAllMocks();
  f.result = { data: { id: "verified-owner" }, error: null };
  f.upload.mockResolvedValue({ error: null });
  f.remove.mockResolvedValue({ error: null });
  f.email.mockResolvedValue({ error: null });
  f.reset.mockResolvedValue({ error: null });
  f.billing.mockResolvedValue({ url: "https://billing.stripe.com/p/session" });
});
function form(extra: Record<string, string> = {}) {
  const values = {
    locale: "en",
    displayName: "Shared member",
    username: "shared_member",
    bio: "Hi",
    phone: "123",
    locality: "Fuengirola",
    province: "Málaga",
    preferredLocale: "en",
    profileVisibility: "private",
    contactVisibility: "members",
    ...extra,
  };
  const result = new FormData();
  for (const [k, v] of Object.entries(values)) result.set(k, v);
  return result;
}
it("saves only validated columns against the verified caller in one update", async () => {
  await expect(
    saveSharedProfile(form({ id: "foreign", app_role: "administrator" })),
  ).rejects.toThrow(/updated=1/);
  expect(f.eq).toHaveBeenCalledWith("id", "verified-owner");
  expect(f.update).toHaveBeenCalledOnce();
  expect(f.update.mock.calls[0][0]).not.toHaveProperty("app_role");
  expect(f.update.mock.calls[0][0]).not.toHaveProperty("id");
});
it("rejects invalid data before any update", async () => {
  await expect(
    saveSharedProfile(form({ username: "../invalid" })),
  ).rejects.toThrow(/error=validation/);
  expect(f.update).not.toHaveBeenCalled();
});
it("does not claim success after an unavailable update", async () => {
  f.result.error = { code: "unavailable" };
  await expect(saveSharedProfile(form())).rejects.toThrow(/error=profile/);
});
it("uses the current product callback for shared email confirmation", async () => {
  await expect(
    changeSharedEmail(form({ email: "NEW@EXAMPLE.TEST", locale: "es" })),
  ).rejects.toThrow(/email=pending/);
  expect(f.email.mock.calls[0][0]).toEqual({ email: "new@example.test" });
  const callback = new URL(f.email.mock.calls[0][1].emailRedirectTo);
  expect(callback.origin).toBe("https://local-product.test");
  expect(callback.pathname).toBe("/es/auth/callback");
  expect(callback.searchParams.get("next")).not.toContain("https://");
});
it("retains the local settings task through password recovery", async () => {
  await expect(resetSharedPassword(form())).rejects.toThrow(/password=sent/);
  const callback = new URL(f.reset.mock.calls[0][1].redirectTo);
  expect(callback.origin).toBe("https://local-product.test");
  expect(callback.searchParams.get("next")).toContain("/en/auth/recover?next=");
});
it("opens only Stripe management sessions after authenticating", async () => {
  await expect(openSharedBillingPortal(form())).rejects.toThrow(
    "REDIRECT:https://billing.stripe.com/p/session",
  );
  expect(f.guard).toHaveBeenCalled();
  f.billing.mockResolvedValue({ url: "https://evil.test" });
  await expect(openSharedBillingPortal(form())).rejects.toThrow(
    /error=billing/,
  );
});
it("uploads photos only inside the verified identity folder", async () => {
  const data = form({ kind: "avatar", id: "foreign" });
  data.set(
    "file",
    new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" }),
  );
  await expect(uploadSharedProfileMedia(data)).rejects.toThrow(/updated=media/);
  expect(f.upload.mock.calls[0][0]).toMatch(
    /^verified-owner\/avatar-[0-9a-f-]+\.png$/,
  );
  expect(f.eq).toHaveBeenCalledWith("id", "verified-owner");
});
it("rejects unsupported photos and removes an upload if profile save fails", async () => {
  const data = form({ kind: "avatar" });
  data.set("file", new File(["bad"], "bad.svg", { type: "image/svg+xml" }));
  await expect(uploadSharedProfileMedia(data)).rejects.toThrow(/error=media/);
  expect(f.upload).not.toHaveBeenCalled();
  data.set("file", new File(["fixture"], "photo.png", { type: "image/png" }));
  f.result.error = { code: "unavailable" };
  await expect(uploadSharedProfileMedia(data)).rejects.toThrow(/error=media/);
  expect(f.remove).toHaveBeenCalledOnce();
});
