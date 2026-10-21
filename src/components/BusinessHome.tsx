"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icons";
import { BusinessTeamRefresh } from "./BusinessTeamRefresh";
import { VenueDeleteControl } from "./VenueDeleteControl";
import styles from "./BusinessHome.module.css";

export type ManagedPlace = {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
  product: "venue" | "stay" | "rental";
  venueId?: string | null;
};
const pageSize = 8;
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function BusinessHome({
  locale,
  places,
  readError = false,
  partialError = false,
  deleteAction,
}: {
  locale: "en" | "es";
  places: ManagedPlace[];
  readError?: boolean;
  partialError?: boolean;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const es = locale === "es";
  const base = `/${locale}/business`;
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const labels: Record<string, string> = es
    ? {
        owner: "Propietario",
        manager: "Gestor",
        editor: "Editor",
        published: "Publicado",
        draft: "Borrador",
        pending: "Pendiente",
        archived: "Archivado",
        rejected: "Rechazado",
      }
    : {
        owner: "Owner",
        manager: "Manager",
        editor: "Editor",
        published: "Published",
        draft: "Draft",
        pending: "Pending",
        archived: "Archived",
        rejected: "Rejected",
      };
  const filtered = places
    .filter(
      (place) =>
        (product === "all" || place.product === product) &&
        (status === "all" || place.status === status) &&
        normalize(place.name).includes(normalize(search.trim())),
    )
    .sort((a, b) =>
      sort === "status"
        ? a.status.localeCompare(b.status) ||
          a.name.localeCompare(b.name, locale)
        : a.name.localeCompare(b.name, locale),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  function reset() {
    setSearch("");
    setProduct("all");
    setStatus("all");
    setPage(1);
  }
  return (
    <section className={styles.home}>
      <BusinessTeamRefresh />
      <div
        className={styles.shortcuts}
        aria-label={es ? "Accesos rápidos" : "Quick actions"}
      >
        <Link href={`${base}?view=claims`}>
          <Icon name="plus" size={24} />
          <span>
            {es ? "Añadir negocio" : "Add a business"}
            <small>{es ? "Local o alojamiento" : "Venue or stay"}</small>
          </span>
          <Icon name="arrow-right" size={18} />
        </Link>
        <Link href={`${base}?view=events`}>
          <Icon name="calendar" size={24} />
          <span>
            {es ? "Eventos" : "Events"}
            <small>{es ? "Crear y gestionar" : "Create and manage"}</small>
          </span>
          <Icon name="arrow-right" size={18} />
        </Link>
        <Link href={`${base}?view=analytics`}>
          <Icon name="activity" size={24} />
          <span>
            {es ? "Estadísticas" : "Analytics"}
            <small>{es ? "Ver actividad" : "View activity"}</small>
          </span>
          <Icon name="arrow-right" size={18} />
        </Link>
      </div>
      <div className={styles.workspace}>
        {partialError && !readError && (
          <p className={styles.partialWarning} role="status">
            {es
              ? "Mostramos los negocios disponibles; una fuente no respondió y se puede reintentar recargando."
              : "Available businesses are shown; one source did not respond and can be retried by reloading."}
          </p>
        )}
        <div className={styles.heading}>
          <div>
            <h2>
              {es ? "Mis negocios y alojamientos" : "My businesses and stays"}
            </h2>
            <p>
              {es
                ? "Elige un lugar para abrir sus herramientas."
                : "Choose a place to open its tools."}
            </p>
          </div>
          <span className={styles.total}>{places.length}</span>
        </div>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Icon name="search" size={19} />
            <input
              type="search"
              aria-label={es ? "Buscar mis negocios" : "Search my places"}
              placeholder={es ? "Buscar por nombre…" : "Search by name…"}
              value={search}
              maxLength={100}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className={styles.select}>
            <span>{es ? "Estado" : "Status"}</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">
                {es ? "Todos los estados" : "All statuses"}
              </option>
              {Array.from(new Set(places.map((place) => place.status)))
                .sort()
                .map((value) => (
                  <option key={value} value={value}>
                    {labels[value] || value}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.select}>
            <span>{es ? "Ordenar" : "Sort"}</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="name">{es ? "Nombre A–Z" : "Name A–Z"}</option>
              <option value="status">{es ? "Por estado" : "By status"}</option>
            </select>
          </label>
        </div>
        <div
          className={styles.tabs}
          role="group"
          aria-label={es ? "Tipo de negocio" : "Place type"}
        >
          {(
            [
              ["all", es ? "Todos" : "All"],
              ["venue", es ? "Locales" : "Venues"],
              ["stay", es ? "Alojamientos" : "Stays"],
              ["rental", es ? "Sucursales" : "Branches"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={product === value}
              onClick={() => {
                setProduct(value);
                setPage(1);
              }}
            >
              {label}
              <span>
                {
                  places.filter(
                    (place) => value === "all" || place.product === value,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <p className={styles.result} role="status">
          {filtered.length} {es ? "lugares" : "places"}
          {filtered.length > pageSize
            ? ` · ${es ? "Página" : "Page"} ${currentPage} / ${pages}`
            : ""}
        </p>
        {readError ? (
          <div className={styles.empty} role="alert">
            <Icon name="inbox" size={32} />
            <h3>
              {es
                ? "No pudimos cargar tus negocios"
                : "Could not load your places"}
            </h3>
            <p>
              {es
                ? "Vuelve a cargar la página para intentarlo de nuevo."
                : "Reload the page to try again."}
            </p>
            <button type="button" onClick={() => location.reload()}>
              {es ? "Reintentar" : "Try again"}
            </button>
          </div>
        ) : shown.length ? (
          <div className={styles.grid}>
            {shown.map((place) => (
              <article
                className={styles.place}
                key={place.id}
                data-product={place.product}
              >
                <div className={styles.placeHead}>
                  <span className={styles.glyph}>
                    <Icon
                      name={
                        place.product === "stay"
                          ? "bed"
                          : place.product === "rental"
                            ? "car"
                            : "venue"
                      }
                      size={24}
                    />
                  </span>
                  <span className={styles.product}>
                    {place.product === "stay"
                      ? "AkiDuermo"
                      : place.product === "rental"
                        ? "AkiCoches"
                        : "AkiPasa"}
                  </span>
                  <span className={styles.status}>
                    {labels[place.status] || place.status}
                  </span>
                </div>
                <h3>{place.name}</h3>
                <p>{labels[place.role] || place.role}</p>
                <div className={styles.actions}>
                  <Link
                    href={
                      place.product === "rental"
                        ? `${base}/mobility?company=${place.id}`
                        : `${base}/venue/${place.id}`
                    }
                    aria-label={`${es ? "Gestionar" : "Manage"} ${place.name}`}
                  >
                    <span>
                      {place.product === "rental"
                        ? es
                          ? "Gestionar flota"
                          : "Manage fleet"
                        : place.product === "stay"
                          ? es
                            ? "Gestionar alojamiento"
                            : "Manage stay"
                          : es
                            ? "Gestionar local"
                            : "Manage venue"}
                    </span>
                    <Icon name="arrow-right" size={18} />
                  </Link>
                  {place.product !== "rental" &&
                    place.role === "owner" &&
                    place.slug !== "akipasa-editorial" && (
                      <details className={styles.more}>
                        <summary
                          aria-label={`${es ? "Opciones de" : "Options for"} ${place.name}`}
                        >
                          <Icon name="more" size={20} />
                        </summary>
                        <div>
                          <VenueDeleteControl
                            locale={locale}
                            venueId={place.id}
                            venueName={place.name}
                            action={deleteAction}
                          />
                        </div>
                      </details>
                    )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <Icon name="business" size={32} />
            <h3>
              {places.length
                ? es
                  ? "Sin resultados"
                  : "No matches"
                : es
                  ? "Tu primer negocio empieza aquí"
                  : "Your first business starts here"}
            </h3>
            <p>
              {places.length
                ? es
                  ? "Prueba otro nombre o cambia los filtros."
                  : "Try another name or change the filters."
                : es
                  ? "Reclama tu local o alojamiento para gestionarlo."
                  : "Claim your venue or accommodation to manage it."}
            </p>
            {places.length ? (
              <button type="button" onClick={reset}>
                {es ? "Restablecer filtros" : "Reset filters"}
              </button>
            ) : (
              <Link href={`${base}?view=claims`}>
                {es ? "Encontrar mi negocio" : "Find my business"}
                <Icon name="arrow-right" size={18} />
              </Link>
            )}
          </div>
        )}
        {!readError && pages > 1 && (
          <nav
            className={styles.pagination}
            aria-label={es ? "Páginas de negocios" : "Places pages"}
          >
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              {es ? "Anterior" : "Previous"}
            </button>
            <span>
              {currentPage} / {pages}
            </span>
            <button
              type="button"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              {es ? "Siguiente" : "Next"}
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
