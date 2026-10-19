import { notFound } from "next/navigation";
import { isLocale } from "@/lib/config";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  return (
    <main className="shell legal">
      <section className="hero">
        <div className="eyebrow">{es ? "Privacidad" : "Privacy"}</div>
        <h1>
          {es
            ? "Tu información, bajo control"
            : "Your information, under control"}
        </h1>
        <p className="lede">
          {es
            ? "Resumen de privacidad de AkiPasa para la versión preliminar pública."
            : "AkiPasa privacy summary for the public preview."}
        </p>
      </section>
      <section className="panel prose">
        <h2>{es ? "Qué guardamos" : "What we store"}</h2>
        <p>
          {es
            ? "Datos de cuenta, favoritos, locales seguidos, actividad de recompensas y contenido que envías. La ubicación precisa del dispositivo no se guarda por defecto."
            : "Account data, favorites, followed venues, reward activity and content you submit. Precise device location is not stored by default."}
        </p>
        <h2>{es ? "Para qué" : "Why"}</h2>
        <p>
          {es
            ? "Para prestar el servicio, protegerlo contra abusos y ofrecer estadísticas agregadas a los negocios. No vendemos datos personales."
            : "To provide the service, protect it from abuse and give businesses aggregate statistics. We do not sell personal data."}
        </p>
        <h2>{es ? "Tus derechos" : "Your rights"}</h2>
        <p>
          {es
            ? "Puedes descargar tus datos y solicitar la eliminación desde Cuenta. Las solicitudes se registran y se procesan de forma verificable."
            : "You can download your data and request deletion from Account. Requests are logged and processed verifiably."}
        </p>
        <h2>{es ? "Contacto" : "Contact"}</h2>
        <p>privacy@akipasa.com</p>
        <p>
          <small>
            {es
              ? "Última actualización: 23 de julio de 2026. Pendiente de revisión jurídica profesional antes del lanzamiento comercial."
              : "Last updated: 23 July 2026. Pending professional legal review before commercial launch."}
          </small>
        </p>
      </section>
    </main>
  );
}
import { publicPageMetadata } from "@/lib/page-metadata";

export const generateMetadata = publicPageMetadata("/privacy");
