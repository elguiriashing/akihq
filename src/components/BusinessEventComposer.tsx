/* eslint-disable @next/next/no-img-element -- Venue media uses native images with existing layout controls. */
"use client";

import { config } from "@/lib/config";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createEvent } from "@/app/[locale]/business/actions";
import { GuardedActionForm } from "@/components/GuardedActionForm";

type VenueOption = { id: string; name: string };
type CategoryOption = { id: string; label: string };
export type BusinessMediaOption = {
  id: string;
  venueId: string;
  url: string;
  alt: string;
};

export function BusinessEventComposer({
  locale,
  venues,
  categories,
  media,
}: {
  locale: "es" | "en";
  venues: VenueOption[];
  categories: CategoryOption[];
  media: BusinessMediaOption[];
}) {
  const es = locale === "es";
  const router = useRouter();
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    bookingUrl: "",
    startsAt: "",
    endsAt: "",
  });
  const [submissionError, setSubmissionError] = useState("");
  const [submissionSaved, setSubmissionSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  async function submitEvent(formData: FormData) {
    setSubmitting(true);
    setSubmissionError("");
    setSubmissionSaved(false);
    formData.set("inline", "1");
    try {
      const result = await createEvent(formData);
      if (result?.ok) {
        setFormVersion((v) => v + 1);
        setDraft({
          title: "",
          description: "",
          bookingUrl: "",
          startsAt: "",
          endsAt: "",
        });
        setSlots({
          banner: "",
          explore: "",
          profile: "",
          background: "",
          map: "",
        });
        setPrice("0");
        setPriceMode("hide");
        setSubmissionSaved(true);
        router.refresh();
      } else setSubmissionError(result?.error || "event");
    } catch {
      setSubmissionError("unavailable");
    } finally {
      setSubmitting(false);
    }
  }
  const [venueId, setVenueId] = useState(venues[0]?.id || "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [priceMode, setPriceMode] = useState<"show" | "hide">("hide");
  const [price, setPrice] = useState("0");
  const [slots, setSlots] = useState({
    banner: "",
    explore: "",
    profile: "",
    background: "",
    map: "",
  });

  const [activeMediaSlot, setActiveMediaSlot] = useState<
    keyof typeof slots | null
  >(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeMedia = () => setActiveMediaSlot(null);

  useEffect(() => {
    if (activeMediaSlot === null) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = openerRef.current;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMedia();
      } else if (event.key === "Tab") {
        const controls = focusable();
        if (!controls.length) {
          event.preventDefault();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [activeMediaSlot]);

  const venueMedia = useMemo(
    () => media.filter((item) => item.venueId === venueId),
    [media, venueId],
  );

  function selectVenue(next: string) {
    setVenueId(next);
    setSlots({
      banner: "",
      explore: "",
      profile: "",
      background: "",
      map: "",
    });
  }

  return (
    <section className="event-studio">
      <header className="event-studio-hero">
        <div>
          <span className="eyebrow">{es ? "Nuevo evento" : "New event"}</span>
          <h2>
            {es ? "Crea la ficha visualmente" : "Build the event visually"}
          </h2>
          <p>
            {es
              ? "Elige las opciones como si estuvieras montando una ficha, no rellenando una declaración de la renta."
              : "Choose the options like you are building a listing, not filing a tax return."}
          </p>
        </div>
        <div className="event-studio-progress" aria-hidden="true">
          <span className="done">1</span>
          <i />
          <span>2</span>
          <i />
          <span>3</span>
        </div>
      </header>

      {submissionError ? (
        <p role="alert">
          {submissionError === "listing-limit"
            ? es
              ? "La ficha gratuita admite cuatro eventos por mes natural y cinco días por evento. Tu borrador sigue aquí."
              : "Free listings allow four events per calendar month and five days per event. Your draft is still here."
            : es
              ? "No se pudo crear el evento. Tu borrador sigue aquí; revisa los datos y vuelve a intentarlo."
              : "The event could not be created. Your draft is still here; check the details and retry."}
          {submissionError === "listing-limit" ? (
            <Link
              href={`${config.consumerUrl}/${locale}/account/subscription?app=akibusiness`}
            >
              {es ? " Ver Premium de la ficha" : " View listing Premium"}
            </Link>
          ) : null}
        </p>
      ) : null}
      {submissionSaved ? (
        <p role="status">{es ? "Evento creado." : "Event created."}</p>
      ) : null}
      <GuardedActionForm
        key={formVersion}
        action={submitEvent}
        className="event-studio-form"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="venueId" value={venueId} />
        <input type="hidden" name="categoryId" value={categoryId} />
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

        <section className="event-studio-card">
          <div className="event-studio-card-head">
            <span className="event-studio-step">1</span>
            <div>
              <h3>{es ? "Qué y dónde" : "What and where"}</h3>
              <p>
                {es
                  ? "Local, categoría y nombre."
                  : "Venue, category and name."}
              </p>
            </div>
          </div>

          <div className="event-choice-grid event-choice-grid-venues">
            {venues.map((venue) => (
              <button
                key={venue.id}
                type="button"
                className={
                  venueId === venue.id
                    ? "event-choice selected"
                    : "event-choice"
                }
                aria-pressed={venueId === venue.id}
                onClick={() => selectVenue(venue.id)}
              >
                <span className="event-choice-icon">⌂</span>
                <strong>{venue.name}</strong>
                <small>{es ? "Publicar aquí" : "Publish here"}</small>
              </button>
            ))}
          </div>

          <div
            className="event-category-strip"
            role="radiogroup"
            aria-label={es ? "Categoría" : "Category"}
          >
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                role="radio"
                aria-checked={categoryId === category.id}
                className={
                  categoryId === category.id
                    ? "event-category-pill selected"
                    : "event-category-pill"
                }
                onClick={() => setCategoryId(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <label className="event-studio-big-field">
            <span>{es ? "Nombre del evento" : "Event name"}</span>
            <input
              name="title"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              required
              minLength={3}
              maxLength={160}
              placeholder={
                es ? "Ej. Desayuno de los domingos" : "e.g. Sunday Breakfast"
              }
            />
          </label>
        </section>

        <section className="event-studio-card">
          <div className="event-studio-card-head">
            <span className="event-studio-step">2</span>
            <div>
              <h3>{es ? "Cómo se verá" : "How it looks"}</h3>
              <p>
                {es
                  ? "Reutiliza imágenes que ya has subido. Una foto, mil usos, porque duplicar archivos por diversión sería muy humano."
                  : "Reuse media you already uploaded. One image, many placements."}
              </p>
            </div>
          </div>

          {venueMedia.length ? (
            <div className="event-five-slots event-five-slots-create">
              {[
                ["banner", es ? "1 · Banner del evento" : "1 · Event banner"],
                ["explore", es ? "2 · Tarjeta Explorar" : "2 · Explore card"],
                ["profile", es ? "3 · Imagen de perfil" : "3 · Event profile"],
                [
                  "background",
                  es ? "4 · Fondo de la ficha" : "4 · Event background",
                ],
                ["map", es ? "5 · Vertical para mapa" : "5 · Map vertical"],
              ].map(([key, label]) => {
                const slotKey = key as keyof typeof slots;
                const selectedId = slots[slotKey];
                const selected =
                  venueMedia.find((item) => item.id === selectedId) ||
                  venueMedia[0];
                return (
                  <article
                    className="event-five-slot"
                    data-media-slot={key}
                    key={key}
                  >
                    <div className="event-five-preview">
                      {selected ? (
                        <img src={selected.url} alt={selected.alt} />
                      ) : (
                        <span>＋</span>
                      )}
                      {!selectedId && selected ? (
                        <small className="media-fallback-chip">
                          {es ? "Automático" : "Auto"}
                        </small>
                      ) : null}
                    </div>
                    <div>
                      <strong>{label}</strong>
                      <small>
                        {es
                          ? "Si no eliges una, usamos la primera imagen del local."
                          : "If you leave it empty, the venue's first image is used."}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="button secondary small-btn"
                      onClick={(event) => {
                        openerRef.current = event.currentTarget;
                        setActiveMediaSlot(slotKey);
                      }}
                    >
                      {es ? "Elegir de biblioteca" : "Choose from library"}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="event-media-empty">
              <span>▧</span>
              <strong>
                {es
                  ? "Aún no hay imágenes en este local"
                  : "No media for this venue yet"}
              </strong>
              <p>
                {es
                  ? "Puedes crear el evento igualmente. AkiPasa usará la imagen principal del local cuando exista."
                  : "You can still create the event. AkiPasa will use the venue's primary image when available."}
              </p>
            </div>
          )}

          {activeMediaSlot !== null && (
            <div
              role="presentation"
              onClick={() => setActiveMediaSlot(null)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(5,12,28,.82)",
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={es ? "Biblioteca de imágenes" : "Image library"}
                onClick={(event) => event.stopPropagation()}
                style={{
                  background: "#1b2946",
                  color: "#fff",
                  border: "1px solid #526080",
                  borderRadius: 18,
                  padding: 20,
                  width: "min(850px, 100%)",
                  maxHeight: "85vh",
                  overflow: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    {es ? "Selecciona una imagen" : "Select an image"}
                  </h3>
                  <button
                    type="button"
                    className="button secondary small-btn"
                    onClick={() => setActiveMediaSlot(null)}
                    aria-label={es ? "Cerrar" : "Close"}
                  >
                    ✕
                  </button>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(110px, 1fr))",
                    gap: 10,
                  }}
                >
                  {venueMedia.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={
                        item.alt || (es ? "Elegir imagen" : "Choose image")
                      }
                      aria-pressed={slots[activeMediaSlot] === item.id}
                      onClick={() => {
                        setSlots((current) => ({
                          ...current,
                          [activeMediaSlot]: item.id,
                        }));
                        setActiveMediaSlot(null);
                      }}
                      style={{
                        padding: 5,
                        borderRadius: 12,
                        border:
                          slots[activeMediaSlot] === item.id
                            ? "3px solid #ffd84d"
                            : "1px solid #526080",
                        background: "#111e37",
                        cursor: "pointer",
                      }}
                    >
                      <img
                        src={item.url}
                        alt={item.alt}
                        style={{
                          display: "block",
                          width: "100%",
                          aspectRatio: "1",
                          objectFit: "cover",
                          borderRadius: 8,
                        }}
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="button secondary small-btn"
                  style={{ marginTop: 14 }}
                  onClick={() => {
                    setSlots((current) => ({
                      ...current,
                      [activeMediaSlot]: "",
                    }));
                    setActiveMediaSlot(null);
                  }}
                >
                  {es ? "Usar imagen automática" : "Use automatic image"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="event-studio-card">
          <div className="event-studio-card-head">
            <span className="event-studio-step">3</span>
            <div>
              <h3>{es ? "Detalles prácticos" : "Practical details"}</h3>
              <p>
                {es
                  ? "Cuándo, precio y descripción."
                  : "When, price and description."}
              </p>
            </div>
          </div>

          <label className="event-studio-big-field">
            <span>{es ? "Descripción" : "Description"}</span>
            <textarea
              name="description"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              required
              minLength={20}
              rows={4}
            />
          </label>

          <div className="event-price-mode">
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
              <strong>{es ? "Sin precio de entrada" : "No entry price"}</strong>
              <small>
                {es
                  ? "No mostramos “Gratis”. Ideal para desayunos, mercados, bares, etc."
                  : "Do not show “Free”. Good for breakfasts, markets, bars, etc."}
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
              <strong>{es ? "Mostrar precio" : "Show a price"}</strong>
              <small>
                {es
                  ? "0 € se mostrará como Gratis."
                  : "€0 will display as Free."}
              </small>
            </button>
          </div>

          <div className="event-studio-grid">
            {priceMode === "show" ? (
              <label>
                {es ? "Precio de entrada (€)" : "Entry price (€)"}
                <input
                  name="priceEuros"
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  required
                />
              </label>
            ) : (
              <input type="hidden" name="priceEuros" value="0" />
            )}
            <label>
              {es ? "Enlace de reserva (opcional)" : "Booking link (optional)"}
              <input
                name="bookingUrl"
                value={draft.bookingUrl}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    bookingUrl: event.target.value,
                  }))
                }
                type="url"
                placeholder="https://"
              />
            </label>
            <label>
              {es ? "Empieza" : "Starts"}
              <input
                name="startsAt"
                value={draft.startsAt}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    startsAt: event.target.value,
                  }))
                }
                type="datetime-local"
                required
              />
            </label>
            <label>
              {es ? "Termina" : "Ends"}
              <input
                name="endsAt"
                value={draft.endsAt}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    endsAt: event.target.value,
                  }))
                }
                type="datetime-local"
                required
              />
            </label>
          </div>
        </section>

        <div className="event-studio-save">
          <div>
            <strong>
              {es ? "Listo cuando tú lo estés" : "Ready when you are"}
            </strong>
            <span>
              {es
                ? "El botón se activará cuando estén completos los campos obligatorios."
                : "The button activates once required fields are complete."}
            </span>
          </div>
          <button
            className="button primary event-studio-submit"
            type="submit"
            disabled={submitting}
          >
            {es ? "Crear evento" : "Create event"}
          </button>
        </div>
      </GuardedActionForm>
    </section>
  );
}
