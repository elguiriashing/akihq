import { managementLocale } from "@/lib/management-locale";
import { optionalUser } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * AkiHQ is an authenticated management service, not a public marketplace.
 * Keep existing /login, /[locale]/business, billing and tenant routes intact.
 */
export const metadata: Metadata = {
  title: "AkiHQ | Business sign in",
  robots: { index: false, follow: false },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; locale?: string }>;
}) {
  const locale = managementLocale("/", await searchParams);
  let signedIn = false;
  try {
    const { user } = await optionalUser();
    signedIn = Boolean(user);
  } catch {
    // Preserve access to the sign-in/recovery page during auth outages.
  }
  redirect(signedIn ? `/${locale}/business` : `/login?lang=${locale}`);
}
