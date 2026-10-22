import type { Metadata } from "next";
import AuthPage from "../[locale]/auth/page";

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
  const locale = query.lang === "es" || query.locale === "es" ? "es" : "en";
  return <AuthPage params={Promise.resolve({ locale })} searchParams={Promise.resolve(query)} />;
}
