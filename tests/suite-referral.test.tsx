// @vitest-environment jsdom
import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useSuiteReferral } from "../src/components/useSuiteReferral";
vi.stubGlobal("React", React);
function Probe() {
  return <output data-testid="ref">{useSuiteReferral() || "none"}</output>;
}
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});
it("carries only a single validated public referral code", () => {
  window.history.replaceState(
    {},
    "",
    "/?ref=ALEX1234&access_token=never-forward",
  );
  render(<Probe />);
  expect(screen.getByTestId("ref").textContent).toBe("ALEX1234");
});
for (const query of [
  "?ref=person%40example.com",
  "?ref=ALEX1234&ref=OTHER123",
  "?ref=ALEX1234%26next%3Devil",
]) {
  it(`ignores malformed or duplicate invitations ${query}`, () => {
    window.history.replaceState({}, "", `/${query}`);
    render(<Probe />);
    expect(screen.getByTestId("ref").textContent).toBe("none");
  });
}

it("refreshes the invitation after same-layout push and replace navigation", () => {
  window.history.replaceState({}, "", "/?ref=FIRST123");
  render(<Probe />);
  expect(screen.getByTestId("ref").textContent).toBe("FIRST123");
  act(() => window.history.pushState({}, "", "/?ref=SECOND12"));
  expect(screen.getByTestId("ref").textContent).toBe("SECOND12");
  act(() => window.history.replaceState({}, "", "/?ref=THIRD123"));
  expect(screen.getByTestId("ref").textContent).toBe("THIRD123");
  act(() => window.history.pushState({}, "", "/?ref=THIRD123&ref=OTHER123"));
  expect(screen.getByTestId("ref").textContent).toBe("none");
});
it("revalidates browser history and restores the original History methods on unmount", () => {
  const push = window.history.pushState;
  const replace = window.history.replaceState;
  window.history.replaceState({}, "", "/?ref=FIRST123");
  const view = render(<Probe />);
  act(() => {
    replace.call(window.history, {}, "", "/?ref=HISTORY1");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByTestId("ref").textContent).toBe("HISTORY1");
  view.unmount();
  expect(window.history.pushState).toBe(push);
  expect(window.history.replaceState).toBe(replace);
});
