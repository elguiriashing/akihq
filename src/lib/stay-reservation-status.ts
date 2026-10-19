import type { StayLocale } from "./akiduermo-i18n";

export function stayReservationStatusLabel(status: string, locale: StayLocale) {
  const labels: Record<string, [string, string]> = {
    requested: ["Awaiting confirmation", "Pendiente de confirmación"],
    confirmed: ["Confirmed", "Confirmada"],
    checked_in: ["Checked in", "Entrada realizada"],
    completed: ["Completed", "Finalizada"],
    cancelled: ["Cancelled", "Cancelada"],
    declined: ["Declined", "Rechazada"],
  };
  return labels[status]?.[locale === "es" ? 1 : 0] ?? status;
}
