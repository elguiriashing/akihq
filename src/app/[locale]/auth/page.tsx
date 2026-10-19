import { managementProduct, operationsProduct } from "@/lib/product-roles";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { config, isLocale } from "@/lib/config";
import {
  requestMagicLink,
  requestPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "./actions";
import { safeAuthDestination } from "@/lib/auth-security";
import { safeStayDestination } from "@/lib/akiduermo-routing";
import { safeConduzcoDestination } from "@/lib/akiconduzco-routing";
import {
  AuthEmailInput,
  AuthSubmitButton,
} from "@/components/AuthFormControls";

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const requestHeaders = await headers();
  const isBusinessHost =
    requestHeaders.get("x-akipasa-product") === "akibusiness";
  const isStayHost = requestHeaders.get("x-akipasa-product") === "akiduermo";
  const isConduzcoHost =
    requestHeaders.get("x-akipasa-product") === "akiconduzco";
  const es = locale === "es";
  const next = isStayHost
    ? safeStayDestination(query.next)
    : isConduzcoHost
      ? safeConduzcoDestination(query.next)
      : safeAuthDestination(locale, query.next);
  const businessIntent = next.startsWith(`/${locale}/business/apply`);
  const mode = ["signup", "magic", "recover"].includes(query.mode ?? "")
    ? query.mode
    : "signin";
  const modeHref = (target: string) => {
    const search = new URLSearchParams({ mode: target });
    if (query.next) search.set("next", next);
    return `/${locale}/auth?${search.toString()}`;
  };
  const authError = query.error
    ? query.error === "password-policy"
      ? es
        ? "Usa 12 o más caracteres con mayúscula, minúscula y número, y confirma la misma contraseña."
        : "Use 12 or more characters with uppercase, lowercase and a number, then confirm the same password."
      : query.error === "invalid"
        ? es
          ? "Introduce una dirección de email válida."
          : "Enter a valid email address."
        : query.error === "terms"
          ? es
            ? "Acepta las condiciones para continuar."
            : "Accept the terms to continue."
          : query.error === "callback" || query.error === "recovery"
            ? es
              ? "El enlace ha caducado o ya se ha usado. Solicita uno nuevo para continuar."
              : "The link expired or was already used. Request a new one to continue."
            : query.error === "send"
              ? es
                ? "No pudimos enviar el email. Revisa la conexión e inténtalo de nuevo."
                : "We could not send the email. Check your connection and try again."
              : query.error === "signin"
                ? es
                  ? "No se aceptaron el email o la contraseña. Revisa ambos campos o recupera tu acceso."
                  : "The email or password was not accepted. Check both fields or recover access."
                : es
                  ? "No se pudo completar el acceso. Revisa los datos e inténtalo de nuevo."
                  : "Authentication could not be completed. Check the details and try again."
    : null;
  const clearSavedEmail = Boolean(
    query.sent || query.registered || query.recovery === "sent",
  );
  const emailInvalid = query.error === "invalid" || query.error === "signin";
  const passwordInvalid =
    query.error === "password-policy" || query.error === "signin";
  return (
    <main
      className={`auth-page auth-product-theme ${isStayHost ? "auth-theme-stay" : isConduzcoHost ? "auth-theme-conduzco" : isBusinessHost ? "auth-theme-business" : "auth-theme-akipasa"}`}
    >
      <section className="auth-intro">
        <div className="auth-intro-copy">
          {(isStayHost || isConduzcoHost) && (
            <a href={`/?lang=${locale}`}>
              ← {isConduzcoHost ? "AkiCoches" : "AkiDuermo"}
            </a>
          )}
          <div className="eyebrow">
            {isConduzcoHost
              ? "AkiCoches"
              : isStayHost
                ? "AkiDuermo"
                : isBusinessHost
                  ? managementProduct.name
                  : businessIntent
                    ? es
                      ? "Paso 1 de 3 · Añade tu negocio"
                      : "Step 1 of 3 · Add your business"
                    : es
                      ? "Cuenta"
                      : "Account"}
          </div>
          <h1>
            {isConduzcoHost
              ? es
                ? "Tu cuenta AkiCoches"
                : "Your AkiCoches account"
              : isStayHost
                ? es
                  ? "Tu próxima estancia empieza aquí"
                  : "Your next stay starts here"
                : isBusinessHost
                  ? es
                    ? "Gestiona tu negocio"
                    : "Manage your business"
                  : businessIntent
                    ? es
                      ? "Primero, crea tu cuenta gratuita"
                      : "First, create your free account"
                    : es
                      ? "Tu cuenta AkiPasa"
                      : "Your AkiPasa account"}
          </h1>
          {(isStayHost || isConduzcoHost) && (
            <p className="akiduermo-auth-promise">
              {isConduzcoHost
                ? es
                  ? "Guarda tus solicitudes de alquiler y vuelve a los detalles de tu viaje cuando quieras."
                  : "Keep your rental requests and trip details together in one place."
                : es
                  ? "Guarda tus favoritos, organiza tus escapadas y vuelve a tus reservas cuando quieras."
                  : "Save your favourites, plan the next escape and find every stay in one place."}
            </p>
          )}
        </div>
        {!isStayHost && !isConduzcoHost && (
          <aside className="auth-product-portals">
            <span>{es ? "Elige tu espacio" : "Choose your workspace"}</span>
            <a
              className={`auth-product-card ${!isBusinessHost ? "active" : ""}`}
              href={`${config.consumerUrl}/${locale}/auth`}
            >
              <i
                className="auth-product-dot auth-product-dot-akipasa"
                aria-hidden="true"
              />
              <span>
                <strong>AkiPasa</strong>
              </span>
            </a>
            <a
              className={`auth-product-card ${isBusinessHost ? "active" : ""}`}
              href={`${config.businessUrl}/${locale}/auth?next=/${locale}/business`}
            >
              <i
                className="auth-product-dot auth-product-dot-business"
                aria-hidden="true"
              />
              <span>
                <strong>{managementProduct.name}</strong>
              </span>
            </a>
            <a className="auth-product-card" href={config.crmUrl}>
              <i
                className="auth-product-dot auth-product-dot-hq"
                aria-hidden="true"
              />
              <span>
                <strong>{operationsProduct.name}</strong>
              </span>
            </a>
          </aside>
        )}
      </section>
      {businessIntent && (
        <aside
          className="auth-journey"
          aria-label={es ? "Siguiente paso" : "Next step"}
        >
          <strong>
            {es ? "Lo siguiente: datos del negocio" : "Next: business details"}
          </strong>
          <span>
            {es
              ? "Solo te pediremos el nombre, la localidad y una breve descripción."
              : "We will only ask for its name, town or city, and a short description."}
          </span>
        </aside>
      )}
      <section className="auth-focus-panel">
        {query.sent && (
          <p className="notice">
            {es
              ? "Enlace enviado. Revisa tu correo."
              : "Link sent. Check your email."}
          </p>
        )}
        {query.registered && (
          <p className="notice">
            {es
              ? "Cuenta creada. Confirma tu dirección de email para entrar."
              : "Account created. Confirm your email address to sign in."}
          </p>
        )}
        {query.recovery === "sent" && (
          <p className="notice">
            {es
              ? "Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña."
              : "If an account exists for that email, you will receive a password-reset link."}
          </p>
        )}
        {query.reset && (
          <p className="notice">
            {es
              ? "Contraseña actualizada. Ya puedes entrar."
              : "Password updated. You can now sign in."}
          </p>
        )}
        {authError && (
          <p className="notice" id="auth-error" role="alert">
            {authError}
          </p>
        )}
        <nav
          className="auth-modes"
          aria-label={es ? "Opciones de acceso" : "Access options"}
        >
          <a
            className={mode === "signin" ? "active" : ""}
            href={modeHref("signin")}
          >
            {es ? "Entrar" : "Sign in"}
          </a>
          <a
            className={mode === "signup" ? "active" : ""}
            href={modeHref("signup")}
          >
            {es ? "Crear cuenta" : "Create account"}
          </a>
        </nav>
        <div className="auth-form-head">
          <span>
            {mode === "signup"
              ? es
                ? "Empieza gratis"
                : "Start for free"
              : mode === "magic"
                ? es
                  ? "Enlace seguro"
                  : "Secure link"
                : mode === "recover"
                  ? es
                    ? "Recupera tu acceso"
                    : "Recover access"
                  : es
                    ? "Te damos la bienvenida"
                    : "Welcome back"}
          </span>
          <h2>
            {mode === "signup"
              ? es
                ? "Crea tu cuenta"
                : "Create your account"
              : mode === "magic"
                ? es
                  ? "Entra sin contraseña"
                  : "Sign in without a password"
                : mode === "recover"
                  ? es
                    ? "Restablece tu contraseña"
                    : "Reset your password"
                  : isStayHost
                    ? es
                      ? "Entra en AkiDuermo"
                      : "Sign in to AkiDuermo"
                    : isBusinessHost
                      ? es
                        ? `Entra en ${managementProduct.name}`
                        : `Sign in to ${managementProduct.name}`
                      : es
                        ? "Entra en AkiPasa"
                        : "Sign in to AkiPasa"}
          </h2>
        </div>
        {config.googleAuthEnabled && mode !== "recover" && mode !== "magic" && (
          <>
            <form action={signInWithGoogle} className="stack">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="next" value={next} />
              <TermsConsent
                locale={locale}
                suffix="google"
                invalid={query.error === "terms"}
              />
              <AuthSubmitButton
                className="button google-button"
                idle={es ? "Continuar con Google" : "Continue with Google"}
                pending={es ? "Abriendo Google…" : "Opening Google…"}
              />
            </form>
            <div className="auth-divider">
              <span>{es ? "o con email" : "or with email"}</span>
            </div>
          </>
        )}
        {mode === "signup" && (
          <form action={signUpWithPassword} className="stack">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            <label>
              Email
              <AuthEmailInput
                id="signup-email"
                invalid={emailInvalid}
                clear={clearSavedEmail}
              />
            </label>
            <label>
              {es ? "Contraseña" : "Password"}
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                aria-describedby={
                  passwordInvalid ? "password-help auth-error" : "password-help"
                }
                aria-invalid={passwordInvalid || undefined}
              />
            </label>
            <small id="password-help">
              {es
                ? "12+ caracteres, con mayúscula, minúscula y número."
                : "12+ characters with uppercase, lowercase, and a number."}
            </small>
            <label>
              {es ? "Repetir contraseña" : "Confirm password"}
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                aria-invalid={passwordInvalid || undefined}
                aria-describedby={passwordInvalid ? "auth-error" : undefined}
              />
            </label>
            <TermsConsent
              locale={locale}
              suffix="password"
              invalid={query.error === "terms"}
            />
            <AuthSubmitButton
              idle={es ? "Crear cuenta" : "Create account"}
              pending={es ? "Creando cuenta…" : "Creating account…"}
            />
          </form>
        )}
        {mode === "signin" && (
          <form action={signInWithPassword} className="stack">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            <label>
              Email
              <AuthEmailInput
                id="signin-email"
                invalid={emailInvalid}
                clear={clearSavedEmail}
              />
            </label>
            <label>
              <span className="auth-label-line">
                {es ? "Contraseña" : "Password"}
                <a href={modeHref("recover")}>
                  {es ? "¿La has olvidado?" : "Forgot it?"}
                </a>
              </span>
              <input
                name="password"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
                aria-invalid={passwordInvalid || undefined}
                aria-describedby={passwordInvalid ? "auth-error" : undefined}
              />
            </label>
            <AuthSubmitButton
              idle={es ? "Entrar" : "Sign in"}
              pending={es ? "Entrando…" : "Signing in…"}
            />
          </form>
        )}
        {mode === "magic" && (
          <form action={requestMagicLink} className="stack">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            <label htmlFor="magic-email">Email</label>
            <AuthEmailInput
              id="magic-email"
              invalid={emailInvalid}
              clear={clearSavedEmail}
            />
            <AuthSubmitButton
              idle={es ? "Enviar enlace" : "Send sign-in link"}
              pending={es ? "Enviando…" : "Sending…"}
            />
          </form>
        )}
        {mode === "recover" && (
          <form action={requestPasswordReset} className="stack">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            <label htmlFor="recovery-email">Email</label>
            <AuthEmailInput
              id="recovery-email"
              invalid={emailInvalid}
              clear={clearSavedEmail}
            />
            <AuthSubmitButton
              idle={es ? "Enviar enlace de recuperación" : "Send recovery link"}
              pending={es ? "Enviando…" : "Sending…"}
            />
          </form>
        )}
        <div className="auth-secondary">
          {mode !== "magic" && (
            <a href={modeHref("magic")}>
              {es ? "Usar un enlace de acceso" : "Use a sign-in link"}
            </a>
          )}
          {(mode === "magic" || mode === "recover") && (
            <a href={modeHref("signin")}>
              {es ? "Volver a entrar" : "Back to sign in"}
            </a>
          )}
        </div>
      </section>
    </main>
  );
}

function TermsConsent({
  locale,
  suffix,
  invalid = false,
}: {
  locale: "es" | "en";
  suffix: string;
  invalid?: boolean;
}) {
  const es = locale === "es";
  return (
    <label className="consent-row" htmlFor={`accept-terms-${suffix}`}>
      <input
        id={`accept-terms-${suffix}`}
        name="acceptTerms"
        type="checkbox"
        value="accepted"
        required
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "auth-error" : undefined}
      />
      <span>
        {es ? "Acepto las " : "I accept the "}
        <a href={`/${locale}/terms`}>{es ? "condiciones" : "terms"}</a>
        {es ? " y he leído la " : " and have read the "}
        <a href={`/${locale}/privacy`}>
          {es ? "política de privacidad" : "privacy policy"}
        </a>
        .
      </span>
    </label>
  );
}
