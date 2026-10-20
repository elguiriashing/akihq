import type { PulseScope, PulseScopedReport } from "@/lib/akipulse-scoped";
import styles from "./BusinessGrowthOverview.module.css";
import scopedStyles from "./AkiPulseScoped.module.css";
export function AkiPulseScoped({
  locale,
  kind,
  selected,
  scopes,
  report,
  unavailable,
  page,
  hasMore,
  days,
}: {
  locale: "en" | "es";
  kind: string;
  selected: string;
  scopes: PulseScope[];
  report: PulseScopedReport | null;
  unavailable: boolean;
  page: number;
  hasMore: boolean;
  days: number;
}) {
  const es = locale === "es";
  const instant = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const labels: Record<string, string> = {
    venue: es ? "Locales" : "Venues",
    property: es
      ? "Alojamientos vinculados a fichas"
      : "Listing-linked accommodation",
    fleet: es ? "Sucursales de alquiler" : "Rental branches",
    organisation: es ? "Organizaciones" : "Organisations",
  };
  const actions: Record<string, string> = {
    venue_view: es ? "Visitas a la ficha" : "Listing views",
    event_view: es ? "Visitas a eventos" : "Event views",
    booking_click: es ? "Clics de reserva" : "Booking clicks",
    directions_click: es ? "Cómo llegar" : "Directions clicks",
    share: es ? "Compartidos" : "Shares",
    event_saved: es ? "Eventos guardados" : "Saved events",
    venue_followed: es ? "Seguimientos del local" : "Listing follows",
    check_in_accepted: es
      ? "Visitas registradas aceptadas"
      : "Accepted check-ins",
    check_in_rejected: es
      ? "Visitas registradas rechazadas"
      : "Rejected check-ins",
    promotion_requested: es ? "Solicitudes de promoción" : "Promotion requests",
  };
  const statuses: Record<string, string> = {
    requested: es ? "Solicitada" : "Requested",
    confirmed: es ? "Confirmada" : "Confirmed",
    cancelled: es ? "Cancelada" : "Cancelled",
    declined: es ? "Rechazada" : "Declined",
    completed: es ? "Completada" : "Completed",
    checked_in: es ? "Registro de entrada" : "Checked in",
  };
  const href = (next: number) =>
    `/${locale}/business?${new URLSearchParams({ view: "pulse", pulseKind: kind, pulsePage: String(next), days: String(days) })}`;
  return (
    <section
      className={`${styles.panel} ${scopedStyles.root}`}
      aria-labelledby="pulse-booking-title"
    >
      <h3 id="pulse-booking-title">
        {es
          ? "Reservas y cobertura por negocio"
          : "Business booking activity and coverage"}
      </h3>
      <form action={`/${locale}/business`} className={styles.filters}>
        <input type="hidden" name="view" value="pulse" />
        <input type="hidden" name="days" value={days} />
        <label>
          {es ? "Tipo de ámbito" : "Scope type"}
          <select name="pulseKind" defaultValue={kind}>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button secondary">
          {es ? "Cargar ámbitos" : "Load scopes"}
        </button>
      </form>
      <form action={`/${locale}/business`} className={styles.filters}>
        <input type="hidden" name="view" value="pulse" />
        <label>
          {es ? "Periodo" : "Period"}
          <select name="days" defaultValue={String(days)}>
            {[7, 30, 90].map((day) => (
              <option key={day} value={day}>
                {day} {es ? "días" : "days"}
              </option>
            ))}
          </select>
        </label>
        <input type="hidden" name="pulseKind" value={kind} />
        <input type="hidden" name="pulsePage" value={page} />
        <label>
          {es ? "Negocio autorizado" : "Authorised business"}
          <select
            name="pulseResource"
            defaultValue={selected}
            disabled={!scopes.length}
          >
            {scopes.map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={!scopes.length}
          className="button secondary"
        >
          {es ? "Ver informe" : "View report"}
        </button>
      </form>
      <nav aria-label={es ? "Páginas de ámbitos" : "Scope pages"}>
        {page > 0 && (
          <a href={href(page - 1)}>{es ? "Anterior" : "Previous"}</a>
        )}{" "}
        {hasMore && <a href={href(page + 1)}>{es ? "Siguiente" : "Next"}</a>}
      </nav>
      {unavailable ? (
        <p role="alert">
          {es
            ? "No se pudieron verificar los datos o tus permisos. No mostramos ceros ni datos guardados como sustitutos."
            : "Data or access could not be verified. Cached figures and zero values are not substituted."}
        </p>
      ) : !scopes.length ? (
        <p>
          {es
            ? "No hay ámbitos autorizados en esta página."
            : "No authorised scopes on this page."}
        </p>
      ) : null}
      {report && (
        <>
          <h4>{report.name}</h4>
          <p className={styles.fine}>
            {es
              ? "Solicitudes creadas durante cada periodo; el estado es el actual, no la fecha de confirmación. No son pagos, ingresos ni ocupación histórica."
              : "Requests created during each period; status is current, not the confirmation date. These are not payments, revenue or historical occupancy."}
          </p>
          <p className={styles.fine}>
            {instant(report.period.current_from)} —{" "}
            {instant(report.period.until)} · UTC ·{" "}
            {es
              ? "Periodo anterior de igual duración"
              : "Equal-length previous period"}
            : {instant(report.period.previous_from)} —{" "}
            {instant(report.period.current_from)}
          </p>
          {report.coverage.excluded_locations > 0 && (
            <p role="status">
              {report.coverage.excluded_locations}{" "}
              {es
                ? "ubicaciones sin vínculo verificable o permiso de gestión. Se excluyen; los resultados no son el total de toda la organización."
                : "locations lack a verified link or management access. They are excluded; results are not the complete organisation total."}
            </p>
          )}
          <div className={styles.stats}>
            <article>
              <span>{es ? "Fichas medidas" : "Measured listings"}</span>
              <strong>{report.coverage.measured_venues}</strong>
            </article>
            {report.coverage.current_active_units !== null && (
              <article>
                <span>
                  {es ? "Unidades activas ahora" : "Units active now"}
                </span>
                <strong>{report.coverage.current_active_units}</strong>
              </article>
            )}
            {report.coverage.current_active_vehicles !== null && (
              <article>
                <span>
                  {es ? "Vehículos activos ahora" : "Vehicles active now"}
                </span>
                <strong>{report.coverage.current_active_vehicles}</strong>
              </article>
            )}
          </div>
          {report.bookings.length ? (
            <div
              className={styles.tableScroll}
              tabIndex={0}
              role="region"
              aria-label={
                es
                  ? "Solicitudes por estado y periodo"
                  : "Requests by status and period"
              }
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    {[
                      es ? "Origen" : "Source",
                      es ? "Periodo" : "Period",
                      es ? "Estado actual" : "Current status",
                      es ? "Solicitudes" : "Requests",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.bookings.map((row) => (
                    <tr key={`${row.source}-${row.period}-${row.status}`}>
                      <th scope="row">
                        {row.source === "accommodation"
                          ? es
                            ? "Alojamiento"
                            : "Accommodation"
                          : row.source === "fleet"
                            ? es
                              ? "Alquiler"
                              : "Rental"
                            : es
                              ? "Reserva de local"
                              : "Venue booking"}
                      </th>
                      <td>
                        {row.period === "current"
                          ? es
                            ? "Actual"
                            : "Current"
                          : es
                            ? "Anterior"
                            : "Previous"}
                      </td>
                      <td>{statuses[row.status] || row.status}</td>
                      <td>{row.total.toLocaleString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              {es
                ? "No se registraron solicitudes en estos intervalos."
                : "No requests recorded in these intervals."}
            </p>
          )}
          <details>
            <summary>
              {es
                ? "Acciones registradas del ámbito"
                : "Recorded actions for this scope"}
            </summary>
            <p className={styles.fine}>
              {es
                ? "Las acciones dependen del consentimiento. No equivalen a personas únicas ni se unen a solicitudes para atribuir conversiones."
                : "Actions depend on consent. They are not unique people and are not joined to requests to attribute conversions."}
            </p>
            {report.interactions.map((row) => (
              <p key={row.action}>
                {actions[row.action] ||
                  (es ? "Otra acción registrada" : "Other recorded action")}
                : {row.current} / {row.previous}
              </p>
            ))}
          </details>
        </>
      )}
      <details>
        <summary>
          {es
            ? "Cobertura de adquisición y embudo comercial"
            : "Acquisition and commercial funnel coverage"}
        </summary>
        <p>
          {es
            ? "Aún no hay un adaptador verificado que vincule impresiones, reclamaciones, activaciones y pagos a este ámbito. No calculamos tasas de conversión ni atribuimos tráfico global de Google a tu negocio. Los clics GA4 sujetos a consentimiento siguen separados de los pagos verificados."
            : "A verified adapter linking impressions, claims, activations and payments to this scope is not available yet. Conversion rates and sitewide Google traffic are not attributed to your business. Consent-gated GA4 clicks remain separate from verified payments."}
        </p>
      </details>
      <p className={styles.fine}>
        {es
          ? "Los alojamientos independientes y las sucursales sin vínculo de organización conservan sus permisos y datos. Su incorporación a un total de organización requiere un vínculo explícito verificado."
          : "Independent properties and branches without an organisation link retain their own permissions and records. Inclusion in an organisation total requires an explicit verified link."}
      </p>
    </section>
  );
}
