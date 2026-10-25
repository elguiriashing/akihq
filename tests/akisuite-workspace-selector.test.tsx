// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
  "shows all five choices with %s selected initially",
  (current) => {
    render(<WorkspaceSelector current={current} locale="en" />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(
      screen.getByRole("radio", { name: names[products.indexOf(current)] }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("link")).toBeNull();
  },
);
it.each(["en", "es"] as const)(
  "previews all destinations without altering the login draft in %s",
  (locale) => {
    const action = vi.fn();
    render(
      <>
        <input
          aria-label="Draft email"
          defaultValue="fixture@example.invalid"
        />
        <WorkspaceSelector current="pasa" locale={locale} />
        <button onClick={action}>Existing sign-in action</button>
      </>,
    );
    for (let i = 1; i < products.length; i++) {
      fireEvent.click(screen.getByRole("radio", { name: names[i] }));
      const target = new URL(
        screen
          .getByRole("link", { name: new RegExp(names[i]) })
          .getAttribute("href")!,
      );
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
      if (i === 3) expect(target.pathname).toBe(`/${locale}/auth`);
      else
        expect(target.searchParams.get(i === 4 ? "locale" : "lang")).toBe(
          locale,
        );
      expect(screen.getByRole("textbox", { name: "Draft email" })).toHaveValue(
        "fixture@example.invalid",
      );
      expect(action).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe("/en/auth");
    }
  },
);
it("supports keyboard selection and explicit opening as separate steps", () => {
  render(<WorkspaceSelector current="pasa" locale="en" />);
  const initial = screen.getByRole("radio", { name: "AkiPasa" });
  initial.focus();
  fireEvent.keyDown(initial, { key: "End" });
  expect(screen.getByRole("radio", { name: "AkiBusiness" })).toHaveFocus();
  expect(
    screen.getByRole("link", { name: /Open AkiBusiness/ }),
  ).toHaveAttribute(
    "href",
    "https://akibusiness.com/login?locale=en&ref=AKI12345",
  );
  fireEvent.keyDown(screen.getByRole("radio", { name: "AkiBusiness" }), {
    key: "Home",
  });
  expect(initial).toHaveFocus();
  expect(screen.queryByRole("link")).toBeNull();
});
