"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./Icons";
import {
  getVenueDashboardSection,
  type VenueDashboardSection,
} from "../lib/venue-dashboard";
import styles from "./VenueDashboard.module.css";

type ToolSection = Exclude<VenueDashboardSection, "overview">;
type Counts = {
  photos: number;
  events: number;
  catalogueItems?: number;
  programs: number;
  credentials: number;
  requests: number;
  members: number;
  vehicles?: number;
};

export function VenueDashboard({
  locale,
  name,
  status,
  verified,
  publicHref,
  initialSection,
  feedback,
  counts,
  sections,
  overview,
  product = "venue",
}: {
  locale: "en" | "es";
  name: string;
  status: string;
  verified: boolean;
  publicHref?: string;
  initialSection: VenueDashboardSection;
  feedback?: "success" | "error";
  counts: Counts;
  sections: Partial<Record<ToolSection, ReactNode>>;
  overview?: ReactNode;
  product?: "venue" | "accommodation";
  mobility?: boolean;
}) {
  const es = locale === "es";
  const stay = product === "accommodation";
  const [active, setActive] = useState(
    product === "accommodation" &&
      !["overview", "profile", "bookings", "team"].includes(initialSection)
      ? "overview"
      : initialSection,
  );
  const [showFeedback, setShowFeedback] = useState(Boolean(feedback));
  const dashboard = useRef<HTMLElement>(null);
  const tabs = useRef<
    Partial<Record<VenueDashboardSection, HTMLButtonElement | null>>
  >({});

  useEffect(() => {
    const root = dashboard.current;
    const header = root
      ?.closest(".akibusiness-host")
      ?.querySelector(".akibusiness-topbar");
    if (!root || !header) return;
    const measure = () =>
      root.style.setProperty(
        "--business-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  function countLabel(
    value: number,
    en: [string, string],
    spanish: [string, string],
  ) {
    return `${value} ${(es ? spanish : en)[value === 1 ? 0 : 1]}`;
  }
  const tools: {
    id: ToolSection;
    label: string;
    description: string;
    icon: IconName;
    detail: string;
  }[] = [
    {
      id: "profile",
      label: es ? "Perfil" : "Profile",
      description: es
        ? "Datos, contacto y fotos"
        : "Details, contact and photos",
      icon: "venue",
      detail: countLabel(counts.photos, ["photo", "photos"], ["foto", "fotos"]),
    },
    {
      id: "events",
      label: es ? "Eventos" : "Events",
      description: es
        ? "Fechas, edición y audiencia"
        : "Dates, editing and audience",
      icon: "calendar",
      detail: countLabel(
        counts.events,
        ["event", "events"],
        ["evento", "eventos"],
      ),
    },
    {
      id: "catalogue",
      label: es ? "Carta / catálogo" : "Menu / catalogue",
      description: es
        ? "Comida, productos y servicios"
        : "Food, products and services",
      icon: "inbox",
      detail: countLabel(
        counts.catalogueItems || 0,
        ["item", "items"],
        ["elemento", "elementos"],
      ),
    },
    {
      id: "rewards",
      label: es ? "Fidelidad" : "Rewards",
      description: es
        ? "Sellos, premios y ofertas"
        : "Stamps, rewards and offers",
      icon: "gift",
      detail: countLabel(
        counts.programs,
        ["active card", "active cards"],
        ["tarjeta activa", "tarjetas activas"],
      ),
    },
    {
      id: "checkin",
      label: "Check-in",
      description: es ? "Código QR y canjes" : "QR code and redemptions",
      icon: "passport",
      detail: counts.credentials
        ? es
          ? "QR disponible"
          : "QR ready"
        : es
          ? "Configurar QR"
          : "Set up QR",
    },
    {
      id: "bookings",
      label: es ? "Reservas" : "Bookings",
      description: stay
        ? es
          ? "Gestión de alojamiento y disponibilidad"
          : "Stay reservations and availability"
        : es
          ? "Solicitudes y disponibilidad"
          : "Requests and availability",
      icon: "inbox",
      detail: countLabel(
        counts.requests,
        ["pending", "pending"],
        ["pendiente", "pendientes"],
      ),
    },
    {
      id: "fleet",
      label: "AkiCoches",
      description: es
        ? "Flota, precios, disponibilidad y solicitudes"
        : "Fleet, prices, availability and requests",
      icon: "venue",
      detail: countLabel(
        counts.vehicles || 0,
        ["vehicle", "vehicles"],
        ["vehículo", "vehículos"],
      ),
    },
    {
      id: "team",
      label: es ? "Equipo" : "Team",
      description: es ? "Miembros y permisos" : "Members and permissions",
      icon: "users",
      detail: countLabel(
        counts.members,
        ["member", "members"],
        ["miembro", "miembros"],
      ),
    },
  ];
  const availableTools = stay
    ? tools.filter((tool) => ["profile", "bookings", "team"].includes(tool.id))
    : tools.filter((tool) => tool.id !== "fleet");
  const navigation = [
    {
      id: "overview" as const,
      label: es ? "Resumen" : "Overview",
      icon: "home" as const,
    },
    ...availableTools,
  ];
  const statusLabels: Record<string, string> = es
    ? {
        published: "Publicado",
        pending: "En revisión",
        draft: "Borrador",
        archived: "Archivado",
        rejected: "Rechazado",
      }
    : {
        published: "Published",
        pending: "In review",
        draft: "Draft",
        archived: "Archived",
        rejected: "Rejected",
      };

  useEffect(() => {
    function restoreLocation() {
      const query = Object.fromEntries(
        new URLSearchParams(window.location.search),
      );
      const eventId = window.location.hash.slice(1);
      const event = eventId.startsWith("event-")
        ? document.getElementById(eventId)
        : null;
      const requested = event ? "events" : getVenueDashboardSection(query);
      setActive(
        stay && !["overview", "profile", "bookings", "team"].includes(requested)
          ? "overview"
          : requested,
      );
      if (event instanceof HTMLDetailsElement) {
        event.open = true;
        requestAnimationFrame(() => event.scrollIntoView({ block: "start" }));
      }
    }
    // Preserve old event links from the main business dashboard.
    if (window.location.hash.startsWith("#event-")) restoreLocation();
    window.addEventListener("popstate", restoreLocation);
    window.addEventListener("hashchange", restoreLocation);
    return () => {
      window.removeEventListener("popstate", restoreLocation);
      window.removeEventListener("hashchange", restoreLocation);
    };
  }, [stay]);

  function selectSection(section: VenueDashboardSection) {
    setActive(section);
    setShowFeedback(false);
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    url.searchParams.delete("updated");
    url.searchParams.delete("error");
    url.hash = "";
    window.history.pushState(window.history.state, "", url);
    tabs.current[section]?.focus({ preventScroll: true });
    if (typeof tabs.current[section]?.scrollIntoView === "function") {
      tabs.current[section]?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }

  return (
    <main
      ref={dashboard}
      className={styles.dashboard}
      data-active-section={active}
    >
      <Link className={styles.back} href={`/${locale}/business`}>
        <Icon name="arrow-right" />
        {stay
          ? es
            ? "Mis negocios y alojamientos"
            : "My businesses and stays"
          : es
            ? "Mis locales"
            : "My venues"}
      </Link>
      <header className={styles.header}>
        <div className={styles.venueMark}>
          <Icon name="venue" />
        </div>
        <div className={styles.identity}>
          <span className={styles.eyebrow}>
            {stay ? "AkiDuermo" : es ? "Gestionar local" : "Manage venue"}
          </span>
          <h1>{name}</h1>
          <div className={styles.status}>
            <span>
              <i data-published={status === "published"} />
              {statusLabels[status] || status}
            </span>
            {verified ? (
              <span>
                <Icon name="shield" />
                {es ? "Verificado" : "Verified"}
              </span>
            ) : (
              <span>
                {es ? "Pendiente de verificación" : "Awaiting verification"}
              </span>
            )}
          </div>
        </div>
        {publicHref && (
          <Link className={styles.publicLink} href={publicHref}>
            {es ? "Ver ficha" : "View listing"}
            <Icon name="arrow-right" />
          </Link>
        )}
      </header>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={
          stay
            ? es
              ? "Herramientas del alojamiento"
              : "Accommodation tools"
            : es
              ? "Herramientas del local"
              : "Venue tools"
        }
      >
        {navigation.map((item, index) => (
          <button
            key={item.id}
            id={`venue-tab-${item.id}`}
            ref={(element) => {
              tabs.current[item.id] = element;
            }}
            type="button"
            role="tab"
            aria-label={
              "detail" in item ? `${item.label} · ${item.detail}` : item.label
            }
            aria-selected={active === item.id}
            aria-controls={`venue-panel-${item.id}`}
            tabIndex={active === item.id ? 0 : -1}
            onClick={() => selectSection(item.id)}
            onKeyDown={(event) => {
              let next: number | undefined;
              if (event.key === "ArrowRight")
                next = (index + 1) % navigation.length;
              if (event.key === "ArrowLeft")
                next = (index - 1 + navigation.length) % navigation.length;
              if (event.key === "Home") next = 0;
              if (event.key === "End") next = navigation.length - 1;
              if (next !== undefined) {
                event.preventDefault();
                selectSection(navigation[next].id);
              }
            }}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
      {showFeedback && (
        <p
          className={styles.feedback}
          role={feedback === "error" ? "alert" : "status"}
        >
          {feedback === "error"
            ? es
              ? "No se pudo guardar. Revisa los datos y permisos."
              : "Could not save. Check the data and permissions."
            : es
              ? "Cambios guardados."
              : "Changes saved."}
        </p>
      )}
      <section
        className={styles.section}
        data-section="overview"
        id="venue-panel-overview"
        role="tabpanel"
        aria-labelledby="venue-tab-overview"
        hidden={active !== "overview"}
        tabIndex={0}
      >
        <div className={styles.sectionHeading}>
          <h2>
            {stay
              ? es
                ? "Tu alojamiento, bajo control"
                : "Your property, at a glance"
              : es
                ? "Todo tu local, a mano"
                : "Your venue, at a glance"}
          </h2>
          <p>
            {es
              ? "Elige qué quieres gestionar."
              : "Choose what you want to manage."}
          </p>
        </div>
        {overview}
      </section>
      {availableTools.map((tool) => (
        <section
          key={tool.id}
          className={styles.section}
          data-section={tool.id}
          id={`venue-panel-${tool.id}`}
          role="tabpanel"
          aria-labelledby={`venue-tab-${tool.id}`}
          hidden={active !== tool.id}
          tabIndex={0}
        >
          <div className={styles.sectionHeading}>
            <h2>{tool.label}</h2>
            <p>{tool.description}</p>
          </div>
          {["profile", "events", "catalogue", "rewards"].includes(tool.id) && (
            <div className={styles.translationAssist}>
              <Icon name="globe" />
              <span>
                <strong>
                  {es ? "Escribe en español." : "Write in English."}
                </strong>{" "}
                {es
                  ? "Al guardar, AkiPasa crea automáticamente la versión en inglés para los usuarios EN."
                  : "When you save, AkiPasa automatically creates the Spanish version for ES users."}
              </span>
            </div>
          )}
          {sections[tool.id]}
        </section>
      ))}
    </main>
  );
}
