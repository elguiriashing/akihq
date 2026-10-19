// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
import { BusinessTeamRefresh } from "../src/components/BusinessTeamRefresh";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.refresh.mockClear();
});
it("reloads membership on return and while visible, suspends hidden polling and cleans up", () => {
  vi.useFakeTimers();
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible");
  const { unmount } = render(<BusinessTeamRefresh />);
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  act(() => {
    vi.advanceTimersByTime(30000);
  });
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue("hidden");
  act(() => {
    vi.advanceTimersByTime(30000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue("visible");
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.refresh).toHaveBeenCalledTimes(3);
  unmount();
  act(() => {
    vi.advanceTimersByTime(30000);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.refresh).toHaveBeenCalledTimes(3);
});
