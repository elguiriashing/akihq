"use client";

import Link from "next/link";
import React from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function LanguageLink({
  locale,
  compact = false,
}: {
  locale: "es" | "en";
  compact?: boolean;
}) {
  const pathname = usePathname();
  const search = new URLSearchParams(useSearchParams().toString());
  const target = pathname.replace(/^\/(es|en)(?=\/|$)/, `/${locale}`);
  const destinations = search.getAll("next");
  const requested = destinations[0];
  if (
    destinations.length === 1 &&
    /^\/(es|en)(?=\/|$|[?#])/.test(requested) &&
    !/[\\\u0000-\u0020\u007f]/.test(requested) &&
    !/%(?![0-9a-f]{2})/i.test(requested)
  ) {
    const destination = new URL(requested, "https://locale-switch.invalid");
    if (/^\/(es|en)(?=\/|$)/.test(destination.pathname)) {
      search.set("next", requested.replace(/^\/(es|en)/, `/${locale}`));
    }
  }
  const query = search.toString();
  return (
    <Link
      className={["language", compact ? "language--compact" : ""]
        .filter(Boolean)
        .join(" ")}
      href={`${target}${query ? `?${query}` : ""}`}
      hrefLang={locale}
      aria-label={locale === "es" ? "Cambiar a español" : "Switch to English"}
    >
      {locale.toUpperCase()}
    </Link>
  );
}
