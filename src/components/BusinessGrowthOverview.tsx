import Link from "next/link";
import styles from "./BusinessGrowthOverview.module.css";

type GrowthVenue = {
  id: string;
  name: string;
  events: number;
  media?: number;
  interactions: number | null;
};
export function BusinessGrowthOverview({
  locale,
  venues,
  events,
}: {
  locale: "en" | "es";
  venues: GrowthVenue[];
  events: number;
}) {
  const es = locale === "es";
  const base = `/${locale}/business`;
  const totals = venues.reduce(
    (sum, venue) => sum + (venue.interactions || 0),
    0,
  );
  const measured =
    venues.length > 0 && venues.every((venue) => venue.interactions !== null);
  return (
    <section className={styles.root} aria-labelledby="business-growth-heading">
      <header className={styles.header}>
        <div>
          <span className="eyebrow">
            {es ? "Centro de crecimiento" : "Growth centre"}
          </span>
          <h2 id="business-growth-heading">
            {es ? "Tu negocio, creciendo" : "Your business, growing"}
          </h2>
          <p>
            {es
              ? "Actividad real, próximos eventos y oportunidades para mejorar tus fichas."
              : "Real activity, upcoming events and opportunities to improve your listings."}
          </p>
        </div>
        <span className={styles.pill}>
          {es ? "Vista inicial" : "Early access"}
        </span>
      </header>
      <div className={styles.stats}>
        <article>
          <span>{es ? "Locales gestionados" : "Managed venues"}</span>
          <strong>{venues.length}</strong>
        </article>
        <article>
          <span>{es ? "Eventos registrados" : "Registered events"}</span>
          <strong>{events}</strong>
        </article>
        <article>
          <span>
            {es ? "Interacciones registradas" : "Recorded interactions"}
          </span>
          <strong>
            {measured ? totals.toLocaleString(es ? "es-ES" : "en-GB") : "—"}
          </strong>
        </article>
      </div>
      <div className={styles.columns}>
        <div className={styles.panel}>
          <h3>{es ? "Tus locales" : "Your venues"}</h3>
          {venues.length ? (
            <ul className={styles.venues}>
              {venues.map((venue) => (
                <li key={venue.id}>
                  <div>
                    <strong>{venue.name}</strong>
                    <small>
                      {venue.interactions === null
                        ? es
                          ? "Estadísticas no disponibles"
                          : "Analytics unavailable"
                        : `${venue.interactions.toLocaleString(es ? "es-ES" : "en-GB")} ${es ? "interacciones registradas" : "recorded interactions"}`}
                    </small>
                  </div>
                  <Link href={`${base}/venue/${venue.id}`}>
                    {es ? "Gestionar" : "Manage"}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {es
                ? "Cuando gestiones un local aparecerá aquí."
                : "Your venues will appear here once you manage one."}
            </p>
          )}
          <Link className="button secondary" href={`${base}?view=analytics`}>
            {es ? "Abrir estadísticas" : "Open analytics"}
          </Link>
        </div>
        <div className={styles.panel}>
          <h3>{es ? "Acciones rápidas" : "Quick actions"}</h3>
          <div className={styles.actions}>
            <Link href={`${base}?view=events#create-event`}>
              {es ? "Crear un evento" : "Create an event"}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href={`${base}?view=events`}>
              {es
                ? "Gestionar eventos y reutilizar fichas"
                : "Manage events and reuse listings"}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href={`${base}?view=analytics`}>
              {es
                ? "Ver el rendimiento registrado"
                : "View recorded performance"}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className={styles.future}>
            <h4>AkiBusiness</h4>
            <p>
              {es
                ? "Tu espacio de operaciones: TPV, inventario, clientes y personal según las herramientas y permisos activos. La gestión básica de tus fichas sigue siendo gratuita en AkiHQ."
                : "Your operations workspace: PoS, inventory, customers and staff according to active tools and permissions. Basic listing management remains free in AkiHQ."}
            </p>
            <a
              className="button secondary"
              href={`https://akibusiness.com/?locale=${locale}`}
            >
              {es ? "Abrir AkiBusiness" : "Open AkiBusiness"}
            </a>
          </div>
        </div>
      </div>
      <p className={styles.fine}>
        {es
          ? "Las interacciones proceden de las estadísticas disponibles de AkiPasa. No representan impresiones individuales de Google ni cifras estimadas."
          : "Interactions use available AkiPasa analytics. They are not individual Google impressions or estimates."}
      </p>
    </section>
  );
}
