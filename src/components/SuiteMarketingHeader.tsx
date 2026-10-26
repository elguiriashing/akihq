import Image from "next/image";
import Link from "next/link";
import { PortalHeaderTools } from "./PortalHeaderTools";
import "./SuiteMarketingHeader.css";

/** Shared marketing-header v1 geometry; static adapter lives in AkiBusiness. */
export function SuiteMarketingHeader({ locale }: { locale: "en" | "es" }) {
  return (
    <header className="suite-marketing-header" data-brand="hq">
      <Link
        className="suite-marketing-brand"
        href={`/?lang=${locale}`}
        aria-label={locale === "es" ? "Inicio de AkiHQ" : "AkiHQ home"}
      >
        <Image
          src="/brand/v3/hq.svg"
          width={40}
          height={40}
          alt=""
          unoptimized
        />
        <span>
          Aki<strong>HQ.</strong>
        </span>
      </Link>
      <nav
        className="suite-marketing-links"
        aria-label={
          locale === "es" ? "Navegación principal" : "Primary navigation"
        }
      >
        <a href="#tools">{locale === "es" ? "Herramientas" : "Tools"}</a>
        <a href="#pricing">{locale === "es" ? "Precios" : "Pricing"}</a>
        <a
          className="suite-marketing-peer"
          href={`https://akibusiness.com/?locale=${locale}`}
        >
          AkiBusiness
        </a>
      </nav>
      <PortalHeaderTools
        locale={locale}
        product="business"
        languageHref={`/?lang=${locale === "en" ? "es" : "en"}`}
      />
      <Link className="suite-marketing-signin" href={`/login?lang=${locale}`}>
        {locale === "es" ? "Entrar" : "Sign in"}
        <span aria-hidden="true">↗</span>
      </Link>
    </header>
  );
}
