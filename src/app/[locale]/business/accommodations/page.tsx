import { accountTaskFromSearch } from "@/lib/account-task-resume";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isLocale } from "@/lib/config";
import { accommodationPropertyId } from "@/lib/independent-accommodation";
import { IndependentAccommodationManager } from "@/components/IndependentAccommodationManager";
import "./accommodations.css";
export default async function AccommodationManagement({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const property = accommodationPropertyId.safeParse(query.property);
  const { supabase } = await requireUser(
    locale,
    `/${locale}${accountTaskFromSearch("hq", locale, "/business/accommodations", query) || "/business/accommodations"}`,
  );
  const locations =
    process.env.AKISUITE_ORGANISATIONS_READY === "true"
      ? await supabase.rpc("list_managed_operating_locations", {
          p_limit: 100,
          p_offset: 0,
        })
      : { data: [], error: null };
  return (
    <main>
      <Link href={`/${locale}/business`}>
        {locale === "es" ? "Volver a mi gestión" : "Back to management"}
      </Link>
      {process.env.AKISUITE_ACCOMMODATION_READY === "true" ? (
        <IndependentAccommodationManager
          locale={locale}
          locations={(locations.data || []).filter(
            (item: { role: string }) => item.role === "owner",
          )}
          initialProperty={property.success ? property.data : ""}
        />
      ) : (
        <p>
          {locale === "es"
            ? "La gestión independiente de alojamientos aún no está disponible. Tus alojamientos existentes conservan sus herramientas habituales."
            : "Independent accommodation management is not available yet. Existing accommodation retains its usual tools."}
        </p>
      )}
    </main>
  );
}
