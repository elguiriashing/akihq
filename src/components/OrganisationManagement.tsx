import { suiteHref } from "@/lib/suite-navigation";
import Link from "next/link";
import { z } from "zod";
import {
  createOperatingOrganisation,
  attachOperatingLocation,
} from "@/app/[locale]/business/locations/organisation-actions";
type Company = { id: string; name: string; role: string };
type Location = { id: string; name: string; role: string | null };
export function OrganisationManagement({
  locale,
  companies,
  locations,
  ownLocations,
  error,
  query,
}: {
  locale: "en" | "es";
  companies: Company[];
  locations: Location[];
  ownLocations: Location[];
  error: boolean;
  query: Record<string, string | undefined>;
}) {
  const es = locale === "es",
    selected = companies.find((company) => company.id === query.organisation);
  const id = z.string().uuid().safeParse(query.companyRequestId);
  const page = Number(query.companyPage || "0"),
    locationPage = Number(query.companyLocationPage || "0");
  const href = (key: string, value: number) => {
    const search = new URLSearchParams({
      ...(selected ? { organisation: selected.id } : {}),
      companyPage: String(page),
      companyLocationPage: String(locationPage),
    });
    search.set(key, String(value));
    return `/${locale}/business/locations?${search}`;
  };
  return (
    <section>
      <h2>{es ? "Mis empresas" : "My companies"}</h2>
      <p>
        {es
          ? "La empresa agrupa ubicaciones por decisión explícita de sus propietarios. Gestionar una empresa no concede acceso al trabajo diario de cada ubicación."
          : "A company groups locations through explicit owner decisions. Managing a company does not grant access to each location's daily operations."}
      </p>
      {(error || query.companyError) && (
        <p role="alert">
          {es
            ? "No se pudo cargar o guardar la empresa. Comprueba tus permisos y reintenta; ninguna relación se supone por el nombre."
            : "Could not load or save the company. Check permissions and retry; names never imply ownership."}
        </p>
      )}
      <ul>
        {companies.map((company) => (
          <li key={company.id}>
            <Link
              href={`/${locale}/business/locations?organisation=${encodeURIComponent(company.id)}&companyPage=${page}`}
            >
              {company.name}
            </Link>
          </li>
        ))}
      </ul>
      <nav aria-label={es ? "Páginas de empresas" : "Company pages"}>
        {page > 0 && (
          <Link href={href("companyPage", page - 1)}>
            {es ? "Anterior" : "Previous"}
          </Link>
        )}
        {companies.length === 50 && page < 200 && (
          <Link href={href("companyPage", page + 1)}>
            {es ? "Siguiente" : "Next"}
          </Link>
        )}
      </nav>
      <details>
        <summary>
          {es ? "Crear empresa privada" : "Create private company"}
        </summary>
        <form action={createOperatingOrganisation}>
          <fieldset disabled={error}>
            <input type="hidden" name="locale" value={locale} />
            <input
              type="hidden"
              name="requestId"
              value={id.success ? id.data : crypto.randomUUID()}
            />
            <label>
              {es ? "Nombre de la empresa" : "Company name"}
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={query.companyName?.slice(0, 120) || ""}
              />
            </label>
            <button type="submit">
              {es ? "Crear empresa" : "Create company"}
            </button>
          </fieldset>
        </form>
      </details>
      {selected && (
        <section>
          <h3>{selected.name}</h3>
          <ul>
            {locations.map((location) => (
              <li key={location.id}>
                {location.role ? (
                  <a
                    href={suiteHref("business", locale, {
                      workspaceId: location.id,
                    })}
                  >
                    {location.name}
                  </a>
                ) : (
                  <span>
                    {location.name} —{" "}
                    {es
                      ? "Sin permiso operativo en esta ubicación"
                      : "No operational membership for this location"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <nav
            aria-label={
              es
                ? "Páginas de ubicaciones de empresa"
                : "Company location pages"
            }
          >
            {locationPage > 0 && (
              <Link href={href("companyLocationPage", locationPage - 1)}>
                {es ? "Anterior" : "Previous"}
              </Link>
            )}
            {locations.length === 50 && locationPage < 200 && (
              <Link href={href("companyLocationPage", locationPage + 1)}>
                {es ? "Siguiente" : "Next"}
              </Link>
            )}
          </nav>
          {["owner", "admin"].includes(selected.role) && (
            <form action={attachOperatingLocation}>
              <fieldset disabled={error}>
                <legend>
                  {es
                    ? "Vincular una ubicación de la que eres propietario"
                    : "Attach a location you own"}
                </legend>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="organisation" value={selected.id} />
                <label>
                  {es ? "Ubicación existente" : "Existing location"}
                  <select name="workspace" required defaultValue="">
                    <option value="">{es ? "Seleccionar" : "Select"}</option>
                    {ownLocations
                      .filter((location) => location.role === "owner")
                      .map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                  </select>
                </label>
                <p>
                  {es
                    ? "Solo se agrupa esta ubicación. No cambia su propietario, sus miembros ni su suscripción."
                    : "Only this location is grouped. Its owner, members and subscription stay intact."}
                </p>
                <button type="submit">
                  {es
                    ? "Vincular ubicación seleccionada"
                    : "Attach selected location"}
                </button>
              </fieldset>
            </form>
          )}
        </section>
      )}
    </section>
  );
}
