import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { config, isLocale } from "@/lib/config";
import { safeAuthDestination } from "@/lib/auth-security";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptTerms } from "./actions";
import { headers } from "next/headers";
import { safeStayDestination } from "@/lib/akiduermo-routing";
import { safeConduzcoDestination } from "@/lib/akiconduzco-routing";

export default async function TermsAcceptancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const product = (await headers()).get("x-akipasa-product");
  const stayHost = product === "akiduermo";
  const conduzcoHost = product === "akiconduzco";
  const next = stayHost
    ? safeStayDestination(query.next)
    : conduzcoHost
      ? safeConduzcoDestination(query.next)
      : safeAuthDestination(locale, query.next);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(
      `/${locale}/auth?next=${encodeURIComponent(`/${locale}/terms/accept?next=${encodeURIComponent(next)}`)}`,
    );
  const es = locale === "es";

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">
          {es ? "Antes de continuar" : "Before you continue"}
        </div>
        <h1>
          {es
            ? "Confirma las condiciones actuales"
            : "Accept the current terms"}
        </h1>
        <p className="lede">
          {es
            ? "Necesitamos registrar qué versión aceptaste para mantener tu cuenta y tus datos de forma responsable."
            : "We need to record which version you accepted so we can manage your account and data responsibly."}
        </p>
        <p>
          {es ? "Versión" : "Version"}: {config.currentTermsVersion}
        </p>
      </section>
      <section className="panel auth-panel">
        {query.error && (
          <p className="notice">
            {es
              ? "No pudimos guardar tu aceptación. Revisa la casilla e inténtalo de nuevo."
              : "We could not save your acceptance. Check the box and try again."}
          </p>
        )}
        <form action={acceptTerms} className="stack">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="next" value={next} />
          <label className="consent-row">
            <input
              name="acceptTerms"
              type="checkbox"
              value="accepted"
              required
            />
            <span>
              {es ? "Acepto las " : "I accept the "}
              <Link href={`/${locale}/terms`}>
                {es ? "condiciones" : "terms"}
              </Link>
              {es ? " y he leído la " : " and have read the "}
              <Link href={`/${locale}/privacy`}>
                {es ? "política de privacidad" : "privacy policy"}
              </Link>
              .
            </span>
          </label>
          <button className="button" type="submit">
            {es ? "Aceptar y continuar" : "Accept and continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
