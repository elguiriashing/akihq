import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isLocale } from "@/lib/config";
import { SupportAgentLauncher } from "@/components/support/SupportAgentLauncher";
import { SpainAddressAutocomplete } from "@/components/SpainAddressAutocomplete";
import { businessCategories } from "@/lib/business-packages";
import { submitBusinessApplication } from "../actions";

type BusinessApplication = {
  id: string;
  business_name: string;
  state: string;
  payment_state: string;
  review_reason: string | null;
  created_at: string;
  business_category: string | null;
  plan_code: string;
};

export default async function BusinessApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const selectedCategory = businessCategories.some(
    (item) => item.key === query.category,
  )
    ? query.category!
    : "food";
  const selectedPlan =
    query.plan === "business_pro" ? "business_pro" : "business";
  const { supabase, user } = await requireUser(
    locale,
    `/${locale}/business/apply`,
  );
  const { data } = await supabase
    .from("business_applications")
    .select(
      "id,business_name,state,payment_state,review_reason,created_at,business_category,plan_code",
    )
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false });
  const applications = (data || []) as BusinessApplication[];
  const current = applications.find((application) =>
    ["submitted", "under_review", "awaiting_payment", "active"].includes(
      application.state,
    ),
  );
  const es = locale === "es";
  const stateLabel: Record<string, string> = {
    submitted: es ? "Pendiente de revisión" : "Waiting for review",
    under_review: es ? "En revisión" : "Under review",
    awaiting_payment: es
      ? "Aprobado · elige un plan"
      : "Approved · choose a plan",
    active: es ? "Negocio activo" : "Business active",
  };
  const paymentLabel: Record<string, string> = {
    not_started: es ? "No se requiere todavía" : "Not required yet",
    pending: es ? "Pendiente" : "Pending",
    paid: es ? "Pagado" : "Paid",
    trial: es ? "Periodo de prueba" : "Trial",
    waived: es ? "Sin cargo" : "No charge",
    failed: es ? "Necesita atención" : "Needs attention",
  };
  const errorMessage =
    query.error === "review_required"
      ? es
        ? "Antes de pagar, necesitamos revisar tu negocio. Empieza con la solicitud gratuita."
        : "Before you pay, we need to review your business. Start with the free application."
      : query.error === "validation"
        ? es
          ? "Falta algún dato o hay algo que corregir. Revisa todos los campos marcados."
          : "A detail is missing or needs correcting. Check every marked field."
        : es
          ? "No hemos podido enviar la solicitud. Inténtalo de nuevo o pide ayuda."
          : "We could not send the application. Try again or ask for help.";
  return (
    <main className="shell dashboard business-application-page">
      <section className="hero business-application-hero">
        <div>
          <div className="eyebrow">
            {es
              ? "Paso 2 de 3 · Revisión gratuita"
              : "Step 2 of 3 · Free review"}
          </div>
          <h1>
            {es ? "Añade tu negocio a AkiPasa" : "Add your business to AkiPasa"}
          </h1>
          <p className="lede">
            {es
              ? "Completa un formulario corto. Comprobaremos los datos y te avisaremos antes de pedir cualquier pago."
              : "Complete one short form. We will check the details and tell you before asking for any payment."}
          </p>
          <div className="hero-actions">
            <Link
              className="button secondary"
              href={`/${locale}/membership#business-plan`}
            >
              {es ? "Ver precio y ventajas" : "See price and benefits"}
            </Link>
            <SupportAgentLauncher
              locale={locale}
              surface="business_application"
              label={es ? "Necesito ayuda" : "I need help"}
              className="button button-ghost"
              signedIn
              captureBusinessForm
            />
          </div>
        </div>
        <aside className="business-application-checklist">
          <strong>{es ? "Ten a mano:" : "Have these ready:"}</strong>
          <ul>
            <li>{es ? "Nombre del negocio" : "Business name"}</li>
            <li>
              {es ? "Tu nombre y localidad" : "Your name and town or city"}
            </li>
            <li>
              {es
                ? "Una frase sobre lo que ofreces"
                : "One sentence about what you offer"}
            </li>
          </ul>
          <small>
            {es ? "Tiempo aproximado: 3 minutos" : "About 3 minutes"}
          </small>
        </aside>
      </section>

      {query.submitted && (
        <p className="notice notice-success" role="status">
          {es
            ? "Listo. Hemos recibido tu solicitud. No se te ha cobrado nada; el siguiente paso aparecerá aquí."
            : "Done. We have received your application. You have not been charged; the next step will appear here."}
        </p>
      )}
      {query.error && (
        <p className="notice notice-error" role="alert">
          {errorMessage}
        </p>
      )}

      <ol
        className="business-application-steps"
        aria-label={es ? "Cómo funciona" : "How it works"}
      >
        <li className={!current ? "active" : "complete"}>
          <span>1</span>
          <div>
            <strong>{es ? "Cuéntanos lo básico" : "Tell us the basics"}</strong>
            <small>
              {es ? "Gratis · unos 3 minutos" : "Free · about 3 minutes"}
            </small>
          </div>
        </li>
        <li
          className={
            current &&
            current.state !== "awaiting_payment" &&
            current.state !== "active"
              ? "active"
              : ""
          }
        >
          <span>2</span>
          <div>
            <strong>
              {es ? "Comprobamos los datos" : "We check the details"}
            </strong>
            <small>
              {es ? "Sin cargos ni compromiso" : "No charge or commitment"}
            </small>
          </div>
        </li>
        <li
          className={
            current?.state === "awaiting_payment" || current?.state === "active"
              ? "active"
              : ""
          }
        >
          <span>3</span>
          <div>
            <strong>
              {es ? "Elige un plan y publica" : "Choose a plan and publish"}
            </strong>
            <small>
              {es ? "Solo después de aprobarte" : "Only after approval"}
            </small>
          </div>
        </li>
      </ol>

      {current ? (
        <section className="panel console-card business-application-status">
          <span className="status-pill">
            {stateLabel[current.state] || current.state}
          </span>
          <h2>{current.business_name}</h2>
          <p>
            {es ? "Pago" : "Payment"}:{" "}
            <strong>
              {paymentLabel[current.payment_state] || current.payment_state}
            </strong>
          </p>
          {current.review_reason && <p>{current.review_reason}</p>}
          {current.state === "active" && (
            <Link className="button button-strong" href={`/${locale}/business`}>
              {es ? "Añadir mi primer local" : "Add my first venue"}
            </Link>
          )}
          {current.state === "awaiting_payment" && (
            <Link
              className="button button-strong"
              href={`/${locale}/account/subscription?plan=${current.plan_code === "business_pro" ? "business_pro" : "business"}&category=${current.business_category || "food"}`}
            >
              {es ? "Elegir plan Business" : "Choose a Business plan"}
            </Link>
          )}
          {!["active", "awaiting_payment"].includes(current.state) && (
            <p className="fine-print">
              {es
                ? "No necesitas hacer nada ahora. Vuelve aquí para ver el siguiente paso."
                : "You do not need to do anything now. Return here to see the next step."}
            </p>
          )}
        </section>
      ) : (
        <section className="business-application-form-layout">
          <form
            action={submitBusinessApplication}
            className="panel stack focused-form business-application-form"
          >
            <div>
              <span className="status-pill">{es ? "Gratis" : "Free"}</span>
              <h2>{es ? "Empezar la revisión" : "Start the review"}</h2>
              <p>
                {es
                  ? "Todos los campos son obligatorios salvo la web."
                  : "Every field is required except the website."}
              </p>
            </div>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="plan" value={selectedPlan} />
            <label htmlFor="business-category">
              {es ? "Tipo de negocio" : "Business type"}
            </label>
            <select
              id="business-category"
              name="businessCategory"
              defaultValue={selectedCategory}
              required
            >
              {businessCategories.map((category) => (
                <option key={category.key} value={category.key}>
                  {es ? category.es : category.en}
                </option>
              ))}
            </select>
            <label htmlFor="business-name">
              {es ? "Nombre del negocio" : "Business name"}
            </label>
            <input
              id="business-name"
              name="businessName"
              required
              minLength={2}
              maxLength={160}
              autoComplete="organization"
              placeholder={
                es ? "Por ejemplo, Café Central" : "For example, Central Café"
              }
            />
            <label htmlFor="contact-name">
              {es ? "Tu nombre" : "Your name"}
            </label>
            <input
              id="contact-name"
              name="contactName"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
            />
            <SpainAddressAutocomplete locale={locale} mode="locality" />
            <label htmlFor="business-website">
              {es ? "Página web (opcional)" : "Website (optional)"}
            </label>
            <input
              id="business-website"
              name="websiteUrl"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://"
              aria-describedby="business-website-help"
            />
            <small id="business-website-help">
              {es
                ? "Si no tienes web, déjalo vacío."
                : "Leave this empty if you do not have a website."}
            </small>
            <label htmlFor="business-about">
              {es
                ? "¿Qué ofrece tu negocio?"
                : "What does your business offer?"}
            </label>
            <textarea
              id="business-about"
              name="message"
              required
              minLength={20}
              maxLength={2000}
              rows={5}
              aria-describedby="business-about-help"
              placeholder={
                es
                  ? "Por ejemplo: Somos una cafetería familiar con música en directo los viernes."
                  : "For example: We are a family café with live music on Fridays."
              }
            />
            <small id="business-about-help">
              {es
                ? "Una o dos frases son suficientes."
                : "One or two sentences are enough."}
            </small>
            <button className="button button-strong" type="submit">
              {es ? "Enviar para revisión gratuita" : "Send for free review"}
            </button>
            <p className="fine-print">
              {es
                ? "No pagarás nada hoy. Enviar este formulario no inicia una membresía."
                : "You will not pay anything today. Sending this form does not start a membership."}
            </p>
          </form>
          <aside className="panel business-application-help">
            <span className="status-pill">
              {es ? "Ayuda humana" : "Human help"}
            </span>
            <h2>
              {es ? "¿No sabes qué escribir?" : "Not sure what to write?"}
            </h2>
            <p>
              {es
                ? "No hace falta usar palabras técnicas. Cuéntanos lo que dirías a un cliente nuevo."
                : "You do not need technical words. Tell us what you would say to a new customer."}
            </p>
            <SupportAgentLauncher
              locale={locale}
              surface="business_application"
              label={
                es
                  ? "Pedir ayuda para completarlo"
                  : "Ask for help completing it"
              }
              className="button secondary"
              signedIn
              captureBusinessForm
            />
          </aside>
        </section>
      )}
    </main>
  );
}
