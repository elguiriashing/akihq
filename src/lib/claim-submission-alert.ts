import { suiteEmailFrom } from "./suite-email-templates";
import type { BookingMailOutcome } from "./booking-confirmation-email";

export const claimSubmissionRecipients = [
  "alex@akipasa.com",
  "andrew@akipasa.com",
] as const;

export type ClaimSubmissionAlert = {
  claimId: string;
  venueId: string;
  venueName: string;
  submittedAt: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[char] || char,
  );
}

/** Internal notification. Applicant evidence and contact details stay in the
 * authenticated staff review screen, not email notifications. */
export function renderClaimSubmissionAlert(data: ClaimSubmissionAlert) {
  const venue = String(data.venueName || "Venue")
    .trim()
    .slice(0, 160);
  const title = "New venue ownership claim";
  const safeVenue = venue.replace(/[\r\n]/g, " ");
  const subject = "AkiPasa · New claim: " + safeVenue;
  const reviewUrl = "https://akipasa.com/en/staff/moderation?queue=claims";
  const submitted = Number.isNaN(Date.parse(data.submittedAt))
    ? "Recently"
    : new Date(data.submittedAt).toISOString();
  const text = [
    title,
    "",
    "Venue: " + safeVenue,
    "Submitted: " + submitted,
    "Claim reference: " + data.claimId,
    "",
    "A claim requires staff review. Do not approve automatically.",
    "Review applicant evidence and contacts inside AkiPasa:",
    reviewUrl,
  ].join("\n");
  const html =
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escapeHtml(title) +
    '</title></head><body style="margin:0;background:#f1f4fa;color:#14213b;font:16px Arial,sans-serif;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:auto;background:#fff;border-radius:16px"><tr><td style="padding:28px;overflow-wrap:anywhere"><p style="color:#c65912;font-weight:bold">AkiPasa · Staff alert</p><h1 style="font-size:24px">' +
    escapeHtml(title) +
    "</h1><p>Someone has submitted a new business ownership claim.</p><p><strong>Venue:</strong> " +
    escapeHtml(venue) +
    "</p><p><strong>Submitted:</strong> " +
    escapeHtml(submitted) +
    '</p><p style="font-size:13px;color:#52627b"><strong>Claim:</strong> ' +
    escapeHtml(data.claimId) +
    '</p><p>Review and verify the evidence before granting access.</p><p style="margin:26px 0"><a href="' +
    escapeHtml(reviewUrl) +
    '" style="display:inline-block;border-radius:10px;padding:13px 19px;background:#14213b;color:#fff;text-decoration:none;font-weight:700">Review pending claims →</a></p><p style="font-size:12px;color:#536078">Internal staff notification. Applicant contact details remain inside the staff-only review screen.</p></td></tr></table></td></tr></table></body></html>';
  return { subject, text, html };
}

export async function sendClaimSubmissionAlert(
  data: ClaimSubmissionAlert,
  apiKey?: string,
): Promise<BookingMailOutcome & { retryable?: boolean }> {
  if (!apiKey) {
    return {
      ok: false,
      error: "api_key_missing",
      ambiguous: false,
      retryable: false,
    };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": "akipasa-claim-submission-" + data.claimId,
      },
      body: JSON.stringify({
        from: suiteEmailFrom,
        reply_to: "support@akipasa.com",
        to: [...claimSubmissionRecipients],
        ...renderClaimSubmissionAlert(data),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      return {
        ok: false,
        error: "provider_" + response.status,
        ambiguous: response.status >= 500 || response.status === 409,
        retryable:
          response.status >= 500 ||
          response.status === 429 ||
          response.status === 409,
      };
    const result = (await response.json()) as { id?: string };
    return typeof result.id === "string" && result.id.length > 0
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
