"use client";
import { IndependentAccommodationTeam } from "./IndependentAccommodationTeam";
import { IndependentAccommodationMedia } from "./IndependentAccommodationMedia";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Property = {
  id: string;
  name: string;
  status: string;
  legacy_venue_id: string | null;
};
type Row = {
  id: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  accommodation_type?: string;
  website_url?: string;
  description_es?: string;
  description_en?: string;
  name?: string;
  active?: boolean;
  max_guests?: number;
  room_type_id?: string;
  unit_id?: string;
  start_date?: string;
  end_date_exclusive?: string;
  nightly_price_cents?: number;
  status?: string;
  check_in?: string;
  check_out?: string;
  reference?: string;
  contact_name?: string;
  contact_email?: string;
  guests?: number;
  quoted_total_cents?: number;
  mode?: string;
  policy?: string;
  external_url?: string;
  notification_email?: string;
  storage_path?: string;
};
type Section = {
  rows?: Row[];
  error?: string;
  page?: number;
  hasMore?: boolean;
};
type Inventory = Record<string, Section>;
const sections = [
  "profile",
  "room_types",
  "units",
  "nightly_rates",
  "unit_blocks",
  "booking_settings",
  "reservations",
  "property_media",
  "team",
] as const;
const reservationTransitions: Record<string, string[]> = {
  requested: ["confirmed", "declined", "cancelled"],
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["completed"],
};
const statusLabels: Record<string, { en: string; es: string }> = {
  private: { en: "Private", es: "Privado" },
  published: { en: "Published", es: "Publicado" },
  requested: { en: "Requested", es: "Solicitada" },
  confirmed: { en: "Confirmed", es: "Confirmada" },
  declined: { en: "Declined", es: "Rechazada" },
  cancelled: { en: "Cancelled", es: "Cancelada" },
  checked_in: { en: "Checked in", es: "En estancia" },
  completed: { en: "Completed", es: "Completada" },
};
const labels = {
  en: [
    "Property profile",
    "Room types",
    "Units",
    "Nightly rates",
    "Blocked dates",
    "Booking settings",
    "Reservations",
    "Photos",
    "Team",
  ],
  es: [
    "Ficha del alojamiento",
    "Tipos de habitación",
    "Unidades",
    "Tarifas por noche",
    "Fechas bloqueadas",
    "Configuración de reservas",
    "Reservas",
    "Fotografías",
    "Equipo",
  ],
};
export function IndependentAccommodationManager({
  locale,
  initialProperty = "",
  locations = [],
}: {
  locale: "en" | "es";
  initialProperty?: string;
  locations?: { id: string; name: string }[];
}) {
  const es = locale === "es";
  const [properties, setProperties] = useState<Property[]>([]),
    [selected, setSelected] = useState(initialProperty);
  const [inventory, setInventory] = useState<Inventory>({}),
    [tab, setTab] = useState<(typeof sections)[number]>("room_types");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [listPage, setListPage] = useState(0),
    [listMore, setListMore] = useState(false);
  const requestGeneration = useRef(0);
  async function loadPage(section: string, page: number) {
    const generation = requestGeneration.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/business/accommodations?property=${encodeURIComponent(selected)}&section=${section}&page=${page}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw Error();
      const data = await response.json();
      if (generation !== requestGeneration.current) return;
      setInventory((current) => ({ ...current, ...data }));
    } catch {
      if (generation !== requestGeneration.current) return;
      setInventory((current) => ({
        ...current,
        [section]: { error: "unavailable" },
      }));
      setError(
        es ? "No se pudo cargar la página." : "Could not load the page.",
      );
    } finally {
      if (generation === requestGeneration.current) setBusy(false);
    }
  }
  useEffect(() => {
    requestGeneration.current += 1;
    setBusy(false);
    let current = true;
    setLoading(true);
    setError("");
    fetch(
      `/api/business/accommodations${selected ? "?property=" + encodeURIComponent(selected) : "?page=" + listPage}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data) => {
        if (current) {
          if (selected) setInventory(data);
          else {
            setProperties(data.properties || []);
            setListMore(data.hasMore === true);
          }
        }
      })
      .catch(() => {
        if (current)
          setError(
            es
              ? "No se pudieron cargar los datos. Reintenta; no se considera inventario vacío."
              : "Could not load the data. Retry; unavailable inventory is not treated as empty.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      requestGeneration.current += 1;
    };
  }, [selected, refresh, es, listPage]);
  async function mutate(
    payload: Record<string, unknown>,
    form?: HTMLFormElement,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/business/accommodations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "unavailable");
      if (payload.action === "create") setSelected(result.property);
      else setRefresh((v) => v + 1);
      form?.reset();
    } catch {
      setError(
        es
          ? "No se pudo guardar. Revisa los datos y vuelve a cargar antes de reintentar."
          : "Could not save. Check the details and reload before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const text = (key: string) => String(values.get(key) || "");
    const action = text("action");
    let payload: Record<string, unknown> = { action, property: selected };
    if (action === "create")
      payload = {
        action,
        name: text("name"),
        ...(text("workspace") ? { workspace: text("workspace") } : {}),
      };
    if (action === "profile")
      payload = {
        ...payload,
        submit: values.get("submit") === "on",
        profile: {
          name: text("name"),
          address: text("address"),
          city: text("city"),
          latitude: text("latitude") ? Number(text("latitude")) : null,
          longitude: text("longitude") ? Number(text("longitude")) : null,
          accommodation_type: text("accommodation_type"),
          website_url: text("website_url") || null,
          description_es: text("description_es"),
          description_en: text("description_en"),
        },
      };
    if (action === "room_type")
      payload = {
        ...payload,
        name: text("name"),
        maxGuests: Number(text("maxGuests")),
        active: true,
      };
    if (action === "unit")
      payload = {
        ...payload,
        name: text("name"),
        roomType: text("roomType"),
        active: true,
      };
    if (action === "rate")
      payload = {
        ...payload,
        roomType: text("roomType"),
        start: text("start"),
        end: text("end"),
        cents: Math.round(Number(text("price")) * 100),
        minimumNights: Number(text("minimumNights")),
      };
    if (action === "block")
      payload = {
        ...payload,
        unit: text("unit"),
        start: text("start"),
        end: text("end"),
      };
    if (action === "settings")
      payload = {
        ...payload,
        mode: text("mode"),
        externalUrl: text("externalUrl") || null,
        policy: text("policy"),
        notificationEmail: text("notificationEmail") || null,
      };
    void mutate(payload, form);
  }
  const rows = inventory[tab]?.rows || [],
    failed = Boolean(inventory[tab]?.error);
  const roomTypes = inventory.room_types?.rows || [],
    units = inventory.units?.rows || [];
  const save = es ? "Guardar" : "Save";
  const dateInputs = (
    <>
      <label>
        {es ? "Desde" : "From"}
        <input name="start" type="date" required />
      </label>
      <label>
        {es ? "Hasta (excluido)" : "Until (exclusive)"}
        <input name="end" type="date" required />
      </label>
    </>
  );
  return (
    <section className="independent-accommodation">
      <h1>{es ? "Mis alojamientos" : "My accommodation"}</h1>
      <p>
        {es
          ? "Gestiona un alojamiento sin crear un local AkiPasa. Las nuevas propiedades son privadas hasta completar su publicación y verificación."
          : "Manage accommodation without creating an AkiPasa venue. New properties stay private until publication and verification are completed."}
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={busy || loading}
        onClick={() => setRefresh((v) => v + 1)}
      >
        {es ? "Volver a cargar" : "Reload"}
      </button>
      {!selected && (
        <p>
          {es ? "100 alojamientos por página." : "100 properties per page."}
        </p>
      )}
      {loading ? (
        <p role="status">{es ? "Cargando…" : "Loading…"}</p>
      ) : !selected ? (
        <>
          <div>
            <button
              type="button"
              disabled={listPage === 0}
              onClick={() => setListPage((p) => p - 1)}
            >
              {es ? "Anterior" : "Previous"}
            </button>
            <span> {listPage + 1} </span>
            <button
              type="button"
              disabled={!listMore || listPage >= 100}
              onClick={() => setListPage((p) => p + 1)}
            >
              {es ? "Siguiente" : "Next"}
            </button>
          </div>
          <ul>
            {properties.map((property) => (
              <li key={property.id}>
                <button
                  type="button"
                  onClick={() => {
                    setInventory({});
                    setSelected(property.id);
                  }}
                >
                  {property.name} ·{" "}
                  {statusLabels[property.status]?.[locale] || property.status}
                </button>
                {property.legacy_venue_id && (
                  <a
                    href={`/${locale}/business/venue/${encodeURIComponent(property.legacy_venue_id)}`}
                  >
                    {es ? "Gestión anterior" : "Legacy management"}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={submit}>
            <fieldset disabled={busy || Boolean(error)}>
              <legend>
                {es
                  ? "Crear alojamiento privado"
                  : "Create private accommodation"}
              </legend>
              <input type="hidden" name="action" value="create" />
              <label>
                {es ? "Nombre" : "Name"}
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              {locations.length > 0 && (
                <label>
                  {es
                    ? "Ubicación operativa propia (opcional)"
                    : "Owned operating location (optional)"}
                  <select name="workspace" defaultValue="">
                    <option value="">{es ? "Sin vincular" : "Unlinked"}</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit">{es ? "Crear" : "Create"}</button>
            </fieldset>
          </form>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSelected("");
              setInventory({});
            }}
          >
            {es ? "Todos mis alojamientos" : "All my accommodation"}
          </button>
          <nav
            aria-label={
              es ? "Herramientas del alojamiento" : "Accommodation tools"
            }
          >
            {sections.map((section, index) => (
              <button
                type="button"
                key={section}
                aria-pressed={tab === section}
                onClick={() => setTab(section)}
              >
                {labels[locale][index]}
              </button>
            ))}
          </nav>
          <h2>{labels[locale][sections.indexOf(tab)]}</h2>
          {tab === "team" ? (
            <IndependentAccommodationTeam
              key={selected}
              property={selected}
              locale={locale}
            />
          ) : tab === "property_media" ? (
            <IndependentAccommodationMedia
              property={selected}
              locale={locale}
            />
          ) : failed ? (
            <p role="alert">
              {es
                ? "Esta sección no está disponible. Las acciones quedan bloqueadas hasta recargar."
                : "This section is unavailable. Actions are blocked until it reloads."}
            </p>
          ) : (
            <>
              <p>
                {es
                  ? "100 registros por página. La ausencia de resultados no implica disponibilidad."
                  : "100 records per page. Missing results do not establish availability."}
              </p>
              {!["profile", "booking_settings"].includes(tab) && (
                <div>
                  <button
                    type="button"
                    disabled={busy || !inventory[tab]?.page}
                    onClick={() =>
                      void loadPage(tab, (inventory[tab]?.page ?? 0) - 1)
                    }
                  >
                    {es ? "Anterior" : "Previous"}
                  </button>
                  <span> {(inventory[tab]?.page ?? 0) + 1} </span>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !inventory[tab]?.hasMore ||
                      (inventory[tab]?.page ?? 0) >= 100
                    }
                    onClick={() =>
                      void loadPage(tab, (inventory[tab]?.page ?? 0) + 1)
                    }
                  >
                    {es ? "Siguiente" : "Next"}
                  </button>
                </div>
              )}
              <ul>
                {rows.map((row) => (
                  <li key={row.id || "settings"}>
                    <span>
                      {row.name || row.reference || row.id}{" "}
                      {tab === "reservations" && (
                        <span>
                          {row.contact_name} · {row.contact_email} ·{" "}
                          {row.guests} {es ? "huéspedes" : "guests"} ·{" "}
                          {typeof row.quoted_total_cents === "number"
                            ? (row.quoted_total_cents / 100).toFixed(2)
                            : "—"}{" "}
                          EUR
                        </span>
                      )}
                      {row.start_date || row.check_in}{" "}
                      {row.end_date_exclusive || row.check_out}{" "}
                      {row.nightly_price_cents !== undefined
                        ? `${(row.nightly_price_cents / 100).toFixed(2)} EUR`
                        : ""}{" "}
                      {row.status
                        ? statusLabels[row.status]?.[locale] || row.status
                        : ""}
                    </span>
                    {(tab === "nightly_rates" || tab === "unit_blocks") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void mutate({
                            action:
                              tab === "nightly_rates"
                                ? "remove_rate"
                                : "remove_block",
                            property: selected,
                            id: row.id,
                          })
                        }
                      >
                        {es ? "Eliminar" : "Remove"}
                      </button>
                    )}
                    {tab === "reservations" && (
                      <select
                        aria-label={
                          es
                            ? "Cambiar estado de reserva"
                            : "Change reservation status"
                        }
                        value=""
                        disabled={busy}
                        onChange={(event) =>
                          void mutate({
                            action: "status",
                            property: selected,
                            reservation: row.id,
                            status: event.target.value,
                          })
                        }
                      >
                        <option value="">
                          {es ? "Elegir estado" : "Choose status"}
                        </option>
                        {(reservationTransitions[row.status || ""] || []).map(
                          (status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]?.[locale] || status}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                    {(tab === "room_types" || tab === "units") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            tab === "room_types"
                              ? {
                                  action: "room_type",
                                  property: selected,
                                  id: row.id,
                                  name: row.name,
                                  maxGuests: (
                                    row as Row & { max_guests: number }
                                  ).max_guests,
                                  active: !row.active,
                                }
                              : {
                                  action: "unit",
                                  property: selected,
                                  id: row.id,
                                  name: row.name,
                                  roomType: row.room_type_id,
                                  active: !row.active,
                                },
                          )
                        }
                      >
                        {row.active
                          ? es
                            ? "Desactivar"
                            : "Deactivate"
                          : es
                            ? "Activar"
                            : "Activate"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!["reservations", "property_media"].includes(tab) && (
                <form onSubmit={submit} key={`${selected}-${tab}-${refresh}`}>
                  <fieldset
                    disabled={
                      busy ||
                      Boolean(error) ||
                      failed ||
                      ((tab === "units" || tab === "nightly_rates") &&
                        Boolean(inventory.room_types?.error)) ||
                      (tab === "unit_blocks" && Boolean(inventory.units?.error))
                    }
                  >
                    <legend>
                      {tab === "booking_settings"
                        ? save
                        : es
                          ? "Añadir"
                          : "Add"}
                    </legend>
                    <input
                      type="hidden"
                      name="action"
                      value={
                        (
                          {
                            profile: "profile",
                            room_types: "room_type",
                            units: "unit",
                            nightly_rates: "rate",
                            unit_blocks: "block",
                            booking_settings: "settings",
                          } as Record<string, string>
                        )[tab]
                      }
                    />
                    {tab === "profile" && (
                      <>
                        <label>
                          {es ? "Nombre" : "Name"}
                          <input
                            name="name"
                            required
                            minLength={2}
                            maxLength={120}
                            defaultValue={rows[0]?.name || ""}
                          />
                        </label>
                        <label>
                          {es ? "Dirección" : "Address"}
                          <input
                            name="address"
                            maxLength={500}
                            defaultValue={rows[0]?.address || ""}
                          />
                        </label>
                        <label>
                          {es ? "Localidad" : "City"}
                          <input
                            name="city"
                            maxLength={160}
                            defaultValue={rows[0]?.city || ""}
                          />
                        </label>
                        <label>
                          {es ? "Latitud" : "Latitude"}
                          <input
                            type="number"
                            step="any"
                            min={-85}
                            max={85}
                            name="latitude"
                            defaultValue={rows[0]?.latitude ?? ""}
                          />
                        </label>
                        <label>
                          {es ? "Longitud" : "Longitude"}
                          <input
                            type="number"
                            step="any"
                            min={-180}
                            max={180}
                            name="longitude"
                            defaultValue={rows[0]?.longitude ?? ""}
                          />
                        </label>
                        <label>
                          {es ? "Tipo de alojamiento" : "Accommodation type"}
                          <select
                            name="accommodation_type"
                            defaultValue={
                              rows[0]?.accommodation_type || "hotel"
                            }
                          >
                            {[
                              ["hotel", "Hotel", "Hotel"],
                              ["apartment", "Apartment", "Apartamento"],
                              ["rural_house", "Rural house", "Casa rural"],
                              ["hostel", "Hostel", "Albergue"],
                              ["guest_house", "Guest house", "Pensión"],
                              ["campsite", "Campsite", "Camping"],
                              ["motel", "Motel", "Motel"],
                              [
                                "student_accommodation",
                                "Student accommodation",
                                "Residencia de estudiantes",
                              ],
                            ].map(([value, en, sp]) => (
                              <option key={value} value={value}>
                                {es ? sp : en}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {es ? "Web HTTPS" : "HTTPS website"}
                          <input
                            type="url"
                            name="website_url"
                            defaultValue={rows[0]?.website_url || ""}
                          />
                        </label>
                        <label>
                          {es
                            ? "Descripción en español"
                            : "Spanish description"}
                          <textarea
                            name="description_es"
                            maxLength={6000}
                            defaultValue={rows[0]?.description_es || ""}
                          />
                        </label>
                        <label>
                          {es ? "Descripción en inglés" : "English description"}
                          <textarea
                            name="description_en"
                            maxLength={6000}
                            defaultValue={rows[0]?.description_en || ""}
                          />
                        </label>
                        <label>
                          <input type="checkbox" name="submit" />
                          {es
                            ? "Enviar para revisión; no publica automáticamente"
                            : "Submit for review; does not publish automatically"}
                        </label>
                      </>
                    )}
                    {(tab === "room_types" || tab === "units") && (
                      <label>
                        {es ? "Nombre" : "Name"}
                        <input
                          name="name"
                          required
                          minLength={2}
                          maxLength={120}
                        />
                      </label>
                    )}
                    {tab === "room_types" && (
                      <label>
                        {es ? "Huéspedes máximos" : "Maximum guests"}
                        <input
                          name="maxGuests"
                          type="number"
                          required
                          min={1}
                          max={30}
                          defaultValue={2}
                        />
                      </label>
                    )}
                    {(tab === "units" || tab === "nightly_rates") && (
                      <label>
                        {es ? "Tipo de habitación" : "Room type"}
                        <select name="roomType" required defaultValue="">
                          <option value="">
                            {es ? "Selecciona" : "Select"}
                          </option>
                          {roomTypes.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {tab === "unit_blocks" && (
                      <label>
                        {es ? "Unidad" : "Unit"}
                        <select name="unit" required defaultValue="">
                          <option value="">
                            {es ? "Selecciona" : "Select"}
                          </option>
                          {units.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {(tab === "nightly_rates" || tab === "unit_blocks") &&
                      dateInputs}
                    {tab === "nightly_rates" && (
                      <>
                        <label>
                          {es
                            ? "Precio por noche (EUR)"
                            : "Nightly price (EUR)"}
                          <input
                            type="number"
                            name="price"
                            min={0}
                            step="0.01"
                            required
                          />
                        </label>
                        <label>
                          {es ? "Noches mínimas" : "Minimum nights"}
                          <input
                            name="minimumNights"
                            type="number"
                            min={1}
                            max={365}
                            required
                            defaultValue={1}
                          />
                        </label>
                      </>
                    )}
                    {tab === "booking_settings" && (
                      <>
                        <label>
                          {es ? "Reservas" : "Bookings"}
                          <select
                            name="mode"
                            defaultValue={rows[0]?.mode || "disabled"}
                          >
                            <option value="disabled">
                              {es ? "Desactivadas" : "Disabled"}
                            </option>
                            <option value="external">
                              {es ? "Enlace externo" : "External link"}
                            </option>
                            <option value="request">
                              {es
                                ? "Solicitud, no confirmación automática"
                                : "Request, no automatic confirmation"}
                            </option>
                          </select>
                        </label>
                        <label>
                          {es ? "Enlace externo HTTPS" : "External HTTPS link"}
                          <input
                            type="url"
                            name="externalUrl"
                            defaultValue={rows[0]?.external_url || ""}
                          />
                        </label>
                        <label>
                          {es ? "Política" : "Policy"}
                          <textarea
                            name="policy"
                            maxLength={4000}
                            defaultValue={rows[0]?.policy || ""}
                          />
                        </label>
                        <label>
                          {es ? "Email de notificación" : "Notification email"}
                          <input
                            type="email"
                            name="notificationEmail"
                            defaultValue={rows[0]?.notification_email || ""}
                          />
                        </label>
                      </>
                    )}
                    <button type="submit">
                      {busy ? (es ? "Guardando…" : "Saving…") : save}
                    </button>
                  </fieldset>
                </form>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
