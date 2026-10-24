import Link from "next/link";
import { sharedAccountBilling } from "@/lib/shared-membership";
import { openSharedBillingPortal } from "@/lib/shared-account-actions";
export async function SharedMembershipPanel({
  locale,
  membership,
}: {
  locale: "en" | "es";
  membership: string;
}) {
  const es = locale === "es",
    t = (en: string, sp: string) => (es ? sp : en);
  const billing = await sharedAccountBilling("summary", locale).catch(
    () => null,
  );
  const plans: Record<string, string> = {
    premium: t(
      "AkiPasa Premium (for individuals)",
      "AkiPasa Premium (para particulares)",
    ),
    business: t(
      "Legacy Business subscription",
      "Suscripción Business anterior",
    ),
    business_pro: t(
      "Legacy Business Pro subscription",
      "Suscripción Business Pro anterior",
    ),
    akipasa_premium: t(
      "AkiPasa Premium (for individuals)",
      "AkiPasa Premium (para particulares)",
    ),
    akibusiness_premium: t(
      "AkiPasa Premium (for businesses)",
      "AkiPasa Premium (para empresas)",
    ),
    akiduermo_premium: t(
      "Existing AkiDuermo Premium subscription",
      "Suscripción AkiDuermo Premium existente",
    ),
    akihq_standard: t("Legacy AkiHQ Standard", "AkiHQ Standard anterior"),
    akihq_pro: t("Legacy AkiHQ Pro", "AkiHQ Pro anterior"),
    aki_enterprise: t(
      "Legacy Enterprise subscription",
      "Suscripción Enterprise anterior",
    ),
  };
  const statuses: Record<string, string> = es
    ? {
        active: "Activa",
        trialing: "Prueba",
        past_due: "Pago pendiente",
        canceled: "Cancelada",
        unpaid: "Sin pagar",
        paused: "En pausa",
        incomplete: "Incompleta",
        incomplete_expired: "Incompleta caducada",
      }
    : {
        active: "Active",
        trialing: "Trial",
        past_due: "Payment overdue",
        canceled: "Cancelled",
        unpaid: "Unpaid",
        paused: "Paused",
        incomplete: "Incomplete",
        incomplete_expired: "Incomplete, expired",
      };
  return (
    <section>
      <h2>{t("My memberships", "Mis membresías")}</h2>
      {billing ? (
        <>
          <p>
            {billing.subscriptions?.length
              ? t(
                  "Subscriptions on your shared account:",
                  "Suscripciones de tu cuenta compartida:",
                )
              : t(
                  "No paid subscriptions are recorded for this account.",
                  "Esta cuenta no tiene suscripciones de pago registradas.",
                )}
          </p>
          <ul>
            {billing.subscriptions?.map((row, index) => (
              <li key={index}>
                {plans[row.plan_code] ||
                  t("Existing subscription", "Suscripción existente")}{" "}
                ·{" "}
                {statuses[row.status] ||
                  t("Status unavailable", "Estado no disponible")}
                {row.current_period_end
                  ? ` · ${new Date(row.current_period_end).toLocaleDateString(locale)}`
                  : ""}
                {row.cancel_at_period_end
                  ? ` · ${t("Ends at period end", "Finaliza al terminar el periodo")}`
                  : ""}
              </li>
            ))}
          </ul>
          {billing.hasCustomer && (
            <form action={openSharedBillingPortal}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit">
                {t(
                  "Manage billing and subscriptions",
                  "Gestionar pagos y suscripciones",
                )}
              </button>
            </form>
          )}
        </>
      ) : (
        <p role="alert">
          {t(
            "Membership details are temporarily unavailable. Retry before making billing changes.",
            "Los datos de membresía no están disponibles. Reintenta antes de hacer cambios.",
          )}
        </p>
      )}
      <Link href={membership}>
        {t("Explore this product’s plans", "Ver los planes de este producto")}
      </Link>
    </section>
  );
}
