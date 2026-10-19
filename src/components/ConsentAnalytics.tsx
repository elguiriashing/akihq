"use client";
import { useEffect } from "react";
import { readPrivacyChoices } from "../lib/privacy-consent";
const measurementId = "G-PW8547QDGD";
const adsId = "AW-18500420718";
type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean;
};
export function ConsentAnalytics() {
  useEffect(() => {
    const w = window as unknown as GoogleWindow;
    // Share one gtag.js loader for GA4 and Ads, respecting the visitor's choices.
    let loaded = Boolean(document.getElementById("ak-consented-ga"));
    let analyticsConfigured = false;
    let adsConfigured = false;
    function update() {
      const choices = readPrivacyChoices();
      const analytics = choices.analytics;
      const marketing = choices.marketing;
      // The consumer advertising campaign must not tag AkiBusiness or AkiDuermo.
      const adsAllowed =
        marketing &&
        (location.hostname === "akipasa.com" ||
          location.hostname === "www.akipasa.com");
      w[`ga-disable-${measurementId}`] = !analytics;
      w[`ga-disable-${adsId}`] = !adsAllowed;

      w.dataLayer = w.dataLayer || [];
      w.gtag =
        w.gtag ||
        function (...args: unknown[]) {
          w.dataLayer!.push(args);
        };

      // Consent must be set before configuring either destination.
      if (!loaded) {
        w.gtag("consent", "default", {
          analytics_storage: "denied",
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          wait_for_update: 500,
        });
      }
      w.gtag("consent", "update", {
        analytics_storage: analytics ? "granted" : "denied",
        ad_storage: adsAllowed ? "granted" : "denied",
        ad_user_data: adsAllowed ? "granted" : "denied",
        ad_personalization: adsAllowed ? "granted" : "denied",
      });

      if (!loaded && (analytics || adsAllowed)) {
        loaded = true;
        w.gtag("js", new Date());
        const script = document.createElement("script");
        script.id = "ak-consented-ga";
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);
      }
      if (analytics && !analyticsConfigured) {
        analyticsConfigured = true;
        w.gtag("config", measurementId, {
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
      }
      if (!adsConfigured && adsAllowed) {
        adsConfigured = true;
        w.gtag("config", adsId);
      }
      if (!analytics) {
        for (const item of document.cookie.split("; ")) {
          const name = item.split("=")[0];
          if (!/^_ga(?:_|$)/.test(name)) continue;
          const domains = ["", location.hostname, "akipasa.com"];
          for (const domain of domains)
            document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
        }
      }
    }
    update();
    window.addEventListener("akipasa:consent-changed", update);
    return () => window.removeEventListener("akipasa:consent-changed", update);
  }, []);
  return null;
}
