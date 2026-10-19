"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/config";

export function LocaleDocumentLanguage({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
