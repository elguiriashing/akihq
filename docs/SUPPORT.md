# Customer Support

Tenant-specific support lives at `#/support`. It is separate from the legacy
platform-wide company Inbox. The implementation is gated: incoming-mail
processing is **off** in the checked-in Worker configuration and AI defaults to
**off** per workspace. A GitHub/Pages deployment alone does not activate intake.

## Features

- Numbered `SUP-000001` tickets, tenant-specific customer IDs and unique email IDs.
- Email conversations threaded by RFC Message-ID/References, the same sender,
  and the same tenant mailbox. Subject text alone never merges conversations.
- Search, status filters, assignment, priority, private notes, replies and audit
  history. Mobile uses a ticket list/detail layout; desktop uses a split inbox.
- “Needs a human” counts in the Support navigation and CRM notification bell.
  These are in-app alerts while the CRM is open, not OS push or SMS alerts.
- Private original `.eml` downloads including attachments. Displayed message
  previews are plain text, never executed HTML; attachments are untrusted files.
- AI Off, Draft, or Automatic modes. AI selects an exact owner-approved answer,
  or escalates. It has no CRM tools, browser, account-changing capabilities, or
  access to another tenant's knowledge or email.

## Access and isolation

The module must be active in `crm_workspace_entitlements`, the workspace must
be active, and the person must have an active membership **in that workspace**.
The existing business entitlement is also required for customer workspaces.

Owners have access. An admin without a role template has access. Other roles
(and admins with a template) need that tenant's role template to include
`support`. Viewers can read but cannot reply or change tickets. Only permitted
owners/admins can configure AI and approved answers. A platform admin has no
support-data bypass into another business.

The existing Business CRM module toggle controls tenant availability. Mailbox
registration is an operator task, not a self-service text field: a tenant must
never claim an email address belonging to another business.

API calls require a valid Supabase user access token and `X-Workspace-ID`.
Every read and mutation checks tenant access. Tables have RLS; aggregate and
mutation RPCs are service-only. Original emails use the private
`crm-support-mail` Storage bucket with an additional restrictive policy blocking
all direct anonymous/authenticated access. The gateway authorizes each download;
there are no public or bearer-link downloads. Emails are not included in shared
workspace snapshots, browser localStorage, or public-site search.

## Safe rollout — required before use

1. Review and apply `supabase/migrations/20260915074426_support_desk.sql` to the
   **existing AkiPasa database**, after its CRM migrations through 0080. Do not
   apply the legacy `supabase/schema.sql` as a production replacement. The new
   migration is additive and seeds only an inactive, unverified
   `support@akipasa.com` mailbox in `ws_akipasa`, with AI off.
2. Deploy this repository's `cloudflare/` integration gateway, initially with
   `SUPPORT_INGEST_ENABLED=false`. Deploy the static CRM assets too. If GitHub
   is connected only to Pages, the Worker needs its own deployment.
3. Confirm the gateway's existing `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL` binding,
   Supabase URL, publishable key and allowed CRM origin are correctly configured.
   Check Storage quota/file limits (original messages are limited to 25 MiB).
4. Verify control of `support@akipasa.com` and its Cloudflare Email Routing rule
   targeting `akihq-integration-gateway`. Then mark **that exact existing
   mailbox** active and verified using an authorized server-side database tool:

   ```sql
   update public.crm_support_mailboxes
   set active = true, verified_at = now()
   where workspace_id = 'ws_akipasa' and address = 'support@akipasa.com';
   ```

5. Enable `SUPPORT_INGEST_ENABLED=true` in the Worker deployment configuration.
   Keep the workspace AI mode off. Use two authorized test accounts to verify
   that an allowed HQ member sees Support and an unrelated business cannot.
6. Send a test email from a test address you control. Verify intake, ticket ID,
   duplicate protection, reply threading, original download, assignment and
   handover notifications. Send a reply only to that authorized test address.
7. For AI, configure the gateway's `OPENAI_API_KEY` secret and an appropriate
   `SUPPORT_AI_MODEL` supporting the Responses API and structured outputs. Never
   put secrets in `config.js`, GitHub files, or chat. Add reviewed, customer-safe
   answers in Support settings. Start in Draft mode, review results, then opt
   into Automatic mode if desired. Activation sends email subject/body and only
   that tenant's approved answers to OpenAI with `store:false`; review the
   organization's provider/data-processing settings before enabling it.

For another business: enable its Support entitlement, grant its staff the
correct role template, verify domain/address control, register the exact mailbox
with its workspace ID, configure the inbound route and authorized sender, then
activate. Do not add its emails to AkiPasa's global forwarding list. Registered
customer-tenant support mail is never forwarded to the HQ Gmail destination or
copied into the company-wide KV Inbox. HQ's existing Gmail backup forwarding is
preserved. Register all tenant addresses before routing messages to the Worker.

## AI and delivery safeguards

- Sensitive/account-changing requests, customers asking for a person, automated
  senders, attachments, long/HTML-only messages, and uncertain sender eligibility
  go to a human. Email authentication is **not** proof of customer identity.
- Default budget: 25 AI classifications/day per workspace and up to two AI
  replies/ticket; settings cap these at 100/day and three/ticket.
- No match, provider error, timeout or budget exhaustion produces a handover.
- A human taking over, a new customer email, or changed approved answers
  invalidates an in-flight AI decision. Taking over cancels queued AI replies;
  an email already submitted to the provider cannot be recalled.
- Replies use a transactional outbox and idempotency IDs. Unknown send outcomes
  are flagged for review, not automatically retried. “Accepted by mail provider”
  is not a promise that the message reached the customer's inbox.
- The two-minute cron advances AI and queued deliveries. Dashboard refreshes
  normally happen every 30 seconds in Support / 60 seconds elsewhere; edits are
  preserved while typing. This is asynchronous support, not real-time chat.
- Disabling processing pauses AI/outbound replies but retains incoming tickets.
  Disabling the tenant entitlement hides access and prevents replies. Registered
  tenant intake stays isolated even while that mailbox/module is disabled.
- If intake/storage fails, the email is rejected with an explicit error, not
  silently accepted or forwarded into another tenant's inbox. Monitor Worker
  errors and email delivery logs. Successful private-file uploads preceding a
  failed DB transaction may leave orphan files; retain/reconcile them before any
  authorized cleanup. Do not assume Cloudflare automatically retries rejections.

## Scope and operation

No Gmail history is imported or deleted. This processes **new routed mail**.
Replies send from the registered support alias to the ticket's original customer;
arbitrary recipients, CC/BCC and outbound attachments are not supported yet.
Original attachments can be downloaded in the `.eml` file; there is no inline
attachment preview or malware scanning. Tickets show the newest 200 messages and
100 activity entries; older records remain in the database. Retention/deletion
must follow the business's agreed policy; no automatic destructive purge is
configured.

To pause rollout, disable AI/processing first and restore the approved HQ email
route if needed. Do not forward another tenant's mail to HQ. Keep the new tables
and private bucket intact so ticket history remains recoverable. Do not roll back
by dropping tables or deleting customer emails.

## Verification

```bash
cd cloudflare
npm ci
npm run check
npx wrangler deploy --dry-run --outdir ../test-results/worker
```

The tests execute the actual migration in isolated PGlite/Postgres, check RLS,
role templates, thread boundaries, private storage policies, concurrency,
outbox idempotency, AI handover, and UI behavior in JSDOM. Provider calls are
mocked: tests never email customers, call a paid model, or modify production.
These checks do not replace a visual mobile/desktop review and authorized live
mail smoke test before activation.
