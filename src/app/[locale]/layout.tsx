import { notFound } from "next/navigation";
import { isLocale } from "@/lib/config";
import { optionalUser } from "@/lib/auth";
import { BusinessHeader } from "@/components/BusinessHeader";
import { LocaleDocumentLanguage } from "@/components/LocaleDocumentLanguage";
import { SupportAgentLauncher } from "@/components/support/SupportAgentLauncher";
import { signOut } from "@/app/[locale]/auth/actions";
import { queueSuitePortalWelcome } from "@/lib/suite-welcome";
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { user } = await optionalUser();
  if (user) await queueSuitePortalWelcome("akibusiness", locale);
  return (
    <>
      <LocaleDocumentLanguage locale={locale} />
      <div className="akibusiness-host">
        <BusinessHeader
          locale={locale}
          signedIn={Boolean(user)}
          signOut={signOut}
        />
        <div className="akibusiness-content">{children}</div>
        <SupportAgentLauncher
          locale={locale}
          surface="site_contact"
          label={locale === "es" ? "Soporte" : "Support"}
          className="global-support-trigger"
          signedIn={Boolean(user)}
        />
      </div>
    </>
  );
}
