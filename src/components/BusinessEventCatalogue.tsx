"use client";

import { useMemo, useState } from "react";

type EventItem = {
  id: string;
  venueId: string;
  slug: string;
  title: string;
  venue: string;
  status: string;
  group: "current" | "past" | "archived";
  date: string | null;
};

type Props = {
  locale: "en" | "es";
  events: EventItem[];
  reuseAction: (formData: FormData) => void | Promise<void>;
};

const PAGE_SIZE = 9;

export function BusinessEventCatalogue({ locale, events, reuseAction }: Props) {
  const es = locale === "es";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return events.filter((event) => {
      const matchesStatus = status === "all" || event.group === status;
      const matchesQuery =
        !query ||
        [event.title, event.venue, event.status].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      return matchesStatus && matchesQuery;
    });
  }, [events, search, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const filters = [
    { value: "all", label: es ? "Todos" : "All", count: events.length },
    {
      value: "current",
      label: es ? "Actuales y próximos" : "Current and upcoming",
      count: events.filter((e) => e.group === "current").length,
    },
    {
      value: "past",
      label: es ? "Anteriores" : "Past",
      count: events.filter((e) => e.group === "past").length,
    },
    {
      value: "archived",
      label: es ? "Archivados" : "Archived",
      count: events.filter((e) => e.group === "archived").length,
    },
  ];

  return (
    <section
      aria-label={es ? "Catálogo de eventos" : "Event catalogue"}
      className="business-event-catalogue"
    >
      <div className="catalogue-section-header">
        <div>
          <span className="eyebrow">
            {es ? "Catálogo de eventos" : "Event catalogue"}
          </span>
          <h2>{es ? "Tus eventos" : "Your events"}</h2>
        </div>
        <a
          className="button button-strong"
          href={`/${locale}/business?view=events&compose=1#create-event`}
        >
          {es ? "Crear evento" : "Create event"}
        </a>
      </div>
      <div className="business-event-toolbar">
        <label className="business-event-search">
          <span className="sr-only">
            {es ? "Buscar eventos" : "Search events"}
          </span>
          <input
            type="search"
            value={search}
            placeholder={
              es
                ? "Buscar por nombre, local o estado…"
                : "Search by name, venue or status…"
            }
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div
          className="business-event-filters"
          role="group"
          aria-label={es ? "Filtrar eventos" : "Filter events"}
        >
          {filters.map((filter) => (
            <button
              key={filter.value}
              className={status === filter.value ? "is-active" : ""}
              type="button"
              aria-pressed={status === filter.value}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
            >
              {filter.label} <span>{filter.count}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <div className="business-event-nine-grid">
          {visible.map((event) => (
            <article className="business-event-tile" key={event.id}>
              <div className="business-event-tile-main">
                <span
                  className={`status-pill ${event.status === "published" ? "badge-success" : event.status === "archived" ? "badge-neutral" : "badge-warning"}`}
                >
                  {event.status}
                </span>
                <h3 title={event.title}>{event.title}</h3>
                <p title={event.venue}>{event.venue}</p>
                <small>
                  {event.date
                    ? new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Europe/Madrid",
                      }).format(new Date(event.date))
                    : es
                      ? "Sin fecha"
                      : "No date"}
                </small>
              </div>
              <div className="business-event-tile-actions">
                <a
                  className="button secondary small-btn"
                  href={`/${locale}/business/venue/${event.venueId}?section=events#event-${event.id}`}
                >
                  {es ? "Gestionar" : "Manage"}
                </a>
                <form action={reuseAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="sourceSlug" value={event.slug} />
                  <button className="button small-btn" type="submit">
                    {es ? "Reutilizar" : "Reuse"}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="catalogue-empty-card">
          {es ? "No hay eventos que coincidan." : "No matching events."}
        </div>
      )}
      <div className="business-event-pagination">
        <span aria-live="polite">
          {filtered.length
            ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} / ${filtered.length}`
            : "0 / 0"}
        </span>
        <div>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label={es ? "Página anterior" : "Previous page"}
          >
            ‹
          </button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label={es ? "Página siguiente" : "Next page"}
          >
            ›
          </button>
        </div>
      </div>
      <style jsx>{`
        .business-event-catalogue {
          width: 100%;
          min-width: 0;
        }
        .business-event-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 14px 0 16px;
          align-items: center;
        }
        .business-event-search {
          flex: 1 1 250px;
          min-width: 0;
        }
        .business-event-search input {
          width: 100%;
          margin: 0;
        }
        .business-event-filters {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .business-event-filters button,
        .business-event-pagination button {
          border: 1px solid var(--border, #47546d);
          background: transparent;
          border-radius: 999px;
          color: inherit;
          padding: 9px 12px;
          cursor: pointer;
        }
        .business-event-filters .is-active {
          background: #ffd84d;
          border-color: #ffd84d;
          color: #17223d;
          font-weight: 750;
        }
        .business-event-filters span {
          opacity: 0.7;
          padding-left: 3px;
        }
        .business-event-nine-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .business-event-tile {
          min-width: 0;
          min-height: 148px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 10px;
          padding: 13px;
          border-radius: 15px;
          border: 1px solid rgba(160, 180, 220, 0.22);
          background: rgba(130, 160, 220, 0.055);
        }
        .business-event-tile-main {
          min-width: 0;
        }
        .business-event-tile h3 {
          font-size: 0.99rem;
          margin: 8px 0 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .business-event-tile p {
          margin: 0 0 8px;
          opacity: 0.75;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.85rem;
        }
        .business-event-tile small {
          opacity: 0.8;
        }
        .business-event-tile .status-pill {
          font-size: 0.65rem;
        }
        .business-event-tile-actions {
          display: flex;
          gap: 7px;
        }
        .business-event-tile-actions > * {
          flex: 1;
          min-width: 0;
        }
        .business-event-tile-actions form button,
        .business-event-tile-actions a {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          padding: 7px 4px;
          font-size: 0.78rem;
        }
        .business-event-pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 14px 2px 0;
        }
        .business-event-pagination > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .business-event-pagination button:disabled {
          opacity: 0.35;
          cursor: default;
        }
        @media (max-width: 850px) {
          .business-event-nine-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 540px) {
          .business-event-nine-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .business-event-tile {
            min-height: 120px;
          }
          .business-event-filters {
            width: 100%;
          }
          .business-event-filters button {
            flex: 1;
            padding: 8px 5px;
            font-size: 0.75rem;
          }
        }
      `}</style>
    </section>
  );
}
