"use client";

import { managementProduct } from "../lib/product-roles";
import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    const productionHost =
      window.location.hostname === new URL(managementProduct.origin).hostname ||
      window.location.hostname ===
        `www.${new URL(managementProduct.origin).hostname}` ||
      window.location.hostname === "business.akipasa.com" ||
      window.location.hostname === "akiduermo.akipasa.com" ||
      window.location.hostname === "akiconduzco.akipasa.com";
    if ("serviceWorker" in navigator && productionHost)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
