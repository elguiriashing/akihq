# Deployment guide

## 1. Local-only operation

Extract the project and run `start-windows.bat` on Windows or `./start.sh` on macOS/Linux.

AkiHQ stores the workspace in that browser profile. Export backups from the Dashboard or Settings.

## 2. Cloudflare Pages — no VPS

Create a Pages project and upload the repository contents.

```text
Build command:     blank
Output directory:  repository root
```

After deployment, connect a custom hostname such as `hq.akipasa.com` from the Pages dashboard. The included `_headers` and `_redirects` files are recognised by Pages.

Before publishing, edit `ALLOWED_ORIGINS` in the Worker configuration to include the final HTTPS origin.

## 3. Supabase snapshot sync

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication settings, enable Email/Password.
4. Add the deployed AkiHQ URL to allowed redirect/site URLs as appropriate.
5. Edit `config.js`:

```js
window.AKIHQ_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_PUBLIC_ANON_KEY"
};
```

6. Deploy the updated file.
7. In AkiHQ, open **Settings → Cloud sync**, create/sign into an account, then push a snapshot.

Do not use the service-role key in `config.js`.

## 4. Cloudflare Worker integration gateway

Install Wrangler through Node/npm or run it with `npx`:

```bash
cd cloudflare
npx wrangler deploy
```

Edit the public values in `wrangler.toml` first:

```toml
ALLOWED_ORIGINS = "https://hq.example.com,http://127.0.0.1:8080"
OUTBOUND_WEBHOOK_HOSTS = "hooks.example.com,automation.example.net"
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
```

Set only the secrets you actually use:

```bash
npx wrangler secret put AKIHQ_API_TOKEN
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put WEBHOOK_INGEST_SECRET
npx wrangler secret put OUTBOUND_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SLACK_WEBHOOK_URL
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM_NUMBER
```

The gateway API token is powerful. Use a long random value, rotate it if exposed, and do not put it into a publicly served JavaScript file. A production frontend should call privileged actions through an authenticated backend/session, not embed a master bearer token in every browser.

## 5. Production hardening checklist

- Replace demonstration records and example email addresses.
- Enable Supabase RLS and test with two different accounts.
- Use separate development and production provider credentials.
- Implement official signature verification for every sensitive provider webhook.
- Restrict `ALLOWED_ORIGINS` and outgoing webhook hostnames.
- Add rate limiting to public endpoints.
- Add an authenticated multi-user data model before inviting a team.
- Automate encrypted backups and test restoring them.
- Review tax, invoice, retention and privacy requirements for the countries where the app is used.
