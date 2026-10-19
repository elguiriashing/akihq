"use client";

import { managementProduct } from "@/lib/product-roles";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "./Icons";
import { bookingTab } from "../lib/booking-ui";
import {
  BOOKING_INBOX_PAGE_SIZE,
  bookingInboxHref,
  bookingInboxStatuses,
  type BookingInboxFilters,
} from "../lib/business-booking-inbox";

type Mode = "external" | "request" | "disabled";
type Settings = {
  mode?: string | null;
  external_url?: string | null;
  booking_template?: string | null;
  notification_email?: string | null;
  requires_deposit?: boolean | null;
  deposit_cents?: number | null;
  instructions_es?: string | null;
  instructions_en?: string | null;
} | null;

const templates: ReadonlyArray<readonly [string, IconName, string, string]> = [
  ["dining", "venue", "Tables & dining", "Mesas y restaurantes"],
  ["experience", "discover", "Tours & experiences", "Tours y experiencias"],
  ["resource", "calendar", "Facilities & rentals", "Instalaciones y alquiler"],
  ["appointment", "calendar", "Appointments", "Citas y servicios"],
  ["ticket", "membership", "Events & tickets", "Eventos y entradas"],
  ["class", "users", "Classes & activities", "Clases y actividades"],
  ["stay", "home", "Overnight stays", "Alojamientos"],
];

export function BookingManager({
  locale,
  venueId,
  settings,
  slots,
  resources,
  offerings,
  requests,
  save,
  createSlot,
  createRecurringSlots,
  createResource,
  createOffering,
  updateOffering,
  updateRequest,
  initialTab,
  notifications = [],
  emailConfigured = false,
  retryEmails,
  inbox,
}: {
  inbox?: BookingInboxFilters & {
    total: number;
    pending: number;
    error?: boolean;
    notificationError?: boolean;
  };
  initialTab?: string;
  notifications?: Array<{
    booking_id: string;
    audience: string;
    status: string;
    last_error?: string | null;
  }>;
  emailConfigured?: boolean;
  retryEmails?: (form: FormData) => Promise<void>;
  locale: "es" | "en";
  venueId: string;
  settings: Settings;
  slots: Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    capacity: number;
    active: boolean;
    resource_id?: string | null;
    offering_id?: string | null;
  }>;
  resources: Array<{
    id: string;
    name: string;
    kind: string;
    capacity: number;
    active: boolean;
  }>;
  offerings: Array<{
    id: string;
    name: string;
    kind: string;
    duration_minutes: number;
    capacity: number;
    active: boolean;
  }>;
  requests: Array<{
    id: string;
    contact_name: string;
    contact_email: string;
    contact_phone?: string | null;
    notes?: string | null;
    party_size: number;
    status: string;
    created_at: string;
    slot_id?: string | null;
    venue_availability_slots?: {
      starts_at: string;
      ends_at: string;
      offering_id?: string | null;
    } | null;
  }>;
  save: (formData: FormData) => Promise<void>;
  createSlot: (formData: FormData) => Promise<void>;
  createRecurringSlots: (formData: FormData) => Promise<void>;
  createResource: (formData: FormData) => Promise<void>;
  createOffering: (formData: FormData) => Promise<void>;
  updateOffering: (formData: FormData) => Promise<void>;
  updateRequest: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const es = locale === "es";
  const [mode, setMode] = useState<Mode>(
    settings?.mode === "request" || settings?.mode === "disabled"
      ? (settings.mode as Mode)
      : "external",
  );
  const [section, setSection] = useState<
    "setup" | "offerings" | "resources" | "calendar" | "inbox"
  >(bookingTab(initialTab));
  const [showResources, setShowResources] = useState(false);
  const [editingOffering, setEditingOffering] = useState<string | null>(null);
  const [template, setTemplate] = useState(
    settings?.booking_template || "experience",
  );
  React.useEffect(() => {
    const tab = bookingTab(
      initialTab ||
        new URLSearchParams(window.location.search).get("bookingTab"),
    );
    setSection(tab === "resources" ? "offerings" : tab);
    setShowResources(tab === "resources");
  }, [initialTab]);
  const statusText: Record<string, string> = {
    requested: es ? "Pendiente" : "Pending",
    confirmed: es ? "Confirmada" : "Confirmed",
    declined: es ? "Rechazada" : "Declined",
    cancelled: es ? "Cancelada" : "Cancelled",
    completed: es ? "Completada" : "Completed",
  };
  const resourceText: Record<string, string> = es
    ? {
        table: "Mesa",
        staff: "Personal",
        vehicle: "Vehículo",
        equipment: "Equipo",
        court: "Pista",
        room: "Habitación",
        other: "Otro",
      }
    : {};
  const mailText: Record<string, string> = {
    pending: es ? "En cola" : "Queued",
    sending: es ? "Enviando" : "Sending",
    sent: es ? "Enviado al proveedor" : "Submitted to provider",
    failed: es ? "Reintento pendiente" : "Retry pending",
    blocked: es ? "Falta email del local" : "Venue email missing",
    review: es ? "Requiere revisión" : "Needs review",
    cancelled: es ? "Cancelado" : "Cancelled",
  };
  const pending =
    inbox?.pending ?? requests.filter((r) => r.status === "requested").length;
  const inboxFilters = inbox || {
    search: "",
    status: "all" as const,
    sort: "newest" as const,
    page: 1,
  };
  const total = inbox?.total ?? requests.length;
  const pages = Math.max(1, Math.ceil(total / BOOKING_INBOX_PAGE_SIZE));
  const inboxHref = (page: number) =>
    bookingInboxHref(locale, venueId, { ...inboxFilters, page });
  const applyInboxFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const statusValue = String(form.get("bookingStatus") || "all");
    const sortValue = String(form.get("bookingSort") || "newest");
    router.push(
      bookingInboxHref(locale, venueId, {
        search: String(form.get("bookingSearch") || ""),
        status: bookingInboxStatuses.includes(
          statusValue as (typeof bookingInboxStatuses)[number],
        )
          ? (statusValue as (typeof bookingInboxStatuses)[number])
          : "all",
        sort: sortValue === "oldest" ? "oldest" : "newest",
        page: 1,
      }),
      { scroll: false },
    );
  };
  return (
    <section
      className="panel booking-workbench booking-hub"
      aria-label={es ? "Gestor de reservas" : "Booking manager"}
    >
      <div className="workspace-inline-heading">
        <div>
          <span className="eyebrow">{managementProduct.name}</span>
          <h2>{es ? "Gestor de reservas" : "Booking manager"}</h2>
          <p>
            {es
              ? "Controla cómo se reserva tu local."
              : "Choose how customers book with you."}
          </p>
        </div>
      </div>
      <div className="booking-status-strip">
        <article>
          <small>{es ? "Modo" : "Mode"}</small>
          <strong>
            {mode === "external"
              ? es
                ? "Externo"
                : "External"
              : mode === "request"
                ? "AkiPasa"
                : es
                  ? "Desactivado"
                  : "Disabled"}
          </strong>
        </article>
        <article>
          <small>{es ? "Horarios" : "Slots"}</small>
          <strong>{slots.length}</strong>
        </article>
        <article>
          <small>{es ? "Pendientes" : "Pending"}</small>
          <strong>{pending}</strong>
        </article>
      </div>
      <nav
        className="booking-manager-tabs"
        aria-label={es ? "Secciones de reservas" : "Booking sections"}
      >
        {(
          [
            ["inbox", es ? "Reservas" : "Bookings"],
            ["calendar", es ? "Calendario" : "Calendar"],
            ["offerings", es ? "Servicios" : "Services"],
            ["setup", es ? "Ajustes" : "Settings"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={section === key ? "button" : "button secondary"}
            aria-current={section === key ? "page" : undefined}
            onClick={() => {
              setSection(key);
              const url = new URL(window.location.href);
              url.searchParams.set("bookingTab", key);
              window.history.replaceState({}, "", url);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="booking-manager-body" data-booking-panel={section}>
        {section === "setup" && (
          <form
            action={save}
            className="stack compact-action-form booking-manager-form"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="venueId" value={venueId} />
            <input type="hidden" name="template" value={template} />
            <div className="booking-mode-grid">
              {(
                [
                  [
                    "external",
                    "globe",
                    es ? "Enlace externo" : "External link",
                    es
                      ? "Usa tu proveedor de reservas."
                      : "Use your existing provider.",
                  ],
                  [
                    "request",
                    "calendar",
                    es ? "Reservas AkiPasa" : "Via AkiPasa",
                    es ? "Gestiona reservas aquí." : "Manage bookings here.",
                  ],
                  [
                    "disabled",
                    "close",
                    es ? "Sin reservas" : "Bookings off",
                    es
                      ? "Oculta el botón al público."
                      : "Hide the public booking button.",
                  ],
                ] as const
              ).map(([value, icon, title, description]) => (
                <label className="booking-mode-card" key={value}>
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  <span aria-hidden="true">
                    <Icon name={icon as IconName} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>
            {mode === "external" && (
              <label>
                {es ? "Enlace de reservas" : "Booking URL"}
                <input
                  name="externalUrl"
                  type="url"
                  required
                  maxLength={2048}
                  placeholder="https://booking.example.com"
                  defaultValue={settings?.external_url || ""}
                />
              </label>
            )}
            {mode === "request" && (
              <>
                <label className="toggle-card">
                  <input
                    name="requiresDeposit"
                    type="checkbox"
                    defaultChecked={settings?.requires_deposit || false}
                  />
                  <span>{es ? "Solicitar depósito" : "Require deposit"}</span>
                </label>
                <label>
                  {es ? "Depósito (€)" : "Deposit (€)"}
                  <input
                    name="depositEuros"
                    type="number"
                    min="0"
                    max="10000"
                    step="0.01"
                    defaultValue={
                      settings?.deposit_cents
                        ? (settings.deposit_cents / 100).toFixed(2)
                        : ""
                    }
                  />
                </label>
                <label>
                  {es
                    ? "Email para confirmaciones del local"
                    : "Venue confirmation email"}
                  <input
                    type="email"
                    name="notificationEmail"
                    placeholder="reservas@ejemplo.com"
                    defaultValue={settings?.notification_email || ""}
                  />
                  <small>
                    {es
                      ? "Una confirmación para el cliente y otra para el local. En blanco, usamos el email verificado del propietario."
                      : "One confirmation for the guest, one for the venue. Leave blank to use the verified owner email."}
                  </small>
                </label>
                <label>
                  {es ? "Instrucciones de reserva" : "Booking instructions"}
                  <textarea
                    name="instructions"
                    rows={3}
                    defaultValue={
                      (es
                        ? settings?.instructions_es
                        : settings?.instructions_en) || ""
                    }
                  />
                </label>
              </>
            )}
            <button className="button" type="submit">
              {es ? "Guardar configuración" : "Save booking setup"}
            </button>
          </form>
        )}
        {section === "offerings" && (
          <div className="stack booking-manager-form">
            <h3>{es ? "Servicios reservables" : "Bookable offerings"}</h3>
            <p>
              {es
                ? "Crea actividades, citas, clases o experiencias independientes. Cada servicio tendrá su propio cupo y horarios."
                : "Create separate services, appointments, classes or experiences. Each offering has its own capacity and slots."}
            </p>
            {offerings.length > 0 && (
              <div className="managed-list">
                {offerings.map((offering) => (
                  <div className="managed-row" key={offering.id}>
                    {editingOffering === offering.id ? (
                      <form
                        action={updateOffering}
                        className="stack compact-action-form booking-inline-edit"
                      >
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="venueId" value={venueId} />
                        <input
                          type="hidden"
                          name="offeringId"
                          value={offering.id}
                        />
                        <div className="form-grid-three">
                          <label>
                            {es ? "Nombre del servicio" : "Offering name"}
                            <input
                              type="text"
                              name="name"
                              maxLength={120}
                              required
                              defaultValue={offering.name}
                            />
                          </label>
                          <label>
                            {es ? "Tipo" : "Type"}
                            <select name="kind" defaultValue={offering.kind}>
                              {templates.map(([key, , en, spanish]) => (
                                <option key={key} value={key}>
                                  {es ? spanish : en}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {es ? "Duración (min)" : "Duration (min)"}
                            <input
                              name="duration"
                              type="number"
                              min="15"
                              max="1440"
                              defaultValue={offering.duration_minutes}
                              required
                            />
                          </label>
                          <label>
                            {es ? "Capacidad máxima" : "Maximum capacity"}
                            <input
                              name="capacity"
                              type="number"
                              min="1"
                              max="10000"
                              defaultValue={offering.capacity}
                              required
                            />
                          </label>
                          <label className="toggle-row">
                            <input
                              type="checkbox"
                              name="active"
                              defaultChecked={offering.active}
                            />
                            {es
                              ? "Activo y visible para nuevos horarios"
                              : "Active and visible for new slots"}
                          </label>
                        </div>
                        <div className="inline-actions">
                          <button className="button" type="submit">
                            {es ? "Guardar servicio" : "Save offering"}
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => setEditingOffering(null)}
                          >
                            {es ? "Cancelar" : "Cancel"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span>
                          <strong>{offering.name}</strong> ·{" "}
                          {templates.find((t) => t[0] === offering.kind)?.[
                            es ? 3 : 2
                          ] || offering.kind}
                          {!offering.active && (
                            <> · {es ? "inactivo" : "inactive"}</>
                          )}
                        </span>
                        <span>
                          {offering.duration_minutes} min · {offering.capacity}{" "}
                          {es ? "plazas" : "places"}
                        </span>
                        <button
                          type="button"
                          className="button secondary compact-button"
                          onClick={() => setEditingOffering(offering.id)}
                        >
                          {es ? "Editar" : "Edit"}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <h3>{es ? "¿Qué vas a ofrecer?" : "What are you offering?"}</h3>
            <p>
              {es
                ? "Selecciona un tipo. Se usará al crear el servicio, con su propio horario y plazas."
                : "Choose a type for the service you are creating. Its capacity and schedule are separate."}
            </p>
            <div className="booking-template-grid">
              {templates.map(([key, icon, en, spanish]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={template === key}
                  onClick={() => setTemplate(key)}
                  className={
                    template === key
                      ? "booking-template-card selected"
                      : "booking-template-card"
                  }
                >
                  <span aria-hidden="true">
                    <Icon name={icon} />
                  </span>
                  <strong>{es ? spanish : en}</strong>
                </button>
              ))}
            </div>

            <form action={createOffering} className="stack compact-action-form">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="venueId" value={venueId} />
              <div className="form-grid-three">
                <label>
                  {es ? "Nombre del servicio" : "Offering name"}
                  <input
                    type="text"
                    name="name"
                    maxLength={120}
                    required
                    placeholder={
                      template === "dining"
                        ? es
                          ? "Ej. Desayuno"
                          : "E.g. Breakfast"
                        : template === "appointment"
                          ? es
                            ? "Ej. Corte de pelo"
                            : "E.g. Haircut"
                          : es
                            ? "Nombre de la actividad"
                            : "Activity name"
                    }
                  />
                </label>
                <input type="hidden" name="kind" value={template} />
                <label>
                  {es ? "Duración (min)" : "Duration (min)"}
                  <input
                    name="duration"
                    type="number"
                    min="15"
                    max="1440"
                    key={template}
                    defaultValue={
                      template === "dining"
                        ? 90
                        : template === "appointment"
                          ? 30
                          : 60
                    }
                    required
                  />
                </label>
                <label>
                  {es ? "Capacidad máxima" : "Maximum capacity"}
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    max="10000"
                    defaultValue={1}
                    required
                  />
                </label>
              </div>
              <button className="button" type="submit">
                {es ? "Crear servicio" : "Create offering"}
              </button>
            </form>
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowResources(!showResources)}
            >
              <Icon name="venue" size={17} />
              {showResources
                ? es
                  ? "Ocultar mesas, equipos y personal"
                  : "Hide tables, equipment and staff"
                : es
                  ? "Gestionar mesas, equipos y personal"
                  : "Manage tables, equipment and staff"}
            </button>
          </div>
        )}
        {section === "offerings" && showResources && (
          <div className="stack booking-manager-form">
            <h3>{es ? "Recursos reservables" : "Bookable resources"}</h3>
            <p>
              {es
                ? "Crea mesas, personal, vehículos, pistas o equipos con aforo propio. Los horarios asignados al mismo recurso no pueden solaparse."
                : "Create tables, staff, vehicles, courts, or equipment with individual capacities. Slots for the same resource cannot overlap."}
            </p>
            {resources.length > 0 && (
              <div className="managed-list">
                {resources.map((resource) => (
                  <div className="managed-row" key={resource.id}>
                    <span>
                      <strong>{resource.name}</strong> ·{" "}
                      {resourceText[resource.kind] || resource.kind}
                    </span>
                    <span>
                      {resource.capacity} {es ? "plazas" : "places"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <form action={createResource} className="stack compact-action-form">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="venueId" value={venueId} />
              <div className="form-grid-three">
                <label>
                  {es ? "Nombre del recurso" : "Resource name"}
                  <input
                    name="name"
                    type="text"
                    maxLength={100}
                    placeholder={
                      es ? "Ej. Mesa 1, Buggy 2" : "E.g. Table 1, Buggy 2"
                    }
                    required
                  />
                </label>
                <label>
                  {es ? "Tipo" : "Type"}
                  <select name="kind" defaultValue="other">
                    {(
                      [
                        "table",
                        "staff",
                        "vehicle",
                        "equipment",
                        "court",
                        "room",
                        "other",
                      ] as const
                    ).map((kind) => (
                      <option value={kind} key={kind}>
                        {resourceText[kind] || kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {es ? "Capacidad" : "Capacity"}
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    max="10000"
                    defaultValue="1"
                    required
                  />
                </label>
              </div>
              <button className="button" type="submit">
                {es ? "Añadir recurso" : "Add resource"}
              </button>
            </form>
          </div>
        )}
        {section === "calendar" && (
          <div className="stack booking-manager-form">
            {mode !== "request" ? (
              <p>
                {es
                  ? "Activa reservas AkiPasa para gestionar disponibilidad."
                  : "Enable AkiPasa bookings to manage availability."}
              </p>
            ) : (
              <>
                <h3>
                  {es
                    ? "Calendario y disponibilidad"
                    : "Calendar & availability"}
                </h3>
                {slots.length ? (
                  <div className="managed-list">
                    {slots.map((slot) => (
                      <div className="managed-row" key={slot.id}>
                        <span>
                          {new Date(slot.starts_at).toLocaleString(locale, {
                            timeZone: "Europe/Madrid",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <strong>
                          {slot.resource_id
                            ? resources.find((r) => r.id === slot.resource_id)
                                ?.name + " · "
                            : ""}
                          {slot.capacity} {es ? "plazas" : "places"}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>
                    {es
                      ? "Aún no hay horarios creados."
                      : "No booking slots yet."}
                  </p>
                )}
                <details className="workspace-action-card">
                  <summary>
                    {es ? "Crear horario" : "Create availability"}
                  </summary>
                  <form
                    action={createSlot}
                    className="stack compact-action-form"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="venueId" value={venueId} />
                    <div className="form-grid-three">
                      <label>
                        {es ? "Inicio" : "Starts"}
                        <input name="startsAt" type="datetime-local" required />
                      </label>
                      <label>
                        {es ? "Final" : "Ends"}
                        <input name="endsAt" type="datetime-local" required />
                      </label>
                      <label>
                        {es ? "Capacidad" : "Capacity"}
                        <input
                          name="capacity"
                          type="number"
                          min="1"
                          defaultValue="1"
                          required
                        />
                      </label>
                    </div>
                    <label>
                      {es ? "Servicio opcional" : "Optional offering"}
                      <select name="offeringId" defaultValue="">
                        <option value="">
                          {es ? "Reserva general" : "General booking"}
                        </option>
                        {offerings
                          .filter((o) => o.active)
                          .map((offering) => (
                            <option key={offering.id} value={offering.id}>
                              {offering.name} · {offering.capacity}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      {es ? "Recurso opcional" : "Optional resource"}
                      <select name="resourceId" defaultValue="">
                        <option value="">
                          {es ? "Aforo general" : "General capacity"}
                        </option>
                        {resources
                          .filter((r) => r.active)
                          .map((resource) => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} · {resource.capacity}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button className="button" type="submit">
                      {es ? "Añadir horario" : "Add slot"}
                    </button>
                  </form>
                </details>
                <details className="workspace-action-card">
                  <summary>
                    {es
                      ? "Programar horarios recurrentes"
                      : "Schedule recurring availability"}
                  </summary>
                  <form
                    action={createRecurringSlots}
                    className="stack compact-action-form"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="venueId" value={venueId} />
                    <div className="form-grid-three">
                      <label>
                        {es ? "Desde" : "From"}
                        <input type="date" name="startDate" required />
                      </label>
                      <label>
                        {es ? "Hasta (máx. 90 días)" : "Until (max 90 days)"}
                        <input type="date" name="endDate" required />
                      </label>
                      <label>
                        {es ? "Hora de inicio" : "Start time"}
                        <input type="time" name="startTime" required />
                      </label>
                      <label>
                        {es ? "Duración en minutos" : "Duration in minutes"}
                        <input
                          type="number"
                          name="duration"
                          min="15"
                          max="1440"
                          defaultValue="60"
                          required
                        />
                      </label>
                      <label>
                        {es ? "Plazas por horario" : "Places per slot"}
                        <input
                          type="number"
                          name="capacity"
                          min="1"
                          max="10000"
                          defaultValue="1"
                          required
                        />
                      </label>
                    </div>
                    <label>
                      {es ? "Servicio opcional" : "Optional offering"}
                      <select name="offeringId" defaultValue="">
                        <option value="">
                          {es ? "Reserva general" : "General booking"}
                        </option>
                        {offerings
                          .filter((o) => o.active)
                          .map((offering) => (
                            <option key={offering.id} value={offering.id}>
                              {offering.name} · {offering.capacity}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      {es ? "Recurso opcional" : "Optional resource"}
                      <select name="resourceId" defaultValue="">
                        <option value="">
                          {es ? "Aforo general" : "General capacity"}
                        </option>
                        {resources
                          .filter((r) => r.active)
                          .map((resource) => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} · {resource.capacity}
                            </option>
                          ))}
                      </select>
                    </label>
                    <fieldset>
                      <legend>
                        {es ? "Días de la semana" : "Days of the week"}
                      </legend>
                      <div className="booking-weekday-options">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                          (day, i) => (
                            <label key={day}>
                              <input
                                type="checkbox"
                                name="weekdays"
                                value={i + 1}
                                defaultChecked={i < 5}
                              />
                              {es
                                ? [
                                    "Lun",
                                    "Mar",
                                    "Mié",
                                    "Jue",
                                    "Vie",
                                    "Sáb",
                                    "Dom",
                                  ][i]
                                : day}
                            </label>
                          ),
                        )}
                      </div>
                    </fieldset>
                    <p>
                      {es
                        ? "Los horarios existentes no se duplicarán. Los horarios nuevos conservarán la capacidad elegida."
                        : "Existing dates won't be duplicated. New slots use your selected capacity."}
                    </p>
                    <button type="submit" className="button">
                      {es ? "Crear programación" : "Create schedule"}
                    </button>
                  </form>
                </details>
              </>
            )}
          </div>
        )}
        {section === "inbox" && (
          <div className="booking-inbox" id="booking-inbox">
            <div className="booking-inbox-heading">
              <h3>{es ? "Solicitudes de reserva" : "Booking requests"}</h3>
              <span>
                {total} {es ? "reservas" : "bookings"}
              </span>
            </div>
            <form
              method="get"
              action={`/${locale}/business/venue/${venueId}#booking-inbox`}
              onSubmit={applyInboxFilters}
              className="booking-inbox-toolbar"
              key={`${inboxFilters.search}-${inboxFilters.status}-${inboxFilters.sort}`}
              role="search"
              aria-label={es ? "Buscar reservas" : "Search bookings"}
            >
              <input type="hidden" name="section" value="bookings" />
              <input type="hidden" name="bookingTab" value="inbox" />
              <label className="booking-inbox-search">
                {es ? "Buscar reservas" : "Search bookings"}
                <input
                  type="search"
                  name="bookingSearch"
                  maxLength={80}
                  defaultValue={inboxFilters.search}
                  placeholder={
                    es
                      ? "Nombre, email, teléfono o referencia"
                      : "Name, email, phone or reference"
                  }
                />
              </label>
              <label>
                {es ? "Estado" : "Status"}
                <select name="bookingStatus" defaultValue={inboxFilters.status}>
                  {bookingInboxStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status === "all"
                        ? es
                          ? "Todas"
                          : "All statuses"
                        : statusText[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {es ? "Orden" : "Sort"}
                <select name="bookingSort" defaultValue={inboxFilters.sort}>
                  <option value="newest">
                    {es ? "Más recientes" : "Newest requests"}
                  </option>
                  <option value="oldest">
                    {es ? "Más antiguas" : "Oldest requests"}
                  </option>
                </select>
              </label>
              <button type="submit" className="button">
                {es ? "Buscar" : "Search"}
              </button>
              {(inboxFilters.search ||
                inboxFilters.status !== "all" ||
                inboxFilters.sort !== "newest") && (
                <Link
                  className="button secondary"
                  href={bookingInboxHref(locale, venueId, {
                    search: "",
                    status: "all",
                    sort: "newest",
                    page: 1,
                  })}
                >
                  {es ? "Limpiar" : "Reset"}
                </Link>
              )}
            </form>
            <nav
              className="booking-inbox-pager"
              aria-label={es ? "Páginas de reservas" : "Booking pages"}
            >
              <span role="status">
                {total
                  ? `${(inboxFilters.page - 1) * BOOKING_INBOX_PAGE_SIZE + 1}–${Math.min(inboxFilters.page * BOOKING_INBOX_PAGE_SIZE, total)} / ${total}`
                  : "0"}
              </span>
              <span>
                {es ? "Página" : "Page"} {inboxFilters.page} / {pages}
              </span>
              {inboxFilters.page > 1 ? (
                <Link
                  className="button secondary"
                  href={inboxHref(inboxFilters.page - 1)}
                >
                  {es ? "Anterior" : "Previous"}
                </Link>
              ) : (
                <button type="button" className="button secondary" disabled>
                  {es ? "Anterior" : "Previous"}
                </button>
              )}
              {inboxFilters.page < pages ? (
                <Link
                  className="button secondary"
                  href={inboxHref(inboxFilters.page + 1)}
                >
                  {es ? "Siguiente" : "Next"}
                </Link>
              ) : (
                <button type="button" className="button secondary" disabled>
                  {es ? "Siguiente" : "Next"}
                </button>
              )}
            </nav>
            {!emailConfigured && (
              <p className="notice" role="status">
                {es
                  ? "Las reservas funcionan. Los emails quedarán en cola hasta configurar RESEND_API_KEY en Cloudflare."
                  : "Bookings work normally. Confirmation emails stay queued until RESEND_API_KEY is configured in Cloudflare."}
              </p>
            )}
            {inbox?.error ? (
              <p role="alert">
                {es
                  ? "No se pudieron cargar las reservas. Inténtalo de nuevo."
                  : "Bookings could not be loaded. Please try again."}{" "}
                <Link href={inboxHref(inboxFilters.page)}>
                  {es ? "Reintentar" : "Retry"}
                </Link>
              </p>
            ) : (
              !requests.length && (
                <p>
                  {inboxFilters.search || inboxFilters.status !== "all"
                    ? es
                      ? "No hay reservas que coincidan. Prueba otros filtros."
                      : "No matching bookings. Try different filters."
                    : es
                      ? "Todavía no hay reservas."
                      : "No booking requests yet."}
                </p>
              )
            )}
            {inbox?.notificationError && (
              <p role="alert">
                {es
                  ? "No se pudo cargar el estado de los emails."
                  : "Email delivery status could not be loaded."}
              </p>
            )}
            <div className="booking-inbox-grid">
              {requests.map((request) => {
                const slot =
                  request.venue_availability_slots ||
                  slots.find((s) => s.id === request.slot_id);
                const service = offerings.find(
                  (o) => o.id === slot?.offering_id,
                );
                const mails = notifications.filter(
                  (n) => n.booking_id === request.id,
                );
                return (
                  <article className="booking-request-card" key={request.id}>
                    <div>
                      <strong>
                        {request.contact_name} · {request.party_size}{" "}
                        {es ? "personas" : "guests"}
                      </strong>
                      <small>{request.contact_email}</small>
                      {slot && (
                        <time dateTime={slot.starts_at}>
                          {new Date(slot.starts_at).toLocaleString(locale, {
                            timeZone: "Europe/Madrid",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      )}
                      {service && <small>{service.name}</small>}
                    </div>
                    <span className="status-pill">
                      {statusText[request.status] || request.status}
                    </span>
                    <details className="booking-request-details">
                      <summary>
                        {es ? "Detalles y referencia" : "Details & reference"}
                      </summary>
                      <small>
                        {es ? "Referencia" : "Reference"}: {request.id}
                      </small>
                      {request.contact_phone && (
                        <small>
                          {es ? "Teléfono" : "Phone"}: {request.contact_phone}
                        </small>
                      )}
                      {request.notes && (
                        <small>
                          {es ? "Notas" : "Notes"}: {request.notes}
                        </small>
                      )}
                      <small>
                        {es ? "Recibida" : "Received"}:{" "}
                        {new Date(request.created_at).toLocaleString(locale, {
                          timeZone: "Europe/Madrid",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </small>
                    </details>
                    <form
                      action={updateRequest}
                      className="booking-request-controls"
                    >
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="venueId" value={venueId} />
                      <input
                        type="hidden"
                        name="bookingSearch"
                        value={inboxFilters.search}
                      />
                      <input
                        type="hidden"
                        name="bookingStatus"
                        value={inboxFilters.status}
                      />
                      <input
                        type="hidden"
                        name="bookingSort"
                        value={inboxFilters.sort}
                      />
                      <input
                        type="hidden"
                        name="bookingPage"
                        value={inboxFilters.page}
                      />
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      {request.status === "requested" && (
                        <>
                          <button
                            className="button"
                            name="status"
                            value="confirmed"
                          >
                            {es ? "Aprobar" : "Approve"}
                          </button>
                          <button
                            className="button secondary"
                            name="status"
                            value="declined"
                          >
                            {es ? "Rechazar" : "Decline"}
                          </button>
                        </>
                      )}
                      {request.status === "confirmed" && (
                        <>
                          <button
                            className="button secondary"
                            name="status"
                            value="completed"
                            disabled={
                              !!slot &&
                              new Date(slot.starts_at).getTime() > Date.now()
                            }
                          >
                            {es ? "Completar" : "Complete"}
                          </button>
                          <details>
                            <summary>{es ? "Cancelar" : "Cancel"}</summary>
                            <button
                              className="button secondary"
                              name="status"
                              value="cancelled"
                            >
                              {es
                                ? "Confirmar cancelación"
                                : "Confirm cancellation"}
                            </button>
                          </details>
                        </>
                      )}
                    </form>
                    {mails.length > 0 && (
                      <div className="booking-mail-status">
                        {mails.map((mail) => (
                          <small key={mail.audience}>
                            {mail.audience === "customer"
                              ? es
                                ? "Cliente"
                                : "Guest"
                              : es
                                ? "Local"
                                : "Venue"}
                            : {mailText[mail.status] || mail.status}
                          </small>
                        ))}
                      </div>
                    )}
                    {retryEmails &&
                      emailConfigured &&
                      mails.some((m) =>
                        ["pending", "failed", "blocked"].includes(m.status),
                      ) && (
                        <form action={retryEmails}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="venueId" value={venueId} />
                          <input
                            type="hidden"
                            name="bookingSearch"
                            value={inboxFilters.search}
                          />
                          <input
                            type="hidden"
                            name="bookingStatus"
                            value={inboxFilters.status}
                          />
                          <input
                            type="hidden"
                            name="bookingSort"
                            value={inboxFilters.sort}
                          />
                          <input
                            type="hidden"
                            name="bookingPage"
                            value={inboxFilters.page}
                          />
                          <input
                            type="hidden"
                            name="requestId"
                            value={request.id}
                          />
                          <button className="button secondary" type="submit">
                            {es ? "Reintentar emails" : "Retry emails"}
                          </button>
                        </form>
                      )}
                  </article>
                );
              })}
            </div>
            {pages > 1 && (
              <nav
                className="booking-inbox-pager"
                aria-label={
                  es
                    ? "Continuar por las reservas"
                    : "Continue browsing bookings"
                }
              >
                <span>
                  {es ? "Página" : "Page"} {inboxFilters.page} / {pages}
                </span>
                {inboxFilters.page > 1 && (
                  <Link
                    className="button secondary"
                    href={inboxHref(inboxFilters.page - 1)}
                  >
                    {es ? "Página anterior" : "Previous page"}
                  </Link>
                )}
                {inboxFilters.page < pages && (
                  <Link
                    className="button"
                    href={inboxHref(inboxFilters.page + 1)}
                  >
                    {es ? "Página siguiente" : "Next page"}
                  </Link>
                )}
              </nav>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
