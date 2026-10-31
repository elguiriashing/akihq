import { managementLocale } from "@/lib/management-locale";
import type { Metadata } from "next";
import AuthPage from "../[locale]/auth/page";
import { BusinessHeader } from "@/components/BusinessHeader";
import { signOut } from "../[locale]/auth/actions";

export const metadata: Metadata = {
  title: "Sign in | AkiHQ",
  robots: { index: false, follow: false },
};

/** Public /login entry reuses the exact existing form, auth actions and callback flow. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const locale = managementLocale("/login", query);
  return (
    <>
      <BusinessHeader locale={locale} signedIn={false} signOut={signOut} />
      <AuthPage
        params={Promise.resolve({ locale })}
        searchParams={Promise.resolve(query)}
      />
    </>
  );
}
