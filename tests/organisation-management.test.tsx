// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
const org = "11111111-1111-4111-8111-111111111111",
  request = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_AKISUITE_ROLE_SWAP", "true");
  vi.stubEnv("AKISUITE_ORGANISATIONS_READY", "true");
  mocks.requireUser.mockResolvedValue({ supabase: { rpc: mocks.rpc } });
  mocks.redirect.mockImplementation((url) => {
    throw new Error(url);
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
it("creates using explicit idempotency identity, without inferred owner or location", async () => {
  const { createOperatingOrganisation } = await import(
    "../src/app/[locale]/business/locations/organisation-actions"
  );
  mocks.rpc.mockResolvedValue({ data: org, error: null });
  await expect(
    createOperatingOrganisation(
      form({ locale: "en", requestId: request, name: "  Company  " }),
    ),
  ).rejects.toThrow(`organisation=${org}`);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    "create_operating_organisation",
    { p_request_id: request, p_name: "Company" },
  );
});
it("keeps name/request identity on conflicts and makes no second RPC", async () => {
  const { createOperatingOrganisation } = await import(
    "../src/app/[locale]/business/locations/organisation-actions"
  );
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "PT409" } });
  await expect(
    createOperatingOrganisation(
      form({ locale: "es", requestId: request, name: "Company" }),
    ),
  ).rejects.toThrow(
    `companyRequestId=${request}&companyName=Company&companyError=conflict`,
  );
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it("attaches only the explicitly selected canonical location through the permission RPC", async () => {
  const { attachOperatingLocation } = await import(
    "../src/app/[locale]/business/locations/organisation-actions"
  );
  mocks.rpc.mockResolvedValue({ data: "private-one", error: null });
  await expect(
    attachOperatingLocation(
      form({ locale: "en", organisation: org, workspace: "private-one" }),
    ),
  ).rejects.toThrow(`organisation=${org}`);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    "attach_operating_location",
    { p_organisation: org, p_workspace: "private-one" },
  );
});
it("closed readiness blocks all company writes", async () => {
  vi.stubEnv("AKISUITE_ORGANISATIONS_READY", "false");
  const { attachOperatingLocation } = await import(
    "../src/app/[locale]/business/locations/organisation-actions"
  );
  await expect(
    attachOperatingLocation(
      form({ locale: "en", organisation: org, workspace: "private-one" }),
    ),
  ).rejects.toThrow("companyError=unavailable");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each(["en", "es"] as const)(
  "does not turn company metadata into location operations permission in %s",
  async (locale) => {
    const { OrganisationManagement } = await import(
      "../src/components/OrganisationManagement"
    );
    render(
      <OrganisationManagement
        locale={locale}
        companies={[{ id: org, name: "Company", role: "owner" }]}
        locations={[
          { id: "private-one", name: "Own place", role: "owner" },
          { id: "other-place", name: "Metadata only", role: null },
        ]}
        ownLocations={[
          { id: "private-one", name: "Own place", role: "owner" },
          { id: "staff-place", name: "Staff place", role: "staff" },
        ]}
        error={false}
        query={{ organisation: org }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Own place" }).getAttribute("href"),
    ).toBe("https://akibusiness.com/?workspace=private-one");
    expect(screen.queryByRole("link", { name: /Metadata only/ })).toBeNull();
    expect(screen.queryByRole("option", { name: "Staff place" })).toBeNull();
    expect(screen.getByRole("option", { name: "Own place" })).toBeTruthy();
  },
);

it("uses explicit rental branch and location identifiers without venue mutation", async () => {
  const { attachRentalLocation } = await import(
    "../src/app/[locale]/business/locations/organisation-actions"
  );
  mocks.rpc.mockResolvedValue({ data: "private-one", error: null });
  await expect(
    attachRentalLocation(
      form({ locale: "es", company: org, workspace: "private-one" }),
    ),
  ).rejects.toThrow("/es/business/locations");
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    "attach_rental_operating_location",
    { p_company: org, p_workspace: "private-one" },
  );
});
