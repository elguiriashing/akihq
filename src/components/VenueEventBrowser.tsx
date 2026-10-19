"use client";

import { Children, useEffect, useMemo, useState, type ReactNode } from "react";

// prettier-ignore
type EventSummary = { id: string; title: string; status: string; date: string | null };
const SIZE = 9;
// prettier-ignore
export function VenueEventBrowser({ locale, events, children }: {
  locale: "en" | "es"; events: EventSummary[]; children: ReactNode;
}) {
  const es = locale === "es";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const childrenArray = Children.toArray(children);
  const group = (e: EventSummary) => e.status === "archived" ? "archived" :
    e.date && new Date(e.date).getTime() < Date.now() ? "past" : "current";
  const categories = [
    ["all", es ? "Todos" : "All"],
    ["current", es ? "Actuales y próximos" : "Current and upcoming"],
    ["past", es ? "Anteriores" : "Past"],
    ["archived", es ? "Archivados" : "Archived"]
  ];
  const filtered = useMemo(() => events.map((event, index) => ({ event, index }))
    .filter(({ event }) => (filter === "all" || group(event) === filter) &&
      (!query.trim() || [event.title, event.status].some(value =>
        value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))),
    [events, query, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * SIZE, current * SIZE);
  useEffect(() => {
    function reveal() {
      const id = window.location.hash.match(/^#event-(.+)$/)?.[1];
      if (!id) return;
      const index = events.findIndex(event => event.id === id);
      if (index < 0) return;
      setFilter("all");
      setQuery("");
      setPage(Math.floor(index / SIZE) + 1);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const target = document.getElementById("event-" + id);
        if (target instanceof HTMLDetailsElement) {
          target.open = true;
          target.scrollIntoView({ block: "start" });
        }
      }));
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [events]);
  return <section className="venue-event-browser" aria-label={es ? "Eventos del local" : "Venue events"}>
    <div className="venue-event-toolbar">
      <input type="search" value={query} aria-label={es ? "Buscar eventos" : "Search events"}
        placeholder={es ? "Buscar por nombre o estado…" : "Search by name or status…"}
        onChange={e => { setQuery(e.target.value); setPage(1); }} />
      <div className="venue-event-filters" role="group" aria-label={es ? "Filtrar eventos" : "Filter events"}>
        {categories.map(([id, label]) => <button type="button" key={id}
          className={filter === id ? "selected" : ""} aria-pressed={filter === id}
          onClick={() => { setFilter(id); setPage(1); }}>
          {label} <span>{events.filter(e => id === "all" || group(e) === id).length}</span>
        </button>)}
      </div>
    </div>
    {visible.length ? <div className="venue-event-grid">
      {visible.map(({ event, index }) =>
        <div className="venue-event-item" key={event.id}>{childrenArray[index]}</div>)}
    </div> : <p className="notice">{es ? "No hay eventos que coincidan." : "No matching events."}</p>}
    <nav className="venue-event-pagination" aria-label={es ? "Paginación" : "Pagination"}>
      <span aria-live="polite">{filtered.length ? (current - 1) * SIZE + 1 : 0}–{Math.min(current * SIZE, filtered.length)} / {filtered.length}</span>
      <div>
        <button type="button" disabled={current === 1} aria-label={es ? "Anterior" : "Previous"} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
        <span>{current} / {pages}</span>
        <button type="button" disabled={current === pages} aria-label={es ? "Siguiente" : "Next"} onClick={() => setPage(p => Math.min(pages, p + 1))}>›</button>
      </div>
    </nav>
    <style jsx>{`
      .venue-event-browser { width: 100%; min-width: 0; }
      .venue-event-toolbar { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; align-items: center; }
      .venue-event-toolbar input { flex: 1 1 240px; min-width: 0; margin: 0; }
      .venue-event-filters { display: flex; gap: 6px; flex-wrap: wrap; }
      .venue-event-filters button, .venue-event-pagination button { border: 1px solid var(--border, #47546d); border-radius: 999px; padding: 9px 12px; background: transparent; color: inherit; cursor: pointer; }
      .venue-event-filters button.selected { background: #ffd84d; border-color: #ffd84d; color: #17223d; font-weight: 750; }
      .venue-event-filters button span { opacity: .75; padding-left: 4px; }
      .venue-event-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
      .venue-event-item { min-width: 0; }
      .venue-event-item:has(details[open]) { grid-column: 1 / -1; }
      .venue-event-item :global(details[data-event-card]) { margin: 0; }
      .venue-event-pagination { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 16px; }
      .venue-event-pagination > div { display: flex; gap: 12px; align-items: center; }
      .venue-event-pagination button:disabled { opacity: .35; cursor: default; }
      @media (max-width: 900px) { .venue-event-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 600px) { .venue-event-grid { grid-template-columns: 1fr; } .venue-event-filters { width: 100%; } }
    `}</style>
  </section>;
}
