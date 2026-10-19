"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/config";
import {
  deniedChoices,
  readPrivacyChoices,
  writePrivacyChoices,
  type PrivacyChoices,
} from "../lib/privacy-consent";

import {
  readMotionPreference,
  writeMotionPreference,
  requestPassportMotion,
} from "../lib/passport-motion";
import styles from "./PersonalisationConsent.module.css";

export function PersonalisationConsent({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [privacyHost, setPrivacyHost] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [choices, setChoices] = useState<PrivacyChoices>(deniedChoices);
  const [motionChoice, setMotionChoice] = useState(false);
  const [motionDenied, setMotionDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const privacyTrigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [changedLocale, setChangedLocale] = useState<{
    scope: string;
    locale: Locale;
  } | null>(null);
  // Root layouts persist during client navigation between localized routes.
  // AkiDuermo changes its language query in place through native history.
  // Keep the server locale as the fallback when neither route defines one.
  const queryLocale = searchParams?.get("lang");
  const localeScope = `${pathname ?? ""}?${queryLocale ?? ""}`;
  const currentLocale =
    pathname?.match(/^\/(en|es)(?=\/|$)/)?.[1] ??
    (changedLocale?.scope === localeScope
      ? changedLocale.locale
      : queryLocale === "en" || queryLocale === "es"
        ? queryLocale
        : locale);
  const es = currentLocale === "es";
  useEffect(() => {
    // Visiting another route must discard the previous route's override.
    setChangedLocale(null);
    // Stay screens retain Next's history markers, so their locale is explicit.
    const changeLanguage = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (value === "en" || value === "es")
        setChangedLocale({ scope: localeScope, locale: value });
    };
    window.addEventListener("akipasa:locale-change", changeLanguage);
    return () =>
      window.removeEventListener("akipasa:locale-change", changeLanguage);
  }, [localeScope]);
  useEffect(() => {
    setPrivacyHost(document.getElementById("passport-privacy-controls"));
  }, [pathname]);
  useEffect(() => {
    setMotionChoice(readMotionPreference() === true);
    setChoices(readPrivacyChoices());
    setVisible(!document.cookie.split("; ").includes("ak_consent_version=2"));
    const open = () => {
      setMotionChoice(readMotionPreference() === true);
      setChoices(readPrivacyChoices());
      setVisible(true);
    };
    window.addEventListener("akipasa:privacy-open", open);
    return () => window.removeEventListener("akipasa:privacy-open", open);
  }, []);
  async function choose(next: PrivacyChoices, motionEnabled = motionChoice) {
    // Request inside the click gesture, before the consent network request.
    const permission = motionEnabled
      ? requestPassportMotion()
      : Promise.resolve(true);
    writeMotionPreference(motionEnabled);
    setMotionChoice(motionEnabled);
    setMotionDenied(false);
    void permission.then((granted) => setMotionDenied(!granted));
    setSaving(true);
    setError(false);
    // Withdrawal takes effect locally even when the server is unavailable.
    const previous = readPrivacyChoices();
    writePrivacyChoices({
      analytics: previous.analytics && next.analytics,
      personalisation: previous.personalisation && next.personalisation,
      marketing: previous.marketing && next.marketing,
    });
    const response = await fetch("/api/v1/personalisation/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      setError(true);
      return;
    }
    writePrivacyChoices(next);
    setChoices(next);
    setVisible(false);
  }
  function dismiss() {
    if (saving) return;
    // Closing is not a consent decision. Keep saved permissions and the draft.
    setVisible(false);
    privacyTrigger.current?.focus({ preventScroll: true });
  }
  const privacyControl = (
    <div
      className={
        privacyHost
          ? "privacy-preferences privacy-preferences--passport"
          : "privacy-preferences"
      }
    >
      <button
        ref={privacyTrigger}
        type="button"
        className="button secondary"
        aria-expanded={visible}
        aria-controls={panelId}
        onClick={() => setVisible(true)}
      >
        {es ? "Opciones de privacidad" : "Privacy choices"}
      </button>
    </div>
  );
  return (
    <>
      {privacyHost ? createPortal(privacyControl, privacyHost) : privacyControl}
      {visible && (
        <aside
          id={panelId}
          className="personalisation-consent"
          aria-label={es ? "Opciones de privacidad" : "Privacy choices"}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || saving) return;
            event.preventDefault();
            event.stopPropagation();
            dismiss();
          }}
        >
          <div>
            <div className={styles.heading}>
              <strong>
                {es
                  ? "Tú eliges cómo usamos tus datos"
                  : "Choose how we use your data"}
              </strong>
              <button
                type="button"
                className={`button secondary ${styles.close}`}
                aria-label={
                  es ? "Cerrar opciones de privacidad" : "Close privacy choices"
                }
                disabled={saving}
                onClick={dismiss}
              >
                {es ? "Cerrar" : "Close"}
              </button>
            </div>
            <p>
              {es
                ? "Las funciones esenciales siempre están activas. Elige por separado los usos opcionales; puedes cambiarlos aquí cuando quieras."
                : "Essential functions are always active. Choose optional uses separately; you can change them here anytime."}
            </p>
            {(
              [
                [
                  "analytics",
                  es
                    ? "Medición de audiencia (Google Analytics)"
                    : "Audience measurement (Google Analytics)",
                ],
                [
                  "personalisation",
                  es
                    ? "Recomendaciones según mis interacciones"
                    : "Recommendations based on my interactions",
                ],
                [
                  "marketing",
                  es
                    ? "Personalización publicitaria"
                    : "Advertising personalisation",
                ],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="consent-row">
                <input
                  type="checkbox"
                  checked={choices[key]}
                  disabled={saving}
                  onChange={(e) =>
                    setChoices({ ...choices, [key]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))}
            <label className="consent-row">
              <input
                type="checkbox"
                checked={motionChoice}
                disabled={saving}
                onChange={(event) => setMotionChoice(event.target.checked)}
              />
              {es
                ? "Inclinación del pasaporte con el movimiento del móvil"
                : "Passport tilt using phone motion"}
            </label>
            <p className="muted">
              {es
                ? "El movimiento se usa solo en tu dispositivo. Si hace falta, el navegador pedirá permiso al guardar o aceptar todo."
                : "Motion is used only on your device. When required, your browser will ask for permission when you save or accept all."}
            </p>
            {motionDenied && (
              <p role="status">
                {es
                  ? "Movimiento no disponible. Puedes activarlo después en el pasaporte."
                  : "Motion unavailable. You can enable it later in your passport."}
              </p>
            )}
            {error && (
              <p role="alert">
                {es
                  ? "No se pudieron guardar las opciones. Los permisos retirados ya están desactivados en este navegador. Reintenta guardar."
                  : "Could not save your choices. Withdrawn permissions are already disabled in this browser. Please retry saving."}
              </p>
            )}
          </div>
          <div className="personalisation-consent-actions">
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => void choose({ ...deniedChoices }, false)}
            >
              {es ? "Rechazar opcionales" : "Reject optional"}
            </button>
            <button
              className="button"
              disabled={saving}
              onClick={() =>
                void choose(
                  { analytics: true, personalisation: true, marketing: true },
                  true,
                )
              }
            >
              {es ? "Aceptar todo" : "Accept all"}
            </button>
            <button
              className="button"
              disabled={saving}
              onClick={() => void choose(choices)}
            >
              {es ? "Guardar opciones" : "Save choices"}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
