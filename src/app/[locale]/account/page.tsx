import { notFound } from "next/navigation";
import { isLocale } from "@/lib/config";
import { SharedAccount } from "@/components/SharedAccount";
export const metadata = {
  title: "Your account · AkiHQ",
  robots: { index: false, follow: false },
};
export default async function Account({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main>
      <SharedAccount
        locale={locale}
        product="AkiHQ"
        home={`/${locale}/business`}
        membership={`/${locale}/membership`}
        path={`/${locale}/account`}
        query={await searchParams}
      />
    </main>
  );
}
