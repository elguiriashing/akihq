import Link from "next/link";
import type { Locale } from "@/lib/config";
import { Icon } from "@/components/Icons";
import styles from "./OwnerReadiness.module.css";

export function OwnerReadiness({
  locale,
  venueId,
  profileComplete,
  photos,
  upcomingEvents,
  loyaltyReady,
  results,
}: {
  locale: Locale;
  venueId: string;
  profileComplete: boolean;
  photos: number;
  upcomingEvents: number;
  loyaltyReady: boolean;
  results: Record<string, number> | null;
}) {
  const es = locale === "es";
  const tasks = [
    {
      done: profileComplete,
      section: "profile",
      icon: "venue" as const,
      label: es ? "Perfil listo" : "Complete your profile",
      detail: es ? "Descripción y contacto" : "Description and contact details",
    },
    {
      done: photos > 0,
      section: "profile",
      icon: "inbox" as const,
      label: es ? "Añade una foto" : "Add a venue photo",
      detail: es
        ? "Que te reconozcan al instante"
        : "Help people recognise you",
    },
    {
      done: upcomingEvents > 0,
      section: "events",
      icon: "calendar" as const,
      label: es ? "Próximo evento" : "Publish your next event",
      detail: es ? "Aparece en descubrimiento" : "Appear in event discovery",
    },
    {
      done: loyaltyReady,
      section: "rewards",
      icon: "gift" as const,
      label: es ? "Activa fidelidad" : "Turn on loyalty",
      detail: es ? "Opcional, pero útil" : "Optional, but useful",
    },
  ];
  const completed = tasks.filter((task) => task.done).length;
  const progress = Math.round((completed / tasks.length) * 100);
  const metrics = [
    ["listing_views", es ? "Ficha" : "Listing", "venue" as const],
    ["event_views", es ? "Eventos" : "Events", "calendar" as const],
    ["directions", es ? "Cómo llegar" : "Directions", "map" as const],
    [
      "website_clicks",
      es ? "Web / reserva" : "Website / booking",
      "globe" as const,
    ],
    ["contact_clicks", es ? "Contacto" : "Contact", "person" as const],
    ["accepted_checkins", "Check-ins", "passport" as const],
    ["rewards_redeemed", es ? "Canjes" : "Redemptions", "gift" as const],
  ] as const;

  return (
    <div className={styles.overview}>
      <section className={styles.readiness}>
        <div className={styles.readinessHeader}>
          <div>
            <span className={styles.eyebrow}>
              {es ? "Puesta a punto" : "Venue setup"}
            </span>
            <h2>
              {completed === tasks.length
                ? es
                  ? "Tu local está listo"
                  : "Your venue is ready"
                : es
                  ? "Deja el local listo en pocos pasos"
                  : "Get the venue ready in a few quick steps"}
            </h2>
          </div>
          <strong>{progress}%</strong>
        </div>
        <div className={styles.progress} aria-label={`${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.taskGrid}>
          {tasks.map((task) => (
            <Link
              className={styles.task}
              data-done={task.done}
              href={`/${locale}/business/venue/${venueId}?section=${task.section}`}
              key={task.section + task.label}
            >
              <span className={styles.taskIcon}>
                {task.done ? "✓" : <Icon name={task.icon} />}
              </span>
              <span>
                <strong>{task.label}</strong>
                <small>{task.detail}</small>
              </span>
              <Icon name="arrow-right" />
            </Link>
          ))}
        </div>
        {!upcomingEvents && (
          <p className={styles.hint}>
            {es
              ? "Consejo: una fecha futura publicada hace que el local aparezca también en el descubrimiento de eventos."
              : "Tip: a published future date also puts the venue into event discovery."}
          </p>
        )}
      </section>

      <section className={styles.results}>
        <div className={styles.resultsHeader}>
          <div>
            <span className={styles.eyebrow}>
              {es ? "Últimos 30 días" : "Last 30 days"}
            </span>
            <h2>{es ? "Lo que está pasando" : "What is happening"}</h2>
          </div>
        </div>
        {results ? (
          <div className={styles.metricGrid}>
            {metrics.map(([key, label, icon]) => (
              <article className={styles.metric} key={key}>
                <span>
                  <Icon name={icon} />
                </span>
                <strong>
                  {Number(results[key] || 0).toLocaleString(locale)}
                </strong>
                <small>{label}</small>
              </article>
            ))}
          </div>
        ) : (
          <p role="status" className={styles.hint}>
            {es
              ? "Los resultados no están disponibles ahora."
              : "Results are currently unavailable."}
          </p>
        )}
        <p className={styles.footnote}>
          {es
            ? "Interacciones registradas con permiso. No son clientes únicos ni ventas confirmadas."
            : "Permission-aware interactions. These are not unique customers or confirmed sales."}
        </p>
      </section>
    </div>
  );
}
