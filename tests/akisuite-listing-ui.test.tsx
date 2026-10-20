// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
const create = vi.hoisted(() => vi.fn());
vi.mock("../src/app/[locale]/business/actions", () => ({
  createEvent: create,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../src/components/GuardedActionForm", () => ({
  GuardedActionForm: ({
    action,
    children,
  }: {
    action: (fd: FormData) => Promise<void>;
    children: React.ReactNode;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void action(new FormData(event.currentTarget));
      }}
    >
      {children}
    </form>
  ),
}));
import { BusinessEventComposer } from "../src/components/BusinessEventComposer";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it.each(["en", "es"] as const)(
  "retains controlled event draft after quota rejection in %s",
  async (locale) => {
    create.mockResolvedValue({ ok: false, error: "listing-limit" });
    const { container } = render(
      <BusinessEventComposer
        locale={locale}
        venues={[{ id: "venue", name: "Venue" }]}
        categories={[{ id: "category", label: "Music" }]}
        media={[]}
      />,
    );
    for (const [name, value] of Object.entries({
      title: "Live music",
      description: "A legitimate live music show",
      startsAt: "2030-01-01T20:00",
      endsAt: "2030-01-01T23:00",
    }))
      fireEvent.change(container.querySelector(`[name=${name}]`)!, {
        target: { value },
      });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        locale === "en" ? /Your draft is still here/ : /Tu borrador sigue aquí/,
      ),
    );
    expect(
      (container.querySelector("[name=title]") as HTMLInputElement).value,
    ).toBe("Live music");
    expect(
      (container.querySelector("[name=description]") as HTMLInputElement).value,
    ).toBe("A legitimate live music show");
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      `https://akipasa.com/${locale}/account/subscription?app=akibusiness`,
    );
    expect(create.mock.calls[0][0].get("inline")).toBe("1");
  },
);

it("keeps draft after a network/provider failure", async () => {
  create.mockRejectedValue(new Error("offline"));
  const { container } = render(
    <BusinessEventComposer
      locale="en"
      venues={[{ id: "venue", name: "Venue" }]}
      categories={[{ id: "category", label: "Music" }]}
      media={[]}
    />,
  );
  fireEvent.change(container.querySelector("[name=title]")!, {
    target: { value: "Original draft" },
  });
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Your draft is still here",
    ),
  );
  expect(
    (container.querySelector("[name=title]") as HTMLInputElement).value,
  ).toBe("Original draft");
});
