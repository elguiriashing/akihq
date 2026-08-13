# AkiHQ

**AkiHQ is an original, database-backed business operating system.** It combines CRM, projects, inbox, calendar, stock, invoicing, marketing, internal collaboration, reporting and integration management in one browser app.

This repository contains a **working alpha**, not a mock-up and not a prompt for another AI to build later. It runs without npm, Docker or a VPS.

![AkiHQ dashboard](docs/screenshots/dashboard.png)

## Start it

### Windows — easiest

1. Extract the ZIP.
2. Double-click `start-windows.bat`.
3. A browser opens at `http://127.0.0.1:8080`.

Python 3 is the only requirement for the local web server. You can also double-click `index.html`; nearly everything still works, but installable-PWA and service-worker features need `http://` or `https://`.

### macOS or Linux

```bash
chmod +x start.sh
./start.sh
```

Or run:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8080`.

## What already works

- Dashboard metrics, activity, tasks, revenue and pipeline summaries
- CRM deals, leads, contacts and companies
- Social CRM for Facebook Pages, Instagram professional accounts and TikTok metrics
- Multiple pipelines, Kanban drag-and-drop, list view and record drawers
- Lead conversion into contact, company and deal records
- Shared inbox with database-backed conversations and replies
- Tasks, projects, board/list views, deadlines and work timer
- Calendar events and month navigation
- Product catalogue, warehouses and stock adjustments
- Quotes and invoices with printable documents
- Campaigns, audiences and marketing performance
- Landing-page and form records
- Automation-rule records and enable/disable controls
- Team feed, posts, comments and reactions
- Employee directory and HR-lite records
- Knowledge-base articles with Markdown rendering
- Live personalisation, recommendation, catalogue, CRM and funnel analytics
- Integration marketplace and connection configuration
- JSON backup/restore, CSV export and Bitrix24 CSV migration
- Global search, command palette (`Ctrl/Cmd + K`), notifications and themes
- English/Spanish interface setting, responsive layout and offline app shell
- Required Supabase staff sign-in, RLS-protected persistence and realtime workspace sync
- Encrypted Cloudflare credential vault and server-side social OAuth/token handling

## Data model and privacy

Supabase is the authoritative store for workspace records. Browser memory is only a temporary render cache; Calendar, Knowledge and the other CRM modules are committed to the shared `workspace_snapshots` row and synchronized with authenticated staff sessions.

Use **Dashboard → Backup** for portable recovery exports. Clearing browser storage no longer deletes workspace business records.

Personalisation analytics are returned through an administrator-only aggregate RPC. The dashboard does not expose individual visitor histories or precise location data.

## Deploy with no VPS

### Cloudflare Pages

Upload this whole folder to a Cloudflare Pages project, or connect the repository to Pages. It is a static app, so there is no build command and the output directory is the repository root.

Suggested settings:

```text
Framework preset: None
Build command:     (leave blank)
Output directory:  /
```

The included `_headers` file adds sensible browser security headers.

### Required Supabase database

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email/Password authentication.
4. Put the project URL and anon key in `config.js`.
5. Sign in with a moderator or administrator account.

The publishable key is expected to be visible in a browser app. Row Level Security and staff-role policies protect the shared workspace.

### Optional Cloudflare integration gateway

The `cloudflare/` folder contains a deployable Worker for integrations that cannot safely expose secrets in a browser. It currently includes authenticated endpoints for:

- Resend email
- Slack notifications
- Discord notifications
- Telegram bot messages
- Twilio SMS
- Incoming provider-webhook storage in Supabase
- Allow-listed generic outgoing webhooks

See `docs/DEPLOY.md` and `docs/INTEGRATIONS.md`.

## Integration honesty department

AkiHQ contains configuration screens and a provider catalogue for the major CRM/business integrations. External OAuth services do not become live just because their logo appears on a card. Gmail, Microsoft, Meta, Stripe, Zoom and similar services require your own developer application, credentials, approval scopes, callback URLs and provider-specific code.

The browser app, import/export flows, database-backed modules, Supabase realtime sync and included Worker endpoints are implemented. The remaining provider cards are clearly marked as setup/adapters rather than pretending to be connected. No smoke, mirrors or tiny salesman living in the ZIP.

## Project structure

```text
assets/                 App JavaScript, CSS and logo
cloudflare/             Optional secret-holding integration Worker
supabase/schema.sql     Shared workspace and webhook-event schema
docs/                   Architecture, features, deployment and test notes
config.js               Public Supabase and gateway configuration
index.html              App entry point
manifest.webmanifest    Installable PWA metadata
sw.js                   Offline shell service worker
```

## Current scope

AkiHQ is a database-backed alpha and a strong base for a hosted product. It is not yet a drop-in replacement for every Bitrix24 enterprise feature. Complete mail ingestion, voice/video calling, payroll, accounting compliance and every third-party OAuth adapter still require further backend work and provider credentials.

See `docs/FEATURES.md` for the precise implemented/adapter/planned split.

## Licence

Apache License 2.0. See `LICENSE`.
