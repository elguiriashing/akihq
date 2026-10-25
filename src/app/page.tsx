import { managementLocale } from "@/lib/management-locale";
import { PortalHeaderTools } from "@/components/PortalHeaderTools";
import type { Metadata } from "next";
import Link from "next/link";
import { PortalLogo } from "@/components/PortalLogo";
import "./landing.css";

export const metadata: Metadata = {
  title: "AkiHQ | Your business, in one place",
  description:
    "AkiHQ is the free management hub for your companies, locations, listings, teams and bookings across AkiSuite.",
  alternates: { canonical: "https://akihq.app/" },
  robots: { index: true, follow: true },
};

const copy = {
  en: {
    navTools: "Tools",
    navPricing: "Pricing",
    navAccess: "Sign in",
    language: "ES",
    eyebrow: "THE FREE AKISUITE BUSINESS HUB",
    titleFirst: "Your business.",
    titleSecond: "One clear view.",
    intro:
      "Bring your locations, teams, listings and bookings into one organised home. AkiHQ handles the management. You focus on what comes next.",
    start: "Open AkiHQ",
    discover: "Explore the tools",
    free: "Free to use",
    connected: "One account across AkiSuite",
    screenEyebrow: "YOUR WORKSPACE",
    screenTitle: "Good morning, team",
    screenSubtitle: "An organised view across every location.",
    live: "Your business overview",
    overview: "Overview",
    cards: ["Companies & locations", "Listings & media", "Bookings & requests"],
    flow: "Connected to your AkiSuite products",
    flowItems: ["AkiPasa", "AkiDuermo", "AkiCoches"],
    usedForEyebrow: "USED FOR",
    usedForTitle: "One hub. Three discovery platforms.",
    usedForDescription:
      "Manage the public business presence for your venues, stays and rental branches across AkiSuite.",
    toolsKicker: "BUILT FOR EVERYDAY MANAGEMENT",
    toolsTitle: "Less jumping between tabs. More getting things done.",
    toolsIntro:
      "Manage the essentials in one calm workspace, with each location and staff member kept in their right place.",
    features: [
      [
        "01",
        "Companies & locations",
        "Organise different businesses, venues, accommodation and rental branches without mixing their records.",
      ],
      [
        "02",
        "Listings & content",
        "Keep public business details, events and media ready for the AkiSuite discovery platforms.",
      ],
      [
        "03",
        "Bookings & requests",
        "See and manage the enquiries and reservations your locations receive.",
      ],
      [
        "04",
        "Teams & access",
        "Invite your people and control which locations they can work with.",
      ],
      [
        "05",
        "Discovery connections",
        "Move between AkiPasa, AkiDuermo and AkiCoches without losing sight of your business.",
      ],
      [
        "06",
        "Ready to grow",
        "Start with free management and add AkiBusiness operating tools when you need them.",
      ],
    ],
    priceEyebrow: "SIMPLE FROM DAY ONE",
    priceTitle: "The essentials cost nothing.",
    priceBody:
      "Company, location and listing management stays free. Paid operating tools and optional discovery upgrades are separate.",
    priceName: "AkiHQ",
    priceTerm: "/forever",
    included: "Included with your free workspace",
    perks: [
      "Company and location overview",
      "Listing and media management",
      "Team access and booking workspaces",
      "Connections across AkiSuite",
    ],
    priceAction: "Get started free",
    upgradeKicker: "NEED MORE POWER?",
    upgradeTitle: "Meet AkiBusiness.",
    upgradeBody:
      "Point of sale, inventory, CRM, staff operations and reporting tools for businesses ready to run their day-to-day from one suite.",
    upgradeAction: "Explore AkiBusiness plans",
    footer: "AkiHQ is part of AkiSuite by AkiPasa.",
    ctaTitle: "Make room for what matters.",
    ctaAction: "Go to your workspace",
    mockNav: ["Overview", "Locations", "Bookings", "Team"],
    status: "Workspace ready",
  },
  es: {
    navTools: "Herramientas",
    navPricing: "Precios",
    navAccess: "Entrar",
    language: "EN",
    eyebrow: "EL CENTRO GRATUITO PARA NEGOCIOS DE AKISUITE",
    titleFirst: "Tu negocio.",
    titleSecond: "Todo bajo control.",
    intro:
      "Reúne tus ubicaciones, equipos, fichas y reservas en un único lugar. AkiHQ se ocupa de la gestión y tú de lo importante.",
    start: "Abrir AkiHQ",
    discover: "Ver herramientas",
    free: "Uso gratuito",
    connected: "Una cuenta para AkiSuite",
    screenEyebrow: "TU ESPACIO",
    screenTitle: "Buenos días, equipo",
    screenSubtitle: "Una visión organizada de cada ubicación.",
    live: "Resumen de tu negocio",
    overview: "Resumen",
    cards: [
      "Empresas y ubicaciones",
      "Fichas y multimedia",
      "Reservas y solicitudes",
    ],
    flow: "Conectado con tus productos AkiSuite",
    flowItems: ["AkiPasa", "AkiDuermo", "AkiCoches"],
    usedForEyebrow: "PARA GESTIONAR",
    usedForTitle: "Un centro. Tres plataformas de descubrimiento.",
    usedForDescription:
      "Gestiona la presencia pública de tus locales, alojamientos y sucursales de alquiler en AkiSuite.",
    toolsKicker: "PENSADO PARA TU DÍA A DÍA",
    toolsTitle: "Menos pestañas. Más cosas hechas.",
    toolsIntro:
      "Gestiona lo esencial desde un espacio claro, respetando los permisos de cada equipo y ubicación.",
    features: [
      [
        "01",
        "Empresas y ubicaciones",
        "Organiza diferentes negocios, locales, alojamientos y sucursales de alquiler sin mezclar sus datos.",
      ],
      [
        "02",
        "Fichas y contenido",
        "Mantén al día datos públicos, eventos e imágenes de tus negocios en las plataformas AkiSuite.",
      ],
      [
        "03",
        "Reservas y solicitudes",
        "Consulta y gestiona las reservas y solicitudes recibidas en tus ubicaciones.",
      ],
      [
        "04",
        "Equipos y acceso",
        "Invita a tu equipo y controla a qué ubicaciones tiene acceso cada persona.",
      ],
      [
        "05",
        "Conexiones AkiSuite",
        "Salta entre AkiPasa, AkiDuermo y AkiCoches sin perder de vista tu negocio.",
      ],
      [
        "06",
        "Listo para crecer",
        "Empieza con gestión gratuita y añade las herramientas operativas de AkiBusiness cuando lo necesites.",
      ],
    ],
    priceEyebrow: "SENCILLO DESDE EL PRIMER DÍA",
    priceTitle: "Lo esencial cuesta cero.",
    priceBody:
      "Gestionar empresas, ubicaciones y fichas sigue siendo gratuito. Las herramientas operativas y mejoras opcionales se contratan aparte.",
    priceName: "AkiHQ",
    priceTerm: "/para siempre",
    included: "Incluido con tu espacio gratuito",
    perks: [
      "Vista de empresas y ubicaciones",
      "Gestión de fichas y multimedia",
      "Equipo y espacios de reservas",
      "Conexión con AkiSuite",
    ],
    priceAction: "Empezar gratis",
    upgradeKicker: "¿NECESITAS MÁS?",
    upgradeTitle: "Descubre AkiBusiness.",
    upgradeBody:
      "TPV, inventario, CRM, operaciones de personal e informes para gestionar el día a día de tu negocio.",
    upgradeAction: "Ver planes AkiBusiness",
    footer: "AkiHQ forma parte de AkiSuite by AkiPasa.",
    ctaTitle: "Dedícate a lo que importa.",
    ctaAction: "Ir a mi espacio",
    mockNav: ["Resumen", "Ubicaciones", "Reservas", "Equipo"],
    status: "Espacio preparado",
  },
} as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; locale?: string }>;
}) {
  const params = await searchParams;
  const lang = managementLocale("/", params);
  const c = copy[lang];
  const login = `/login?lang=${lang}`;
  return (
    <main className="hq-landing" id="top">
      <header className="hq-landing-header">
        <Link className="hq-landing-brand" href="/" aria-label="AkiHQ home">
          <PortalLogo product="hq" />
        </Link>
        <nav aria-label="Primary navigation">
          <a href="#tools">{c.navTools}</a>
          <a href="#pricing">{c.navPricing}</a>
          <Link className="hq-nav-login" href={login}>
            {c.navAccess} <span aria-hidden="true">↗</span>
          </Link>
        </nav>
        <PortalHeaderTools
          locale={lang}
          product="business"
          languageHref={`/?lang=${lang === "en" ? "es" : "en"}`}
        />
      </header>

      <section className="hq-hero">
        <div className="hq-hero-copy">
          <span className="hq-kicker">
            <span className="hq-kicker-dot" />
            {c.eyebrow}
          </span>
          <h1>
            {c.titleFirst}
            <br />
            <em>{c.titleSecond}</em>
          </h1>
          <p>{c.intro}</p>
          <div className="hq-hero-actions">
            <Link className="hq-button hq-button-primary" href={login}>
              {c.start} <span aria-hidden="true">↗</span>
            </Link>
            <a className="hq-button hq-button-ghost" href="#tools">
              {c.discover} <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hq-hero-proof">
            <span>✓ {c.free}</span>
            <span>✳ {c.connected}</span>
          </div>
        </div>
        <div className="hq-showcase" aria-label={c.live}>
          <div className="hq-showcase-glow" aria-hidden="true" />
          <div className="hq-app-window">
            <div className="hq-app-top">
              <span className="hq-dots">
                <i />
                <i />
                <i />
              </span>
              <span>AkiHQ / {c.overview}</span>
              <span className="hq-app-ready">● {c.status}</span>
            </div>
            <div className="hq-app-main">
              <aside className="hq-app-sidebar">
                <div className="hq-app-monogram">
                  A<span>✳</span>
                </div>
                {c.mockNav.map((item, index) => (
                  <span className={index === 0 ? "selected" : ""} key={item}>
                    <b>{["◫", "▤", "◷", "♧"][index]}</b> {item}
                  </span>
                ))}
              </aside>
              <div className="hq-app-content">
                <small>{c.screenEyebrow}</small>
                <h2>{c.screenTitle}</h2>
                <p>{c.screenSubtitle}</p>
                <div className="hq-app-tiles">
                  {c.cards.map((item, index) => (
                    <div key={item}>
                      <span className="hq-tile-emoji">
                        {["◈", "▦", "◷"][index]}
                      </span>
                      <strong>{item}</strong>
                      <span className="hq-skeleton" />
                    </div>
                  ))}
                </div>
                <div className="hq-app-connected">
                  <span className="hq-pulse" /> {c.flow}
                  <div>
                    {c.flowItems.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <span className="hq-floating-note">
            <span>✳</span> AKISUITE CONNECTED
          </span>
        </div>
      </section>

      <section className="hq-used-for" aria-labelledby="hq-used-for-title">
        <div className="hq-used-for-copy">
          <span className="hq-kicker">{c.usedForEyebrow}</span>
          <h2 id="hq-used-for-title">{c.usedForTitle}</h2>
          <p>{c.usedForDescription}</p>
        </div>
        <nav className="hq-used-for-logos" aria-label={c.usedForTitle}>
          <a
            className="hq-used-for-product hq-used-for-pasa"
            href="https://akipasa.com/"
            aria-label="AkiPasa"
          >
            <PortalLogo product="pasa" />
            <span aria-hidden="true">↗</span>
          </a>
          <a
            className="hq-used-for-product hq-used-for-duermo"
            href="https://akiduermo.com/"
            aria-label="AkiDuermo"
          >
            <PortalLogo product="duermo" />
            <span aria-hidden="true">↗</span>
          </a>
          <a
            className="hq-used-for-product hq-used-for-coches"
            href="https://akicoches.com/"
            aria-label="AkiCoches"
          >
            <PortalLogo product="coches" />
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </section>

      <section id="tools" className="hq-section hq-tools">
        <div className="hq-section-heading">
          <span className="hq-kicker">{c.toolsKicker}</span>
          <h2>{c.toolsTitle}</h2>
          <p>{c.toolsIntro}</p>
        </div>
        <div className="hq-feature-grid">
          {c.features.map(([number, title, description]) => (
            <article key={number}>
              <span>{number} / 06</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="hq-feature-arrow" aria-hidden="true">
                ↗
              </span>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="hq-section hq-pricing">
        <div className="hq-section-heading">
          <span className="hq-kicker">{c.priceEyebrow}</span>
          <h2>{c.priceTitle}</h2>
          <p>{c.priceBody}</p>
        </div>
        <div className="hq-price-layout">
          <article className="hq-free-plan">
            <div className="hq-plan-top">
              <span>{c.priceName}</span>
              <span className="hq-free-pill">FREE</span>
            </div>
            <div className="hq-price">
              <strong>€0</strong>
              <span>{c.priceTerm}</span>
            </div>
            <p>{c.included}</p>
            <ul>
              {c.perks.map((item) => (
                <li key={item}>
                  <span>✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href={login} className="hq-button hq-button-primary">
              {c.priceAction} ↗
            </Link>
          </article>
          <article className="hq-upgrade">
            <div className="hq-orb">✳</div>
            <span className="hq-kicker">{c.upgradeKicker}</span>
            <h3>{c.upgradeTitle}</h3>
            <p>{c.upgradeBody}</p>
            <a
              href="https://akibusiness.com/#pricing"
              className="hq-upgrade-link"
            >
              {c.upgradeAction} ↗
            </a>
          </article>
        </div>
      </section>

      <section className="hq-final">
        <h2>{c.ctaTitle}</h2>
        <Link className="hq-button hq-button-primary" href={login}>
          {c.ctaAction} ↗
        </Link>
      </section>
      <footer className="hq-footer">
        <span>{c.footer}</span>
        <div>
          <a href="https://akipasa.com">AkiPasa</a>
          <a href="https://akiduermo.com">AkiDuermo</a>
          <a href="https://akicoches.com">AkiCoches</a>
          <a href="https://akibusiness.com">AkiBusiness</a>
        </div>
      </footer>
    </main>
  );
}
