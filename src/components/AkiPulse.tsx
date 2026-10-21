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
  const es = locale === "es";
  const base = `/${locale}/business`;
  const metrics = aggregatePulse(locations.map((item) => item.metrics));
  const interactions = metrics?.reduce((total, row) => total + row.current, 0);
  const previous = metrics?.reduce((total, row) => total + row.previous, 0);
  const published = locations.filter(
    (item) => item.status === "published",
  ).length;
  const metricPeak = Math.max(
    1,
    ...(metrics || []).map((row) => Math.max(row.current, row.previous)),
  );
  const labels: Record<string, string> = {
    venue_view: es ? "Visitas a la ficha" : "Listing views",
    event_view: es ? "Visitas a eventos" : "Event views",
    booking_click: es ? "Clics de reserva" : "Booking clicks",
    directions_click: es ? "Cómo llegar" : "Directions clicks",
    share: es ? "Compartidos" : "Shares",
  };
  const checkLabels: Record<string, string> = {
    name: es ? "nombre" : "name",
    address: es ? "dirección" : "address",
    description: es ? "descripción" : "description",
    contact: es ? "contacto" : "contact",
    published: es ? "publicación" : "publication",
  };

  return (
    <section className={styles.root} aria-labelledby="pulse-title">
      <header className={styles.header}>
        <div>
          <span className={styles.brand}>AkiPulse</span>
          <h2 id="pulse-title">
            {es ? "Pulso de tu negocio" : "Your business pulse"}
          </h2>
          <p>
            {es
              ? "Lo importante de tus fichas, de un vistazo."
              : "The important signals from your listings, at a glance."}
          </p>
        </div>
        <span className={styles.pill}>
          {es ? "Resumen gratuito" : "Free overview"}
        </span>
      </header>

      <form
        className={`${styles.filters} ${styles.compactFilters}`}
        action={base}
      >
        <input type="hidden" name="view" value="pulse" />
        <label>
          {es ? "Local" : "Location"}
          <select name="location" defaultValue={selectedLocation}>
            <option value="all">
              {es ? "Todos los locales" : "All managed locations"}
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
            {[7, 30, 90].map((day) => (
              <option value={day} key={day}>
                {day} {es ? "días" : "days"}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" type="submit">
          {es ? "Aplicar" : "Apply"}
        </button>
      </form>

      {truncated && (
        <p className={styles.compactNotice} role="status">
          {es
            ? "Mostrando 20 locales. Selecciona uno para ver su actividad."
            : "Showing 20 locations. Select one to inspect its activity."}
        </p>
      )}

      <div className={styles.stats}>
        <article>
          <span>{es ? "Publicados" : "Published"}</span>
          <strong>
            {published}/{locations.length}
          </strong>
        </article>
        <article>
          <span>{es ? "Interacciones" : "Interactions"}</span>
          <strong>
            {interactions === undefined
              ? "—"
              : interactions.toLocaleString(locale)}
          </strong>
        </article>
        <article>
          <span>{es ? "Periodo anterior" : "Previous period"}</span>
          <strong>
            {previous === undefined ? "—" : previous.toLocaleString(locale)}
          </strong>
        </article>
      </div>

      {metrics === null && (
        <p className="notice notice-error" role="alert">
          {es
            ? "Faltan datos de uno o más locales. No mostramos totales incompletos."
            : "One or more locations could not be measured. Incomplete totals are hidden."}
        </p>
      )}

      <div className={styles.columns}>
        <div className={`${styles.panel} ${styles.activityPanel}`}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.sectionLabel}>
                {es ? "Actividad" : "Activity"}
              </span>
              <h3>{es ? "Acciones de clientes" : "Customer actions"}</h3>
            </div>
            <span className={styles.periodBadge}>
              {days} {es ? "días" : "days"}
            </span>
          </div>
          {metrics?.length ? (
            <div className={styles.metricList}>
              {metrics.map((row) => {
                const delta = row.current - row.previous;
                return (
                  <div className={styles.metricRow} key={row.action}>
                    <div className={styles.metricTopline}>
                      <strong>
                        {labels[row.action] || row.action.replaceAll("_", " ")}
                      </strong>
                      <span>
                        <b>{row.current.toLocaleString(locale)}</b>
                        <small
                          data-direction={
                            delta > 0 ? "up" : delta < 0 ? "down" : "flat"
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {delta.toLocaleString(locale)}
                        </small>
                      </span>
                    </div>
                    <span className={styles.track} aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.max(4, (row.current / metricPeak) * 100)}%`,
                        }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            metrics && (
              <p className={styles.emptyInline}>
                {es
                  ? "Todavía no hay acciones en este periodo."
                  : "No actions in this period yet."}
              </p>
            )
          )}
          <details className={styles.explainer}>
            <summary>
              {es ? "Qué significan estos datos" : "What this data means"}
            </summary>
            <p className={styles.fine}>
              {es
                ? `Los clics de reserva no son reservas confirmadas y las acciones no son usuarios únicos. Comparamos los últimos ${days} días con los ${days} anteriores. La recogida depende del consentimiento. No incluye impresiones de Google, ingresos ni fuentes de adquisición sin vinculación comprobada.`
                : `Booking clicks are not confirmed bookings and actions are not unique users. We compare the last ${days} days with the preceding ${days}. Collection depends on consent. Excludes Google impressions, revenue and acquisition sources without verified linkage.`}
            </p>
          </details>
        </div>

        <div className={`${styles.panel} ${styles.readinessPanel}`}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.sectionLabel}>
                {es ? "Fichas" : "Listings"}
              </span>
              <h3>{es ? "Listas para clientes" : "Customer ready"}</h3>
            </div>
            <Link className={styles.textLink} href={`${base}?view=events`}>
              {es ? "Eventos" : "Events"}
            </Link>
          </div>
          <ul className={styles.venues}>
            {locations.map((item) => {
              const readiness = listingCompleteness(item);
              const missing = readiness.checks.filter(
                (check) => check.complete === false,
              );
              return (
                <li key={item.id}>
                  <div className={styles.venueSummary}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.status === "published"
                          ? es
                            ? "Publicada"
                            : "Published"
                          : es
                            ? "Revisar publicación"
                            : "Review publication"}{" "}
                        · {item.events} {es ? "eventos" : "events"}
                      </small>
                    </div>
                    <span className={styles.score}>
                      {readiness.score === null ? "—" : `${readiness.score}%`}
                    </span>
                    <Link href={`${base}/venue/${item.id}`}>
                      {es ? "Editar" : "Edit"}
                    </Link>
                  </div>
                  {missing.length > 0 && (
                    <small className={styles.missing}>
                      {es ? "Falta: " : "Missing: "}
                      {missing
                        .map((check) => checkLabels[check.key])
                        .join(" · ")}
                    </small>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {!locations.length && (
        <p className={styles.emptyInline}>
          {es
            ? "Reclama o crea una ficha para ver sus datos aquí."
            : "Claim or create a listing to see its data here."}
        </p>
      )}
      <BusinessPathway locale={locale} chooseCategory />
    </section>
  );
}
