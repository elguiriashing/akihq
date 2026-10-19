import Link from "next/link";
export function AkiCochesFleetWorkspace({
  locale,
}: {
  locale: "en" | "es";
  [key: string]: unknown;
}) {
  return (
    <section className="panel">
      <h2>AkiCoches</h2>
      <p>
        {locale === "es"
          ? "Las sucursales de alquiler tienen su propio perfil, ubicación y biblioteca de fotos."
          : "Rental branches have their own profile, location and photo library."}
      </p>
      <Link className="button" href={`/${locale}/business/mobility`}>
        {locale === "es" ? "Abrir mis sucursales" : "Open my branches"} ↗
      </Link>
    </section>
  );
}
