import { createClient } from "@supabase/supabase-js";
import { resendSendingKey } from "./booking-mail-delivery";
import {
  claimMailConfigured,
  claimMailEnvironment,
  type ClaimMailEnv,
} from "./claim-mail-delivery";
import {
  sendClaimSubmissionAlert,
  type ClaimSubmissionAlert,
} from "./claim-submission-alert";

/** Outbox is written atomically with venue_claims. This worker uses only the
 * service role and never leaks claims or recipients into public API responses. */
export async function dispatchClaimSubmissionAlerts(
  env: ClaimMailEnv = claimMailEnvironment(),
  claimId?: string,
) {
  if (!claimMailConfigured(env))
    return { sent: 0, failed: 0, configured: false };
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await db.rpc("claim_due_submission_alerts", {
    p_claim: claimId || null,
  });
  if (error) {
    console.error("claim_submission_alert_queue_unavailable", error.code);
    return { sent: 0, failed: 0, configured: true };
  }
  let sent = 0;
  let failed = 0;
  for (const row of data || []) {
    const outcome = await sendClaimSubmissionAlert(
      row.payload as ClaimSubmissionAlert,
      resendSendingKey(env),
    );
    const { error: ackError } = await db.rpc("finish_claim_submission_alert", {
      p_claim: row.claim_id,
      p_lease: row.lease_id,
      p_ok: outcome.ok,
      p_message: outcome.messageId || null,
      p_error: outcome.error || null,
      p_ambiguous: outcome.ambiguous ?? true,
      p_retryable: outcome.retryable ?? false,
    });
    if (ackError)
      console.error("claim_submission_alert_ack_pending", ackError.code);
    if (outcome.ok) sent++;
    else failed++;
  }
  return { sent, failed, configured: true };
}
