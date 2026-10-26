// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  WorkspaceSelector,
  type LoginWorkspace,
} from "../src/components/WorkspaceSelector";
const products: LoginWorkspace[] = [
  "pasa",
  "duermo",
  "coches",
  "hq",
  "business",
];
const names = ["AkiPasa", "AkiDuermo", "AkiCoches", "AkiHQ", "AkiBusiness"];
beforeEach(() =>
  window.history.replaceState(
    null,
    "",
    "/en/auth?ref=AKI12345&access_token=must-not-cross",
  ),
);
afterEach(cleanup);
it.each(products)(
  "makes the five icons direct links with %s current",
  (current) => {
    const { container } = render(
      <WorkspaceSelector current={current} locale="en" />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(5);
    const active = screen.getByRole("link", {
      name: names[products.indexOf(current)],
    });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected", "true");
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      container.querySelector(
        ".aks-selector__footer, .aki-workspace-picker__action",
      ),
    ).toBeNull();
  },
);
it.each(["en", "es"] as const)(
  "puts safe localized destinations on every icon in %s",
  (locale) => {
    render(<WorkspaceSelector current="pasa" locale={locale} />);
    for (let i = 0; i < products.length; i++) {
      const card = screen.getByRole("link", { name: names[i] });
      const target = new URL(card.getAttribute("href")!);
      expect(target.host).toBe(
        [
          "akipasa.com",
          "akiduermo.com",
          "akicoches.com",
          "akihq.app",
          "akibusiness.com",
        ][i],
      );
      expect(target.searchParams.get("ref")).toBe("AKI12345");
      expect(target.searchParams.has("access_token")).toBe(false);
      if (i === 0 || i === 3) expect(target.pathname).toBe(`/${locale}/auth`);
      else
        expect(target.searchParams.get(i === 4 ? "locale" : "lang")).toBe(
          locale,
        );
      expect(card).not.toHaveAttribute("role", "radio");
    }
  },
);
it("browses by keyboard without opening an app or changing the login draft", () => {
  render(
    <>
      <input aria-label="Draft email" defaultValue="fixture@example.invalid" />
      <WorkspaceSelector current="pasa" locale="en" />
    </>,
  );
  const initial = screen.getByRole("link", { name: "AkiPasa" });
  initial.focus();
  fireEvent.keyDown(initial, { key: "End" });
  const last = screen.getByRole("link", { name: "AkiBusiness" });
  expect(last).toHaveFocus();
  expect(last).toHaveAttribute("data-selected", "true");
  expect(last).toHaveAttribute(
    "href",
    "https://akibusiness.com/login?locale=en&ref=AKI12345",
  );
  fireEvent.keyDown(last, { key: "Home" });
  expect(initial).toHaveFocus();
  fireEvent.keyDown(initial, { key: "ArrowRight" });
  expect(screen.getByRole("link", { name: "AkiDuermo" })).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "Draft email" })).toHaveValue(
    "fixture@example.invalid",
  );
  expect(window.location.pathname).toBe("/en/auth");
});

it("previews hover energy while preserving the current app, selected card and first-click destination", () => {
  const { container } = render(
    <WorkspaceSelector current="pasa" locale="en" />,
  );
  const current = screen.getByRole("link", { name: "AkiPasa" });
  const preview = screen.getByRole("link", { name: "AkiDuermo" });
  const destination = preview.getAttribute("href");
  const position = preview.getAttribute("style");
  const event = new Event("pointerover", { bubbles: true });
  Object.assign(event, { pointerType: "mouse" });
  fireEvent(preview, event);
  expect(preview).toHaveAttribute("data-energized", "true");
  expect(current).toHaveAttribute("data-selected", "true");
  expect(current).toHaveAttribute("aria-current", "page");
  expect(preview.getAttribute("href")).toBe(destination);
  expect(preview.getAttribute("style")).toBe(position);
  fireEvent.keyDown(current, { key: "End" });
  expect(screen.getByRole("link", { name: "AkiBusiness" })).toHaveAttribute(
    "data-energized",
    "true",
  );
  expect(container.querySelectorAll('[data-energized="true"]')).toHaveLength(1);
});

it("assigns each product its own decorative opening independently from its idle effect", () => {
  const { container } = render(
    <WorkspaceSelector current="coches" locale="en" />,
  );
  products.forEach((product, index) => {
    const card = screen.getByRole("link", { name: names[index] });
    expect(card).toHaveAttribute("data-arrival", product);
    expect(card.querySelector(".aks-selector__arrival")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      card.querySelector(".aks-selector__arrival-actor"),
    ).toBeInTheDocument();
    expect(card.querySelector(".aks-selector__sustain")).toBeInTheDocument();
  });
  expect(container.querySelectorAll("[data-energized=true]")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "AkiCoches" })).toHaveAttribute(
    "data-effect",
    "bloom",
  );
});
