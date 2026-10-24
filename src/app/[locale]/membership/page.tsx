import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/config";
import { suiteHref } from "@/lib/suite-navigation";
import styles from "./membership.module.css";

export default async function HQMembershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  const listings = [
    {
      key: "pasa",
      title: "AkiPasa Business Premium",
      image: "/brand/logo-stacked-light.svg",
      subject: es ? "tu local y sus eventos" : "your venue and events",
      details: es
        ? [
            "Presencia Premium del local",
            "Contenido multimedia ampliado",
            "Herramientas para eventos",
          ]
        : [
            "Premium venue presence",
            "Enhanced media",
            "Event listing features",
          ],
    },
    {
      key: "duermo",
      title: "AkiDuermo Business Premium",
      image: "/brand/duermo-icon.png",
      subject: es ? "tu alojamiento" : "your accommodation",
      details: es
        ? [
            "Visibilidad Premium de la propiedad",
            "Contenido del alojamiento ampliado",
            "Herramientas para propietarios",
          ]
        : [
            "Premium property presence",
            "Enhanced accommodation media",
            "Property listing features",
          ],
    },
    {
      key: "coches",
      title: "AkiCoches Business Premium",
      image: "/brand/conduzco-icon.svg",
      subject: es ? "tu sucursal de alquiler" : "your rental branch",
      details: es
        ? [
            "Presencia Premium de la sucursal",
            "Presentación ampliada de la flota",
            "Herramientas para anuncios de vehículos",
          ]
        : [
            "Premium rental branch presence",
            "Enhanced fleet presentation",
            "Rental listing features",
          ],
    },
  ] as const;
  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>AKIHQ / AKISUITE</span>
        <Image
          src="/brand/hq-mark.svg"
          width={64}
          height={64}
          alt=""
          unoptimized
        />
        <h1>
          {es
            ? "Gestiona gratis. Destaca con Premium."
            : "Manage free. Stand out with Premium."}
        </h1>
        <p>
          {es
            ? "AkiHQ es tu centro de gestión gratuito. Elige una mejora Premium solo para la ficha de AkiPasa, AkiDuermo o AkiCoches que quieras destacar."
            : "AkiHQ is your free management home. Choose a Premium upgrade only for the AkiPasa, AkiDuermo or AkiCoches listing you want to showcase."}
        </p>
        <div className={styles.free}>
          <strong>{es ? "AkiHQ siempre es gratis" : "AkiHQ stays free"}</strong>
          <span>
            {es
              ? "Ubicaciones, anuncios y accesos de equipo sin cuota obligatoria."
              : "Manage locations, listings and team access without a mandatory fee."}
          </span>
          <Link href={`/${locale}/business`}>
            {es ? "Ir a mi panel" : "Open my dashboard"} ↗
          </Link>
        </div>
      </header>
      <section aria-labelledby="listings-heading" className={styles.listings}>
        <h2 id="listings-heading">
          {es
            ? "Mejoras Premium para tus anuncios"
            : "Premium upgrades for your listings"}
        </h2>
        <div className={styles.grid}>
          {listings.map((item) => (
            <article className={styles.card} key={item.key}>
              <div className={styles.cardHead}>
                <Image
                  src={item.image}
                  alt=""
                  width={46}
                  height={46}
                  unoptimized
                />
                <span>{es ? "PREMIUM EMPRESARIAL" : "BUSINESS PREMIUM"}</span>
              </div>
              <h3>{item.title}</h3>
              <p>
                {es
                  ? `Mejora tu presencia y desbloquea herramientas Premium para gestionar ${item.subject} desde AkiHQ.`
                  : `Upgrade your presence and unlock premium listing tools for ${item.subject} through AkiHQ.`}
              </p>
              <div className={styles.price}>
                <strong>€14.99</strong>
                <span>{es ? "/ mes por anuncio" : "/ month per listing"}</span>
              </div>
              <ul>
                {item.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <Link href={suiteHref(item.key, locale, { path: "/membership" })}>
                {es
                  ? "Ver opciones de esta plataforma"
                  : "View this product's plans"}{" "}
                ↗
              </Link>
              <small>
                {es
                  ? "El precio/checkout se confirma en el producto correspondiente."
                  : "Availability and checkout are confirmed in that product."}
              </small>
            </article>
          ))}
        </div>
      </section>
      <aside className={styles.software}>
        <Image
          src="/brand/business-mark.svg"
          width={56}
          height={56}
          alt=""
          unoptimized
        />
        <div>
          <h2>
            {es
              ? "¿Necesitas herramientas operativas?"
              : "Need business operations software?"}
          </h2>
          <p>
            {es
              ? "AkiBusiness Standard, Plus y Pro ofrecen TPV, inventario, CRM y más herramientas por ubicación. Son independientes de Premium para anuncios."
              : "AkiBusiness Standard, Plus and Pro add PoS, inventory, CRM and more operating tools per location. They're separate from listing Premium."}
          </p>
        </div>
        <a href={suiteHref("business", locale)}>
          {es ? "Explorar AkiBusiness" : "Explore AkiBusiness"} ↗
        </a>
      </aside>
    </main>
  );
}
