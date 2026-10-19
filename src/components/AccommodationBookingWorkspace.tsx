"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./accommodation-workspace.css";
import { Icon, type IconName } from "./Icons";
import { stayReservationStatusLabel } from "../lib/stay-reservation-status";

type Section = "reservations" | "calendar" | "rooms" | "rates" | "settings";
const sections: { id: Section; icon: IconName; en: string; es: string }[] = [
  { id: "reservations", icon: "inbox", en: "Reservations", es: "Reservas" },
  { id: "calendar", icon: "calendar", en: "Calendar", es: "Calendario" },
  { id: "rooms", icon: "home", en: "Rooms & units", es: "Habitaciones" },
  { id: "rates", icon: "venue", en: "Rates & rules", es: "Tarifas" },
  { id: "settings", icon: "venue", en: "Settings", es: "Ajustes" },
];

export type AccommodationRoomType = {
  id: string;
  name: string;
  max_guests: number;
  active: boolean;
};
export type AccommodationUnit = {
  id: string;
  name: string;
  room_type_id: string;
  active: boolean;
};
export type AccommodationRate = {
  id: string;
  room_type_id: string;
  start_date: string;
  end_date_exclusive: string;
  nightly_price_cents: number;
  minimum_nights: number;
};
export type AccommodationReservation = {
  id: string;
  unit_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  status: string;
  contact_name: string;
  contact_email: string;
  quoted_total_cents: number;
};
export type AccommodationBlock = {
  id: string;
  unit_id: string;
  start_date: string;
  end_date_exclusive: string;
  reason: string;
};
type AccommodationActions = {
  createRoomType: (formData: FormData) => Promise<void>;
  updateRoomType: (formData: FormData) => Promise<void>;
  createUnit: (formData: FormData) => Promise<void>;
  updateUnit: (formData: FormData) => Promise<void>;
  createRate: (formData: FormData) => Promise<void>;
  deleteRate: (formData: FormData) => Promise<void>;
  createBlock: (formData: FormData) => Promise<void>;
  deleteBlock: (formData: FormData) => Promise<void>;
  saveSettings?: (formData: FormData) => Promise<void>;
  changeStatus?: (formData: FormData) => Promise<void>;
};
type AccommodationReadErrors = Partial<
  Record<
    "settings" | "roomTypes" | "units" | "rates" | "reservations" | "blocks",
    boolean
  >
>;

/**
 * This is an actual, keyboard-accessible property management navigation surface,
 * not a booking form. Until room-night persistence is validated it never claims
 * inventory or accepts a reservation.
 */
export function AccommodationBookingWorkspace({
  locale,
  venueId,
  initialTab,
  roomTypes = [],
  units = [],
  rates = [],
  reservations = [],
  blocks = [],
  actions,
  settings = { mode: "disabled", policy: "", external_url: null },
  readErrors = {},
}: {
  locale: "es" | "en";
  venueId: string;
  initialTab?: string;
  roomTypes?: AccommodationRoomType[];
  units?: AccommodationUnit[];
  rates?: AccommodationRate[];
  reservations?: AccommodationReservation[];
  blocks?: AccommodationBlock[];
  actions?: AccommodationActions;
  settings?: {
    mode: string;
    policy: string;
    external_url: string | null;
    notification_email?: string | null;
  };
  readErrors?: AccommodationReadErrors;
}) {
  const es = locale === "es";
  const [active, setActive] = useState<Section>(
    sections.some((section) => section.id === initialTab)
      ? (initialTab as Section)
      : "reservations",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [modeDraft, setModeDraft] = useState(settings.mode);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`akiduermo-inbox-${venueId}`) || "{}",
      );
      const params = new URLSearchParams(location.search);
      setSearch(
        params.get("staySearch") ??
          (typeof saved.search === "string" ? saved.search : ""),
      );
      setStatus(
        params.get("stayStatus") ??
          (typeof saved.status === "string" ? saved.status : ""),
      );
    } catch {}
  }, [venueId]);
  function filter(nextSearch: string, nextStatus: string) {
    setSearch(nextSearch);
    setStatus(nextStatus);
    const url = new URL(location.href);
    url.searchParams.set("staySearch", nextSearch);
    url.searchParams.set("stayStatus", nextStatus);
    history.replaceState(history.state, "", url);
    try {
      localStorage.setItem(
        `akiduermo-inbox-${venueId}`,
        JSON.stringify({ search: nextSearch, status: nextStatus }),
      );
    } catch {}
  }
  const base = `/${locale}/business/venue/${venueId}`;
  const title = sections.find((section) => section.id === active)!;
  const activeRoomTypes = roomTypes.filter((room) => room.active);
  const activeUnits = units.filter((unit) => unit.active);
  const pendingReservations = reservations.filter(
    (reservation) => reservation.status === "requested",
  ).length;
  const filteredReservations = reservations.filter(
    (reservation) =>
      (!status || reservation.status === status) &&
      `${reservation.contact_name} ${reservation.contact_email} ${reservation.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const occupiedUnits = new Set(
    reservations
      .filter((reservation) =>
        ["requested", "confirmed", "checked_in"].includes(reservation.status),
      )
      .map((reservation) => reservation.unit_id),
  ).size;
  const inventoryReady =
    activeRoomTypes.length > 0 && activeUnits.length > 0 && rates.length > 0;
  const inventoryKnown =
    !readErrors.roomTypes && !readErrors.units && !readErrors.rates;
  const activeUnavailable =
    active === "settings"
      ? Boolean(readErrors.settings)
      : active === "rooms"
        ? Boolean(readErrors.roomTypes || readErrors.units)
        : active === "rates"
          ? Boolean(readErrors.rates || readErrors.roomTypes)
          : active === "calendar"
            ? Boolean(readErrors.blocks || readErrors.units)
            : Boolean(readErrors.reservations || readErrors.units);
  const roomName = (id: string) =>
    roomTypes.find((room) => room.id === id)?.name || (es ? "Tipo" : "Type");
  const unitName = (id: string) =>
    units.find((unit) => unit.id === id)?.name || (es ? "Unidad" : "Unit");
  const money = (cents: number) =>
    new Intl.NumberFormat(es ? "es-ES" : "en-GB", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  const copy: Record<Section, [string, string]> = {
    settings: [
      "Booking mode and property terms.",
      "Modo de reserva y condiciones del alojamiento.",
    ],
    reservations: [
      "Confirmed guest records will appear here after the stay engine is enabled.",
      "Los datos de huéspedes confirmados aparecerán aquí cuando se active el motor de alojamientos.",
    ],
    calendar: [
      "Availability will be calculated from real room nights and maintenance blocks. No provisional slots are treated as stays.",
      "La disponibilidad se calculará por noches reales y bloqueos de mantenimiento. Los turnos provisionales no cuentan como estancias.",
    ],
    rooms: [
      "Create room categories and each physical room or apartment before reservations can be accepted.",
      "Crea categorías y cada habitación o apartamento físico antes de aceptar reservas.",
    ],
    rates: [
      "Nightly prices and minimum stays are managed per room category.",
      "Los precios por noche y estancias mínimas se gestionan por categoría.",
    ],
  };
  return (
    <section
      className="panel stack accommodation-booking-workspace"
      aria-label={
        es ? "Gestión de reservas AkiDuermo" : "AkiDuermo booking management"
      }
    >
      <div className="workspace-inline-heading accommodation-app-heading">
        <div>
          <span className="eyebrow">AkiDuermo</span>
          <h2>{es ? "Gestión del alojamiento" : "Property workspace"}</h2>
        </div>
        <Link className="button secondary" href={`${base}?section=profile`}>
          <Icon name="venue" />
          {es ? "Editar ficha" : "Edit listing"}
        </Link>
      </div>
      <div
        className="accommodation-command-strip"
        aria-label={es ? "Resumen del alojamiento" : "Property summary"}
      >
        <div>
          <span>{es ? "Tipos" : "Types"}</span>
          <strong>{readErrors.roomTypes ? "—" : activeRoomTypes.length}</strong>
        </div>
        <div>
          <span>{es ? "Unidades" : "Units"}</span>
          <strong>{readErrors.units ? "—" : activeUnits.length}</strong>
        </div>
        <div>
          <span>{es ? "Ocupadas" : "Occupied"}</span>
          <strong>{readErrors.reservations ? "—" : occupiedUnits}</strong>
        </div>
        <div>
          <span>{es ? "Pendientes" : "Pending"}</span>
          <strong>{readErrors.reservations ? "—" : pendingReservations}</strong>
        </div>
        <div
          className={`accommodation-live-state ${!readErrors.settings && settings.mode === "request" ? "is-live" : ""}`}
        >
          <span>{es ? "Reservas" : "Bookings"}</span>
          <strong>
            {readErrors.settings
              ? es
                ? "No disponible"
                : "Unavailable"
              : settings.mode === "request"
                ? es
                  ? "Activas"
                  : "Live"
                : settings.mode === "external"
                  ? es
                    ? "Externas"
                    : "External"
                  : es
                    ? "Pausadas"
                    : "Paused"}
          </strong>
        </div>
      </div>
      <nav
        className="accommodation-management-tabs"
        aria-label={es ? "Secciones del alojamiento" : "Accommodation sections"}
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={active === section.id ? "button" : "button secondary"}
            aria-current={active === section.id ? "page" : undefined}
            onClick={() => {
              setActive(section.id);
              const url = new URL(window.location.href);
              url.searchParams.set("accommodationTab", section.id);
              window.history.replaceState(window.history.state, "", url);
            }}
          >
            <Icon name={section.icon} />
            {es ? section.es : section.en}
          </button>
        ))}
      </nav>
      <div
        className="accommodation-section-content"
        role="region"
        aria-label={es ? title.es : title.en}
      >
        <div className="accommodation-section-heading">
          <div>
            <h3>{es ? title.es : title.en}</h3>
            <p>{copy[active][es ? 1 : 0]}</p>
          </div>
        </div>
        {activeUnavailable ? (
          <div className="notice" role="alert">
            <strong>
              {es
                ? "No se pudo cargar esta sección"
                : "This section could not be loaded"}
            </strong>{" "}
            <span>
              {es
                ? "Reintenta antes de consultar o cambiar estos datos."
                : "Retry before viewing or changing this data."}
            </span>{" "}
            <Link href={`${base}?section=bookings&accommodationTab=${active}`}>
              {es ? "Reintentar" : "Retry"}
            </Link>
          </div>
        ) : (
          <>
            {inventoryKnown && settings.mode === "disabled" && (
              <div className="notice accommodation-readiness" role="status">
                <Icon name={inventoryReady ? "shield" : "settings"} />
                <div>
                  <strong>
                    {inventoryReady
                      ? es
                        ? "Inventario listo"
                        : "Inventory ready"
                      : es
                        ? "Completa la configuración"
                        : "Finish setup"}
                  </strong>
                  <span>
                    {es
                      ? inventoryReady
                        ? "La protección contra solapamientos está verificada. Activa las solicitudes cuando quieras probar la reserva pública."
                        : "Añade al menos un tipo, una unidad física y una tarifa antes de activar solicitudes."
                      : inventoryReady
                        ? "Overlap protection is verified. Enable requests whenever you are ready to test public booking."
                        : "Add at least one type, physical unit and rate before enabling requests."}
                  </span>
                </div>
              </div>
            )}
            {active === "settings" && actions?.saveSettings && (
              <form
                action={actions.saveSettings}
                className="stack accommodation-settings-app"
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="venueId" value={venueId} />
                <fieldset className="accommodation-mode-picker">
                  <legend>
                    {es
                      ? "¿Cómo quieres recibir reservas?"
                      : "How should guests book?"}
                  </legend>
                  {[
                    {
                      value: "disabled",
                      icon: "close",
                      en: "Paused",
                      es: "Pausadas",
                    },
                    {
                      value: "external",
                      icon: "arrow-right",
                      en: "External site",
                      es: "Web externa",
                    },
                    {
                      value: "request",
                      icon: "calendar",
                      en: "AkiDuermo",
                      es: "AkiDuermo",
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={modeDraft === option.value ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={option.value}
                        checked={modeDraft === option.value}
                        disabled={
                          option.value === "request" &&
                          (!inventoryKnown || !inventoryReady) &&
                          settings.mode !== "request"
                        }
                        onChange={() => setModeDraft(option.value)}
                      />
                      <Icon name={option.icon as IconName} />
                      <strong>{es ? option.es : option.en}</strong>
                    </label>
                  ))}
                </fieldset>
                <div className="accommodation-settings-grid">
                  {modeDraft === "external" && (
                    <label>
                      {es ? "Web de reservas" : "Booking website"}
                      <input
                        name="externalUrl"
                        type="url"
                        required
                        defaultValue={settings.external_url || ""}
                        placeholder="https://"
                      />
                    </label>
                  )}
                  {modeDraft !== "external" && (
                    <input type="hidden" name="externalUrl" value="" />
                  )}
                  <label>
                    {es ? "Correo de avisos" : "Notification email"}
                    <input
                      name="notificationEmail"
                      type="email"
                      defaultValue={settings.notification_email || ""}
                      placeholder="reservas@hotel.com"
                    />
                  </label>
                  {modeDraft === "request" && (
                    <label className="accommodation-policy-field">
                      {es
                        ? "Condiciones y cancelación"
                        : "Terms and cancellation"}
                      <textarea
                        name="policy"
                        maxLength={4000}
                        required
                        defaultValue={settings.policy}
                        placeholder={
                          es
                            ? "Pago en el alojamiento · Cancelación..."
                            : "Pay at property · Cancellation..."
                        }
                      />
                    </label>
                  )}
                  {modeDraft !== "request" && (
                    <input
                      type="hidden"
                      name="policy"
                      value={settings.policy}
                    />
                  )}
                </div>
                <div className="accommodation-save-bar">
                  <small>
                    {es
                      ? "Sin cobros online · Precios con impuestos incluidos"
                      : "No online charge · Rates include taxes"}
                  </small>
                  <button className="button">
                    {es ? "Guardar ajustes" : "Save settings"}
                  </button>
                </div>
              </form>
            )}
            {active === "rooms" && (
              <div className="booking-manager-body">
                <section className="stack">
                  <h4>{es ? "Tipos de habitación" : "Room types"}</h4>
                  {actions && (
                    <details className="accommodation-create-panel">
                      <summary className="button">
                        + {es ? "Nuevo tipo" : "New type"}
                      </summary>
                      <form
                        action={actions.createRoomType}
                        className="compact-action-form booking-manager-form"
                      >
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="venueId" value={venueId} />
                        <label>
                          {es ? "Nombre" : "Name"}
                          <input
                            name="name"
                            required
                            maxLength={120}
                            placeholder={
                              es ? "Doble vista mar" : "Double sea view"
                            }
                          />
                        </label>
                        <label>
                          {es ? "Huéspedes máximos" : "Max guests"}
                          <input
                            name="maxGuests"
                            type="number"
                            min="1"
                            max="30"
                            defaultValue="2"
                            required
                          />
                        </label>
                        <button className="button" type="submit">
                          {es ? "Crear tipo" : "Create type"}
                        </button>
                      </form>
                    </details>
                  )}
                  <div className="booking-list accommodation-card-grid">
                    {roomTypes.map((room) => (
                      <details
                        key={room.id}
                        className="booking-list-card accommodation-manage-card"
                      >
                        <summary>
                          <div>
                            <strong>{room.name}</strong>
                            <small>
                              {room.max_guests} {es ? "huéspedes" : "guests"}
                            </small>
                          </div>
                          <span className="badge">
                            {room.active
                              ? es
                                ? "Activo"
                                : "Active"
                              : es
                                ? "Archivado"
                                : "Archived"}
                          </span>
                        </summary>
                        <form
                          action={actions?.updateRoomType}
                          className="booking-edit-card accommodation-inline-editor"
                        >
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="venueId" value={venueId} />
                          <input
                            type="hidden"
                            name="roomTypeId"
                            value={room.id}
                          />
                          <label>
                            {es ? "Nombre" : "Name"}
                            <input
                              name="name"
                              defaultValue={room.name}
                              required
                              maxLength={120}
                            />
                          </label>
                          <label>
                            {es ? "Huéspedes" : "Guests"}
                            <input
                              name="maxGuests"
                              type="number"
                              min="1"
                              max="30"
                              defaultValue={room.max_guests}
                              required
                            />
                          </label>
                          <label className="toggle-card">
                            <input
                              name="active"
                              type="checkbox"
                              defaultChecked={room.active}
                            />
                            <span>{es ? "Activo" : "Active"}</span>
                          </label>
                          <button
                            className="button secondary"
                            type="submit"
                            disabled={!actions}
                          >
                            {es ? "Guardar" : "Save"}
                          </button>
                        </form>
                      </details>
                    ))}
                    {!roomTypes.length && (
                      <p>{es ? "Aún no hay tipos." : "No room types yet."}</p>
                    )}
                  </div>
                </section>
                <section className="stack">
                  <h4>{es ? "Unidades físicas" : "Physical units"}</h4>
                  {actions && activeRoomTypes.length > 0 && (
                    <details className="accommodation-create-panel">
                      <summary className="button">
                        + {es ? "Nueva unidad" : "New unit"}
                      </summary>
                      <form
                        action={actions.createUnit}
                        className="compact-action-form booking-manager-form"
                      >
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="venueId" value={venueId} />
                        <label>
                          {es ? "Tipo" : "Type"}
                          <select name="roomTypeId">
                            {activeRoomTypes.map((room) => (
                              <option key={room.id} value={room.id}>
                                {room.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {es ? "Nombre de unidad" : "Unit name"}
                          <input
                            name="name"
                            required
                            maxLength={120}
                            placeholder="101"
                          />
                        </label>
                        <button className="button" type="submit">
                          {es ? "Crear unidad" : "Create unit"}
                        </button>
                      </form>
                    </details>
                  )}
                  <div className="booking-list accommodation-card-grid">
                    {units.map((unit) => (
                      <details
                        key={unit.id}
                        className="booking-list-card accommodation-manage-card"
                      >
                        <summary>
                          <div>
                            <strong>{unit.name}</strong>
                            <small>{roomName(unit.room_type_id)}</small>
                          </div>
                          <span className="badge">
                            {unit.active
                              ? es
                                ? "Activo"
                                : "Active"
                              : es
                                ? "Archivado"
                                : "Archived"}
                          </span>
                        </summary>
                        <form
                          action={actions?.updateUnit}
                          className="booking-edit-card accommodation-inline-editor"
                        >
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="venueId" value={venueId} />
                          <input type="hidden" name="unitId" value={unit.id} />
                          <label>
                            {es ? "Tipo" : "Type"}
                            <select
                              name="roomTypeId"
                              defaultValue={unit.room_type_id}
                            >
                              {roomTypes.map((room) => (
                                <option key={room.id} value={room.id}>
                                  {room.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {es ? "Nombre" : "Name"}
                            <input
                              name="name"
                              defaultValue={unit.name}
                              required
                              maxLength={120}
                            />
                          </label>
                          <label className="toggle-card">
                            <input
                              name="active"
                              type="checkbox"
                              defaultChecked={unit.active}
                            />
                            <span>{es ? "Activo" : "Active"}</span>
                          </label>
                          <button
                            className="button secondary"
                            type="submit"
                            disabled={!actions}
                          >
                            {es ? "Guardar" : "Save"}
                          </button>
                        </form>
                      </details>
                    ))}
                    {!units.length && (
                      <p>{es ? "Aún no hay unidades." : "No units yet."}</p>
                    )}
                  </div>
                </section>
              </div>
            )}
            {active === "rates" && (
              <div className="stack">
                {actions && activeRoomTypes.length > 0 && (
                  <details className="accommodation-create-panel">
                    <summary className="button">
                      + {es ? "Nueva tarifa" : "New rate"}
                    </summary>
                    <form
                      action={actions.createRate}
                      className="compact-action-form booking-manager-form"
                    >
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="venueId" value={venueId} />
                      <label>
                        {es ? "Tipo" : "Type"}
                        <select name="roomTypeId">
                          {activeRoomTypes.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {es ? "Desde" : "From"}
                        <input name="startDate" type="date" required />
                      </label>
                      <label>
                        {es ? "Hasta" : "Until"}
                        <input name="endDate" type="date" required />
                      </label>
                      <label>
                        {es ? "Precio/noche (€)" : "Nightly price (€)"}
                        <input
                          name="nightlyPriceEuros"
                          type="number"
                          min="0"
                          max="100000"
                          step="0.01"
                          required
                        />
                      </label>
                      <label>
                        {es ? "Noches mínimas" : "Minimum nights"}
                        <input
                          name="minimumNights"
                          type="number"
                          min="1"
                          max="365"
                          defaultValue="1"
                          required
                        />
                      </label>
                      <button className="button" type="submit">
                        {es ? "Añadir tarifa" : "Add rate"}
                      </button>
                    </form>
                  </details>
                )}
                <div className="booking-list accommodation-card-grid">
                  {rates.map((rate) => (
                    <article key={rate.id} className="booking-list-card">
                      <strong>{roomName(rate.room_type_id)}</strong>
                      <span>
                        {rate.start_date} - {rate.end_date_exclusive}
                      </span>
                      <small>
                        {money(rate.nightly_price_cents)} ·{" "}
                        {rate.minimum_nights}{" "}
                        {es ? "noches mín." : "min nights"}
                      </small>
                      {actions && (
                        <form action={actions.deleteRate}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="venueId" value={venueId} />
                          <input type="hidden" name="rateId" value={rate.id} />
                          <button className="button secondary" type="submit">
                            {es ? "Eliminar" : "Delete"}
                          </button>
                        </form>
                      )}
                    </article>
                  ))}
                  {!rates.length && (
                    <p>{es ? "Aún no hay tarifas." : "No rates yet."}</p>
                  )}
                </div>
              </div>
            )}
            {active === "calendar" && (
              <div className="stack">
                {actions && units.length > 0 && (
                  <details className="accommodation-create-panel">
                    <summary className="button">
                      + {es ? "Bloquear noches" : "Block nights"}
                    </summary>
                    <form
                      action={actions.createBlock}
                      className="compact-action-form booking-manager-form"
                    >
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="venueId" value={venueId} />
                      <label>
                        {es ? "Unidad" : "Unit"}
                        <select name="unitId">
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {es ? "Desde" : "From"}
                        <input name="startDate" type="date" required />
                      </label>
                      <label>
                        {es ? "Hasta" : "Until"}
                        <input name="endDate" type="date" required />
                      </label>
                      <label>
                        {es ? "Motivo" : "Reason"}
                        <input
                          name="reason"
                          maxLength={120}
                          defaultValue="maintenance"
                          required
                        />
                      </label>
                      <button className="button" type="submit">
                        {es ? "Bloquear noches" : "Block nights"}
                      </button>
                    </form>
                  </details>
                )}
                <div className="booking-list accommodation-card-grid">
                  {blocks.map((block) => (
                    <article key={block.id} className="booking-list-card">
                      <strong>{unitName(block.unit_id)}</strong>
                      <span>
                        {block.start_date} - {block.end_date_exclusive}
                      </span>
                      <small>{block.reason}</small>
                      {actions && (
                        <form action={actions.deleteBlock}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="venueId" value={venueId} />
                          <input
                            type="hidden"
                            name="blockId"
                            value={block.id}
                          />
                          <button className="button secondary" type="submit">
                            {es ? "Quitar bloqueo" : "Remove block"}
                          </button>
                        </form>
                      )}
                    </article>
                  ))}
                  {!blocks.length && (
                    <p>{es ? "Sin bloqueos." : "No blocks."}</p>
                  )}
                </div>
              </div>
            )}
            {active === "reservations" && (
              <div className="stack">
                <div className="booking-manager-form">
                  <label>
                    {es ? "Buscar" : "Search"}
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => filter(e.target.value, status)}
                    />
                  </label>
                  <label>
                    {es ? "Estado" : "Status"}
                    <select
                      value={status}
                      onChange={(e) => filter(search, e.target.value)}
                    >
                      <option value="">{es ? "Todos" : "All"}</option>
                      {[
                        "requested",
                        "confirmed",
                        "checked_in",
                        "completed",
                        "cancelled",
                        "declined",
                      ].map((value) => (
                        <option key={value} value={value}>
                          {stayReservationStatusLabel(value, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="booking-list">
                  {filteredReservations.map((reservation) => (
                    <article
                      key={reservation.id}
                      className="booking-list-card stay-reservation-card"
                    >
                      <strong>{reservation.contact_name}</strong>
                      <span>
                        {reservation.check_in} - {reservation.check_out}
                      </span>
                      <small>
                        {unitName(reservation.unit_id)} · {reservation.guests}{" "}
                        {es ? "huéspedes" : "guests"} ·{" "}
                        {money(reservation.quoted_total_cents)}
                      </small>
                      <span className="badge">
                        {stayReservationStatusLabel(reservation.status, locale)}
                      </span>
                      {actions?.changeStatus && (
                        <form action={actions.changeStatus} className="stack">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="venueId" value={venueId} />
                          <input
                            type="hidden"
                            name="reservationId"
                            value={reservation.id}
                          />
                          <div className="button-row">
                            {(reservation.status === "requested"
                              ? ["confirmed", "declined", "cancelled"]
                              : reservation.status === "confirmed"
                                ? ["checked_in", "cancelled"]
                                : reservation.status === "checked_in"
                                  ? ["completed"]
                                  : []
                            ).map((next) => (
                              <button
                                className="button secondary"
                                key={next}
                                name="status"
                                value={next}
                              >
                                {
                                  (
                                    {
                                      confirmed: es ? "Confirmar" : "Confirm",
                                      declined: es ? "Rechazar" : "Decline",
                                      cancelled: es ? "Cancelar" : "Cancel",
                                      checked_in: es ? "Entrada" : "Check in",
                                      completed: es ? "Salida" : "Check out",
                                    } as Record<string, string>
                                  )[next]
                                }
                              </button>
                            ))}
                          </div>
                        </form>
                      )}
                    </article>
                  ))}
                  {!filteredReservations.length && (
                    <p role="status">
                      {reservations.length
                        ? es
                          ? "Ninguna reserva coincide con estos filtros."
                          : "No reservations match these filters."
                        : es
                          ? "Aún no hay reservas de alojamiento."
                          : "No stay reservations yet."}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
