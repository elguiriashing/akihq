import { BusinessPathway } from "./BusinessPathway";
import Link from "next/link";
import {
  aggregatePulse,
  listingCompleteness,
  type PulseMetric,
} from "@/lib/akipulse";
import styles from "./BusinessGrowthOverview.module.css";

type Location = {
  id: string;
  name: string;
  status: string;
  events: number;
  metrics: PulseMetric[] | null;
  address?: string | null;
  description_es?: string | null;
  description_en?: string | null;
  phone?: string | null;
  website_url?: string | null;
};
export function AkiPulse({
  locale,
  locations,
  days,
  selectedLocation,
  availableLocations,
  truncated = false,
}: {
  locale: "en" | "es";
  locations: Location[];
  days: 7 | 30 | 90;
  selectedLocation: string;
  availableLocations: Array<{ id: string; name: string }>;
  truncated?: boolean;
}) {
  const es = locale === "es",
    base = `/${locale}/business`;
  const metrics = aggregatePulse(locations.map((item) => item.metrics));
  const interactions = metrics?.reduce((total, row) => total + row.current, 0);
  const previous = metrics?.reduce((total, row) => total + row.previous, 0);
  const published = locations.filter(
    (item) => item.status === "published",
  ).length;
  const labels: Record<string, string> = {
    venue_view: es ? "Visitas a la ficha" : "Listing views",
    event_view: es ? "Visitas a eventos" : "Event views",
    booking_click: es ? "Clics de reserva" : "Booking clicks",
    directions_click: es ? "Cómo llegar" : "Directions clicks",
    share: es ? "Compartidos" : "Shares",
  };
  return (
    <section className={styles.root} aria-labelledby="pulse-title">
      <header className={styles.header}>
        <div>
          <span className="eyebrow">AkiPulse · AkiHQ</span>
          <h2 id="pulse-title">
            {es
              ? "Entiende la actividad de tu negocio"
              : "Understand your business activity"}
          </h2>
          <p>
            {es
              ? "Visibilidad, eventos y acciones sobre tus fichas, en un solo espacio."
              : "Listing visibility, events and customer actions in one workspace."}
          </p>
        </div>
        <span className={styles.pill}>
          {es ? "Resumen gratuito" : "Free overview"}
        </span>
      </header>
      <form className={styles.filters} action={base}>
        <input type="hidden" name="view" value="pulse" />
        <label>
          {es ? "Local" : "Location"}
          <select name="location" defaultValue={selectedLocation}>
            <option value="all">
              {es ? "Todos los locales gestionados" : "All managed locations"}
            </option>
            {availableLocations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {es ? "Periodo" : "Period"}
          <select name="days" defaultValue={String(days)}>
            {[7, 30, 90].map((d) => (
              <option value={d} key={d}>
                {d} {es ? "días" : "days"}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" type="submit">
          {es ? "Aplicar" : "Apply"}
        </button>
      </form>
      {truncated && (
        <p role="status">
          {es
            ? "Se muestran los primeros 20 locales. Selecciona un local para consultar su actividad."
            : "Showing the first 20 locations. Select a location to inspect its activity."}
        </p>
      )}
      <div className={styles.stats}>
        <article>
          <span>{es ? "Locales publicados" : "Published locations"}</span>
          <strong>
            {published}/{locations.length}
          </strong>
        </article>
        <article>
          <span>
            {es ? "Interacciones registradas" : "Recorded interactions"}
          </span>
          <strong>
            {interactions === undefined
              ? "—"
              : interactions.toLocaleString(locale)}
          </strong>
        </article>
        <article>
          <span>
            {es ? "Periodo anterior equivalente" : "Previous equal period"}
          </span>
          <strong>
            {previous === undefined ? "—" : previous.toLocaleString(locale)}
          </strong>
        </article>
      </div>
      {metrics === null && (
        <p className="notice notice-error" role="alert">
          {es
            ? "Faltan datos de uno o más locales. No mostramos totales incompletos como si fueran definitivos."
            : "One or more locations could not be measured. Incomplete totals are not shown as final results."}
        </p>
      )}
      <div className={styles.columns}>
        <div className={styles.panel}>
          <h3>{es ? "Acciones de clientes" : "Customer actions"}</h3>
          <p className={styles.fine}>
            {es
              ? "Los clics de reserva no son reservas confirmadas. Las acciones pueden proceder de la misma persona; no son usuarios únicos ni un embudo de conversión."
              : "Booking clicks are not confirmed bookings. Actions may come from the same person; these are not unique users or a conversion funnel."}
          </p>
          {metrics?.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{es ? "Acción" : "Action"}</th>
                    <th>{es ? "Actual" : "Current"}</th>
                    <th>{es ? "Anterior" : "Previous"}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row) => (
                    <tr key={row.action}>
                      <th scope="row">
                        {labels[row.action] || row.action.replaceAll("_", " ")}
                      </th>
                      <td>{row.current.toLocaleString(locale)}</td>
                      <td>{row.previous.toLocaleString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            metrics && (
              <p>
                {es
                  ? "No hay acciones registradas en estos periodos."
                  : "No actions recorded in these periods."}
              </p>
            )
          )}
          <details>
            <summary>
              {es ? "Método y cobertura" : "Method and coverage"}
            </summary>
            <p className={styles.fine}>
              {es
                ? `Comparación de los últimos ${days} días con los ${days} días anteriores, usando intervalos UTC de 24 horas y registros de AkiPasa autorizados por local. La recogida depende del consentimiento y puede ser incompleta. No incluye impresiones de Google, ingresos ni fuentes de adquisición sin vinculación comprobada.`
                : `Compares the last ${days} days with the preceding ${days} days, using UTC 24-hour intervals and location-authorised AkiPasa records. Collection depends on consent and may be incomplete. Excludes Google impressions, revenue and acquisition sources without verified linkage.`}
            </p>
          </details>
        </div>
        <div className={styles.panel}>
          <h3>{es ? "Preparación de las fichas" : "Listing readiness"}</h3>
          <p className={styles.fine}>
            {es
              ? "Cinco comprobaciones de 20 puntos: nombre, dirección, descripción, contacto y publicación. No mide ingresos ni predice crecimiento."
              : "Five checks worth 20 points each: name, address, description, contact and publication. Does not measure revenue or predict growth."}
          </p>
          <ul className={styles.venues}>
            {locations.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {es ? "Ficha completa" : "Listing completeness"}:{" "}
                    {listingCompleteness(item).score === null
                      ? es
                        ? "No disponible"
                        : "Unavailable"
                      : `${listingCompleteness(item).score}/100`}
                  </small>
                  <small>
                    {listingCompleteness(item)
                      .checks.filter((check) => check.complete === false)
                      .map(
                        (check) =>
                          ({
                            name: es ? "nombre" : "name",
                            address: es ? "dirección" : "address",
                            description: es ? "descripción" : "description",
                            contact: es ? "contacto" : "contact",
                            published: es ? "publicación" : "publication",
                          })[
                            check.key as
                              | "name"
                              | "address"
                              | "description"
                              | "contact"
                              | "published"
                          ],
                      )
                      .join(" · ")}
                  </small>
                  <small>
                    {item.status === "published"
                      ? es
                        ? "Ficha publicada"
                        : "Listing published"
                      : es
                        ? "Revisar estado de publicación"
                        : "Review publication status"}{" "}
                    · {item.events} {es ? "eventos guardados" : "saved events"}
                  </small>
                  <small>
                    {item.metrics === null
                      ? es
                        ? "Estadísticas no disponibles"
                        : "Analytics unavailable"
                      : es
                        ? "Estadísticas disponibles"
                        : "Analytics available"}
                  </small>
                </div>
                <Link href={`${base}/venue/${item.id}`}>
                  {es ? "Revisar" : "Review"}
                </Link>
              </li>
            ))}
          </ul>
          <Link className="button secondary" href={`${base}?view=events`}>
            {es ? "Gestionar eventos" : "Manage events"}
          </Link>
        </div>
      </div>
      {!locations.length && (
        <p>
          {es
            ? "Reclama o crea una ficha para ver sus datos aquí."
            : "Claim or create a listing to see its data here."}
        </p>
      )}
      <BusinessPathway locale={locale} chooseCategory />
    </section>
  );
}
