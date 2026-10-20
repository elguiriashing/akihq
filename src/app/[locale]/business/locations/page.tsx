import { suiteHref } from "@/lib/suite-navigation";
import "../accommodations/accommodations.css";
import { OrganisationManagement } from "@/components/OrganisationManagement";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/config";
import { requireUser } from "@/lib/auth";
import { roleSwapEnabled } from "@/lib/product-roles";
import { attachRentalLocation } from "./organisation-actions";
import { createPrivateLocation } from "./actions";
export default async function PrivateLocations({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const requestedCompany = z.string().uuid().safeParse(query.organisation);
  const { supabase, user } = await requireUser(
    locale,
    `/${locale}/business/locations${requestedCompany.success ? "?organisation=" + requestedCompany.data : ""}`,
  );
  const es = locale === "es";
  const ready =
    roleSwapEnabled && process.env.AKISUITE_PRIVATE_LOCATIONS_READY === "true";
  const parsedPage = Number(query.page || "0");
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 0
      ? Math.min(parsedPage, 200)
      : 0;
  const { data: memberships, error } = await supabase.rpc(
    "list_managed_operating_locations",
    { p_limit: 50, p_offset: page * 50 },
  );
  const companyReady =
    roleSwapEnabled && process.env.AKISUITE_ORGANISATIONS_READY === "true";
  const boundedPage = (value: string | undefined) => {
    const n = Number(value || "0");
    return Number.isInteger(n) && n >= 0 ? Math.min(n, 200) : 0;
  };
  const companyPage = boundedPage(query.companyPage),
    companyLocationPage = boundedPage(query.companyLocationPage);
  const organisation = z.string().uuid().safeParse(query.organisation);
  const companies = companyReady
    ? await supabase.rpc("list_operating_organisations", {
        p_limit: 50,
        p_offset: companyPage * 50,
      })
    : { data: [], error: null };
  const companyLocations =
    companyReady && organisation.success
      ? await supabase.rpc("list_operating_organisation_locations", {
          p_organisation: organisation.data,
          p_limit: 50,
          p_offset: companyLocationPage * 50,
        })
      : { data: [], error: null };
  const branchRows = companyReady
    ? await supabase.rpc("managed_rental_branches")
    : { data: [], error: null };
  const branchMembers = companyReady
    ? await supabase
        .from("car_rental_company_members")
        .select("company_id")
        .eq("profile_id", user.id)
        .eq("role", "owner")
        .limit(100)
    : { data: [], error: null };
  const ownedBranchIds = new Set(
    (branchMembers.data || []).map(
      (row: { company_id: string }) => row.company_id,
    ),
  );
  const ownedBranches = (branchRows.data || []).filter(
    (row: { id: string; submitted_by: string }) =>
      row.submitted_by === user.id || ownedBranchIds.has(row.id),
  );
  const requestId = z.string().uuid().safeParse(query.requestId);
  return (
    <main className="business-main private-management">
      <Link href={`/${locale}/business`}>
        {es ? "Volver a mi gestión" : "Back to management"}
      </Link>
      <h1>
        {es ? "Ubicaciones de trabajo privadas" : "Private operating locations"}
      </h1>
      <p>
        {es
          ? "Crea un espacio de trabajo sin publicar una ficha. Cada ubicación conserva sus propios permisos. Las funciones de pago requieren su plan correspondiente."
          : "Create a workspace without publishing a listing. Each location retains its own permissions. Paid features require their applicable plan."}
      </p>
      {companyReady && (
        <OrganisationManagement
          locale={locale}
          companies={companies.data || []}
          locations={companyLocations.data || []}
          ownLocations={memberships || []}
          error={Boolean(companies.error || companyLocations.error || error)}
          query={{
            ...query,
            companyPage: String(companyPage),
            companyLocationPage: String(companyLocationPage),
          }}
        />
      )}
      {error && (
        <p role="alert">
          {es
            ? "No se pudieron cargar tus ubicaciones."
            : "Your locations could not be loaded."}
        </p>
      )}
      {query.error && (
        <p role="alert">
          {query.error === "conflict"
            ? es
              ? "Esta solicitud ya se usó con otro nombre. Conserva el nombre original para reintentar."
              : "This request was already used with another name. Keep the original name to retry."
            : es
              ? "No se pudo crear la ubicación. Revisa los datos o reintenta cuando el servicio esté disponible."
              : "The location could not be created. Check the details or retry when the service is available."}
        </p>
      )}
      {!error && (
        <ul>
          {(memberships || []).map(
            (workspace: { id: string; name: string }) => (
              <li key={workspace.id}>
                <a
                  href={suiteHref("business", locale, {
                    workspaceId: workspace.id,
                  })}
                >
                  {workspace.name}
                </a>
              </li>
            ),
          )}
        </ul>
      )}
      {!error && (
        <nav aria-label={es ? "Páginas de ubicaciones" : "Location pages"}>
          {page > 0 && (
            <Link href={`/${locale}/business/locations?page=${page - 1}`}>
              {es ? "Anterior" : "Previous"}
            </Link>
          )}
          {(memberships || []).length === 50 && page < 200 && (
            <Link href={`/${locale}/business/locations?page=${page + 1}`}>
              {es ? "Siguiente" : "Next"}
            </Link>
          )}
        </nav>
      )}
      {companyReady && (
        <section>
          <h2>
            {es ? "Vincular sucursal de alquiler" : "Attach rental branch"}
          </h2>
          {(branchRows.error || branchMembers.error) && (
            <p role="alert">
              {es
                ? "No se pudieron cargar tus sucursales."
                : "Your rental branches could not be loaded."}
            </p>
          )}
          <form action={attachRentalLocation}>
            <fieldset
              disabled={Boolean(
                error || branchRows.error || branchMembers.error,
              )}
            >
              <input type="hidden" name="locale" value={locale} />
              <label>
                {es ? "Sucursal propia" : "Owned branch"}
                <select name="company" required defaultValue="">
                  <option value="">{es ? "Seleccionar" : "Select"}</option>
                  {ownedBranches.map((branch: { id: string; name: string }) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Ubicación operativa propia" : "Owned operating location"}
                <select name="workspace" required defaultValue="">
                  <option value="">{es ? "Seleccionar" : "Select"}</option>
                  {(memberships || [])
                    .filter(
                      (location: { role: string }) => location.role === "owner",
                    )
                    .map((location: { id: string; name: string }) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                </select>
              </label>
              <p>
                {es
                  ? "Se requiere ser propietario de ambos espacios. La vinculación no mueve reservas, no publica fichas y no concede permisos operativos adicionales."
                  : "Ownership of both spaces is required. Linking does not move bookings, publish listings or grant additional operational permissions."}
              </p>
              <button type="submit">
                {es
                  ? "Vincular sucursal seleccionada"
                  : "Attach selected branch"}
              </button>
            </fieldset>
          </form>
        </section>
      )}
      {ready ? (
        <form action={createPrivateLocation}>
          <input type="hidden" name="locale" value={locale} />
          <input
            type="hidden"
            name="requestId"
            value={requestId.success ? requestId.data : crypto.randomUUID()}
          />
          <label>
            {es ? "Nombre de la ubicación" : "Location name"}
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={query.name?.slice(0, 120) || ""}
            />
          </label>
          <button type="submit">
            {es ? "Crear ubicación privada" : "Create private location"}
          </button>
        </form>
      ) : (
        <p>
          {es
            ? "La creación de nuevas ubicaciones aún no está disponible. Tus espacios existentes conservan su acceso."
            : "New location creation is not available yet. Existing workspaces retain their access."}
        </p>
      )}
    </main>
  );
}
