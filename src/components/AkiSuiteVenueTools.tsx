"use client";

import { managementProduct } from "@/lib/product-roles";
import Link from "next/link";
import {
  saveEventTemplate,
  useEventTemplate,
  scheduleEventPublication,
  cancelFutureEventDates,
} from "@/app/[locale]/business/venue/[id]/premium-actions";
import styles from "./AkiSuiteVenueTools.module.css";
export type SuiteGrowthReport = {
  days: number;
  current: number;
  previous: number;
  publishedEvents: number;
  images: number;
  actions?: Array<{ action: string; current: number; previous: number }>;
  events?: Array<{
    id: string;
    title_en: string;
    title_es: string;
    current: number;
    previous: number;
  }>;
};
export type SuiteStayReport = {
  days: number;
  confirmedNights: number;
  previousConfirmedNights: number;
  receivedRequests: number;
  quotedValueCents: number;
};
export function AkiSuiteVenueTools({
  locale,
  venueId,
  premium,
  accommodation,
  report,
  stayReport,
  unavailable,
  templates,
  readiness,
}: {
  locale: "en" | "es";
  venueId: string;
  premium: boolean;
  accommodation: boolean;
  report?: SuiteGrowthReport | null;
  stayReport?: SuiteStayReport | null;
  unavailable?: boolean;
  templates: Array<{ id: string; name: string }>;
  readiness: Array<{ label: string; complete: boolean }>;
}) {
  const es = locale === "es";
  const exportReport = () => {
    if (!report && !stayReport) return;
    const values = Object.entries({ ...report, ...stayReport }).filter(
      ([, value]) => typeof value === "number" && Number.isFinite(value),
    );
    const blob = new Blob(
      [
        "Metric,Value\r\n" +
          values.map(([key, value]) => `${key},${value}`).join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "akisuite-performance.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className={styles.root} aria-labelledby="suite-venue-growth">
      <header>
        <div>
          <span className="eyebrow">
            {accommodation ? "AkiDuermo" : managementProduct.name}
          </span>
          <h2 id="suite-venue-growth">
            {es ? "Contenido y crecimiento" : "Content and growth"}
          </h2>
        </div>
        <span className={styles.badge}>
          {premium ? "Premium" : es ? "Gratis" : "Free"}
        </span>
      </header>
      <div className={styles.columns}>
        <div>
          <h3>{es ? "Preparación de la ficha" : "Listing readiness"}</h3>
          <ul>
            {readiness.map((item) => (
              <li key={item.label}>
                <span aria-hidden="true">{item.complete ? "✓" : "○"}</span>
                {item.label}
              </li>
            ))}
          </ul>
          <Link href={`/${locale}/business/venue/${venueId}?section=profile`}>
            {es ? "Mejorar mi ficha" : "Improve my listing"} →
          </Link>
        </div>
        <div>
          <h3>{es ? "Comparación histórica" : "Historical comparison"}</h3>
          {!premium ? (
            <p>
              {es
                ? "Premium añade comparaciones, informes exportables y una biblioteca ampliada. Tus datos y contenido actuales se conservan."
                : "Premium adds comparisons, exportable reports and an expanded library. Existing data and content are retained."}
            </p>
          ) : unavailable ? (
            <p role="status">
              {es
                ? "El informe no está disponible. Reintenta antes de tomar decisiones."
                : "The report is unavailable. Retry before using these figures."}
            </p>
          ) : report ? (
            <>
              <div className={styles.stats}>
                <article>
                  <span>
                    {es
                      ? `Últimos ${report.days} días`
                      : `Last ${report.days} days`}
                  </span>
                  <strong>{report.current}</strong>
                </article>
                <article>
                  <span>{es ? "Periodo anterior" : "Previous period"}</span>
                  <strong>{report.previous}</strong>
                </article>
              </div>
              <p className={styles.fine}>
                {es
                  ? "Interacciones registradas en AkiPasa. No son impresiones de Google."
                  : "Recorded AkiPasa interactions. These are not Google impressions."}
              </p>
              {report.actions && report.actions.length > 0 && (
                <div className={styles.tableWrap}>
                  <table>
                    <caption>
                      {es ? "Actividad por acción" : "Activity by action"}
                    </caption>
                    <thead>
                      <tr>
                        <th>{es ? "Acción" : "Action"}</th>
                        <th>{es ? "Actual" : "Current"}</th>
                        <th>{es ? "Anterior" : "Previous"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.actions.map((row) => (
                        <tr key={row.action}>
                          <td>{row.action}</td>
                          <td>{row.current}</td>
                          <td>{row.previous}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {report.events && report.events.length > 0 && (
                <div className={styles.tableWrap}>
                  <table>
                    <caption>
                      {es ? "Rendimiento de eventos" : "Event performance"}
                    </caption>
                    <thead>
                      <tr>
                        <th>{es ? "Evento" : "Event"}</th>
                        <th>{es ? "Actual" : "Current"}</th>
                        <th>{es ? "Anterior" : "Previous"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.events.map((row) => (
                        <tr key={row.id}>
                          <td>{es ? row.title_es : row.title_en}</td>
                          <td>{row.current}</td>
                          <td>{row.previous}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {stayReport && (
                <div className={styles.stats}>
                  <article>
                    <span>
                      {es ? "Noches confirmadas" : "Confirmed nights"}
                    </span>
                    <strong>{stayReport.confirmedNights}</strong>
                    <small>
                      {es ? "Anterior" : "Previous"}:{" "}
                      {stayReport.previousConfirmedNights}
                    </small>
                  </article>
                  <article>
                    <span>
                      {es ? "Solicitudes recibidas" : "Requests received"}
                    </span>
                    <strong>{stayReport.receivedRequests}</strong>
                  </article>
                </div>
              )}
              <button
                type="button"
                className="button secondary"
                onClick={exportReport}
              >
                {es ? "Exportar informe CSV" : "Export CSV report"}
              </button>
            </>
          ) : (
            <p>
              {es
                ? "El informe aparecerá cuando se puedan leer los registros."
                : "The report appears once its records can be read."}
            </p>
          )}
        </div>
      </div>
      {!accommodation && premium && templates.length > 0 && (
        <details>
          <summary>
            {es ? "Reutilizar una plantilla" : "Reuse a template"}
          </summary>
          <form action={useEventTemplate} className={styles.form}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="venueId" value={venueId} />
            <label>
              {es ? "Plantilla" : "Template"}
              <select name="templateId">
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {es ? "Enlace del nuevo evento" : "New event link"}
              <input
                name="slug"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={150}
                required
              />
            </label>
            <button className="button" type="submit">
              {es ? "Crear borrador" : "Create draft"}
            </button>
          </form>
        </details>
      )}
      <p className={styles.fine}>
        {es
          ? "La titularidad verificada es independiente del pago. No prometemos posiciones en Google."
          : "Verified ownership is independent of payment. No Google ranking guarantees."}
      </p>
    </section>
  );
}
export function AkiSuiteEventTools({
  locale,
  venueId,
  eventId,
  premium,
  published,
  trustedDraft = false,
}: {
  locale: "en" | "es";
  venueId: string;
  eventId: string;
  premium: boolean;
  published: boolean;
  trustedDraft?: boolean;
}) {
  const es = locale === "es";
  const fields = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="eventId" value={eventId} />
    </>
  );
  return (
    <div className={styles.eventTools}>
      {premium && (
        <details>
          <summary>
            {es ? "Guardar como plantilla" : "Save as template"}
          </summary>
          <form action={saveEventTemplate} className={styles.form}>
            {fields}
            <label>
              {es ? "Nombre de la plantilla" : "Template name"}
              <input name="name" minLength={2} maxLength={100} required />
            </label>
            <button type="submit" className="button">
              {es ? "Guardar plantilla" : "Save template"}
            </button>
          </form>
        </details>
      )}
      {premium && (published || trustedDraft) && (
        <details>
          <summary>
            {es ? "Programar publicación" : "Schedule publication"}
          </summary>
          <p>
            {es
              ? "Oculta este contenido ya aprobado hasta la fecha elegida. Si se modifica, deberá revisarse de nuevo."
              : "Hide this approved content until the chosen time. Changes require approval again."}
          </p>
          <form action={scheduleEventPublication} className={styles.form}>
            {fields}
            <label>
              {es ? "Publicar en horario de Madrid" : "Publish in Madrid time"}
              <input name="publishAt" type="datetime-local" required />
            </label>
            <button type="submit" className="button">
              {es ? "Programar" : "Schedule"}
            </button>
          </form>
        </details>
      )}
      <details>
        <summary>
          {es ? "Cancelar fechas futuras" : "Cancel future dates"}
        </summary>
        <form action={cancelFutureEventDates} className={styles.form}>
          {fields}
          <label>
            <input
              type="checkbox"
              name="confirm"
              value="cancel-future-dates"
              required
            />
            {es
              ? "Cancelar todas las fechas futuras de este evento. Las fechas pasadas se conservan."
              : "Cancel every future date of this event. Past dates are retained."}
          </label>
          <button type="submit" className="button secondary">
            {es ? "Confirmar cancelación" : "Confirm cancellation"}
          </button>
        </form>
      </details>
    </div>
  );
}
