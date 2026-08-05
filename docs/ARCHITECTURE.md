# Architecture

## Default mode

```text
Browser
  ├─ index.html
  ├─ assets/app.js
  ├─ assets/styles.css
  ├─ localStorage workspace state
  └─ service-worker offline shell
```

There is no build step and no package manager. The app is intentionally delivered as plain HTML, CSS and JavaScript so it can be inspected, modified and hosted almost anywhere.

All write actions update a single versioned workspace object. `StateStore` serialises that object into `localStorage`. Derived metrics are calculated at render time rather than duplicated into separate storage.

## Optional cloud snapshot

```text
AkiHQ browser
  ├─ Supabase Auth (email/password)
  └─ PostgREST
       └─ workspace_snapshots
            └─ one JSONB snapshot per auth user
```

The browser uses the Supabase anon key plus the authenticated user's access token. Row Level Security allows a user to access only the row whose `user_id` equals `auth.uid()`.

This deliberately favours simple backup/restore over fake distributed-system cleverness. A later multi-user edition should normalise entities into tables, add workspace memberships and roles, and use row-level mutation/versioning rather than whole-state snapshots.

## Optional integration gateway

```text
AkiHQ / trusted automation
          │ Bearer token
          ▼
Cloudflare Worker
  ├─ provider APIs (Resend, Twilio, Telegram, Slack, Discord)
  ├─ allow-listed signed outgoing webhook
  └─ incoming event ingestion
          ▼ service-role key
Supabase integration_events
```

Provider secrets live as Worker secrets. They never belong in `config.js` or frontend source.

## Main frontend concepts

- **State**: workspace, users, CRM entities, projects, tasks, messages, stock, documents, content and settings.
- **UI state**: route, active tabs, selected pipeline, modals, drawers, dropdowns and transient search.
- **Render functions**: each module returns HTML from state.
- **Action delegation**: one document-level click/change/input/submit layer handles controls through `data-*` attributes.
- **Persistence**: all successful writes call `persist()`, which versions, stores and re-renders the workspace.
- **Import/export**: JSON preserves the whole state; CSV handles common operational entities and Bitrix migrations.

## Security boundaries

The frontend must be treated as public code. Anything placed in it can be read by a visitor.

Safe in frontend:

- Supabase URL and anon key, with correct RLS
- Non-secret feature flags
- Public Worker base URL

Never safe in frontend:

- Supabase service-role key
- OAuth client secret
- Resend/Twilio/Stripe secret key
- Bot tokens
- Webhook signing secrets
- Master API tokens
