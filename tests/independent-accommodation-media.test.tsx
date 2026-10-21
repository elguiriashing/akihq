// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { IndependentAccommodationMedia } from "../src/components/IndependentAccommodationMedia";
const property = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const request = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", request);
  request.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("places only the selected property's image and retains private status until explicit placement", async () => {
  request.mockImplementation(async (_url, opts) => ({
    ok: true,
    json: async () =>
      opts?.method === "POST"
        ? { ok: true }
        : { media: [{ id, altText: "Room", url: null, position: null }] },
  }));
  render(<IndependentAccommodationMedia property={property} locale="en" />);
  const select = await screen.findByLabelText("Gallery position: Room");
  expect((select as HTMLInputElement).value).toBe("");
  fireEvent.change(select, { target: { value: "1" } });
  fireEvent.submit(select.closest("form")!);
  await waitFor(() =>
    expect(request.mock.calls.some(([, opts]) => opts?.method === "POST")).toBe(
      true,
    ),
  );
  expect(
    JSON.parse(
      request.mock.calls.find(([, opts]) => opts?.method === "POST")![1].body,
    ),
  ).toEqual({ action: "place", property, id, position: 0 });
});
it("blocks upload after a media read failure", async () => {
  request.mockResolvedValue({ ok: false });
  render(<IndependentAccommodationMedia property={property} locale="es" />);
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "Subir" }).closest("fieldset")?.disabled,
  ).toBe(true);
  expect(request.mock.calls.every(([, opts]) => opts?.method !== "POST")).toBe(
    true,
  );
});

it.each(["en", "es"] as const)(
  "shows actual %s property quota and preserves typed work after a concurrent quota rejection",
  async (locale) => {
    request.mockImplementation(async (_url, opts) => ({
      ok: opts?.method !== "POST",
      json: async () =>
        opts?.method === "POST"
          ? { error: "quota" }
          : {
              media: [],
              limits: {
                premium: false,
                photos: 8,
                used: 7,
                max_dimension: 1920,
                uploads_enforced: true,
              },
            },
    }));
    render(
      <IndependentAccommodationMedia property={property} locale={locale} />,
    );
    await screen.findByRole("status");
    const description = await screen.findByLabelText(
      locale === "es" ? "Descripción de la imagen" : "Image description",
    );
    fireEvent.change(description, {
      target: { value: "Preserved room caption" },
    });
    fireEvent.submit(description.closest("form")!);
    await screen.findByText(
      locale === "es"
        ? "Se alcanzó el límite. Tus fotografías existentes se conservan. Premium ofrece hasta 250 fotografías."
        : "The allowance is full. Your existing photos are retained. Premium provides up to 250 photos.",
    );
    expect((description as HTMLInputElement).value).toBe(
      "Preserved room caption",
    );
    expect(
      screen
        .getByRole("link", {
          name:
            locale === "es"
              ? "Consultar Premium para este alojamiento"
              : "View Premium for this accommodation",
        })
        .getAttribute("href"),
    ).toBe(`https://akipasa.com/${locale}/account/subscription?app=akiduermo`);
  },
);
it("disables new uploads when the authoritative property quota is full while retaining existing media", async () => {
  request.mockResolvedValue({
    ok: true,
    json: async () => ({
      media: [{ id, altText: "Retained room", url: null, position: null }],
      limits: {
        premium: false,
        photos: 8,
        used: 11,
        max_dimension: 1920,
        uploads_enforced: true,
      },
    }),
  });
  render(<IndependentAccommodationMedia property={property} locale="en" />);
  await screen.findByLabelText("Gallery position: Retained room");
  expect(
    screen.getByRole("button", { name: "Upload" }).closest("fieldset")
      ?.disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Remove photo" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

it("renders one shared position list for250Premium photos rather than62500 duplicated options", async () => {
  request.mockImplementation(async (_url, opts) => ({
    ok: true,
    json: async () =>
      opts?.method === "POST"
        ? { ok: true }
        : {
            media: Array.from({ length: 250 }, (_, i) => ({
              id: `media-${i}`,
              altText: `Room${i}`,
              url: null,
              position: null,
            })),
            limits: {
              premium: true,
              photos: 250,
              used: 250,
              max_dimension: 3840,
              uploads_enforced: true,
            },
          },
  }));
  const { container } = render(
    <IndependentAccommodationMedia property={property} locale="en" />,
  );
  const position = await screen.findByLabelText("Gallery position: Room249");
  expect(screen.getAllByRole("spinbutton")).toHaveLength(250);
  expect(container.querySelectorAll("datalist")).toHaveLength(1);
  expect(container.querySelectorAll("option")).toHaveLength(250);
  fireEvent.change(position, { target: { value: "250" } });
  fireEvent.submit(position.closest("form")!);
  await waitFor(() =>
    expect(request.mock.calls.some(([, opts]) => opts?.method === "POST")).toBe(
      true,
    ),
  );
  expect(
    JSON.parse(
      request.mock.calls.find(([, opts]) => opts?.method === "POST")![1].body,
    ),
  ).toEqual({ action: "place", property, id: "media-249", position: 249 });
});
