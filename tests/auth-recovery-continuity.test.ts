import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  host: "akibusiness.com",
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: mocks.host }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error("redirect"), { path });
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: mocks }),
}));

import { updateRecoveredPassword } from "../src/app/[locale]/auth/recover/actions";
import { signOut } from "../src/app/[locale]/auth/actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.host = "akibusiness.com";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

function recoveryForm(next: string, password = "SecureAccount42") {
  const form = new FormData();
  form.set("locale", "en");
  form.set("next", next);
  form.set("password", password);
  form.set("confirmPassword", password);
  return form;
}

async function destination(form: FormData) {
  try {
    await updateRecoveredPassword(form);
    throw new Error("Expected redirect");
  } catch (error) {
    const path = (error as { path?: string }).path;
    if (!path) throw error;
    return new URL(path, "https://akibusiness.com");
  }
}

it("returns a completed password reset to sign-in with the original task", async () => {
  const next = "/en/business/venue/123?section=bookings";
  const result = await destination(recoveryForm(next));

  expect(result.pathname).toBe("/en/auth");
  expect(result.searchParams.get("reset")).toBe("1");
  expect(result.searchParams.get("next")).toBe(next);
  expect(mocks.updateUser).toHaveBeenCalledWith({
    password: "SecureAccount42",
  });
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  expect(result.href).not.toContain("SecureAccount42");
});

it("preserves an business booking task after a provider save failure", async () => {
  mocks.host = "akibusiness.com";
  mocks.updateUser.mockResolvedValue({ error: { message: "inert" } });
  const result = await destination(
    recoveryForm("/en/business/venue/123?section=bookings"),
  );

  expect(result.pathname).toBe("/en/auth/recover");
  expect(result.searchParams.get("error")).toBe("save");
  expect(result.searchParams.get("next")).toBe(
    "/en/business/venue/123?section=bookings",
  );
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it.each([
  ["en", "/en"],
  ["es", "/es"],
  ["invalid", "/es"],
])(
  "signs out only the current Business session for %s",
  async (locale, path) => {
    const form = new FormData();
    form.set("locale", locale);
    await expect(signOut(form)).rejects.toMatchObject({ path });
    expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  },
);

it("rejects a tampered recovery destination and never serializes passwords", async () => {
  const result = await destination(
    recoveryForm("https://evil.example/steal", "weak"),
  );

  expect(result.pathname).toBe("/en/auth/recover");
  expect(result.searchParams.get("error")).toBe("password-policy");
  expect(result.searchParams.get("next")).toBe("/en/business");
  expect(result.href).not.toContain("weak");
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
