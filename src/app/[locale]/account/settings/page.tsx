import { redirect, notFound } from "next/navigation";
import { isLocale } from "@/lib/config";
export default async function Alias({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/account`);
}
