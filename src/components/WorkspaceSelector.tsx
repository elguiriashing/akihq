"use client";

import { useState } from "react";
import Image from "next/image";
import { AkiSelector } from "./aki-selector/AkiSelector";
import { suiteHref } from "../lib/suite-navigation";
import { useSuiteReferral } from "./useSuiteReferral";
import "./workspace-selector.css";

export type LoginWorkspace = "pasa" | "duermo" | "coches" | "hq" | "business";
const workspaces = [
  {
    id: "pasa",
    label: "AkiPasa",
    effect: "ember",
    accent: "242,107,29",
    path: "/auth",
  },
  {
    id: "duermo",
    label: "AkiDuermo",
    effect: "breeze",
    accent: "47,194,165",
    path: "/account",
  },
  {
    id: "coches",
    label: "AkiCoches",
    effect: "bloom",
    accent: "255,48,71",
    path: "/account",
  },
  {
    id: "hq",
    label: "AkiHQ",
    effect: "solar",
    accent: "255,197,51",
    path: "/auth",
  },
  {
    id: "business",
    label: "AkiBusiness",
    effect: "aurora",
    accent: "154,112,250",
    path: "/login",
  },
] as const;

/** Browsing choices never leaves or changes the sign-in form. Navigation is explicit. */
export function WorkspaceSelector({
  locale,
  current,
}: {
  locale: "en" | "es";
  current: LoginWorkspace;
}) {
  const [selected, setSelected] = useState<LoginWorkspace>(current);
  const referralCode = useSuiteReferral();
  const es = locale === "es";
  const item = workspaces.find((option) => option.id === selected)!;
  return (
    <aside
      className="auth-product-portals aki-workspace-picker"
      aria-label={es ? "Elige tu espacio" : "Choose your workspace"}
    >
      <h2 className="aki-workspace-picker__title">
        {es ? "Elige tu espacio" : "Choose your workspace"}
      </h2>
      <AkiSelector
        className="aki-workspace-selector"
        ariaLabel={es ? "Espacios AkiSuite" : "AkiSuite workspaces"}
        locale={locale}
        intensity="subtle"
        value={selected}
        onValueChange={(id) => setSelected(id as LoginWorkspace)}
        options={workspaces.map((option) => ({
          ...option,
          symbol: (
            <Image
              src={`/brand/v3/${option.id}.svg`}
              alt=""
              width={56}
              height={56}
              unoptimized
            />
          ),
          subtitle:
            option.id === current
              ? es
                ? "Espacio actual"
                : "Current workspace"
              : "",
        }))}
      />
      <div className="aki-workspace-picker__action">
        {selected === current ? (
          <span className="aki-workspace-picker__current">
            {es ? "Estás en" : "You’re in"} {item.label}
          </span>
        ) : (
          <a
            href={suiteHref(selected, locale, {
              path: item.path,
              referralCode,
            })}
          >
            {es ? "Abrir" : "Open"} {item.label}{" "}
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </aside>
  );
}
