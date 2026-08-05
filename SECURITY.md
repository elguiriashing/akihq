# Security notes

AkiHQ's default local mode stores data in browser localStorage. Treat exported JSON backups as confidential business data.

Never place service-role keys, OAuth client secrets, Resend keys, Twilio credentials or bot tokens in `config.js`, `assets/app.js` or any other browser-delivered file. Store them as Cloudflare Worker secrets.

The optional Supabase schema enables Row Level Security on user snapshots. Do not disable it. The `integration_events` table deliberately has no public policies and is intended to be written with the Supabase service-role key from the Worker only.

For a public deployment, use HTTPS, a unique Worker API token, narrow provider scopes, webhook signature verification and separate development/production credentials.

To report a vulnerability, open a private security advisory in the repository where you host this project. Do not include live secrets or customer records in a public issue.
