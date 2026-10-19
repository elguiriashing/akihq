/* eslint-disable @next/next/no-img-element -- Venue media uses native images with existing layout controls. */
"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { SafeMediaFileInput } from "@/components/SafeMediaFileInput";
import {
  addVenueMediaToEventBin,
  removeMediaFromEventBin,
  updateEvent,
  uploadEventImage,
} from "@/app/[locale]/business/venue/[id]/actions";

type MediaOption = { id: string; url: string; alt: string };

type EventSlotKey = "banner" | "explore" | "profile" | "background" | "map";

type EditorTab =
  | "details"
  | "pricing"
  | "menus"
  | "media"
  | "accessibility"
  | "library";

const PAGE_SIZE = 9;

const eventSlots: Array<{
  key: EventSlotKey;
  en: string;
  es: string;
  enHelp: string;
  esHelp: string;
}> = [
  {
    key: "banner",
    en: "1 · Event banner",
    es: "1 · Banner del evento",
    enHelp: "Wide hero image at the top of the event page.",
    esHelp: "Imagen panorámica en la cabecera de la ficha del evento.",
  },
  {
    key: "explore",
    en: "2 · Explore card",
    es: "2 · Tarjeta Explorar",
    enHelp: "Landscape image used on Discover cards.",
    esHelp: "Imagen horizontal usada en las tarjetas de Descubrir.",
  },
  {
    key: "profile",
    en: "3 · Event profile image",
    es: "3 · Imagen de perfil",
    enHelp: "Small event identity image beside its title and on cards.",
    esHelp: "Imagen pequeña de identidad junto al título y en tarjetas.",
  },
  {
    key: "background",
    en: "4 · Event page background",
    es: "4 · Fondo de la ficha",
    enHelp: "Full-page event background, independent of the banner.",
    esHelp: "Fondo de página independiente del banner del evento.",
  },
  {
    key: "map",
    en: "5 · Map vertical",
    es: "5 · Vertical para mapa",
    enHelp: "Portrait artwork used specifically in map/list cards.",
    esHelp: "Imagen vertical usada específicamente en tarjetas del mapa/lista.",
  },
];

export function BusinessEventEditPanel({
  locale,
  venueId,
  verifiedVenue = false,
  event,
  media,
  venueMediaIds = [],
  bannerMediaId = "",
  exploreMediaId = "",
  profileMediaId = "",
  backgroundMediaId = "",
  mapMediaId = "",
  eventBinMediaIds = [],
  catalogueSections = [],
  selectedCatalogueSectionIds = [],
}: {
  locale: "es" | "en";
  venueId: string;
  verifiedVenue?: boolean;
  event: {
    id: string;
    title: string;
    description: string;
    priceCents: number;
    priceDisplayMode: "show" | "hide";
    bookingUrl: string;
    minimumAge: number | null;
    accessibilityNotes: string;
  };
  media: MediaOption[];
  venueMediaIds?: string[];
  bannerMediaId?: string;
  exploreMediaId?: string;
  profileMediaId?: string;
  backgroundMediaId?: string;
  mapMediaId?: string;
  eventBinMediaIds?: string[];
  catalogueSections?: Array<{ id: string; title: string; itemCount: number }>;
  selectedCatalogueSectionIds?: string[];
}) {
  const es = locale === "es";
  const [activeTab, setActiveTab] = useState<EditorTab>("details");
  const [selectedMenus, setSelectedMenus] = useState<string[]>(
    selectedCatalogueSectionIds,
  );
  const [pickerSlot, setPickerSlot] = useState<EventSlotKey | null>(null);
  const [pickerPage, setPickerPage] = useState(0);
  const [libraryPage, setLibraryPage] = useState(0);
  const [libraryFolder, setLibraryFolder] = useState<
    "all" | "venue" | "events"
  >("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [priceMode, setPriceMode] = useState<"show" | "hide">(
    event.priceDisplayMode,
  );
  const [slots, setSlots] = useState<Record<EventSlotKey, string>>({
    banner: bannerMediaId,
    explore: exploreMediaId,
    profile: profileMediaId,
    background: backgroundMediaId,
    map: mapMediaId,
  });
  const [allMedia, setAllMedia] = useState<MediaOption[]>(media);
  const [binIds, setBinIds] = useState<string[]>(eventBinMediaIds);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [mediaState, setMediaState] = useState<
    "idle" | "working" | "saved" | "error"
  >("idle");
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);

  const eventBin = useMemo(
    () => allMedia.filter((item) => binIds.includes(item.id)),
    [allMedia, binIds],
  );
  const venueLibrary = useMemo(
    () => allMedia.filter((item) => venueMediaIds.includes(item.id)),
    [allMedia, venueMediaIds],
  );
  const selectableMedia = allMedia;
  const eventFallback = eventBin[0] || venueLibrary[0] || allMedia[0] || null;

  const pageCount = Math.max(1, Math.ceil(selectableMedia.length / PAGE_SIZE));
  const safePickerPage = Math.min(pickerPage, pageCount - 1);
  const pickerItems = selectableMedia.slice(
    safePickerPage * PAGE_SIZE,
    safePickerPage * PAGE_SIZE + PAGE_SIZE,
  );
  const filteredLibrary = allMedia.filter(
    (item) =>
      (libraryFolder === "all" ||
        (libraryFolder === "venue"
          ? venueMediaIds.includes(item.id)
          : !venueMediaIds.includes(item.id))) &&
      item.alt.toLocaleLowerCase().includes(librarySearch.toLocaleLowerCase()),
  );
  const libraryPageCount = Math.max(
    1,
    Math.ceil(filteredLibrary.length / PAGE_SIZE),
  );
  const safeLibraryPage = Math.min(libraryPage, libraryPageCount - 1);
  const libraryItems = filteredLibrary.slice(
    safeLibraryPage * PAGE_SIZE,
    safeLibraryPage * PAGE_SIZE + PAGE_SIZE,
  );

  function selectedFor(key: EventSlotKey) {
    const explicit = slots[key]
      ? allMedia.find((item) => item.id === slots[key])
      : null;
    return explicit || eventFallback;
  }

  function openPicker(slot: EventSlotKey) {
    setPickerSlot(slot);
    setPickerPage(0);
  }

  function chooseMedia(mediaId: string) {
    if (!pickerSlot) return;
    setSlots((current) => ({ ...current, [pickerSlot]: mediaId }));
    setSaveState("idle");
    setPickerSlot(null);
  }

  function useAutomatic() {
    if (!pickerSlot) return;
    setSlots((current) => ({ ...current, [pickerSlot]: "" }));
    setSaveState("idle");
    setPickerSlot(null);
  }

  async function saveEvent(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    const form = eventSubmit.currentTarget;
    if (!form.reportValidity()) return;
    setSaveState("saving");
    const formData = new FormData(form);
    formData.set("inline", "1");
    const result = await updateEvent(formData);
    if (result?.ok) {
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2200);
    } else {
      setSaveState("error");
    }
  }

  async function uploadMedia(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    const form = eventSubmit.currentTarget;
    if (!form.reportValidity()) return;

    const source = new FormData(form);
    const files = source
      .getAll("image")
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );
    if (!files.length) return;

    const sharedAlt = String(source.get("alt") || "").trim();
    setMediaState("working");
    setUploadProgress({ done: 0, total: files.length });

    const uploaded: MediaOption[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fallbackAlt =
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim() || (es ? "Imagen del evento" : "Event image");
      const formData = new FormData();
      formData.set("inline", "1");
      formData.set("locale", locale);
      formData.set("venueId", venueId);
      formData.set("eventId", event.id);
      formData.set("sortOrder", String(binIds.length + index));
      formData.set("image", file);
      formData.set(
        "alt",
        files.length === 1 && sharedAlt
          ? sharedAlt
          : sharedAlt
            ? `${sharedAlt} ${index + 1}`
            : fallbackAlt,
      );

      const result = await uploadEventImage(formData);
      if (!result?.ok || !result.media?.url) {
        setMediaState("error");
        setUploadProgress(null);
        return;
      }
      uploaded.push(result.media);
      setUploadProgress({ done: index + 1, total: files.length });
    }

    setAllMedia((current) => {
      const ids = new Set(uploaded.map((item) => item.id));
      return [...current.filter((item) => !ids.has(item.id)), ...uploaded];
    });
    setBinIds((current) => [
      ...current,
      ...uploaded.map((item) => item.id).filter((id) => !current.includes(id)),
    ]);
    form.reset();
    setUploadProgress(null);
    setMediaState("saved");
    window.setTimeout(() => setMediaState("idle"), 1800);
  }

  async function addToEvent(mediaId: string) {
    setMediaState("working");
    const formData = new FormData();
    formData.set("inline", "1");
    formData.set("locale", locale);
    formData.set("venueId", venueId);
    formData.set("eventId", event.id);
    formData.set("mediaId", mediaId);
    const result = await addVenueMediaToEventBin(formData);
    if (result?.ok) {
      setBinIds((current) =>
        current.includes(mediaId) ? current : [...current, mediaId],
      );
      setMediaState("saved");
      window.setTimeout(() => setMediaState("idle"), 1600);
    } else {
      setMediaState("error");
    }
  }

  async function removeFromEvent(mediaId: string) {
    setMediaState("working");
    const formData = new FormData();
    formData.set("inline", "1");
    formData.set("locale", locale);
    formData.set("venueId", venueId);
    formData.set("eventId", event.id);
    formData.set("mediaId", mediaId);
    const result = await removeMediaFromEventBin(formData);
    if (result?.ok) {
      setBinIds((current) => current.filter((id) => id !== mediaId));
      setSlots((current) => {
        const next = { ...current };
        (Object.keys(next) as EventSlotKey[]).forEach((key) => {
          if (next[key] === mediaId) next[key] = "";
        });
        return next;
      });
      setMediaState("saved");
      window.setTimeout(() => setMediaState("idle"), 1600);
    } else {
      setMediaState("error");
    }
  }

  const tabs: Array<{ key: EditorTab; en: string; es: string; icon: string }> =
    [
      { key: "details", en: "Details", es: "Datos", icon: "✎" },
      { key: "pricing", en: "Pricing", es: "Precio", icon: "€" },
      { key: "menus", en: "Menus", es: "Cartas", icon: "☰" },
      { key: "media", en: "Media", es: "Imágenes", icon: "▣" },
      { key: "accessibility", en: "Access", es: "Acceso", icon: "♿" },
      { key: "library", en: "Library", es: "Biblioteca", icon: "⊞" },
    ];

  return (
    <details className="event-edit-studio event-editor-app" open>
      <summary>
        <span>{es ? "Editor del evento" : "Event editor"}</span>
        <small className="event-editor-live-state">
          {verifiedVenue
            ? es
              ? "Local verificado · cambios directos"
              : "Verified venue · changes publish directly"
            : es
              ? "Los cambios pueden requerir revisión"
              : "Changes may require review"}
        </small>
      </summary>

      <div className="event-editor-shell">
        <nav
          className="event-editor-tabs"
          aria-label={es ? "Secciones del editor" : "Editor sections"}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              aria-pressed={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.icon}</span>
              <strong>{es ? tab.es : tab.en}</strong>
            </button>
          ))}
        </nav>

        <div className="event-editor-main">
          <form
            onSubmit={saveEvent}
            className="event-edit-studio-form event-editor-form"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="venueId" value={venueId} />
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="priceDisplayMode" value={priceMode} />
            <input type="hidden" name="bannerMediaId" value={slots.banner} />
            <input type="hidden" name="exploreMediaId" value={slots.explore} />
            <input type="hidden" name="profileMediaId" value={slots.profile} />
            <input
              type="hidden"
              name="backgroundMediaId"
              value={slots.background}
            />
            <input type="hidden" name="mapMediaId" value={slots.map} />
            <input
              type="hidden"
              name="catalogueSectionIds"
              value={JSON.stringify(selectedMenus)}
            />

            <section
              className="event-editor-page"
              hidden={activeTab !== "details"}
            >
              <header className="event-editor-page-head">
                <div>
                  <span className="eyebrow">
                    {es ? "Información principal" : "Main information"}
                  </span>
                  <h3>{es ? "Datos del evento" : "Event details"}</h3>
                </div>
                <small>
                  {es
                    ? "Nombre, descripción, reserva y edad."
                    : "Name, description, booking and age."}
                </small>
              </header>
              <div className="event-editor-fields">
                <label className="event-studio-big-field event-editor-title-field">
                  {es ? "Título" : "Title"}
                  <input name="title" defaultValue={event.title} required />
                </label>
                <label className="event-studio-big-field event-editor-description-field">
                  {es ? "Descripción" : "Description"}
                  <textarea
                    name="description"
                    defaultValue={event.description}
                    required
                    minLength={20}
                    rows={7}
                  />
                </label>
                <label>
                  {es ? "Enlace de reserva" : "Booking link"}
                  <input
                    name="bookingUrl"
                    type="url"
                    defaultValue={event.bookingUrl}
                  />
                </label>
                <label>
                  {es ? "Edad mínima" : "Minimum age"}
                  <input
                    name="minimumAge"
                    type="number"
                    min="0"
                    max="99"
                    defaultValue={event.minimumAge ?? ""}
                  />
                </label>
              </div>
            </section>

            <section
              className="event-editor-page"
              hidden={activeTab !== "menus"}
            >
              <header className="event-editor-page-head">
                <div>
                  <span className="eyebrow">
                    {es ? "Opcional" : "Optional"}
                  </span>
                  <h3>{es ? "Carta del evento" : "Event menu"}</h3>
                </div>
                <small>
                  {es
                    ? "Selecciona las secciones de la carta del local que mostrarás en este evento. Los precios y alérgenos se mantienen sincronizados."
                    : "Choose venue menu sections to show with this event. Prices and allergens stay in sync."}
                </small>
              </header>
              {catalogueSections.length ? (
                <div className="event-menu-choices">
                  {catalogueSections.map((section) => {
                    const selected = selectedMenus.includes(section.id);
                    return (
                      <button
                        type="button"
                        key={section.id}
                        aria-pressed={selected}
                        className={
                          selected
                            ? "event-menu-choice selected"
                            : "event-menu-choice"
                        }
                        onClick={() => {
                          setSelectedMenus((current) =>
                            selected
                              ? current.filter((id) => id !== section.id)
                              : [...current, section.id],
                          );
                          setSaveState("idle");
                        }}
                      >
                        <span aria-hidden="true">{selected ? "✓" : "+"}</span>
                        <strong>{section.title}</strong>
                        <small>
                          {section.itemCount} {es ? "artículos" : "items"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">
                  {es
                    ? "Publica primero una carta con artículos para poder vincularla."
                    : "Publish a venue menu with items first to attach it to an event."}
                </p>
              )}
              {selectedMenus.length > 0 && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setSelectedMenus([])}
                >
                  {es ? "Quitar carta del evento" : "Remove event menu"}
                </button>
              )}
            </section>

            <section
              className="event-editor-page"
              hidden={activeTab !== "pricing"}
            >
              <header className="event-editor-page-head">
                <div>
                  <span className="eyebrow">{es ? "Entrada" : "Entry"}</span>
                  <h3>{es ? "Precio del evento" : "Event pricing"}</h3>
                </div>
                <small>
                  {es
                    ? "Ocúltalo si no existe una entrada real."
                    : "Hide it when there is no actual entry fee."}
                </small>
              </header>
              <div className="event-price-mode event-editor-price-mode">
                <button
                  type="button"
                  className={
                    priceMode === "hide"
                      ? "event-price-option selected"
                      : "event-price-option"
                  }
                  onClick={() => setPriceMode("hide")}
                >
                  <span>◌</span>
                  <strong>{es ? "No mostrar precio" : "Hide price"}</strong>
                  <small>
                    {es
                      ? "No aparecerá “Gratis”."
                      : "“Free” will not be shown."}
                  </small>
                </button>
                <button
                  type="button"
                  className={
                    priceMode === "show"
                      ? "event-price-option selected"
                      : "event-price-option"
                  }
                  onClick={() => setPriceMode("show")}
                >
                  <span>€</span>
                  <strong>{es ? "Mostrar precio" : "Show price"}</strong>
                  <small>
                    {es ? "0 € se verá como Gratis." : "€0 displays as Free."}
                  </small>
                </button>
              </div>
              {priceMode === "show" ? (
                <label className="event-price-input event-editor-price-input">
                  {es ? "Precio (€)" : "Price (€)"}
                  <input
                    name="priceEuros"
                    type="number"
                    min="0"
                    max="10000"
                    step="0.01"
                    defaultValue={(event.priceCents / 100).toFixed(2)}
                  />
                </label>
              ) : (
                <input
                  type="hidden"
                  name="priceEuros"
                  value={event.priceCents / 100}
                />
              )}
            </section>

            <section
              className="event-editor-page"
              hidden={activeTab !== "media"}
            >
              <header className="event-editor-page-head">
                <div>
                  <span className="eyebrow">
                    {es ? "Superficies" : "Surfaces"}
                  </span>
                  <h3>
                    {es ? "Cinco imágenes del evento" : "Five event images"}
                  </h3>
                </div>
                <small>
                  {es
                    ? "Cada imagen tiene un destino concreto."
                    : "Each image has one defined job."}
                </small>
              </header>
              <div className="event-surface-grid">
                {eventSlots.map((slot) => {
                  const selected = selectedFor(slot.key);
                  const explicit = Boolean(slots[slot.key]);
                  return (
                    <article
                      className="event-surface-card"
                      data-media-slot={slot.key}
                      key={slot.key}
                    >
                      <div className="event-surface-preview">
                        {selected ? (
                          <img src={selected.url} alt={selected.alt} />
                        ) : (
                          <span>＋</span>
                        )}
                        {!explicit && selected ? (
                          <small className="media-fallback-chip">
                            {es ? "Automático" : "Auto"}
                          </small>
                        ) : null}
                      </div>
                      <div className="event-surface-copy">
                        <strong>{es ? slot.es : slot.en}</strong>
                        <small>{es ? slot.esHelp : slot.enHelp}</small>
                      </div>
                      <div className="event-surface-actions">
                        <button
                          type="button"
                          className="button"
                          onClick={() => openPicker(slot.key)}
                        >
                          {es ? "Elegir imagen" : "Choose image"}
                        </button>
                        {explicit ? (
                          <button
                            type="button"
                            className="button subtle"
                            onClick={() => {
                              setSlots((current) => ({
                                ...current,
                                [slot.key]: "",
                              }));
                              setSaveState("idle");
                            }}
                          >
                            {es ? "Automático" : "Auto"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section
              className="event-editor-page"
              hidden={activeTab !== "accessibility"}
            >
              <header className="event-editor-page-head">
                <div>
                  <span className="eyebrow">
                    {es ? "Accesibilidad" : "Accessibility"}
                  </span>
                  <h3>{es ? "Información de acceso" : "Access information"}</h3>
                </div>
                <small>
                  {es
                    ? "Solo si hay algo específico que explicar."
                    : "Only when something specific needs explaining."}
                </small>
              </header>
              <label className="event-studio-big-field">
                {es
                  ? "Información de accesibilidad"
                  : "Accessibility information"}
                <textarea
                  name="accessibilityNotes"
                  maxLength={1000}
                  defaultValue={event.accessibilityNotes}
                  rows={10}
                />
              </label>
            </section>

            <div
              className="event-edit-savebar event-editor-savebar"
              hidden={activeTab === "library"}
            >
              <span aria-live="polite">
                {saveState === "saving"
                  ? es
                    ? "Guardando…"
                    : "Saving…"
                  : saveState === "saved"
                    ? verifiedVenue
                      ? es
                        ? "Guardado y publicado."
                        : "Saved and published."
                      : es
                        ? "Guardado."
                        : "Saved."
                    : saveState === "error"
                      ? es
                        ? "No se pudo guardar. Revisa los campos."
                        : "Could not save. Check the fields."
                      : verifiedVenue
                        ? es
                          ? "Los cambios se publican directamente."
                          : "Changes publish directly."
                        : es
                          ? "Los cambios pueden pasar por revisión."
                          : "Changes may go through review."}
              </span>
              <button
                className="button"
                type="submit"
                disabled={saveState === "saving"}
              >
                {saveState === "saving"
                  ? es
                    ? "Guardando…"
                    : "Saving…"
                  : es
                    ? "Guardar cambios"
                    : "Save changes"}
              </button>
            </div>
          </form>

          <section
            className="event-editor-page event-editor-library-page"
            hidden={activeTab !== "library"}
          >
            <header className="event-editor-page-head">
              <div>
                <span className="eyebrow">{es ? "Biblioteca" : "Library"}</span>
                <h3>{es ? "Multimedia del evento" : "Event media"}</h3>
              </div>
              <small>
                {allMedia.length} {es ? "archivos compartidos" : "shared files"}
              </small>
            </header>

            <form
              ref={uploadFormRef}
              onSubmit={uploadMedia}
              className="media-upload-form event-editor-upload-form"
              encType="multipart/form-data"
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="venueId" value={venueId} />
              <input type="hidden" name="eventId" value={event.id} />
              <label>
                {es ? "Subir imágenes / PDF" : "Upload images / PDFs"}
                <SafeMediaFileInput
                  locale={locale}
                  name="image"
                  required
                  multiple
                  maxFiles={20}
                />
              </label>
              <label>
                {es
                  ? "Descripción común (opcional)"
                  : "Shared description (optional)"}
                <input
                  name="alt"
                  minLength={3}
                  maxLength={300}
                  placeholder={
                    es ? "Vacío = nombres de archivo" : "Blank = filenames"
                  }
                />
              </label>
              <button
                className="button"
                type="submit"
                disabled={mediaState === "working"}
              >
                {mediaState === "working"
                  ? uploadProgress
                    ? es
                      ? `Subiendo ${uploadProgress.done}/${uploadProgress.total}…`
                      : `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                    : es
                      ? "Subiendo…"
                      : "Uploading…"
                  : es
                    ? "Subir archivos"
                    : "Upload files"}
              </button>
            </form>

            <p className="event-media-live-status" aria-live="polite">
              {mediaState === "saved"
                ? es
                  ? "Multimedia actualizada."
                  : "Media updated."
                : mediaState === "error"
                  ? es
                    ? "No se pudo actualizar la multimedia."
                    : "Could not update media."
                  : ""}
            </p>

            <div className="event-library-controls">
              <div
                className="event-library-folder-tabs"
                role="group"
                aria-label={es ? "Carpetas" : "Folders"}
              >
                {(["all", "venue", "events"] as const).map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    aria-pressed={libraryFolder === folder}
                    className={
                      libraryFolder === folder
                        ? "button secondary selected"
                        : "button subtle"
                    }
                    onClick={() => {
                      setLibraryFolder(folder);
                      setLibraryPage(0);
                    }}
                  >
                    {folder === "all"
                      ? es
                        ? "Todo"
                        : "All media"
                      : folder === "venue"
                        ? es
                          ? "Local"
                          : "Venue"
                        : es
                          ? "Eventos"
                          : "Events"}
                  </button>
                ))}
              </div>
              <input
                type="search"
                aria-label={es ? "Buscar archivos" : "Search media"}
                placeholder={es ? "Buscar archivos…" : "Search media…"}
                value={librarySearch}
                onChange={(e) => {
                  setLibrarySearch(e.target.value);
                  setLibraryPage(0);
                }}
              />
            </div>
            {filteredLibrary.length ? (
              <>
                <div className="event-editor-library-grid">
                  {libraryItems.map((item, index) => (
                    <article
                      className="event-editor-library-item"
                      key={item.id}
                    >
                      <div className="event-editor-library-thumb">
                        <img src={item.url} alt={item.alt} />
                        {safeLibraryPage === 0 && index === 0 ? (
                          <span className="media-primary-chip">
                            {es ? "Principal" : "Primary"}
                          </span>
                        ) : null}
                      </div>
                      <div>
                        <strong>{item.alt}</strong>
                        <button
                          type="button"
                          disabled={mediaState === "working"}
                          onClick={() =>
                            binIds.includes(item.id)
                              ? removeFromEvent(item.id)
                              : addToEvent(item.id)
                          }
                        >
                          {binIds.includes(item.id)
                            ? es
                              ? "Quitar del evento"
                              : "Remove from event"
                            : es
                              ? "Añadir al evento"
                              : "Add to event"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="event-library-pagination">
                  <button
                    type="button"
                    disabled={safeLibraryPage <= 0}
                    onClick={() =>
                      setLibraryPage((page) => Math.max(0, page - 1))
                    }
                  >
                    ←
                  </button>
                  <span>
                    {safeLibraryPage + 1} / {libraryPageCount}
                  </span>
                  <button
                    type="button"
                    disabled={safeLibraryPage >= libraryPageCount - 1}
                    onClick={() =>
                      setLibraryPage((page) =>
                        Math.min(libraryPageCount - 1, page + 1),
                      )
                    }
                  >
                    →
                  </button>
                </div>
              </>
            ) : (
              <div className="event-media-empty">
                <span>▧</span>
                <strong>
                  {es
                    ? "Este evento aún usa las imágenes del local"
                    : "This event is still using venue media"}
                </strong>
              </div>
            )}

            {venueLibrary.filter((item) => !binIds.includes(item.id)).length ? (
              <details className="event-library-import">
                <summary>
                  ＋{" "}
                  {es
                    ? "Traer desde la biblioteca del local"
                    : "Add from venue library"}
                </summary>
                <div className="event-editor-library-grid">
                  {venueLibrary
                    .filter((item) => !binIds.includes(item.id))
                    .map((item) => (
                      <article
                        className="event-editor-library-item"
                        key={item.id}
                      >
                        <div className="event-editor-library-thumb">
                          <img src={item.url} alt={item.alt} />
                        </div>
                        <div>
                          <strong>{item.alt}</strong>
                          <button
                            type="button"
                            disabled={mediaState === "working"}
                            onClick={() => addToEvent(item.id)}
                          >
                            {es ? "Añadir" : "Add"}
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>
      </div>

      {pickerSlot ? (
        <div
          className="event-media-modal-backdrop"
          role="presentation"
          onMouseDown={() => setPickerSlot(null)}
        >
          <section
            className="event-media-modal"
            role="dialog"
            aria-modal="true"
            aria-label={es ? "Elegir imagen" : "Choose image"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">
                  {es ? "Biblioteca multimedia" : "Media library"}
                </span>
                <h3>
                  {es
                    ? eventSlots.find((slot) => slot.key === pickerSlot)?.es
                    : eventSlots.find((slot) => slot.key === pickerSlot)?.en}
                </h3>
              </div>
              <button
                type="button"
                className="event-media-modal-close"
                onClick={() => setPickerSlot(null)}
              >
                ×
              </button>
            </header>

            <div className="event-media-modal-grid">
              {pickerItems.map((item) => (
                <button
                  type="button"
                  className={slots[pickerSlot] === item.id ? "selected" : ""}
                  key={item.id}
                  onClick={() => chooseMedia(item.id)}
                >
                  <img src={item.url} alt={item.alt} />
                  <span>{item.alt}</span>
                </button>
              ))}
            </div>

            {!selectableMedia.length ? (
              <div className="event-media-empty">
                <span>▧</span>
                <strong>
                  {es ? "No hay imágenes disponibles" : "No media available"}
                </strong>
              </div>
            ) : null}

            <footer>
              <button
                type="button"
                className="button subtle"
                onClick={useAutomatic}
              >
                {es ? "Usar automático" : "Use automatic"}
              </button>
              <div className="event-media-pagination">
                <button
                  type="button"
                  disabled={safePickerPage <= 0}
                  onClick={() => setPickerPage((page) => Math.max(0, page - 1))}
                >
                  ←
                </button>
                <span>
                  {safePickerPage + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={safePickerPage >= pageCount - 1}
                  onClick={() =>
                    setPickerPage((page) => Math.min(pageCount - 1, page + 1))
                  }
                >
                  →
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </details>
  );
}
