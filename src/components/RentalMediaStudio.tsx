/* eslint-disable @next/next/no-img-element -- Signed branch media previews. */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRentalMedia } from "@/app/[locale]/business/mobility/actions";
import type { RentalMediaRow } from "@/lib/rental-media";
import s from "./RentalBranch.module.css";
export function RentalMediaStudio({
  locale,
  companyId,
  media,
  importPending,
}: {
  locale: "en" | "es";
  companyId: string;
  media: RentalMediaRow[];
  importPending?: boolean;
}) {
  const es = locale === "es",
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const filtered = media.filter((m) =>
      m.alt.toLowerCase().includes(search.toLowerCase()),
    ),
    pages = Math.max(1, Math.ceil(filtered.length / 8));
  return (
    <div className={s.mediaStudio}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const files = (form.elements.namedItem("files") as HTMLInputElement)
            .files;
          if (!files?.length) return;
          setBusy(true);
          setMessage("");
          try {
            for (const file of [...files].slice(0, 8)) {
              const data = new FormData();
              data.set("companyId", companyId);
              data.set("file", file);
              const response = await fetch("/api/business/rental-media", {
                method: "POST",
                body: data,
              });
              if (!response.ok) throw Error();
            }
            form.reset();
            setMessage(es ? "Fotos guardadas" : "Photos saved");
          } catch {
            setMessage(
              es
                ? "No se pudieron subir todas las fotos. Usa JPG, PNG o WebP de hasta 8 MB y reintenta."
                : "Some uploads failed. Use JPG, PNG or WebP up to 8 MB and retry.",
            );
          } finally {
            setBusy(false);
            router.refresh();
          }
        }}
        className={s.upload}
      >
        <label>
          {es ? "Fotos de esta sucursal" : "This branch's photos"}
          <input
            type="file"
            name="files"
            multiple
            required
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
          />
        </label>
        <button disabled={busy}>
          {busy ? "…" : es ? "Subir fotos" : "Upload photos"} ↗
        </button>
        <small>
          {es
            ? "Biblioteca exclusiva de esta sucursal · hasta 8 fotos por subida · 8 MB por foto"
            : "Exclusive branch library · up to 8 photos per upload · 8 MB per photo"}
        </small>
      </form>
      {importPending && (
        <p role="status">
          {es
            ? "Hay portadas antiguas pendientes de copia. Recarga para reintentar; los originales no se borran."
            : "Some previous covers are awaiting import. Reload to retry; original files are preserved."}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <input
        type="search"
        aria-label={es ? "Buscar fotos" : "Search photos"}
        placeholder={es ? "Buscar fotos…" : "Search photos…"}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      <div className={s.mediaGrid}>
        {filtered
          .slice(
            Math.min(page, pages - 1) * 8,
            Math.min(page, pages - 1) * 8 + 8,
          )
          .map((item) => (
            <article key={item.id}>
              {item.url ? (
                <img src={item.url} alt={item.alt} />
              ) : (
                <div>
                  {es ? "Vista previa no disponible" : "Preview unavailable"}
                </div>
              )}
              <span>{item.alt}</span>
              <form action={deleteRentalMedia}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="companyId" value={companyId} />
                <input type="hidden" name="mediaId" value={item.id} />
                <button type="submit" disabled={busy}>
                  {es ? "Quitar de la biblioteca" : "Remove from library"}
                </button>
              </form>
            </article>
          ))}
      </div>
      {!filtered.length && (
        <p>
          {es
            ? "Tu biblioteca está lista para las primeras fotos de la flota."
            : "Your library is ready for the first fleet photos."}
        </p>
      )}
      <div className={s.pager}>
        <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
          ←
        </button>
        <span>
          {Math.min(page + 1, pages)}/{pages}
        </span>
        <button
          disabled={page >= pages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          →
        </button>
      </div>
    </div>
  );
}
