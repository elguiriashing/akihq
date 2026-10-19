import { redirect } from "next/navigation";

/** All suite portals resolve to the same membership catalogue. */
export default async function SuiteMembershipRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale === "en" ? "en" : "es"}/membership?from=akibusiness`);
}
