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
    pasa: "/pwa/akipasa-512.png",
    business: "/brand/business-mark.svg",
    duermo: "/brand/duermo-icon.png",
    hq: "/brand/hq-mark.svg",
    coches: "/brand/conduzco-icon.svg",
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
