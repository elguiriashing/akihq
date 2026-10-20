"use client";
/** Shared conversion presentation v1. No billing, identity or analytics authority. */
import { trackSuiteConversion } from "../lib/suite-conversion";
import React, { useRef, useState } from "react";
import { suiteHref } from "../lib/suite-navigation";
import styles from "./BusinessPathway.module.css";
type Category =
  | "hospitality"
  | "accommodation"
  | "services"
  | "retail"
  | "rental";
const demos: Record<Category, { en: string[]; es: string[] }> = {
  hospitality: {
    en: [
      "Build an order in PoS",
      "Keep stock organised",
      "Review sales and staff permissions",
    ],
    es: [
      "Prepara un pedido en el TPV",
      "Organiza las existencias",
      "Revisa ventas y permisos del personal",
    ],
  },
  accommodation: {
    en: [
      "Manage property listings and requests in AkiHQ",
      "Organise operational staff in AkiBusiness",
      "Review available reports for your location",
    ],
    es: [
      "Gestiona alojamientos y solicitudes en AkiHQ",
      "Organiza al equipo operativo en AkiBusiness",
      "Consulta los informes disponibles de tu ubicación",
    ],
  },
  services: {
    en: [
      "Organise services and availability in AkiHQ",
      "Keep customer records organised",
      "Delegate available operating tools to staff",
    ],
    es: [
      "Organiza servicios y disponibilidad en AkiHQ",
      "Organiza los datos de clientes",
      "Delega las herramientas operativas disponibles",
    ],
  },
  retail: {
    en: [
      "Build a sale in PoS",
      "Track inventory movements",
      "Organise customers and staff access",
    ],
    es: [
      "Prepara una venta en el TPV",
      "Controla movimientos de inventario",
      "Organiza clientes y acceso del personal",
    ],
  },
  rental: {
    en: [
      "Manage branches, fleet and requests in AkiHQ",
      "Organise staff operating permissions",
      "Review available business reports",
    ],
    es: [
      "Gestiona sucursales, flota y solicitudes en AkiHQ",
      "Organiza permisos operativos del personal",
      "Consulta los informes disponibles del negocio",
    ],
  },
};
export function BusinessPathway({
  locale,
  category = "hospitality",
  claimVenueId,
  chooseCategory = false,
}: {
  locale: "en" | "es";
  category?: Category;
  claimVenueId?: string;
  chooseCategory?: boolean;
}) {
  const seen = useRef(false);
  const es = locale === "es";
  const [selected, setSelected] = useState<Category>(category);
  const validClaim = claimVenueId && /^[0-9a-f-]{36}$/i.test(claimVenueId);
  const management = new URL(suiteHref("hq", locale));
  if (validClaim) {
    management.searchParams.set("view", "claims");
    management.searchParams.set("venueId", claimVenueId);
  }
  return (
    <details
      className={styles.root}
      onToggle={(event) => {
        if (event.currentTarget.open && !seen.current) {
          trackSuiteConversion("suite_cta_impression", locale, "hq", selected);
          seen.current = true;
        }
      }}
    >
      <summary>{es ? "¿Gestionas un negocio?" : "Run a business?"}</summary>
      <div className={styles.content}>
        <div>
          <h3>
            {validClaim
              ? es
                ? "Reclama y gestiona tu ficha gratis"
                : "Claim and manage your listing for free"
              : es
                ? "Tu negocio, conectado con AkiSuite"
                : "Your business, connected with AkiSuite"}
          </h3>
          <p>
            {es
              ? "AkiHQ es el centro gratuito para tus fichas, ubicaciones y equipo. AkiBusiness es el espacio de herramientas operativas de pago, con acceso según tu suscripción y permisos."
              : "AkiHQ is the free hub for listings, locations and teams. AkiBusiness is the paid operating workspace, with access determined by your subscription and permissions."}
          </p>
          <a
            href={management.toString()}
            onClick={() => {
              trackSuiteConversion("suite_cta_click", locale, "hq", selected);
              if (validClaim)
                trackSuiteConversion(
                  "business_claim_start",
                  locale,
                  "hq",
                  selected,
                );
            }}
          >
            {validClaim
              ? es
                ? "Reclamar con AkiHQ"
                : "Claim with AkiHQ"
              : es
                ? "Abrir AkiHQ gratis"
                : "Open free AkiHQ"}
          </a>
        </div>
        <div>
          <h4>{es ? "Vista de un flujo de trabajo" : "Workflow preview"}</h4>
          {chooseCategory && (
            <label>
              {es ? "Tipo de negocio" : "Business type"}
              <select
                value={selected}
                onChange={(event) =>
                  setSelected(event.target.value as Category)
                }
              >
                {(
                  [
                    "hospitality",
                    "accommodation",
                    "services",
                    "retail",
                    "rental",
                  ] as Category[]
                ).map((key) => (
                  <option value={key} key={key}>
                    {
                      {
                        hospitality: es ? "Hostelería" : "Hospitality",
                        accommodation: es ? "Alojamiento" : "Accommodation",
                        services: es ? "Servicios" : "Services",
                        retail: es ? "Comercio" : "Retail",
                        rental: es ? "Alquiler de coches" : "Car rental",
                      }[key]
                    }
                  </option>
                ))}
              </select>
            </label>
          )}
          <ol>
            {demos[selected][locale].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className={styles.fine}>
            {es
              ? "Ejemplo de organización, sin datos de clientes ni resultados inventados. Las herramientas disponibles dependen de tu ubicación, plan y permisos; no se activa ninguna compra desde aquí."
              : "An example workflow, without customer data or invented results. Available tools depend on your location, plan and permissions; no purchase is activated here."}
          </p>
          <a
            href={suiteHref("business", locale)}
            onClick={() =>
              trackSuiteConversion(
                "suite_cta_click",
                locale,
                "business",
                selected,
              )
            }
          >
            {es ? "Abrir AkiBusiness" : "Open AkiBusiness"}
          </a>
        </div>
      </div>
    </details>
  );
}
