"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let restoreHistory: (() => void) | undefined;

function currentCode(): string | undefined {
  const codes = new URLSearchParams(window.location.search).getAll("ref");
  return codes.length === 1 && /^[A-Z0-9]{8,24}$/.test(codes[0])
    ? codes[0]
    : undefined;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!restoreHistory) {
    const history = window.history;
    const push = history.pushState;
    const replace = history.replaceState;
    const notify = () => listeners.forEach((callback) => callback());
    // Next's client router and ordinary History API navigation both retain the
    // locale layout. Observe successful URL changes without adding redirect state
    // or requiring a useSearchParams/Suspense boundary around the entire shell.
    const pushState: History["pushState"] = function (...args) {
      push.apply(history, args);
      notify();
    };
    const replaceState: History["replaceState"] = function (...args) {
      replace.apply(history, args);
      notify();
    };
    history.pushState = pushState;
    history.replaceState = replaceState;
    window.addEventListener("popstate", notify);
    restoreHistory = () => {
      window.removeEventListener("popstate", notify);
      // Preserve any newer wrapper installed by the router or another module.
      if (history.pushState === pushState) history.pushState = push;
      if (history.replaceState === replaceState) history.replaceState = replace;
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      restoreHistory?.();
      restoreHistory = undefined;
    }
  };
}

/** Revalidate the current public invitation after SPA navigation and history. */
export function useSuiteReferral() {
  return useSyncExternalStore(subscribe, currentCode, () => undefined);
}
