"use client";
import Image from "next/image";
import { SafeMediaFileInput } from "@/components/SafeMediaFileInput";
import { useEffect, useState, type FormEvent } from "react";
type Limits = {
  premium: boolean;
  photos: number;
  used: number;
  max_dimension: number;
  uploads_enforced: boolean;
};
type Media = {
  id: string;
  altText: string;
  position: number | null;
  url: string | null;
};
export function IndependentAccommodationMedia({
  property,
  locale,
}: {
  property: string;
  locale: "en" | "es";
}) {
  const es = locale === "es";
  const [limits, setLimits] = useState<Limits | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [items, setItems] = useState<Media[]>([]),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLimits(null);
    setError(false);
    fetch(
      `/api/business/accommodations/media?property=${encodeURIComponent(property)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((result) => {
        if (active) {
          setItems(result.media || []);
          setLimits(result.limits ?? null);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [property, revision]);
  async function save(body: FormData | Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setFailure(null);
    try {
      const response = await fetch("/api/business/accommodations/media", {
        method: "POST",
        ...(body instanceof FormData
          ? { body }
          : {
              body: JSON.stringify(body),
              headers: { "Content-Type": "application/json" },
            }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setFailure(body.error ?? "unavailable");
        throw new Error(body.error ?? "unavailable");
      }
      setRevision((v) => v + 1);
    } catch (error) {
      setError(
        !(
          error instanceof Error &&
          ["quota", "resolution"].includes(error.message)
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("property", property);
    void save(data);
  }
  return (
    <section>
      <p>
        {es
          ? "Las imágenes permanecen privadas hasta colocarlas en la galería de una propiedad publicada. Máximo 10 MB por JPEG, PNG o WebP."
          : "Images remain private until placed in a published property's gallery. Maximum 10 MB per JPEG, PNG or WebP."}
      </p>
      {limits && (
        <p role="status">
          {es
            ? `Fotografías: ${limits.used} de ${limits.photos}. Resolución máxima: ${limits.max_dimension} píxeles por lado.`
            : `Photos: ${limits.used} of ${limits.photos}. Maximum resolution: ${limits.max_dimension} pixels per side.`}
        </p>
      )}
      {failure === "quota" && (
        <p role="alert">
          {es
            ? "Se alcanzó el límite. Tus fotografías existentes se conservan. Premium ofrece hasta 250 fotografías."
            : "The allowance is full. Your existing photos are retained. Premium provides up to 250 photos."}
        </p>
      )}
      {failure === "resolution" && (
        <p role="alert">
          {es
            ? "Selecciona de nuevo el archivo para prepararlo con la resolución permitida."
            : "Select the file again to prepare it at the permitted resolution."}
        </p>
      )}
      {limits && !limits.premium && (
        <a
          href={`https://akipasa.com/${locale}/account/subscription?app=akiduermo`}
        >
          {es
            ? "Consultar Premium para este alojamiento"
            : "View Premium for this accommodation"}
        </a>
      )}
      {error && (
        <p role="alert">
          {es
            ? "No se pudo cargar o guardar la imagen. Reintenta; no se considera una galería vacía."
            : "Could not load or save media. Retry; this is not treated as an empty gallery."}
        </p>
      )}
      <button
        type="button"
        disabled={loading || busy}
        onClick={() => setRevision((v) => v + 1)}
      >
        {es ? "Recargar fotografías" : "Reload photos"}
      </button>
      {loading ? (
        <p role="status">{es ? "Cargando fotografías…" : "Loading photos…"}</p>
      ) : (
        <>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <Image
                      src={item.url}
                      alt={
                        item.altText ||
                        (es
                          ? "Fotografía del alojamiento"
                          : "Accommodation photo")
                      }
                      width={200}
                      height={140}
                      unoptimized
                    />
                  </a>
                ) : (
                  <span>
                    {es ? "Fotografía no disponible" : "Photo unavailable"}
                  </span>
                )}
                <label>
                  {es ? "Posición en galería" : "Gallery position"}
                  <select
                    aria-label={`${es ? "Posición en galería" : "Gallery position"}: ${item.altText || item.id}`}
                    disabled={busy || error}
                    value={
                      item.position === null ? "private" : String(item.position)
                    }
                    onChange={(event) =>
                      void save({
                        action: "place",
                        property,
                        id: item.id,
                        position:
                          event.target.value === "private"
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  >
                    <option value="private">
                      {es ? "Privada" : "Private"}
                    </option>
                    {Array.from({ length: limits?.photos ?? 8 }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || error}
                  onClick={() =>
                    void save({ action: "remove", property, id: item.id })
                  }
                >
                  {es ? "Eliminar fotografía" : "Remove photo"}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={upload}>
            <fieldset
              disabled={
                busy ||
                error ||
                !limits?.uploads_enforced ||
                limits.used >= limits.photos
              }
            >
              <legend>{es ? "Subir fotografía" : "Upload photo"}</legend>
              <label>
                {es ? "Archivo" : "File"}
                <SafeMediaFileInput
                  name="file"
                  locale={locale}
                  required
                  listingPremium={limits?.premium ?? false}
                />
              </label>
              <label>
                {es ? "Descripción de la imagen" : "Image description"}
                <input name="altText" maxLength={300} />
              </label>
              <button type="submit">{es ? "Subir" : "Upload"}</button>
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}
