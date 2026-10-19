import { managementProduct } from "./product-roles";
export type BookingConfirmation = {
  bookingId: string;
  venueId: string;
  venueName: string;
  venueSlug?: string;
  address?: string | null;
  customerName: string;
  customerEmail: string;
  guestCount: number;
  bookingStart: string | null;
  bookingEnd?: string | null;
  offeringName?: string | null;
  locale: "en" | "es";
  product?: "accommodation";
  totalCents?: number;
  policy?: string;
};
export const bookingEmailFrom = "AkiPasa Support <support@akipasa.com>";
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char,
  );

export function renderBookingConfirmation(
  data: BookingConfirmation,
  audience: "customer" | "venue",
) {
  const es = data.locale === "es";
  const stay = data.product === "accommodation";
  const when = stay
    ? `${data.bookingStart} - ${data.bookingEnd}`
    : data.bookingStart
      ? new Date(data.bookingStart).toLocaleString(es ? "es-ES" : "en-GB", {
          timeZone: "Europe/Madrid",
          dateStyle: "full",
          timeStyle: "short",
        })
      : es
        ? "Consulta con el local"
        : "Contact the venue";
  const title = stay
    ? es
      ? "Estancia confirmada"
      : "Stay confirmed"
    : es
      ? "Reserva confirmada"
      : "Booking confirmed";
  const intro =
    audience === "venue"
      ? es
        ? "Tu equipo ha confirmado esta reserva."
        : "Your team has confirmed this booking."
      : es
        ? `Hola ${data.customerName}, tu ${stay ? "estancia" : "reserva"} está confirmada.`
        : `Hi ${data.customerName}, your ${stay ? "stay" : "booking"} is confirmed.`;
  const detail = [
    [es ? "Local" : "Venue", data.venueName],
    ...(data.offeringName
      ? [[es ? "Servicio" : "Service", data.offeringName]]
      : []),
    [
      stay
        ? es
          ? "Entrada / salida"
          : "Check in / out"
        : es
          ? "Fecha y hora"
          : "Date & time",
      when,
    ],
    ...(stay && data.totalCents !== undefined
      ? [
          [
            es ? "Total (EUR)" : "Total (EUR)",
            (data.totalCents / 100).toFixed(2),
          ],
          [es ? "Condiciones" : "Terms", data.policy || ""],
        ]
      : []),
    ...(data.address ? [[es ? "Dirección" : "Address", data.address]] : []),
    [es ? "Personas" : "Guests", String(data.guestCount)],
    ...(audience === "venue"
      ? [
          [es ? "Cliente" : "Guest", data.customerName],
          ["Email", data.customerEmail],
        ]
      : []),
    [es ? "Referencia" : "Reference", data.bookingId.toUpperCase()],
  ];
  const href =
    audience === "customer"
      ? stay
        ? `https://akiduermo.com/bookings?lang=${data.locale}`
        : `https://akipasa.com/${data.locale}/account/bookings`
      : `${managementProduct.origin}/${data.locale}/business/venue/${encodeURIComponent(data.venueId)}?section=bookings&${stay ? "accommodationTab=reservations" : "bookingTab=inbox"}`;
  const cta =
    audience === "customer"
      ? es
        ? "Mis reservas"
        : "My bookings"
      : es
        ? "Gestionar reserva"
        : "Manage booking";
  return {
    subject:
      `${audience === "venue" ? (es ? "Nueva reserva confirmada" : "New confirmed booking") : title} · ${data.venueName}`.replace(
        /[\r\n]/g,
        " ",
      ),
    text: [
      intro,
      "",
      ...detail.map(([key, value]) => `${key}: ${value}`),
      "",
      `${cta}: ${href}`,
      "AkiPasa · akipasa.com",
    ].join("\n"),
    html: `<!doctype html><html lang="${data.locale}"><body style="margin:0;padding:24px;background:#f1f4fa;font-family:Arial,sans-serif;color:#14213b"><main style="max-width:580px;margin:auto;background:#fff;border-radius:20px;padding:32px"><p style="font-weight:bold;color:${stay ? "#21876b" : "#e66a16"}">${stay ? "AKIDUERMO" : "AKIPASA"}</p><h1 style="font-size:27px">${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p><div style="background:#f1f4fa;border-radius:14px;padding:20px">${detail.map(([key, value]) => `<p style="margin:10px 0"><span style="color:#536078">${escapeHtml(key)}:</span> <strong>${escapeHtml(value)}</strong></p>`).join("")}</div><p style="margin:28px 0"><a href="${escapeHtml(href)}" style="background:${stay ? "#21876b" : "#284cc6"};color:#fff;padding:14px 20px;border-radius:10px;text-decoration:none;font-weight:bold">${cta}</a></p><p style="color:#536078;font-size:12px">${stay ? "AkiDuermo · akiduermo.akipasa.com" : "AkiPasa · akipasa.com"}</p></main></body></html>`,
  };
}

export type BookingMailOutcome = {
  ok: boolean;
  messageId?: string;
  error?: string;
  ambiguous?: boolean;
};
/** No fake successful delivery when the key is absent or the provider rejects the send. */
export async function sendBookingConfirmationEmail(
  data: BookingConfirmation & {
    recipient: string;
    audience: "customer" | "venue";
  },
  config: { apiKey?: string } = {},
): Promise<BookingMailOutcome> {
  const apiKey = config.apiKey || process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "api_key_missing", ambiguous: false };
  const body = renderBookingConfirmation(data, data.audience);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${data.product === "accommodation" ? "akiduermo" : "akipasa"}-booking-${data.bookingId}-${data.audience}`,
      },
      body: JSON.stringify({
        from: bookingEmailFrom,
        reply_to: "support@akipasa.com",
        to: [data.recipient],
        ...body,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      return {
        ok: false,
        error: `provider_${response.status}`,
        ambiguous: response.status >= 500 || response.status === 409,
      };
    const result = (await response.json()) as { id?: string };
    return typeof result.id === "string" && result.id.length > 0
      ? { ok: true, messageId: result.id }
      : { ok: false, error: "provider_response_invalid", ambiguous: true };
  } catch {
    return { ok: false, error: "provider_unreachable", ambiguous: true };
  }
}
