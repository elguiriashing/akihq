"use client";

import { managementProduct } from "@/lib/product-roles";

import Image from "next/image";
import { RentalBookingsDashboard } from "./RentalBookingsDashboard";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ThemeToggle } from "./ThemeModeControls";
import { rentalCategoryLabels } from "@/lib/akiconduzco";
import s from "./RentalOperatorDesk.module.css";

type Action = (data: FormData) => void | Promise<void>;
export type DeskVehicle = {
  id: string;
  name: string;
  category: keyof typeof rentalCategoryLabels;
  transmission: string;
  fuel: string;
  seats: number;
  luggage: number;
  daily_price_cents: number;
  deposit_cents: number;
  rental_media_id?: string | null;
  image_url?: string | null;
  active: boolean;
};
export type DeskBooking = {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  status: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string | null;
  note?: string | null;
  quoted_total_cents: number;
};
export type DeskBlock = {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  reason: string;
};
type Props = {
  locale: "en" | "es";
  venueId?: string;
  initialTab?: string;
  branches?: { id: string; name: string }[];
  company: {
    id: string;
    name: string;
    status: string;
    slug?: string;
    city?: string;
    address?: string;
  };
  vehicles: DeskVehicle[];
  bookings: DeskBooking[];
  blocks: DeskBlock[];
  media?: { id: string; alt: string; url?: string }[];
  mediaStudio?: ReactNode;
  companyTools?: ReactNode;
  feedback?: "error" | "success";
  readError?: boolean;
  actions: {
    create: Action;
    update: Action;
    block: Action;
    booking: Action;
    removeBlock?: Action;
  };
};
function SaveButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className={s.primary} type="submit" disabled={pending}>
      {pending ? "…" : children}
    </button>
  );
}

export function RentalOperatorDesk({
  locale,
  venueId,
  initialTab,
  branches = [],
  company,
  vehicles,
  bookings,
  blocks,
  media = [],
  mediaStudio,
  companyTools,
  feedback,
  readError,
  actions,
}: Props) {
  const es = locale === "es";
  const [tab, setTab] = useState<
    | "overview"
    | "bookings"
    | "fleet"
    | "availability"
    | "requests"
    | "media"
    | "company"
  >(
    initialTab === "company" ||
      initialTab === "media" ||
      initialTab === "bookings"
      ? initialTab
      : branches.length
        ? "overview"
        : "fleet",
  );
  const [selectedId, setSelectedId] = useState(vehicles[0]?.id || "");
  const [adding, setAdding] = useState(false);
  const [mobileEditor, setMobileEditor] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [requestPage, setRequestPage] = useState(0);
  const [requestFilter, setRequestFilter] = useState("requested");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const selected = vehicles.find((v) => v.id === selectedId) || vehicles[0];
  const filtered = vehicles.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 4));
  const currentPage = Math.min(page, pages - 1);
  const requests = bookings.filter(
    (b) => requestFilter === "all" || b.status === requestFilter,
  );
  const requestPages = Math.max(1, Math.ceil(requests.length / 3));
  const [year, m] = month.split("-").map(Number);
  const day = (n: number) =>
    new Date(Date.UTC(year, m - 1, n)).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const carImage =
    selected &&
    (media.find((i) => i.id === selected.rental_media_id)?.url ||
      selected.image_url);
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  function fields(vehicleId?: string) {
    return (
      <>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="companyId" value={company.id} />
        {venueId && <input type="hidden" name="venueId" value={venueId} />}
        <input
          type="hidden"
          name="vehicleId"
          value={vehicleId || selected?.id || ""}
        />
      </>
    );
  }
  const categories = (
    <>
      {Object.entries(rentalCategoryLabels).map(([id, label]) => (
        <option key={id} value={id}>
          {label[locale]}
        </option>
      ))}
    </>
  );
  const editor = (create: boolean) => (
    <form
      key={create ? "new" : selected?.id}
      action={create ? actions.create : actions.update}
      className={s.editor}
    >
      {fields()}
      <h2>
        {create
          ? es
            ? "Nuevo vehículo"
            : "New vehicle"
          : es
            ? "Editar vehículo"
            : "Edit vehicle"}
      </h2>
      <details open={create} className={s.vehicleDetails}>
        <summary>{es ? "Detalles del vehículo" : "Vehicle details"}</summary>
        <>
          <label>
            {es ? "Modelo / nombre" : "Model / name"}
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="Toyota Yaris"
              defaultValue={create ? "" : selected?.name}
            />
          </label>
          <div className={s.two}>
            <label>
              {es ? "Categoría" : "Category"}
              <select
                name="category"
                defaultValue={create ? "economy" : selected?.category}
              >
                {categories}
              </select>
            </label>
            <label>
              {es ? "Cambio" : "Transmission"}
              <select
                name="transmission"
                defaultValue={create ? "manual" : selected?.transmission}
              >
                <option value="manual">Manual</option>
                <option value="automatic">
                  {es ? "Automático" : "Automatic"}
                </option>
              </select>
            </label>
          </div>
          <div className={s.three}>
            <label>
              {es ? "Plazas" : "Seats"}
              <input
                name="seats"
                type="number"
                min={2}
                max={9}
                defaultValue={create ? 5 : selected?.seats}
                required
              />
            </label>
            <label>
              {es ? "Maletas" : "Bags"}
              <input
                name="luggage"
                type="number"
                min={0}
                max={12}
                defaultValue={create ? 2 : selected?.luggage}
                required
              />
            </label>
            <label>
              {es ? "Motor" : "Fuel"}
              <select
                name="fuel"
                defaultValue={create ? "petrol" : selected?.fuel}
              >
                <option value="petrol">{es ? "Gasolina" : "Petrol"}</option>
                <option value="diesel">Diésel</option>
                <option value="hybrid">{es ? "Híbrido" : "Hybrid"}</option>
                <option value="electric">
                  {es ? "Eléctrico" : "Electric"}
                </option>
                <option value="other">{es ? "Otro" : "Other"}</option>
              </select>
            </label>
          </div>
        </>
      </details>
      <div className={s.two}>
        <label>
          {es ? "Precio / día (€)" : "Daily rate (€)"}
          <input
            name="dailyPrice"
            type="number"
            min={1}
            max={10000}
            defaultValue={
              create ? undefined : (selected?.daily_price_cents || 0) / 100
            }
            required
          />
        </label>
        <label>
          {es ? "Fianza (€)" : "Deposit (€)"}
          <input
            name="deposit"
            type="number"
            min={0}
            max={50000}
            defaultValue={create ? 0 : (selected?.deposit_cents || 0) / 100}
            required
          />
        </label>
      </div>
      {
        <label>
          {es ? "Portada del vehículo" : "Vehicle cover"}
          <select
            name="coverMediaId"
            defaultValue={create ? "" : selected?.rental_media_id || ""}
          >
            <option value="">{es ? "Sin foto" : "No photo"}</option>
            {media.map((i) => (
              <option key={i.id} value={i.id}>
                {i.alt}
              </option>
            ))}
          </select>
        </label>
      }
      {!create && (
        <label>
          {es ? "Visibilidad" : "Visibility"}
          <select name="active" defaultValue={String(selected?.active)}>
            <option value="true">{es ? "Publicado" : "Visible"}</option>
            <option value="false">{es ? "Oculto" : "Hidden"}</option>
          </select>
        </label>
      )}
      <SaveButton>
        {create
          ? es
            ? "Añadir a la flota"
            : "Add to fleet"
          : es
            ? "Guardar cambios"
            : "Save changes"}
      </SaveButton>
      {create && (
        <button
          type="button"
          className={s.secondary}
          onClick={() => setAdding(false)}
        >
          {es ? "Cancelar" : "Cancel"}
        </button>
      )}
    </form>
  );
  return (
    <section
      className={s.desk}
      aria-label={es ? "Panel de alquiler" : "Rental desk"}
    >
      <header className={s.header}>
        <Link className={s.back} href={`/${locale}/business`}>
          ← {managementProduct.name}
        </Link>
        <div className={s.brand}>
          Aki<span>Coches</span>
          <small>RENTAL DESK</small>
        </div>
        {company.slug && company.status === "published" && (
          <a
            href={`https://akicoches.com/rentals/${company.slug}?lang=${locale}`}
            className={s.public}
            target="_blank"
            rel="noreferrer"
          >
            {es ? "Ver empresa" : "View company"} ↗
          </a>
        )}
        <div className={s.controls}>
          <ThemeToggle locale={locale} />
          <button
            type="button"
            aria-label={es ? "Switch to English" : "Cambiar a español"}
            onClick={() =>
              location.assign(
                location.pathname.replace(
                  /^\/(en|es)(?=\/|$)/,
                  es ? "/en" : "/es",
                ) + location.search,
              )
            }
          >
            {es ? "EN" : "ES"}
          </button>
        </div>
      </header>
      <div className={s.identity}>
        <div className={s.avatar}>{company.name.slice(0, 1)}</div>
        <div>
          <span className={s.eyebrow}>{company.city || "AKIBUSINESS"}</span>
          <h1>{company.name}</h1>
        </div>
        {branches.length > 0 && (
          <select
            className={s.branchSelect}
            aria-label={es ? "Cambiar sucursal" : "Switch branch"}
            value={company.id}
            onChange={(e) =>
              location.assign(
                `/${locale}/business/mobility?company=${e.target.value}`,
              )
            }
          >
            {branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <span className={s.status}>
          {company.status === "published"
            ? es
              ? "En directo"
              : "Live"
            : es
              ? "Sin publicar"
              : "Not published"}
        </span>
        <div className={s.metrics}>
          <span>
            <strong>{vehicles.length}</strong>
            {es ? "coches" : "cars"}
          </span>
          <span>
            <strong>
              {bookings.filter((b) => b.status === "requested").length}
            </strong>
            {es ? "pendientes" : "pending"}
          </span>
        </div>
      </div>
      <nav
        className={s.nav}
        aria-label={es ? "Herramientas de alquiler" : "Rental tools"}
      >
        {(
          [
            ["overview", es ? "Resumen" : "Overview"],
            ["bookings", es ? "Reservas" : "Bookings"],
            ["fleet", es ? "Flota" : "Fleet"],
            ["availability", es ? "Disponibilidad" : "Availability"],
            ["requests", es ? "Solicitudes" : "Requests"],
            ["media", es ? "Media" : "Media"],
            ["company", es ? "Empresa" : "Company"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => {
              setTab(id);
              setAdding(false);
            }}
          >
            {label}
            {id === "requests" && (
              <small>
                {bookings.filter((b) => b.status === "requested").length}
              </small>
            )}
          </button>
        ))}
      </nav>
      {(feedback || readError) && (
        <p
          className={s.notice}
          role={feedback === "error" || readError ? "alert" : "status"}
        >
          {feedback === "error" || readError
            ? es
              ? "No se pudo cargar o guardar toda la información. Reintenta antes de gestionar solicitudes."
              : "Some data could not load or save. Retry before managing requests."
            : es
              ? "Cambios guardados."
              : "Changes saved."}
        </p>
      )}
      <fieldset className={s.content} disabled={readError}>
        {(tab === "overview" || tab === "bookings") && (
          <RentalBookingsDashboard
            locale={locale}
            companyId={company.id}
            overview={tab === "overview"}
          />
        )}
        {tab === "fleet" && (
          <div className={s.split} data-editor={adding || mobileEditor}>
            <section className={s.fleet}>
              <div className={s.sectionHead}>
                <h2>{es ? "Tu flota" : "Your fleet"}</h2>
                <button
                  className={s.primary}
                  onClick={() => {
                    setAdding(true);
                    setMobileEditor(true);
                  }}
                >
                  + {es ? "Añadir" : "Add car"}
                </button>
              </div>
              <input
                className={s.search}
                aria-label={es ? "Buscar vehículo" : "Search vehicles"}
                placeholder={es ? "Buscar modelo…" : "Search model…"}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
              <div className={s.carList}>
                {filtered
                  .slice(currentPage * 4, currentPage * 4 + 4)
                  .map((v) => {
                    const image =
                      media.find((i) => i.id === v.rental_media_id)?.url ||
                      v.image_url;
                    return (
                      <button
                        className={s.car}
                        key={v.id}
                        aria-pressed={!adding && selected?.id === v.id}
                        onClick={() => {
                          setSelectedId(v.id);
                          setAdding(false);
                          setMobileEditor(true);
                        }}
                      >
                        <span className={s.thumb}>
                          {image ? (
                            <Image
                              src={image}
                              alt=""
                              fill
                              unoptimized
                              sizes="90px"
                            />
                          ) : (
                            "↗"
                          )}
                        </span>
                        <span>
                          <strong>{v.name}</strong>
                          <small>
                            {rentalCategoryLabels[v.category]?.[locale]} ·{" "}
                            {v.active
                              ? es
                                ? "Visible"
                                : "Visible"
                              : es
                                ? "Oculto"
                                : "Hidden"}
                          </small>
                        </span>
                        <b>
                          {money(v.daily_price_cents)}
                          <small>/{es ? "día" : "day"}</small>
                        </b>
                      </button>
                    );
                  })}
                {!filtered.length && (
                  <div className={s.empty}>
                    <h3>
                      {es
                        ? "La próxima aventura empieza aquí"
                        : "The next adventure starts here"}
                    </h3>
                    <p>
                      {es
                        ? "Añade un vehículo para preparar tu flota."
                        : "Add a vehicle to build your fleet."}
                    </p>
                  </div>
                )}
              </div>
              <div className={s.pagination}>
                <button
                  disabled={!currentPage}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ←
                </button>
                <span>
                  {currentPage + 1}/{pages}
                </span>
                <button
                  disabled={currentPage === pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            </section>
            <section className={s.detail}>
              <button
                className={s.mobileBack}
                onClick={() => {
                  setMobileEditor(false);
                  setAdding(false);
                }}
              >
                ← {es ? "Volver a la flota" : "Back to fleet"}
              </button>
              {adding || !selected ? (
                editor(true)
              ) : (
                <>
                  <div className={s.photo}>
                    {carImage ? (
                      <Image
                        src={carImage}
                        alt={selected.name}
                        fill
                        unoptimized
                        sizes="45vw"
                      />
                    ) : (
                      <div>
                        <span>↗</span>
                        <small>
                          {es
                            ? "Tu coche, en primer plano"
                            : "Your car, in the spotlight"}
                        </small>
                      </div>
                    )}
                    <strong>{selected.name}</strong>
                  </div>
                  <div className={s.specs}>
                    {selected.seats} {es ? "plazas" : "seats"} ·{" "}
                    {selected.transmission} · {selected.luggage}{" "}
                    {es ? "maletas" : "bags"}
                  </div>
                  {editor(false)}
                </>
              )}
            </section>
          </div>
        )}
        {tab === "availability" && (
          <div className={s.split}>
            <section className={s.fleet}>
              <div className={s.sectionHead}>
                <h2>{es ? "Calendario de flota" : "Fleet calendar"}</h2>
              </div>
              <label>
                {es ? "Vehículo" : "Vehicle"}
                <select
                  value={selected?.id || ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={s.calendar}>
                <header>
                  <button
                    onClick={() =>
                      setMonth(
                        new Date(Date.UTC(year, m - 2, 1))
                          .toISOString()
                          .slice(0, 7),
                      )
                    }
                    disabled={month <= today.slice(0, 7)}
                    aria-label={es ? "Mes anterior" : "Previous month"}
                  >
                    ←
                  </button>
                  <strong>
                    {new Intl.DateTimeFormat(locale, {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${month}-01T00:00:00Z`))}
                  </strong>
                  <button
                    onClick={() =>
                      setMonth(
                        new Date(Date.UTC(year, m, 1))
                          .toISOString()
                          .slice(0, 7),
                      )
                    }
                    aria-label={es ? "Mes siguiente" : "Next month"}
                  >
                    →
                  </button>
                </header>
                <div className={s.days}>
                  {(es
                    ? ["L", "M", "X", "J", "V", "S", "D"]
                    : ["M", "T", "W", "T", "F", "S", "S"]
                  ).map((d, i) => (
                    <small key={i}>{d}</small>
                  ))}
                  {Array.from(
                    {
                      length:
                        (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) %
                        7,
                    },
                    (_, i) => (
                      <span key={`b${i}`} />
                    ),
                  )}
                  {Array.from(
                    { length: new Date(Date.UTC(year, m, 0)).getUTCDate() },
                    (_, i) => {
                      const blocked = blocks.some(
                        (b) =>
                          b.vehicle_id === selected?.id &&
                          b.start_date <= day(i + 1) &&
                          b.end_date > day(i + 1),
                      );
                      return (
                        <span key={i} data-blocked={blocked}>
                          {i + 1}
                        </span>
                      );
                    },
                  )}
                </div>
                <p>
                  {es
                    ? "Rojo: no disponible · La devolución es exclusiva"
                    : "Red: unavailable · Drop-off date is exclusive"}
                </p>
              </div>
            </section>
            <section className={s.detail}>
              <form action={actions.block} className={s.editor}>
                {fields()}
                <span className={s.eyebrow}>{selected?.name || "FLEET"}</span>
                <h2>{es ? "Bloquear fechas" : "Block dates"}</h2>
                <p>
                  {es
                    ? "Mantenimiento, uso interno o días sin alquiler."
                    : "Maintenance, internal use or days off the road."}
                </p>
                <div className={s.two}>
                  <label>
                    {es ? "Desde" : "From"}
                    <input type="date" name="start" required min={today} />
                  </label>
                  <label>
                    {es ? "Hasta (exclusivo)" : "Until (exclusive)"}
                    <input type="date" name="end" required min={today} />
                  </label>
                </div>
                <SaveButton>{es ? "Guardar bloqueo" : "Save block"}</SaveButton>
              </form>
              <div className={s.blockList}>
                {blocks
                  .filter(
                    (b) =>
                      b.vehicle_id === selected?.id &&
                      b.reason === "maintenance",
                  )
                  .slice(0, 6)
                  .map((b) => (
                    <form
                      key={b.id}
                      action={actions.removeBlock}
                      className={s.blockRow}
                    >
                      <span>
                        {b.start_date} → {b.end_date}
                      </span>
                      {actions.removeBlock && (
                        <>
                          {fields(b.vehicle_id)}
                          <input type="hidden" name="blockId" value={b.id} />
                          <SaveButton>
                            {es ? "Reabrir fechas" : "Reopen dates"}
                          </SaveButton>
                        </>
                      )}
                    </form>
                  ))}
              </div>
            </section>
          </div>
        )}
        {tab === "requests" && (
          <section className={s.inbox}>
            <div className={s.sectionHead}>
              <h2>{es ? "Bandeja de solicitudes" : "Rental requests"}</h2>
              <select
                aria-label={es ? "Estado de solicitud" : "Request status"}
                value={requestFilter}
                onChange={(e) => {
                  setRequestFilter(e.target.value);
                  setRequestPage(0);
                }}
              >
                {[
                  "requested",
                  "confirmed",
                  "declined",
                  "cancelled",
                  "completed",
                  "all",
                ].map((id) => (
                  <option key={id} value={id}>
                    {
                      (
                        {
                          requested: es ? "Pendientes" : "Pending",
                          confirmed: es ? "Confirmadas" : "Confirmed",
                          declined: es ? "Rechazadas" : "Declined",
                          cancelled: es ? "Canceladas" : "Cancelled",
                          completed: es ? "Completadas" : "Completed",
                          all: es ? "Todas" : "All",
                        } as Record<string, string>
                      )[id]
                    }
                  </option>
                ))}
              </select>
            </div>
            <div className={s.requests}>
              {requests
                .slice(
                  Math.min(requestPage, requestPages - 1) * 3,
                  Math.min(requestPage, requestPages - 1) * 3 + 3,
                )
                .map((b) => (
                  <article key={b.id} className={s.request}>
                    <div>
                      <span className={s.eyebrow}>
                        {vehicles.find((v) => v.id === b.vehicle_id)?.name}
                      </span>
                      <h3>{b.contact_name}</h3>
                      <p>
                        {b.start_date} → {b.end_date} ·{" "}
                        {money(b.quoted_total_cents)}
                      </p>
                      {b.contact_email && (
                        <a href={`mailto:${b.contact_email}`}>
                          {b.contact_email}
                        </a>
                      )}
                      {b.contact_phone && <span>{b.contact_phone}</span>}
                      {b.note && <p>{b.note}</p>}
                    </div>
                    {["requested", "confirmed"].includes(b.status) && (
                      <form action={actions.booking}>
                        {fields(b.vehicle_id)}
                        <input type="hidden" name="bookingId" value={b.id} />
                        {b.status === "requested" ? (
                          <>
                            <button
                              type="submit"
                              name="status"
                              value="confirmed"
                              className={s.primary}
                            >
                              {es ? "Confirmar" : "Confirm"}
                            </button>
                            <button
                              type="submit"
                              name="status"
                              value="declined"
                              className={s.secondary}
                            >
                              {es ? "Rechazar" : "Decline"}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="submit"
                              name="status"
                              value="completed"
                              className={s.primary}
                            >
                              {es ? "Completar" : "Complete"}
                            </button>
                            <button
                              type="submit"
                              name="status"
                              value="cancelled"
                              className={s.secondary}
                            >
                              {es ? "Cancelar" : "Cancel"}
                            </button>
                          </>
                        )}
                      </form>
                    )}
                  </article>
                ))}
              {!requests.length && (
                <div className={s.empty}>
                  <span>✓</span>
                  <h3>{es ? "Todo al día" : "All caught up"}</h3>
                  <p>
                    {es
                      ? "No hay solicitudes en este estado."
                      : "No requests with this status."}
                  </p>
                </div>
              )}
            </div>
            <div className={s.pagination}>
              <button
                disabled={!requestPage}
                onClick={() => setRequestPage((p) => p - 1)}
              >
                ←
              </button>
              <span>
                {Math.min(requestPage + 1, requestPages)}/{requestPages}
              </span>
              <button
                disabled={requestPage >= requestPages - 1}
                onClick={() => setRequestPage((p) => p + 1)}
              >
                →
              </button>
            </div>
          </section>
        )}
        {tab === "media" && (
          <section className={s.media}>
            <div className={s.sectionHead}>
              <div>
                <span className={s.eyebrow}>
                  {es
                    ? "LA PRIMERA IMPRESIÓN CUENTA"
                    : "MAKE A GREAT FIRST IMPRESSION"}
                </span>
                <h2>
                  {es ? "El escaparate de tu flota" : "Your fleet's showroom"}
                </h2>
              </div>
            </div>
            {mediaStudio || (
              <p>
                {es
                  ? "La biblioteca de esta sucursal está vacía."
                  : "This branch library is empty."}
              </p>
            )}
          </section>
        )}
        {tab === "company" && (
          <section className={s.company}>
            <span className={s.eyebrow}>AKIFAMILY · RENTAL BRANCH</span>
            <h2>{es ? "Perfil de la sucursal" : "Branch profile"}</h2>
            {companyTools || (
              <p>
                {es
                  ? "Esta sucursal tiene su propio perfil, ubicación y biblioteca."
                  : "This branch has its own profile, location and library."}
              </p>
            )}
            <Link
              href={`/${locale}/business/mobility?new=1`}
              className={s.secondary}
            >
              {es ? "Añadir otra sucursal" : "Add another branch"} ↗
            </Link>
          </section>
        )}
      </fieldset>
    </section>
  );
}
