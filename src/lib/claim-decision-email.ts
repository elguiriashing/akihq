import type { BookingMailOutcome } from "./booking-confirmation-email";

export type ClaimDecision = {
  claimId: string;
  venueId: string;
  venueName: string;
  applicantName: string | null;
  decision: "approved" | "rejected";
  reason: string;
  locale: "en" | "es";
};
export const claimEmailFrom = "AkiPasa Support <support@akipasa.com>";
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char,
  );

export function renderClaimDecision(data: ClaimDecision) {
  const es = data.locale === "es";
  const approved = data.decision === "approved";
  const title = approved
    ? es
      ? "¡Bienvenido a AkiPasa!"
      : "Welcome to AkiPasa!"
    : es
      ? "Tu reclamación necesita más información"
      : "Your claim needs more information";
  const greeting = data.applicantName?.trim()
    ? `${es ? "Hola" : "Hi"} ${data.applicantName.trim()},`
    : es
      ? "Hola,"
      : "Hello,";
  const intro = approved
    ? es
      ? `Hemos aprobado tu reclamación de ${data.venueName}. Ya puedes gestionar la ficha de tu local en AkiPasa desde AkiHQ.`
      : `We have approved your claim for ${data.venueName}. You can now manage your venue's AkiPasa listing through AkiHQ.`
    : es
      ? `No hemos aprobado tu reclamación de ${data.venueName} con la información presentada. Puedes corregirla y enviar una nueva solicitud para que la revisemos.`
      : `We have not approved your claim for ${data.venueName} based on the information submitted. You can address the feedback and submit a new claim for review.`;
  const steps = approved
    ? es
      ? [
          "Inicia sesión en AkiHQ con la misma cuenta de AkiPasa que usaste para reclamar el local.",
          "Comprueba el nombre, la dirección y los datos de contacto de la ficha.",
          "Añade fotos y mantén actualizada la información que verán tus visitantes.",
        ]
      : [
          "Sign in to AkiHQ with the same AkiPasa account you used to claim the venue.",
          "Check the listing name, address and contact details.",
          "Add photos and keep the information visitors see up to date.",
        ]
    : es
      ? [
          "Revisa el motivo de la decisión y corrige los puntos indicados.",
          "Completa tu nombre y tus datos de contacto en tu cuenta para que podamos identificarte.",
          "Prepara pruebas de que eres propietario o estás autorizado para gestionar el negocio: web oficial, email corporativo, teléfono del local y una explicación de tu relación con el negocio.",
          "Abre Reclamaciones en AkiHQ, selecciona el mismo local y envía una nueva solicitud con las pruebas actualizadas. No incluyas contraseñas, datos bancarios ni documentos de identidad completos.",
        ]
      : [
          "Read the decision reason and address the points raised.",
          "Complete your name and contact details in your account so we can identify you.",
          "Provide evidence that you own or are authorized to manage the business: its official website, company email, venue phone number and an explanation of your role.",
          "Open Claims in AkiHQ, select the same venue and submit a new claim with the updated evidence. Do not include passwords, bank details or full identity documents.",
        ];
  const href = approved
    ? `https://akihq.app/${data.locale}/business/venue/${encodeURIComponent(data.venueId)}`
    : `https://akihq.app/${data.locale}/business?view=claims&venueId=${encodeURIComponent(data.venueId)}`;
  const cta = approved
    ? es
      ? "Gestionar mi local en AkiHQ"
      : "Manage my venue in AkiHQ"
    : es
      ? "Enviar una nueva reclamación"
      : "Submit a new claim";
  const reasonLabel = approved
    ? es
      ? "Notas de verificación"
      : "Verification notes"
    : es
      ? "Motivo de la decisión"
      : "Reason for this decision";
  const partnerHref = `https://akipasa.com/${data.locale}/business/early-partner?claim=${encodeURIComponent(data.claimId)}`;
  const partnerTitle = es
    ? "Queremos construir AkiPasa contigo"
    : "Help us build a better AkiPasa";
  const partnerCopy = es
    ? "Estás entre los primeros propietarios que gestionan sus locales de AkiPasa desde AkiHQ. Estamos mejorando esa experiencia y nos encantaría ofrecerte una incorporación personalizada. Queremos construir las funciones que realmente necesitan los negocios."
    : "You are among the first owners managing an AkiPasa venue through AkiHQ. We are improving that experience and would love to offer personal onboarding. Your feedback will help us build the features venues actually need.";
  const giftCopy = es
    ? "Responde dos preguntas con tu cuenta verificada de AkiPasa. Si tu local cumple los requisitos y quedan plazas, activaremos automáticamente 3 meses de AkiPasa Premium para este local, que gestionarás desde AkiHQ. Es una mejora de la ficha de AkiPasa, no una suscripción a software de operaciones. Sin tarjeta, cobros ni renovación automática. Tus respuestas serán privadas."
    : "Answer two quick questions with your verified AkiPasa account. If your venue is eligible and places remain, we will automatically activate 3 months of AkiPasa listing Premium for this venue, managed through AkiHQ. This upgrades your AkiPasa listing, not an operations software subscription. No card, charges or auto-renewal. Your answers stay private.";
  const partnerCta = es ? "Compartir mi opinión" : "Share my feedback";
  const stepsLabel = approved
    ? es
      ? "Primeros pasos"
      : "Getting started"
    : es
      ? "Cómo volver a solicitarlo"
      : "How to resubmit";
  const help = es
    ? "Si necesitas ayuda, responde a este email. Una nueva solicitud se revisará de nuevo; aportar información no garantiza la aprobación."
    : "If you need help, reply to this email. A new claim will be reviewed again; providing information does not guarantee approval.";
  const closing = approved
    ? es
      ? "Gracias por formar parte de AkiPasa. Si necesitas ayuda, responde a este email."
      : "Thank you for joining AkiPasa. If you need help, reply to this email."
    : help;
  const subject =
    `${es ? (approved ? "Reclamación aprobada" : "Reclamación rechazada") : approved ? "Claim approved" : "Claim rejected"} · ${data.venueName}`.replace(
      /[\r\n]/g,
      " ",
    );
  const text = [
    greeting,
    "",
    intro,
    "",
    `${reasonLabel}: ${data.reason}`,
    "",
    stepsLabel,
    ...steps.map((step, i) => `${i + 1}. ${step}`),
    "",
    `${cta}: ${href}`,
    ...(approved
      ? [
          "",
          partnerTitle,
          partnerCopy,
          "",
          giftCopy,
          `${partnerCta}: ${partnerHref}`,
        ]
      : []),
    "",
    closing,
    "Alex · AkiPasa",
    `${es ? "Referencia" : "Reference"}: ${data.claimId}`,
  ].join("\n");
  const html = `<!doctype html><html lang="${data.locale}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f1f4fa;color:#14213b;font-family:Arial,sans-serif;font-size:16px;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#fff;border-radius:16px"><tr><td style="padding:28px;overflow-wrap:anywhere"><p style="color:#b84b00;font-weight:bold;letter-spacing:1px">AkiPasa</p><h1 style="font-size:26px;line-height:1.3">${escapeHtml(title)}</h1><p>${escapeHtml(greeting)}</p><p>${escapeHtml(intro)}</p><h2 style="font-size:18px">${reasonLabel}</h2><p style="background:#f1f4fa;padding:16px;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(data.reason)}</p><h2 style="font-size:20px">${stepsLabel}</h2><ol style="padding-left:24px">${steps.map((step) => `<li style="margin-bottom:12px">${escapeHtml(step)}</li>`).join("")}</ol><p style="margin:28px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#14213b;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${cta}</a></p>${approved ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #aae4dc;border-radius:12px;background:#ecfbf9"><tr><td style="padding:20px"><h2 style="font-size:20px;color:#143b4c">${escapeHtml(partnerTitle)}</h2><p>${escapeHtml(partnerCopy)}</p><p><strong>${escapeHtml(giftCopy)}</strong></p><p><a href="${escapeHtml(partnerHref)}" style="display:inline-block;padding:13px 18px;border-radius:9px;text-decoration:none;background:#0bbbab;color:#09283a;font-weight:bold">${escapeHtml(partnerCta)}</a></p></td></tr></table>` : ""}<p>${escapeHtml(closing)}</p><p>Alex<br>AkiPasa</p><p style="font-size:13px;color:#536078">${es ? "Referencia" : "Reference"}: ${escapeHtml(data.claimId)}</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export async function sendClaimDecisionEmail(
  data: ClaimDecision & { recipient: string },
  apiKey?: string,
): Promise<BookingMailOutcome & { retryable?: boolean }> {
  if (!apiKey)
    return {
      ok: false,
      error: "api_key_missing",
      ambiguous: false,
      retryable: false,
    };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `akipasa-claim-${data.claimId}`,
      },
      body: JSON.stringify({
        from: claimEmailFrom,
        reply_to: "support@akipasa.com",
        to: [data.recipient],
        ...renderClaimDecision(data),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      return {
        ok: false,
        error: `provider_${response.status}`,
        ambiguous: response.status >= 500 || response.status === 409,
        retryable:
          response.status >= 500 ||
          response.status === 429 ||
          response.status === 409,
      };
    const result = (await response.json()) as { id?: string };
    return result.id && typeof result.id === "string"
      ? { ok: true, messageId: result.id }
      : {
          ok: false,
          error: "provider_response_invalid",
          ambiguous: true,
          retryable: true,
        };
  } catch {
    return {
      ok: false,
      error: "provider_unreachable",
      ambiguous: true,
      retryable: true,
    };
  }
}
