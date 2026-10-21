import type { BusinessFunnel as Report } from "@/lib/akipulse-funnel";
export function BusinessFunnel({
  locale,
  report,
}: {
  locale: "en" | "es";
  report: Report | null;
}) {
  const es = locale === "es";
  const labels = {
    claim_completed: es ? "Reclamaciones aprobadas" : "Approved claims",
    hq_activated: es
      ? "Espacios de gestión creados por el propietario"
      : "Owner-created management workspaces",
    checkout_started: es
      ? "Sesiones de pago creadas"
      : "Checkout sessions created",
    payment_verified: es
      ? "Facturas pagadas verificadas"
      : "Verified paid invoices",
    subscription_upgraded: es
      ? "Mejoras de paquete pagadas"
      : "Paid package upgrades",
    subscription_cancelled: es
      ? "Cancelaciones efectivas"
      : "Effective cancellations",
  };
  const reasons: Record<string, string> = {
    scope_mapping_unsupported: es
      ? "Este ámbito aún no tiene un vínculo verificado a un único espacio de gestión. No sumamos embudos de organizaciones o flotas."
      : "This scope has no verified single-workspace mapping. Organisation and fleet funnels are not summed.",
    workspace_mapping_missing: es
      ? "No hay un espacio activo vinculado explícitamente a esta ficha."
      : "No active workspace is explicitly linked to this listing.",
    workspace_mapping_ambiguous: es
      ? "Hay varios espacios vinculados. Es necesario verificar el vínculo antes de mostrar datos."
      : "Multiple workspaces are linked. The mapping needs review before data can be shown.",
    workspace_management_required: es
      ? "Se requiere acceso de gestión al espacio vinculado."
      : "Management access to the linked workspace is required.",
    not_activated: es
      ? "La recopilación del embudo todavía no está activada."
      : "Funnel collection has not been activated.",
    not_initialized: es
      ? "El periodo de recopilación todavía no está inicializado."
      : "The collection period has not been initialized.",
    stage_adapter_not_installed: es
      ? "El adaptador compartido de eventos verificados todavía no está instalado."
      : "The shared verified-stage adapter is not installed yet.",
  };
  return (
    <details>
      <summary>
        {es ? "Embudo comercial verificado" : "Verified commercial funnel"}
      </summary>
      {report?.available ? (
        <>
          <p>
            {es
              ? "Observaciones verificadas con consentimiento vigente. No son clientes únicos ni una tasa de conversión; cada etapa cuenta hechos distintos. La activación significa crear un espacio de gestión, no visitar AkiHQ."
              : "Verified observations with current consent. These are not unique customers or a conversion rate; each stage counts different facts. Activation means creating a management workspace, not visiting AkiHQ."}
          </p>
          <p>
            {es ? "Recopilación desde" : "Collection since"}{" "}
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(report.collection_started_at))}{" "}
            · {es ? "Últimos" : "Last"}{" "}
            {Math.min(report.days, report.retention_days)}{" "}
            {es ? "días, hasta ahora" : "days, ending now"}
          </p>
          <dl>
            {Object.entries(labels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {key === "claim_completed" && !report.claim_stage_available
                    ? es
                      ? "Sin vínculo autorizado"
                      : "No authorized mapping"
                    : (report.stages[key as keyof typeof labels] ??
                      (es ? "Sin observaciones" : "No observations"))}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p>
          {reasons[report && !report.available ? report.reason : ""] ||
            (es
              ? "Los datos del embudo no están disponibles para este ámbito."
              : "Funnel data is unavailable for this scope.")}
        </p>
      )}
      <p>
        {es
          ? "Los clics GA4 siguen separados. No atribuimos tráfico global de Google ni calculamos porcentajes sin un vínculo verificado."
          : "GA4 clicks remain separate. Sitewide Google traffic is not attributed here and percentages are not calculated without verified linkage."}
      </p>
    </details>
  );
}
