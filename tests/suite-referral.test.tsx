// @vitest-environment jsdom
import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
