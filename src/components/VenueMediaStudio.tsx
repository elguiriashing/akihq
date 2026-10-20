/* eslint-disable @next/next/no-img-element -- Venue media uses native images with existing layout controls. */
"use client";

import { config } from "@/lib/config";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { setMediaFolder } from "@/app/[locale]/business/venue/[id]/premium-actions";
import { SafeMediaFileInput } from "@/components/SafeMediaFileInput";
import {
  addStayHeaderPhoto,
  clearVenueMediaPlacement,
  removeStayHeaderPhoto,
  removeVenueImage,
  setVenueMediaPlacement,
} from "@/app/[locale]/business/venue/[id]/actions";

export type VenueMediaStudioItem = {
  id: string;
  url: string;
  alt: string;
  sizeBytes: number;
  folder?: string;
  canDelete?: boolean;
};

export type VenueMediaPlacement =
  | "venue_profile"
  | "venue_cover"
  | "venue_menu"
  | "venue_events"
  | "venue_explore";

const slots: Array<{
  key: VenueMediaPlacement;
  icon: string;
  en: string;
  es: string;
  enHelp: string;
  esHelp: string;
}> = [
  {
    key: "venue_profile",
    icon: "⌂",
    en: "Profile / logo",
    es: "Perfil / logo",
    enHelp: "Small identity image beside the venue name.",
    esHelp: "Imagen pequeña de identidad junto al nombre del local.",
  },
  {
    key: "venue_cover",
    icon: "▣",
    en: "Venue banner",
    es: "Banner del local",
    enHelp: "Wide hero image at the top of the venue page.",
    esHelp: "Imagen panorámica en la cabecera de la ficha del local.",
  },
  {
    key: "venue_menu",
    icon: "☰",
    en: "Menu",
    es: "Carta",
    enHelp: "Default visual for the public menu/catalogue.",
    esHelp: "Imagen por defecto de la carta/catálogo público.",
  },
  {
    key: "venue_events",
    icon: "◫",
    en: "Event fallback",
    es: "Eventos",
    enHelp: "Fallback image for venue events without their own media.",
    esHelp: "Imagen de respaldo para eventos sin imágenes propias.",
  },
  {
    key: "venue_explore",
    icon: "◎",
    en: "Explore",
    es: "Explorar",
    enHelp: "Default venue artwork used in discovery cards.",
    esHelp: "Imagen del local usada por defecto en tarjetas de descubrimiento.",
  },
];

export function VenueMediaStudio({
  locale,
  venueId,
  media,
  placements,
  accommodation = false,
  stayHeaderIds = [],
  premium = false,
  listingLimits = false,
}: {
  locale: "es" | "en";
  venueId: string;
  media: VenueMediaStudioItem[];
  placements: Partial<Record<VenueMediaPlacement, string>>;
  accommodation?: boolean;
  stayHeaderIds?: string[];
  premium?: boolean;
  listingLimits?: boolean;
}) {
  const es = locale === "es";
  const [items, setItems] = useState(media);
  const [headerIds, setHeaderIds] = useState(stayHeaderIds);
  const [slotState, setSlotState] =
    useState<Partial<Record<VenueMediaPlacement, string>>>(placements);
  const [busy, setBusy] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<VenueMediaPlacement | null>(
    null,
  );
  const [pickerPage, setPickerPage] = useState(0);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFolder, setPickerFolder] = useState("");
  const folders = [
    ...new Set(
      items
        .map((item) => item.folder)
        .filter((folder): folder is string => Boolean(folder)),
    ),
  ];
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploadError, setUploadError] = useState("");
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const pickerDialogRef = useRef<HTMLElement>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!pickerSlot) return;
    const dialog = pickerDialogRef.current;
    if (!dialog) return;
    const trigger = pickerTriggerRef.current;
    const controls = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      );
    dialog.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    const keepFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node))
        (controls()[0] || dialog).focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setPickerSlot(null);
      } else if (event.key === "Tab") {
        const focusable = controls();
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", keepFocus);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [pickerSlot]);

  const fallback = items.find((item) => item.canDelete !== false) || null;
  const filteredPickerItems = items.filter(
    (item) =>
      (!pickerFolder || item.folder === pickerFolder) &&
      `${item.alt} ${item.folder || ""}`
        .toLocaleLowerCase()
        .includes(pickerSearch.toLocaleLowerCase()),
  );
  const pickerPageCount = Math.max(
    1,
    Math.ceil(filteredPickerItems.length / 12),
  );
  const safePickerPage = Math.min(pickerPage, pickerPageCount - 1);
  const visiblePickerItems = filteredPickerItems.slice(
    safePickerPage * 12,
    safePickerPage * 12 + 12,
  );

  function selectedFor(slot: VenueMediaPlacement) {
    const explicit = slotState[slot]
      ? items.find((item) => item.id === slotState[slot])
      : null;
    return explicit || (accommodation ? null : fallback);
  }

  async function setPlacement(slot: VenueMediaPlacement, mediaId: string) {
    setBusy(true);
    const fd = new FormData();
    fd.set("inline", "1");
    fd.set("locale", locale);
    fd.set("venueId", venueId);
    fd.set("mediaId", mediaId);
    fd.set("placement", slot);
    const result = await setVenueMediaPlacement(fd);
    if (result?.ok) {
      setSlotState((current) => ({ ...current, [slot]: mediaId }));
      setStatus("saved");
    } else {
      setStatus("error");
    }
    setBusy(false);
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  async function clearPlacement(slot: VenueMediaPlacement) {
    setBusy(true);
    const fd = new FormData();
    fd.set("inline", "1");
    fd.set("locale", locale);
    fd.set("venueId", venueId);
    fd.set("placement", slot);
    const result = await clearVenueMediaPlacement(fd);
    if (result?.ok) {
      setSlotState((current) => {
        const next = { ...current };
        delete next[slot];
        return next;
      });
      setStatus("saved");
    } else {
      setStatus("error");
    }
    setBusy(false);
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  async function updateHeader(mediaId: string, add: boolean) {
    setBusy(true);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("venueId", venueId);
    fd.set("mediaId", mediaId);
    try {
      const result = add
        ? await addStayHeaderPhoto(fd)
        : await removeStayHeaderPhoto(fd);
      if (result.ok) {
        setHeaderIds((current) =>
          add
            ? [...new Set([...current, mediaId])]
            : current.filter((id) => id !== mediaId),
        );
        setStatus("saved");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const source = new FormData(form);
    const files = source
      .getAll("image")
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );
    if (!files.length) return;

    if (listingLimits && items.length + files.length > (premium ? 250 : 8)) {
      setUploadError(
        es
          ? "La selección supera el límite de fotos de esta ficha. Tus archivos y textos siguen aquí; selecciona menos archivos o consulta Premium."
          : "This selection exceeds the listing photo allowance. Your files and text are still here; select fewer files or view Premium.",
      );
      return;
    }
    const sharedAlt = String(source.get("alt") || "").trim();
    const toHeader = source.get("destination") === "stay_header";
    if (toHeader && files.length + headerIds.length > 12) {
      setUploadError(
        es
          ? "La cabecera admite un máximo de 12 fotos. Quita algunas o selecciona menos."
          : "The header holds up to 12 photos. Remove some or select fewer.",
      );
      return;
    }
    setBusy(true);
    setUploadError("");
    setUploadProgress({ done: 0, total: files.length });

    const uploaded: VenueMediaStudioItem[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const fallbackAlt =
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim() || (es ? "Imagen del local" : "Venue image");
      const safeAlt =
        fallbackAlt.length >= 3
          ? fallbackAlt
          : es
            ? `Imagen del local ${index + 1}`
            : `Venue image ${index + 1}`;
      const fd = new FormData();
      fd.set("inline", "1");
      fd.set("locale", locale);
      fd.set("venueId", venueId);
      fd.set("sortOrder", String(items.length + index));
      fd.set("image", file);
      fd.set(
        "alt",
        files.length === 1 && sharedAlt
          ? sharedAlt
          : sharedAlt
            ? `${sharedAlt} ${index + 1}`
            : safeAlt,
      );

      let result;
      try {
        const response = await fetch("/api/business/venue-media", {
          method: "POST",
          body: fd,
          credentials: "same-origin",
          cache: "no-store",
        });
        result = await response
          .json()
          .catch(() => ({ ok: false, error: "unavailable" }));
      } catch {
        setUploadError(
          es
            ? `Falló la subida de ${file.name}. Comprueba la conexión.`
            : `Upload failed for ${file.name}. Check your connection.`,
        );
        setItems((current) => [...current, ...uploaded]);
        setStatus("error");
        setBusy(false);
        setUploadProgress(null);
        return;
      }
      if (!result?.ok || !result.media?.url) {
        const reason = result?.error;
        const explanation =
          reason === "resolution"
            ? es
              ? `La imagen debe medir como máximo ${premium ? 3840 : 1920} píxeles por lado. Vuelve a seleccionarla para prepararla.`
              : `Images must be at most ${premium ? 3840 : 1920} pixels per side. Select it again to prepare it.`
            : reason === "invalid-file"
              ? es
                ? "Archivo inválido o demasiado grande."
                : "Invalid or oversized file."
              : reason === "storage"
                ? es
                  ? "El almacenamiento rechazó el archivo."
                  : "Storage rejected the file."
                : reason === "quota"
                  ? es
                    ? "Has alcanzado el límite de imágenes o almacenamiento de esta ficha. El contenido existente se conserva."
                    : "This listing has reached its image or storage allowance. Existing content is retained."
                  : reason === "database"
                    ? es
                      ? "No se pudo guardar el archivo en la biblioteca."
                      : "Could not save the file to the media library."
                    : reason === "translation"
                      ? es
                        ? "Falló la traducción de la descripción."
                        : "Description translation failed."
                      : reason === "unavailable" || reason === "origin"
                        ? es
                          ? "El servidor no pudo procesar la subida. Vuelve a iniciar sesión y reinténtalo."
                          : "The server could not process the upload. Sign in again and retry."
                        : es
                          ? "No se pudo completar la subida."
                          : "Upload could not be completed.";
        setUploadError(`${file.name}: ${explanation}`);
        setItems((current) => [...current, ...uploaded]);
        setStatus("error");
        setBusy(false);
        setUploadProgress(null);
        return;
      }
      uploaded.push(result.media);
      if (toHeader) {
        const placement = new FormData();
        placement.set("locale", locale);
        placement.set("venueId", venueId);
        placement.set("mediaId", result.media.id);
        const assigned = await addStayHeaderPhoto(placement).catch(() => ({
          ok: false,
        }));
        if (!assigned.ok) {
          setItems((current) => [...current, ...uploaded]);
          setUploadError(
            es
              ? "La imagen se guardó en la biblioteca, pero no se pudo añadir a la cabecera. Selecciónala abajo."
              : "Photo saved to the library, but could not be added to the header. Select it below.",
          );
          setStatus("error");
          setBusy(false);
          setUploadProgress(null);
          return;
        }
        setHeaderIds((current) => [...current, result.media.id]);
      }
      setUploadProgress({ done: index + 1, total: files.length });
    }

    setItems((current) => [...current, ...uploaded]);
    form.reset();
    setStatus("saved");
    setBusy(false);
    setUploadProgress(null);
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  async function assignFolder(mediaId: string, name: string) {
    setBusy(true);
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("venueId", venueId);
    fd.set("mediaId", mediaId);
    fd.set("name", name);
    const result = await setMediaFolder(fd);
    if (result.ok) {
      setItems((current) =>
        current.map((item) =>
          item.id === mediaId ? { ...item, folder: name } : item,
        ),
      );
      setStatus("saved");
    } else setStatus("error");
    setBusy(false);
  }
  async function removeMedia(mediaId: string) {
    setBusy(true);
    const fd = new FormData();
    fd.set("inline", "1");
    fd.set("locale", locale);
    fd.set("venueId", venueId);
    fd.set("mediaId", mediaId);
    const result = await removeVenueImage(fd);
    if (result?.ok) {
      setItems((current) => current.filter((item) => item.id !== mediaId));
      setHeaderIds((current) => current.filter((id) => id !== mediaId));
      setSlotState((current) => {
        const next = { ...current };
        (Object.keys(next) as VenueMediaPlacement[]).forEach((key) => {
          if (next[key] === mediaId) delete next[key];
        });
        return next;
      });
      setStatus("saved");
    } else {
      setStatus("error");
    }
    setBusy(false);
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  const usedBy = useMemo(() => {
    const map = new Map<string, string[]>();
    slots.forEach((slot) => {
      const mediaId = slotState[slot.key];
      if (!mediaId) return;
      const labels = map.get(mediaId) || [];
      labels.push(es ? slot.es : slot.en);
      map.set(mediaId, labels);
    });
    return map;
  }, [slotState, es]);

  return (
    <section className="media-studio media-studio-five">
      <header className="media-studio-header">
        <div>
          <span className="eyebrow">
            {accommodation
              ? es
                ? "Imágenes del alojamiento"
                : "Property images"
              : es
                ? "Imágenes del local"
                : "Venue images"}
          </span>
          <h2>
            {es
              ? "Cinco superficies, una biblioteca."
              : "Five surfaces, one media library."}
          </h2>
          {listingLimits ? (
            <p role="status">
              {es
                ? `${items.length} de ${premium ? 250 : 8} fotos. Las imágenes existentes se conservan al cambiar de plan.`
                : `${items.length} of ${premium ? 250 : 8} photos. Existing images are retained when your plan changes.`}
              {!premium ? (
                <a
                  href={`${config.consumerUrl}/${locale}/account/subscription?app=${accommodation ? "akiduermo" : "akibusiness"}`}
                >
                  {es ? " Ver Premium de la ficha" : " View listing Premium"}
                </a>
              ) : null}
            </p>
          ) : null}
          <p>
            {accommodation
              ? es
                ? "Elige las cinco imágenes de la ficha. Las fotos de la cabecera se gestionan por separado."
                : "Choose the five listing images. Manage public header photos separately below."
              : es
                ? "Elige cada imagen sin salir de la página. Si una ranura queda vacía, AkiPasa usa la primera imagen de la biblioteca."
                : "Assign each image without leaving the page. Empty slots automatically use the first media-library image."}
          </p>
        </div>
        <small className="media-studio-live-status" aria-live="polite">
          {busy
            ? es
              ? "Guardando…"
              : "Saving…"
            : status === "saved"
              ? es
                ? "Actualizado."
                : "Updated."
              : status === "error"
                ? es
                  ? "No se pudo guardar."
                  : "Could not save."
                : ""}
        </small>
      </header>

      <div className="media-five-slots">
        {slots.map((slot) => {
          const selected = selectedFor(slot.key);
          const explicit = Boolean(slotState[slot.key]);
          return (
            <article className="media-five-slot" key={slot.key}>
              <div className="media-five-preview">
                {selected ? (
                  <img src={selected.url} alt={selected.alt} />
                ) : (
                  <span>{slot.icon}</span>
                )}
                {!explicit && selected ? (
                  <small className="media-fallback-chip">
                    {es ? "Automático" : "Auto"}
                  </small>
                ) : null}
              </div>
              <div className="media-five-copy">
                <strong>
                  <span aria-hidden="true">{slot.icon}</span>{" "}
                  {es ? slot.es : slot.en}
                </strong>
                <small>{es ? slot.esHelp : slot.enHelp}</small>
              </div>
              <div className="event-surface-actions">
                <button
                  className="button"
                  type="button"
                  disabled={busy}
                  aria-label={
                    es
                      ? `Elegir imagen: ${slot.es}`
                      : `Choose image: ${slot.en}`
                  }
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    pickerTriggerRef.current = event.currentTarget;
                    setPickerFolder("");
                    setPickerSlot(slot.key);
                    setPickerPage(0);
                    setPickerSearch("");
                  }}
                >
                  {es ? "Elegir imagen" : "Choose image"}
                </button>
                {explicit ? (
                  <button
                    className="button subtle"
                    type="button"
                    disabled={busy}
                    onClick={() => clearPlacement(slot.key)}
                  >
                    Auto
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {accommodation ? (
        <section
          className="stay-header-media"
          aria-label={es ? "Fotos de la cabecera" : "Header photos"}
        >
          <span className="eyebrow">
            {es ? "AkiDuermo · cabecera" : "AkiDuermo · header"}
          </span>
          <h3>{es ? "Galería del alojamiento" : "Property header gallery"}</h3>
          <p>
            {es
              ? "Sube fotos aquí o elige imágenes de la biblioteca. Solo las fotos añadidas a esta galería aparecen en la cabecera pública (máximo 12)."
              : "Upload here or choose from the media bin. Only photos added to this gallery appear in the public header (up to 12)."}
          </p>
          <div className="media-library-grid">
            {headerIds.map((id) => {
              const photo = items.find((item) => item.id === id);
              return photo ? (
                <article className="media-library-item" key={id}>
                  <div className="media-library-thumb">
                    <img src={photo.url} alt={photo.alt} />
                  </div>
                  <div className="media-library-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateHeader(id, false)}
                    >
                      {es ? "Quitar de la cabecera" : "Remove from header"}
                    </button>
                  </div>
                </article>
              ) : null;
            })}
          </div>
          {!headerIds.length ? (
            <p>
              {es
                ? "Aún no hay fotos públicas."
                : "No public header photos yet."}
            </p>
          ) : null}
          <form
            onSubmit={uploadMedia}
            className="media-upload-form"
            encType="multipart/form-data"
          >
            <input type="hidden" name="destination" value="stay_header" />
            <label>
              {es ? "Subir fotos a la cabecera" : "Upload header photos"}
              <SafeMediaFileInput
                locale={locale}
                name="image"
                required
                multiple
                maxFiles={12}
              />
            </label>
            <button
              className="button"
              type="submit"
              disabled={busy || headerIds.length >= 12}
            >
              {busy
                ? es
                  ? "Subiendo…"
                  : "Uploading…"
                : es
                  ? "Subir a la cabecera"
                  : "Upload to header"}
            </button>
          </form>
          {items.some((item) => !headerIds.includes(item.id)) &&
          headerIds.length < 12 ? (
            <div className="media-five-picker">
              {items
                .filter((item) => !headerIds.includes(item.id))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="media-mini-tile"
                    disabled={busy}
                    aria-label={
                      es
                        ? `Añadir ${item.alt} a la cabecera`
                        : `Add ${item.alt} to header`
                    }
                    onClick={() => updateHeader(item.id, true)}
                  >
                    <img src={item.url} alt="" />
                  </button>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="media-bin-heading">
        <div>
          <span className="eyebrow">
            {es ? "Biblioteca multimedia" : "Media bin"}
          </span>
          <h3>{es ? "Imágenes internas" : "Internal media"}</h3>
          <p>
            {es
              ? "Gestiona aquí tus archivos. Las imágenes elegidas para superficies públicas son visibles; la primera imagen propia puede usarse como predeterminada."
              : "Manage your files here. Artwork selected for public surfaces is visible; your first own image can be used as the default."}
          </p>
        </div>
        <span>{items.length}</span>
      </div>

      {uploadError ? (
        <p role="alert" className="safe-media-status error">
          {uploadError}
        </p>
      ) : null}
      <details className="media-upload-drawer" open={!items.length}>
        <summary>
          ＋ {es ? "Añadir a la biblioteca" : "Add to media bin"}
        </summary>
        <form
          ref={uploadFormRef}
          onSubmit={uploadMedia}
          className="media-upload-form"
          encType="multipart/form-data"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="venueId" value={venueId} />
          <label>
            {es ? "Imágenes o PDF" : "Images or PDFs"}
            <SafeMediaFileInput
              locale={locale}
              name="image"
              required
              multiple
              maxFiles={20}
              listingPremium={listingLimits ? premium : undefined}
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
                es
                  ? "Déjalo vacío para usar los nombres de archivo"
                  : "Leave blank to use filenames"
              }
            />
          </label>
          <button className="button" type="submit" disabled={busy}>
            {busy
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
      </details>

      {items.length ? (
        <div className="media-library-grid">
          {items.map((item, index) => (
            <article className="media-library-item" key={item.id}>
              <div className="media-library-thumb">
                <img src={item.url} alt={item.alt} />
                {index === 0 ? (
                  <span className="media-primary-chip">
                    {es ? "Principal" : "Primary"}
                  </span>
                ) : null}
              </div>
              <div className="media-library-copy">
                <strong>{item.alt}</strong>
                <small>
                  {Math.round(item.sizeBytes / 1024)} KB
                  {usedBy.get(item.id)?.length
                    ? " · " + usedBy.get(item.id)!.join(", ")
                    : ""}
                </small>
              </div>
              {premium && item.canDelete !== false && (
                <form
                  className="media-upload-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void assignFolder(
                      item.id,
                      String(
                        new FormData(event.currentTarget).get("folder") || "",
                      ).trim(),
                    );
                  }}
                >
                  <label>
                    {es ? "Carpeta" : "Folder"}
                    <input
                      name="folder"
                      defaultValue={item.folder || ""}
                      maxLength={80}
                      aria-label={
                        es ? `Carpeta de ${item.alt}` : `Folder for ${item.alt}`
                      }
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    {es ? "Guardar carpeta" : "Save folder"}
                  </button>
                </form>
              )}
              {item.canDelete === false && (
                <small>
                  {es ? "Compartida por otro local" : "Shared by another venue"}
                </small>
              )}
              <div className="media-library-actions media-library-actions-simple">
                <button
                  type="button"
                  className="danger"
                  disabled={busy || item.canDelete === false}
                  onClick={() => removeMedia(item.id)}
                >
                  {es ? "Eliminar" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="event-media-empty">
          <span>▧</span>
          <strong>{es ? "Todavía no hay imágenes" : "No media yet"}</strong>
        </div>
      )}
      {pickerSlot ? (
        <div
          className="event-media-modal-backdrop"
          role="presentation"
          onMouseDown={() => setPickerSlot(null)}
        >
          <section
            className="event-media-modal venue-media-picker-modal"
            ref={pickerDialogRef}
            tabIndex={-1}
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
                    ? slots.find((slot) => slot.key === pickerSlot)?.es
                    : slots.find((slot) => slot.key === pickerSlot)?.en}
                </h3>
              </div>
              <button
                type="button"
                className="event-media-modal-close"
                aria-label={es ? "Cerrar" : "Close"}
                onClick={() => setPickerSlot(null)}
              >
                ×
              </button>
            </header>
            <div className="venue-media-picker-controls">
              <input
                type="search"
                aria-label={es ? "Buscar imágenes" : "Search images"}
                placeholder={es ? "Buscar imágenes…" : "Search images…"}
                value={pickerSearch}
                onChange={(event) => {
                  setPickerSearch(event.target.value);
                  setPickerPage(0);
                }}
              />
              {folders.length > 0 && (
                <label>
                  {es ? "Carpeta" : "Folder"}
                  <select
                    value={pickerFolder}
                    onChange={(event) => {
                      setPickerFolder(event.target.value);
                      setPickerPage(0);
                    }}
                  >
                    <option value="">
                      {es ? "Todas las carpetas" : "All folders"}
                    </option>
                    {folders.map((folder) => (
                      <option key={folder}>{folder}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="event-media-modal-grid">
              {visiblePickerItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  className={
                    slotState[pickerSlot] === item.id ? "selected" : ""
                  }
                  onClick={async () => {
                    const slot = pickerSlot;
                    await setPlacement(slot, item.id);
                    setPickerSlot(null);
                  }}
                >
                  <img src={item.url} alt={item.alt} />
                  <span>{item.alt}</span>
                </button>
              ))}
              {!filteredPickerItems.length ? (
                <p className="muted">
                  {es ? "No hay imágenes disponibles." : "No images available."}
                </p>
              ) : null}
            </div>
            <footer>
              <button
                type="button"
                className="button subtle"
                disabled={busy}
                onClick={async () => {
                  const slot = pickerSlot;
                  await clearPlacement(slot);
                  setPickerSlot(null);
                }}
              >
                {es ? "Usar automático" : "Use automatic"}
              </button>
              <div className="event-media-pagination">
                <button
                  type="button"
                  aria-label={es ? "Página anterior" : "Previous page"}
                  disabled={safePickerPage === 0}
                  onClick={() => setPickerPage((page) => page - 1)}
                >
                  ←
                </button>
                <span>
                  {safePickerPage + 1} / {pickerPageCount}
                </span>
                <button
                  type="button"
                  aria-label={es ? "Página siguiente" : "Next page"}
                  disabled={safePickerPage >= pickerPageCount - 1}
                  onClick={() => setPickerPage((page) => page + 1)}
                >
                  →
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
