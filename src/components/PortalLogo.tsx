import Image from "next/image";
import styles from "./PortalLogo.module.css";

export function PortalLogo({
  product,
}: {
  product: "pasa" | "business" | "duermo" | "hq" | "coches";
}) {
  const suffix = {
    pasa: "Pasa",
    business: "Business",
    duermo: "Duermo",
    hq: "HQ",
    coches: "Coches",
  }[product];
  const icon = {
    pasa: "/brand/v3/pasa.svg",
    business: "/brand/v3/business.svg",
    duermo: "/brand/v3/duermo.svg",
    hq: "/brand/v3/hq.svg",
    coches: "/brand/v3/coches.svg",
  }[product];

  return (
    <span className={`${styles.logo} ${styles[product]}`} aria-hidden="true">
      <Image src={icon} alt="" width={40} height={40} priority />
      <span className={styles.wordmark}>
        Aki<span>{suffix}</span>
        <i>.</i>
      </span>
    </span>
  );
}
