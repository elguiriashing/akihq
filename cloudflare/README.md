# AkiHQ Cloudflare integration gateway

This Worker is optional. The main AkiHQ app runs without it.

Use it when a provider requires a secret that must not be shipped to the browser. The Worker exposes:

```text
GET  /api/health
GET  /api/integrations/status
GET  /api/social/overview
POST /api/social/credentials
POST /api/social/oauth/start
GET  /api/social/oauth/callback/:provider
POST /api/social/sync
POST /api/social/accounts/disconnect
POST /api/resend/send
POST /api/notify/slack
POST /api/notify/discord
POST /api/notify/telegram
POST /api/twilio/sms
POST /api/outbound/webhook
POST /api/webhooks/:provider
```

Legacy integration routes require:

```text
Authorization: Bearer <AKIHQ_API_TOKEN>
```

Incoming webhooks require `x-akihq-webhook-secret` when `WEBHOOK_INGEST_SECRET` is configured. That shared secret is a gateway guard, not a replacement for each provider's official signature scheme. Add provider-specific verification before accepting sensitive production events.

Social routes use the signed-in user's Supabase access token. The Worker verifies the session and the user's `profiles.app_role`; only administrators can save credentials, start account connections, or disconnect accounts. Credentials and account tokens are encrypted with AES-GCM before being written to the `SOCIAL_STORE` KV namespace. Secret values are never returned by an API response.

The configured Cron Trigger refreshes connected account metrics daily at 04:15 UTC. Staff can also request an immediate refresh from the Social CRM toolbar.

## Deploy

```bash
cd cloudflare
npx wrangler deploy
```

Set secrets with `npx wrangler secret put NAME`. Do not commit `.dev.vars`.

Required for Social CRM:

```text
SOCIAL_ENCRYPTION_KEY
```

Register these exact provider callbacks after the Worker is deployed:

```text
https://YOUR_WORKER.workers.dev/api/social/oauth/callback/meta
https://YOUR_WORKER.workers.dev/api/social/oauth/callback/tiktok
```

For local development:

```bash
cp .dev.vars.example .dev.vars
npx wrangler dev
```

Update `ALLOWED_ORIGINS`, `SUPABASE_URL` and `OUTBOUND_WEBHOOK_HOSTS` in `wrangler.toml`.
