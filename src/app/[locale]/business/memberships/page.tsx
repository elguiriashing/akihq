import { redirect } from "next/navigation";

/** The free HQ hub hosts its own product-specific listing upgrades. */
export default async function SuiteMembershipRedirect({ params }: { params: Promise<{locale: string}> }) {
  const { locale } = await params;
  redirect(`/${locale === "en" ? "en" : "es"}/membership`);
}
