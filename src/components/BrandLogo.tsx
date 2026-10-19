import React from "react";

/** Shared pin-and-spark mark, matching the September 2026 brand reference. */
export function BrandMark() {
  return (
    <svg
      className="brand-pin"
      viewBox="0 0 64 76"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#F26B1D"
        fillRule="evenodd"
        d="M27 6C13.2 6 2 17.2 2 31c0 17 25 43 25 43s25-26 25-43C52 17.2 40.8 6 27 6Zm0 15a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z"
      />
      <path
        fill="#FFBE2E"
        d="m53 0 3.2 9.8L64 13l-7.8 3.2L53 26l-3.2-9.8L42 13l7.8-3.2Z"
      />
    </svg>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-logo" aria-hidden="true">
      <BrandMark />
      {!compact && (
        <span className="brand-wordmark">
          <span>Aki</span>
          <span className="brand-pasa">Pasa</span>
          <span className="brand-spark">.</span>
        </span>
      )}
    </span>
  );
}
