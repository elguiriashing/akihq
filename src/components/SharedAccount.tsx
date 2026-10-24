import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  saveSharedProfile,
  uploadSharedProfileMedia,
  changeSharedEmail,
  resetSharedPassword,
} from "@/lib/shared-account-actions";
import styles from "./SharedAccount.module.css";
import { Suspense } from "react";
import { SharedMembershipPanel } from "./SharedMembershipPanel";
export async function SharedAccount({
  locale,
  product,
  home,
  membership,
  path,
  query = {},
}: {
  locale: "en" | "es";
  product: string;
  home: string;
  membership: string;
  path: string;
  query?: Record<string, string | string[] | undefined>;
}) {
  const es = locale === "es";
  const { supabase, user } = await requireUser(locale, path);
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "display_name,username,bio,phone,locality,province,preferred_locale,profile_visibility,contact_visibility,avatar_url,banner_url",
    )
    .eq("id", user.id)
    .maybeSingle();
  const t = (en: string, esText: string) => (es ? esText : en);

  const status = query.updated
    ? t("Profile saved across AkiSuite.", "Perfil guardado en AkiSuite.")
    : query.email === "pending"
      ? t(
          "Check your inboxes to confirm your email change.",
          "Revisa tus correos para confirmar el cambio.",
        )
      : query.email === "confirmed"
        ? t("Email confirmed.", "Correo confirmado.")
        : query.password
          ? t(
              "Check your email for the recovery link.",
              "Revisa tu correo para recuperar la contraseña.",
            )
          : null;
  return (
    <div className={styles.account}>
      <nav>
        <Link href={home}>← {product}</Link>
        <Link href={membership}>{t("Membership", "Membresía")}</Link>
      </nav>
      <header>
        <span>{product} / AkiSuite</span>
        <h1>{t("Your account", "Tu cuenta")}</h1>
        <p>
          {t(
            "One profile for all five products. Changes here appear wherever you use this account.",
            "Un perfil para los cinco productos. Los cambios aparecen donde uses esta cuenta.",
          )}
        </p>
      </header>
      {status && (
        <p role="status" className={styles.notice}>
          {status}
        </p>
      )}
      {query.error && (
        <p role="alert">
          {t(
            "The change could not be saved. Check your details and try again.",
            "No se pudo guardar. Revisa los datos e inténtalo de nuevo.",
          )}
        </p>
      )}
      {error || !profile ? (
        <section role="alert">
          <p>
            {t(
              "Your profile could not be loaded. Try again before editing.",
              "No se pudo cargar tu perfil. Reintenta antes de editar.",
            )}
          </p>
          <Link href={path}>{t("Retry", "Reintentar")}</Link>
        </section>
      ) : (
        <section>
          <h2>{t("Shared profile", "Perfil compartido")}</h2>
          <details>
            <summary>
              {t("Profile and cover photos", "Fotos de perfil y portada")}
            </summary>
            {(["avatar", "banner"] as const).map((kind) => (
              <form action={uploadSharedProfileMedia} key={kind}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="kind" value={kind} />
                <label>
                  {kind === "avatar"
                    ? t("Profile photo", "Foto de perfil")
                    : t("Cover photo", "Foto de portada")}
                  <input
                    name="file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </label>
                <small>
                  {t(
                    "JPG, PNG or WebP, up to 10 MB. Shared across AkiSuite.",
                    "JPG, PNG o WebP, hasta 10 MB. Compartida en AkiSuite.",
                  )}
                </small>
                <button type="submit">{t("Save photo", "Guardar foto")}</button>
              </form>
            ))}
          </details>
          <form action={saveSharedProfile}>
            <input type="hidden" name="locale" value={locale} />
            <div className={styles.grid}>
              <label>
                {t("Display name", "Nombre")}
                <input
                  name="displayName"
                  defaultValue={profile.display_name || ""}
                  minLength={2}
                  maxLength={100}
                  required
                  autoComplete="name"
                />
              </label>
              <label>
                {t("Username", "Nombre de usuario")}
                <input
                  name="username"
                  defaultValue={profile.username || ""}
                  pattern="[a-zA-Z0-9_]{3,30}"
                  maxLength={30}
                  autoComplete="username"
                />
              </label>
              <label>
                {t("Phone", "Teléfono")}
                <input
                  name="phone"
                  type="tel"
                  maxLength={40}
                  defaultValue={profile.phone || ""}
                  autoComplete="tel"
                />
              </label>
              <label>
                {t("Preferred language", "Idioma preferido")}
                <select
                  name="preferredLocale"
                  defaultValue={profile.preferred_locale || locale}
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </label>
              <label>
                {t("Town / city", "Localidad")}
                <input
                  name="locality"
                  maxLength={120}
                  defaultValue={profile.locality || ""}
                  autoComplete="address-level2"
                />
              </label>
              <label>
                {t("Province", "Provincia")}
                <input
                  name="province"
                  maxLength={120}
                  defaultValue={profile.province || ""}
                  autoComplete="address-level1"
                />
              </label>
              {(
                [
                  [
                    "profileVisibility",
                    "profile_visibility",
                    t("Profile visibility", "Visibilidad del perfil"),
                  ],
                  [
                    "contactVisibility",
                    "contact_visibility",
                    t("Contact visibility", "Visibilidad del contacto"),
                  ],
                ] as const
              ).map(([name, key, label]) => (
                <label key={name}>
                  {label}
                  <select name={name} defaultValue={profile[key] || "private"}>
                    <option value="private">{t("Private", "Privado")}</option>
                    <option value="members">{t("Members", "Miembros")}</option>
                    <option value="public">{t("Public", "Público")}</option>
                  </select>
                </label>
              ))}
            </div>
            <label>
              {t("About you", "Sobre ti")}
              <textarea
                name="bio"
                maxLength={2000}
                rows={4}
                defaultValue={profile.bio || ""}
              />
            </label>
            <button type="submit">
              {t("Save shared profile", "Guardar perfil compartido")}
            </button>
          </form>
        </section>
      )}
      <Suspense
        fallback={
          <p role="status">
            {t("Loading your memberships…", "Cargando tus membresías…")}
          </p>
        }
      >
        <SharedMembershipPanel locale={locale} membership={membership} />
      </Suspense>
      <section>
        <h2>{t("Sign-in and security", "Acceso y seguridad")}</h2>
        <p>{user.email}</p>
        <p>
          {t(
            "Your email and password are shared across AkiSuite.",
            "Tu correo y contraseña son comunes a AkiSuite.",
          )}
        </p>
        <form action={changeSharedEmail}>
          <input type="hidden" name="locale" value={locale} />
          <label>
            {t("New sign-in email", "Nuevo correo de acceso")}
            <input
              name="email"
              type="email"
              maxLength={254}
              required
              autoComplete="email"
            />
          </label>
          <button type="submit">
            {t("Request email change", "Solicitar cambio de correo")}
          </button>
        </form>
        <form action={resetSharedPassword}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit">
            {t("Send password reset link", "Enviar enlace de recuperación")}
          </button>
        </form>
      </section>
      <section>
        <h2>{t("Privacy and data", "Privacidad y datos")}</h2>
        <p>
          {t(
            "Export and account deletion apply to your shared identity across all products.",
            "La exportación y eliminación afectan a tu identidad compartida en todos los productos.",
          )}
        </p>
        <Link href={`https://akipasa.com/${locale}/account/privacy`}>
          {t(
            "Open shared data controls",
            "Abrir controles de datos compartidos",
          )}{" "}
          ↗
        </Link>
      </section>
    </div>
  );
}
