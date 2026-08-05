# AkiHQ Cloudflare integration gateway

This Worker is optional. The main AkiHQ app runs without it.

Use it when a provider requires a secret that must not be shipped to the browser. The Worker exposes:

```text
GET  /api/health
GET  /api/integrations/status
POST /api/resend/send
POST /api/notify/slack
POST /api/notify/discord
POST /api/notify/telegram
POST /api/twilio/sms
POST /api/outbound/webhook
POST /api/webhooks/:provider
```

All routes except health and incoming webhooks require:

```text
Authorization: Bearer <AKIHQ_API_TOKEN>
```

Incoming webhooks require `x-akihq-webhook-secret` when `WEBHOOK_INGEST_SECRET` is configured. That shared secret is a gateway guard, not a replacement for each provider's official signature scheme. Add provider-specific verification before accepting sensitive production events.

## Deploy

```bash
cd cloudflare
npx wrangler deploy
```

Set secrets with `npx wrangler secret put NAME`. Do not commit `.dev.vars`.

For local development:

```bash
cp .dev.vars.example .dev.vars
npx wrangler dev
```

Update `ALLOWED_ORIGINS`, `SUPABASE_URL` and `OUTBOUND_WEBHOOK_HOSTS` in `wrangler.toml`.
