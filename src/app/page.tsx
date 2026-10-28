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
  try {
    const { user } = await optionalUser();
    if (user) redirect(`/${locale}/business`);
  } catch (error) {
    // Next.js redirect uses a thrown navigation signal: never swallow it.
    if (error && typeof error === "object" && "digest" in error &&
        String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    // If the auth service is unavailable, the dedicated login still provides
    // recovery/help without publishing the retired sales homepage.
  }
  redirect(`/login?lang=${locale}`);
}
