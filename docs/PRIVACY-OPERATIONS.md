# Privacy, communications and integration operations

Implementation date: 23 September 2026. This document describes implemented controls and remaining operational work; it is not a certification or a claim that every processing activity is compliant.

## What is implemented

The Worker delegates `/api/privacy/*` to `cloudflare/privacy.js`. Authenticated operations validate a Supabase user session, require the selected workspace, and check its active owner or unrestricted administrator membership. The database repeats that check for every action. Platform administrator status does not confer access to another tenant. Restricted role templates do not gain privacy-manager access merely by using an `admin` role.

The additive migration `20260923001529_privacy_operations.sql` creates:

| Record | Control |
|---|---|
| Controller settings | Tenant legal name, postal address, privacy contact, HTTPS notice URL and chosen support retention review threshold |
| Consent evidence | Email/channel/purpose, grant or withdrawal, source, evidence reference, notice version, actual occurrence time, server recording time and actor |
| Suppression | Tenant/email block for withdrawal, unsubscribe, objection, bounce or complaint; cannot be cleared by reimporting contacts |
| Rights requests | Intake, one-calendar-month deadline, verified identity, evidenced actions, one extension up to three calendar months from receipt and resolution tracking |
| Privacy audit events | Append-only evidence of settings, consent, rights actions, exports and delivery operations |
| Marketing outbox | Server reservation, consent link, sender, payload digest, idempotency key, provider status and secret unsubscribe capability |

Public-schema privacy tables have RLS and read access only for the tenant's permitted managers. Browser roles cannot insert, update or delete them. Mutation RPCs are callable only by the server role. Consent, event and suppression mutation triggers preserve evidence even if a server code path attempts an ordinary update/delete. A privileged database operator can still change database objects; database access governance and backup protection remain operational duties.

## Marketing delivery

`POST /api/privacy/marketing/send` accepts one recipient per request:

```json
{
  "request_id": "a stable UUID retained across retries",
  "email": "consenting-customer@example.com",
  "sender": "verified-tenant-sender@example.com",
  "subject": "Requested venue news",
  "text": "The message body"
}
```

The sender must match an active, verified mailbox registered for the same workspace. Before reservation the database verifies tenant controller settings, the latest explicit marketing consent and absence of suppression. Imported prospects are not treated as consenting subscribers. This implementation deliberately uses explicit consent only; it does not attempt to implement Spain's narrow existing-customer exception automatically.

Messages include the controller identity/address, privacy contact/link, visible unsubscribe link and RFC 8058 list-unsubscribe headers. The server creates plain text and escaped HTML; the client cannot add hidden recipients, arbitrary headers or executable HTML. A workspace-wide transactional lock enforces an initial cap of 100 send reservations per hour. A repeated idempotency key returns its existing outcome and never sends a new copy; changed content with the same key is rejected. Ambiguous provider failures are recorded as `uncertain` and require review; a new idempotency key cannot bypass an unresolved outcome for the same recipient. `sent` means provider acceptance, not inbox delivery.

Unsubscribe requires no account or password. GET shows a confirmation form and does not change preferences when a mail security scanner follows a link. POST applies suppression immediately and supports one-click mail-client requests. Unknown tokens produce the same confirmation, avoiding subscriber enumeration. Tokens do not expire, so old messages retain a working opt-out. Suppression cannot currently be lifted through the UI; implement a separate verified re-consent procedure before supporting re-enrolment.

`POST /api/privacy/delivery` validates the raw Resend webhook body using Svix HMAC signatures, a five-minute timestamp window and database event deduplication. Hard or soft bounce notifications and complaints are conservatively suppressed. Early callbacks received before the send result are stored and reconciled under a provider lock. Unsigned events cannot suppress users. New endpoints do not make any model call or interpret incoming email as executable instructions.

Activation is intentionally off until configured:

| Configuration | Purpose |
|---|---|
| `RESEND_API_KEY` secret | Server-side provider access |
| `RESEND_WEBHOOK_SECRET` secret | Signature verification for the configured delivery endpoint |
| `PRIVACY_PUBLIC_ORIGIN` | Public HTTPS Worker origin serving the unsubscribe route |
| `PRIVACY_MARKETING_ENABLED=true` | Explicit operational activation after sender and webhook verification |

Before activation, the operator must verify the sending domain/provider authorization, SPF, DKIM, DMARC, actual webhook delivery, complaint/bounce suppression, public unsubscribe availability, controller details and legitimate consent evidence. A nonempty environment variable alone does not verify these external conditions. No external registration, DNS change, email sending or production activation was performed by the automated tests.

Legacy `/api/resend/send` and `/api/twilio/sms` arbitrary shared-token sends now return `409 governed_delivery_required`. Authentication emails are outside these endpoints and remain unchanged. Existing tenant support uses its separate authorized transactional reply flow. Promotional SMS remains unavailable until there is a consent, suppression, sender, provider-feedback and opt-out implementation for that channel.

## Rights requests and retention

| Endpoint | Method and input |
|---|---|
| `/api/privacy/overview` | GET; controller settings, up to 200 newest requests, counts, latest 50 events, support retention review count |
| `/api/privacy/settings` | POST; `controller_name`, `controller_address`, `privacy_email`, `policy_url`, `retention_days` |
| `/api/privacy/consent` | POST; `email`, `status` (`granted`/`withdrawn`), `source`, `evidence`, `notice_version`, `occurred_at` |
| `/api/privacy/requests` | POST; `email`, `kind` (`access`, `erasure`, `rectification`, `restriction`, `objection`, `portability`), optional `note` and actual `received_at` timestamp |
| `/api/privacy/request-action` | POST; request `id`, `action` (`verify`, `extend`, `complete`, `reject`), evidence/explanation `note` |
| `/api/privacy/export?id=…` | GET; verified access/portability request; downloadable JSON |

All manager calls require `Authorization: Bearer <Supabase user token>` and `x-workspace-id`. The UI must retain request IDs, display server errors, and never invent consent for an imported contact. Evidence fields should contain a reference to verified evidence; do not paste full identity documents or unnecessary sensitive data. The system records a manager's verification decision, it does not independently validate a person's identity.

An objection, restriction or erasure request blocks further marketing immediately. The tracker does not automatically erase invoices, employment records or other records potentially subject to preservation duties. It also does not claim that a marketing suppression implements every kind of GDPR processing restriction.

The generated JSON is a **scoped preparation export**, explicitly marked `complete_subject_export: false`. It includes privacy evidence and the subject's support contacts/tickets/correspondence. Other subjects and staff-only notes are excluded from the automated export. A controller must separately assess internal notes about the subject and third-party rights rather than assuming every internal note is exempt from access. CRM snapshots, the company mailbox, sales/statutory invoices, bookings, membership/staff records, providers and backups need separate review before a request is fulfilled. Completion records a manager's evidenced decision; it does not claim those external actions happened automatically.

The system calculates deadlines from the supplied actual receipt timestamp, or the current server timestamp when omitted. Staff must record the actual receipt date, assess its scope and identity proportionately, respond within the legal timeframe, and communicate any justified extension within the initial month. The extension note must reference the justification and communication. This initial UI/API does not send the rights response, automate extension notices, merge cross-channel duplicate requests or support a full legal hold engine.

Retention review identifies resolved/spam support tickets older than the tenant's selected threshold. This threshold is a review policy, not a declaration of a universal legally permitted storage period. It does not silently delete records. Remaining work includes module-specific retention schedules and purposes, legal holds, reviewed erasure/anonymization jobs, processor deletion propagation, private original-email/storage cleanup and backup expiry/recovery procedures. Consent and suppression evidence also need an approved retention schedule and restricted long-term access.

## Shared integrations and AI support

The existing shared KV social-account vault, media store and company mailbox are now limited to the AkiPasa workspace and require both platform staff status and active company owner/unrestricted administrator membership. Media body/query workspace overrides cannot bypass that boundary. Tenant integrations need their own scoped vault and permissions before those legacy tools can be offered as general tenant features.

Company mailbox sends are limited to replies matching an observed inbound message ID and both addresses. This prevents the old arbitrary-recipient route from bypassing the governed marketing sender. New promotional messages must use the consent-gated route. The legacy KV company mailbox still needs a transactional delivery outbox/idempotency upgrade for full operational parity with tenant support.

External Slack/Discord/Telegram/webhook actions require a valid platform staff session and company owner/unrestricted administrator membership. The browser-shared integration token can no longer authorize these writes. Generic webhook intake requires a configured shared secret and server-selected `WEBHOOK_WORKSPACE_ID`; the payload cannot select a target tenant. Provider-specific cryptographic adapters are still needed where a generic shared secret does not match the provider's native protocol. Outbound webhooks stay bound to an exact HTTPS hostname allowlist and do not follow redirects.

OAuth callbacks recheck the active membership saved in encrypted state before storing provider tokens. Media responses apply a sandbox CSP, disable MIME sniffing and prevent referrer leakage from secret media links. JSON request sizes are bounded while streaming. Generic request failures no longer expose raw internal errors.

Tenant support retains its existing verified recipient routing, approved-answer-only AI, human escalation, no-tool model calls, and idempotent delivery outbox. At delivery the server verifies authorship of the exact claimed tenant/message. AI-authored replies begin with a bilingual AI identification and a clear human handoff instruction. Human-authored replies retain their original text. Identity, account changes, privacy requests and other sensitive instructions from inbound email remain routed to humans; a sender's email text is not authorization.

## Required business operations

Code cannot establish the controller's purposes, lawful bases or contractual facts. Before offering the suite for real personal data processing, complete the processing inventory, tenant controller/processor terms, Article 28 processor agreements, subprocessor notices, transfer safeguards/assessment, security incident procedures, staff access reviews, backup restore tests, retention schedules and required public notices. Assess whether a DPO, DPIA or sector-specific controls are needed for the actual deployment. Do not describe AkiHQ as universally GDPR-certified.

## Verification and primary references

Run `node --test privacy.test.js privacy-db.test.js privacy-routing.test.js privacy-support.test.js support.test.js` from `cloudflare/`. Tests use fake providers and a local PostgreSQL-compatible database; they do not send real messages. The coverage includes tenant RLS, restricted manager access, append-only evidence, withdrawn/suppressed recipients, idempotency, early delivery callbacks, identity gates, calendar-month deadlines, scoped exports, signature/body/timestamp verification, safe unsubscribe GET/POST, unknown delivery outcomes and AI identification.

- [Spain LSSI, consolidated text, Articles 20–22](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758): identification and conditions for electronic commercial communications, including the narrow prior contractual relationship exception and an accessible opt-out. Public business contact details are not blanket marketing permission.
- [GDPR, consolidated regulation](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02016R0679-20160504): consent/withdrawal, purpose and retention limits, rights handling, security and processor duties. Article 12 uses one month, with a justified extension of two further months where applicable.
- [EC AI transparency guidance](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations): Article 50 transparency obligations and interaction with people; assess applicability to the actual AI service.
- [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests) and [Svix manual signature verification](https://docs.svix.com/receiving/verifying-payloads/how-manual): raw-body signature and replay protection.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): role grants, row policies and service-role bypass require explicit tenant authorization in trusted backend operations.
