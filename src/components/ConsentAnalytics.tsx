"use client";
import { useEffect } from "react";
import { readPrivacyChoices } from "../lib/privacy-consent";

// Next inlines this public value at build time; no other product is a fallback.
const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || "";
const canonicalHost = "akihq.app";
const validMeasurementId =
  /^G-[A-Z0-9]{4,32}$/.test(measurementId) && measurementId !== "G-PW8547QDGD";

type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  __akGa4ConsentInitialized?: boolean;
  __akGa4ConfiguredId?: string;
  [key: `ga-disable-${string}`]: boolean;
};

export function ConsentAnalytics({
  trackingAllowed = true,
}: {
  trackingAllowed?: boolean;
}) {
  useEffect(() => {
    // Preview hosts and missing/mistaken configuration must never collect data.
    if (
      !validMeasurementId ||
      ![canonicalHost, `www.${canonicalHost}`].includes(location.hostname)
    ) {
      return;
    }
    const w = window as unknown as GoogleWindow;
    const deniedConsent = {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    };
    function update() {
      const analytics = trackingAllowed && readPrivacyChoices().analytics;
      w[`ga-disable-${measurementId}`] = !analytics;
      w.dataLayer = w.dataLayer || [];
      w.gtag =
        w.gtag ||
        function () {
          // gtag consumes native Arguments objects, not rest-parameter arrays.
          // eslint-disable-next-line prefer-rest-params
          w.dataLayer!.push(arguments);
        };
      if (!w.__akGa4ConsentInitialized) {
        w.__akGa4ConsentInitialized = true;
        w.gtag("consent", "default", {
          ...deniedConsent,
          wait_for_update: 500,
        });
      }
      w.gtag("consent", "update", {
        ...deniedConsent,
        analytics_storage: analytics ? "granted" : "denied",
      });
      if (analytics && !document.getElementById("ak-consented-ga")) {
        w.gtag("js", new Date());
        const script = document.createElement("script");
        script.id = "ak-consented-ga";
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);
      }
      if (analytics && w.__akGa4ConfiguredId !== measurementId) {
        w.__akGa4ConfiguredId = measurementId;
        w.gtag("config", measurementId, {
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
      }
      if (!analytics) {
        for (const item of document.cookie.split("; ")) {
          const name = item.split("=")[0];
          if (!/^_ga(?:_|$)/.test(name)) continue;
          for (const domain of ["", location.hostname, canonicalHost]) {
            document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
          }
        }
      }
    }
    update();
    window.addEventListener("akipasa:consent-changed", update);
    return () => {
      window.removeEventListener("akipasa:consent-changed", update);
      w[`ga-disable-${measurementId}`] = true;
      w.gtag?.("consent", "update", deniedConsent);
    };
  }, [trackingAllowed]);
  return null;
}
