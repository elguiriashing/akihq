"use client";
import { useEffect, useState } from "react";
import { updateRentalBookingStatus } from "@/app/[locale]/business/mobility/actions";
import { useFormStatus } from "react-dom";
import type { DeskBooking } from "./RentalOperatorDesk";
import s from "./RentalBookingsDashboard.module.css";
type Booking = DeskBooking & {
  vehicle?: { name: string } | { name: string }[];
};
type Result = {
  rows: Booking[];
  total: number;
  today: string;
  summary: {
    current: number;
    pending: number;
    pickups: number;
    returns: number;
    upcoming: number;
  };
};
function Decision({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} name="status" value={value}>
      {pending ? "…" : children}
    </button>
  );
}
export function RentalBookingsDashboard({
  locale,
  companyId,
  overview = false,
}: {
  locale: "en" | "es";
  companyId: string;
  overview?: boolean;
}) {
  const es = locale === "es",
    [filter, setFilter] = useState("live"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [result, setResult] = useState<Result | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [selectedId, setSelectedId] = useState(""),
    [detail, setDetail] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(false);
    const timer = setTimeout(
      () => {
        fetch(
          `/api/business/rental-bookings?${new URLSearchParams({ company: companyId, filter, page: String(page), q: query })}`,
          { signal: abort.signal, cache: "no-store" },
        )
          .then(async (r) => {
            if (!r.ok) throw Error();
            const data = await r.json();
            if (!data.rows || !data.summary) throw Error();
            if (!abort.signal.aborted) {
              if (page > 1 && data.total <= (page - 1) * 8) {
                setPage(Math.max(1, Math.ceil(data.total / 8)));
                return;
              }
              setResult(data);
              setLoading(false);
            }
          })
          .catch(() => {
            if (!abort.signal.aborted) {
              setError(true);
              setLoading(false);
            }
          });
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [companyId, filter, page, query, retry]);
  const selected =
    result?.rows.find((b) => b.id === selectedId) || result?.rows[0];
  const labels: Record<string, string> = {
    requested: es ? "Pendiente" : "Pending",
    confirmed: es ? "Confirmada" : "Confirmed",
    declined: es ? "Rechazada" : "Declined",
    cancelled: es ? "Cancelada" : "Cancelled",
    completed: es ? "Completada" : "Completed",
  };
  const name = (b: Booking) => {
    const v = Array.isArray(b.vehicle) ? b.vehicle[0] : b.vehicle;
    return v?.name || "AkiCoches";
  };
  const money = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(n / 100);
  return (
    <section
      className={s.dashboard}
      aria-label={es ? "Resumen de reservas" : "Booking overview"}
    >
      <div className={s.stats}>
        {(
          [
            ["current", es ? "En carretera" : "On the road"],
            ["pending", es ? "Por confirmar" : "Awaiting confirmation"],
            ["pickups", es ? "Recogidas hoy" : "Pick-ups today"],
            ["returns", es ? "Devoluciones hoy" : "Returns today"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setFilter(
                key === "pending"
                  ? "requested"
                  : key === "current"
                    ? "current"
                    : key,
              );
              setPage(1);
            }}
          >
            <strong>{result?.summary[key] ?? "—"}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className={s.title}>
        <div>
          <span>AKICOCHES · {es ? "OPERACIONES" : "OPERATIONS"}</span>
          <h2>
            {overview
              ? es
                ? "Tu sucursal, en marcha"
                : "Your branch, in motion"
              : es
                ? "Reservas"
                : "Bookings"}
          </h2>
        </div>
        <small>
          {loading
            ? es
              ? "Actualizando…"
              : "Updating…"
            : `${result?.total ?? 0} ${es ? "reservas" : "bookings"}`}
        </small>
      </div>
      <div className={s.filters}>
        <select
          aria-label={es ? "Vista de reservas" : "Booking view"}
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
            setDetail(false);
          }}
        >
          {[
            ["live", es ? "Reservas activas" : "Live bookings"],
            ["current", es ? "En carretera ahora" : "Currently on the road"],
            ["upcoming", es ? "Próximas recogidas" : "Upcoming pick-ups"],
            ["requested", es ? "Solicitudes pendientes" : "Pending requests"],
            ["history", es ? "Historial" : "History"],
            ["pickups", es ? "Recogidas hoy" : "Pick-ups today"],
            ["returns", es ? "Devoluciones hoy" : "Returns today"],
            ["all", es ? "Todas las reservas" : "All bookings"],
          ].map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          placeholder={es ? "Buscar cliente…" : "Search customer…"}
          aria-label={es ? "Buscar cliente" : "Search customer"}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <button
          onClick={() => setRetry((n) => n + 1)}
          aria-label={es ? "Actualizar reservas" : "Refresh bookings"}
        >
          ↻
        </button>
      </div>
      {error ? (
        <div role="alert" className={s.empty}>
          <h3>
            {es
              ? "No se pudieron cargar las reservas"
              : "Bookings could not be loaded"}
          </h3>
          <button onClick={() => setRetry((n) => n + 1)}>
            {es ? "Reintentar" : "Retry"}
          </button>
        </div>
      ) : (
        <div className={s.body} data-detail={detail} aria-busy={loading}>
          <div className={s.list}>
            {!loading && !result?.rows.length && (
              <div className={s.empty}>
                <h3>{es ? "Todo al día" : "All caught up"}</h3>
                <p>
                  {es
                    ? "No hay reservas en esta vista. Puedes revisar las solicitudes o el historial."
                    : "No bookings in this view. Check pending requests or history."}
                </p>
              </div>
            )}
            {result?.rows.map((b) => (
              <button
                key={b.id}
                className={s.row}
                aria-pressed={selected?.id === b.id}
                disabled={loading}
                onClick={() => {
                  setSelectedId(b.id);
                  setDetail(true);
                }}
              >
                <span className={s.date}>
                  {b.start_date.slice(8)}
                  <small>{b.start_date.slice(5, 7)}</small>
                </span>
                <span>
                  <strong>{name(b)}</strong>
                  <span>{b.contact_name}</span>
                  <small>
                    {b.start_date} → {b.end_date}
                  </small>
                </span>
                <span className={s.state}>
                  {labels[b.status] || b.status}
                  <small>{money(b.quoted_total_cents)}</small>
                </span>
              </button>
            ))}
            <div className={s.pager}>
              <button
                disabled={loading || page <= 1}
                onClick={() => {
                  setPage((p) => p - 1);
                  setDetail(false);
                }}
              >
                ←
              </button>
              <span>
                {page}/{Math.max(1, Math.ceil((result?.total || 0) / 8))}
              </span>
              <button
                disabled={loading || page * 8 >= (result?.total || 0)}
                onClick={() => {
                  setPage((p) => p + 1);
                  setDetail(false);
                }}
              >
                →
              </button>
            </div>
          </div>
          {selected && !loading && (
            <article className={s.detail}>
              <button
                type="button"
                className={s.back}
                onClick={() => setDetail(false)}
              >
                ← {es ? "Reservas" : "Bookings"}
              </button>
              <span className={s.ref}>
                #{selected.id.slice(0, 8)} · {labels[selected.status]}
              </span>
              <h3>{selected.contact_name}</h3>
              <strong>{name(selected)}</strong>
              <div className={s.dates}>
                <span>
                  {es ? "Recogida" : "Pick-up"}
                  <strong>{selected.start_date}</strong>
                </span>
                <span>
                  {es ? "Devolución" : "Drop-off"}
                  <strong>{selected.end_date}</strong>
                </span>
              </div>
              <dl>
                <dt>Email</dt>
                <dd>
                  {selected.contact_email ? (
                    <a href={`mailto:${selected.contact_email}`}>
                      {selected.contact_email}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>{es ? "Teléfono" : "Phone"}</dt>
                <dd>
                  {selected.contact_phone ? (
                    <a href={`tel:${selected.contact_phone}`}>
                      {selected.contact_phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>{es ? "Mensaje" : "Message"}</dt>
                <dd>{selected.note || (es ? "Sin mensaje" : "No message")}</dd>
                <dt>{es ? "Total cotizado" : "Quoted total"}</dt>
                <dd>{money(selected.quoted_total_cents)}</dd>
              </dl>
              {["requested", "confirmed"].includes(selected.status) && (
                <form action={updateRentalBookingStatus} className={s.actions}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="bookingId" value={selected.id} />
                  <input type="hidden" name="tab" value="bookings" />
                  {selected.status === "requested" ? (
                    <>
                      <Decision value="confirmed">
                        {es ? "Confirmar" : "Confirm"}
                      </Decision>
                      <Decision value="declined">
                        {es ? "Rechazar" : "Decline"}
                      </Decision>
                    </>
                  ) : (
                    <>
                      {selected.end_date <= (result?.today || "") && (
                        <Decision value="completed">
                          {es ? "Marcar devuelto" : "Mark returned"}
                        </Decision>
                      )}
                      <Decision value="cancelled">
                        {es ? "Cancelar reserva" : "Cancel booking"}
                      </Decision>
                    </>
                  )}
                </form>
              )}
              <small>
                {es
                  ? "Las actualizaciones se notifican por email a ambas partes."
                  : "Updates are emailed to both parties."}
              </small>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
