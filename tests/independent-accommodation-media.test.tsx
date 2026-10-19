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
  expect((select as HTMLSelectElement).value).toBe("private");
  fireEvent.change(select, { target: { value: "0" } });
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
