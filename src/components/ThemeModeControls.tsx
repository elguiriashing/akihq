"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "./Icons";

const THEME_KEY = "akipasa.theme";
const THEME_EVENT = "akipasa:theme-change";

type ThemeMode = "light" | "dark";

function systemTheme(): ThemeMode {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function validTheme(value: string | null | undefined): ThemeMode | null {
  if (value === "light" || value === "dark") return value;
  // Both legacy choices were dark palettes. Preserve the user's appearance
  // while migrating the setting away from subscription terminology.
  if (value === "standard" || value === "premium") return "dark";
  return null;
}

function readThemePreference(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return validTheme(window.localStorage.getItem(THEME_KEY)) ?? systemTheme();
}

function hydrateThemeOnLoad(): ThemeMode {
  try {
    return readThemePreference();
  } catch {
    return "dark";
  }
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const body = document.body;
  root.dataset.theme = theme;
  body.dataset.theme = theme;
  root.classList.remove(
    "theme-light",
    "theme-dark",
    "theme-standard",
    "theme-premium",
  );
  root.classList.add(`theme-${theme}`);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#14213D" : "#FAF7F2");
  body.classList.remove(
    "theme-light",
    "theme-dark",
    "theme-standard",
    "theme-premium",
  );
  body.classList.add(`theme-${theme}`);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Appearance still works when browser storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent<ThemeMode>(THEME_EVENT, { detail: theme }),
  );
}

export function ThemeManager() {
  useEffect(() => {
    applyTheme(hydrateThemeOnLoad());

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) {
        applyTheme(validTheme(event.newValue) ?? systemTheme());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}

export function ThemeToggle({ locale }: { locale: "es" | "en" }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    setMode(hydrateThemeOnLoad());
    const handleThemeChange = (event: Event) => {
      setMode((event as CustomEvent<ThemeMode>).detail);
    };
    window.addEventListener(THEME_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_EVENT, handleThemeChange);
  }, []);

  const nextMode: ThemeMode = mode === "dark" ? "light" : "dark";
  const label =
    locale === "es"
      ? `Cambiar a modo ${nextMode === "light" ? "claro" : "oscuro"}`
      : `Switch to ${nextMode} mode`;

  function handleClick() {
    const current = validTheme(document.documentElement.dataset.theme) ?? mode;
    applyTheme(current === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      className="theme-toggle theme-toggle--compact button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      aria-pressed={mode === "dark"}
    >
      <Icon name={nextMode === "light" ? "sun" : "moon"} />
    </button>
  );
}
