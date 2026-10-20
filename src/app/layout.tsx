import { optionalUser } from "@/lib/auth";
import { accountFeaturesAllowed } from "@/lib/account-eligibility";
import { managementProduct } from "@/lib/product-roles";
import "./globals.css";
import "./compact-app.css";
import "./brand.css";
import "./appearance.css";
import "./tablet-responsive.css";
import "./portal-unity.css";
import "./product-brand.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { PwaRegistration } from "@/components/PwaRegistration";
import { ThemeManager } from "@/components/ThemeModeControls";
import { ConsentAnalytics } from "@/components/ConsentAnalytics";
import { PersonalisationConsent } from "@/components/PersonalisationConsent";
export const metadata: Metadata = {
  metadataBase: new URL(managementProduct.origin),
  title: {
    default: managementProduct.name,
    template: `%s · ${managementProduct.name}`,
  },
  description: `Gestiona locales, alojamientos y flotas con ${managementProduct.name}.`,
  applicationName: managementProduct.name,
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  icons: {
    icon:
      managementProduct.logo === "hq"
        ? "/brand/hq-mark.svg"
        : `/brand/${managementProduct.logo}-icon.png`,
    apple:
      managementProduct.logo === "hq"
        ? "/brand/hq-v2-180.png"
        : `/brand/${managementProduct.logo}-icon.png`,
  },
};
export const viewport: Viewport = { themeColor: "#111111" };
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let trackingAllowed = true;
  if (process.env.AKISUITE_ONBOARDING_SCHEMA_READY === "true") {
    try {
      const { supabase, user } = await optionalUser();
      if (user) trackingAllowed = await accountFeaturesAllowed(supabase);
    } catch {
      trackingAllowed = false;
    }
  }

  const locale =
    (await headers()).get("x-akipasa-locale") === "en" ? "en" : "es";
  return (
    <html lang={locale}>
      <body data-product="akibusiness">
        <PwaRegistration />
        <ThemeManager />
        {children}
        <ConsentAnalytics trackingAllowed={trackingAllowed} />
        <PersonalisationConsent locale={locale} />
      </body>
    </html>
  );
}
