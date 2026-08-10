# Integrations

## Implemented directly

### Bitrix24 migration

The integration card opens a CSV importer for contacts, companies or deals. It normalises common exported column names, connects matching company/contact names and skips obvious duplicates.

### Supabase

The Settings cloud panel can create/sign into an email/password account, push the current workspace snapshot and restore it later. Run the included schema first.

### Generic data exchange

- Full JSON workspace backup/restore
- CSV export for CRM and products
- Generic integration configuration records

## Included Worker endpoints

The optional Cloudflare Worker contains server-side actions for:

| Provider | Endpoint | Required secrets/config |
|---|---|---|
| Resend | `POST /api/resend/send` | `RESEND_API_KEY` |
| Slack | `POST /api/notify/slack` | `SLACK_WEBHOOK_URL` |
| Discord | `POST /api/notify/discord` | `DISCORD_WEBHOOK_URL` |
| Telegram | `POST /api/notify/telegram` | Bot token and chat ID |
| Twilio SMS | `POST /api/twilio/sms` | Account SID, auth token and from number |
| Generic outgoing webhook | `POST /api/outbound/webhook` | Allow-list; optional signing secret |
| Incoming events | `POST /api/webhooks/:provider` | Supabase service role; ingest secret recommended |

Privileged outgoing routes require `Authorization: Bearer <AKIHQ_API_TOKEN>`.

## Social CRM

The CRM Social tab connects Facebook Pages, Instagram professional accounts and TikTok accounts through the Cloudflare gateway. Staff overview requests use the signed-in Supabase session. Credential changes and account connection controls require an administrator role.

Provider application credentials are submitted over HTTPS, encrypted in the Worker with `SOCIAL_ENCRYPTION_KEY`, and stored in the bound `SOCIAL_STORE` namespace. Access tokens and refresh tokens use the same encrypted path. Neither credentials nor tokens are placed in local storage, workspace snapshots, logs, or API responses.

Meta and TikTok developer portals must approve the requested scopes and list the exact callback URLs shown in the CRM credential form before live account authorization succeeds.

Connected accounts refresh daily through a Cloudflare Cron Trigger and can also be refreshed manually from the CRM.

## Provider catalogue/adapters

AkiHQ includes connection records and setup UI for:

- Gmail, Outlook and Mailchimp
- Telegram, WhatsApp, Instagram, Facebook Messenger, Slack, Discord and Teams
- Google Calendar, Microsoft Calendar and Zoom
- Stripe and PayPal
- Google Drive, OneDrive and Dropbox
- GitHub
- Shopify and WooCommerce
- Typeform and Tally
- Zapier, Make and n8n
- Twilio and Telnyx
- DocuSign and Dropbox Sign
- Generic REST/webhooks
- AkiPasa

These cards are an integration **surface**, not a claim that every provider is already authorised. A production adapter generally needs:

1. A developer application at the provider.
2. Client ID/secret or API credentials.
3. Exact OAuth redirect URLs.
4. Scope and business-verification approval.
5. Token encryption and refresh handling.
6. Provider webhook signature verification.
7. Retry, deduplication and error queues.
8. Mapping between provider objects and AkiHQ records.

## Example Worker request

```bash
curl -X POST "https://YOUR_WORKER.workers.dev/api/notify/telegram" \
  -H "Authorization: Bearer YOUR_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"AkiHQ says the pipeline moved. Tiny digital office goblins remain employed."}'
```

## Recommended adapter order for AkiPasa

1. Resend inbound/outbound email
2. Google Calendar and booking sync
3. Telegram operational alerts
4. Stripe subscriptions/payments
5. Meta messaging after business-app approval
6. Google Drive document attachments
7. AkiPasa signed webhooks/API sync
8. n8n/Make connector for long-tail automations
