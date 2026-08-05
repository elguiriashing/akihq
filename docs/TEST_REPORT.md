# Test report

Date: 2026-08-04  
Version: 0.1.0 working alpha

## Automated/static checks

- `assets/app.js` passes `node --check`.
- `cloudflare/worker.js` passes `node --check`.
- Supabase schema was reviewed for rerunnable table/policy/trigger creation and RLS ownership checks.

## Browser smoke test

A Chromium/Playwright smoke test loaded the app with empty browser storage and observed no page errors or console errors.

Verified flows:

1. Dashboard renders seeded metrics and panels.
2. CRM deal board renders seven stages and seeded cards.
3. A new lead can be created through the modal form.
4. That lead can be converted into linked CRM records, including a deal.
5. Kanban/list controls render correctly.
6. Every main route renders without an exception:
   - Inbox
   - Tasks
   - Calendar
   - Inventory
   - Sales
   - Marketing
   - Sites
   - Automation
   - Collaboration
   - Employees
   - Knowledge
   - Analytics
   - Integrations
   - Settings
7. Generic webhook integration setup can be saved.
8. Local persistence survives a re-render.

## Manual checks still recommended after deployment

- Service-worker install and offline refresh on the final HTTPS origin
- Cloudflare Pages security headers
- Supabase signup/email-confirmation settings
- Snapshot push/pull using two separate users to verify RLS isolation
- Worker secret configuration and provider sandbox calls
- Mobile Safari/Chrome layout on physical devices
- Large CSV imports and large workspaces

## Known limitations

- Cloud snapshot sync is last-write-wins at whole-workspace level.
- Integration cards requiring OAuth are setup surfaces until their provider adapters are added.
- The app is not a compliant accounting, payroll or records-retention system.
- Demo data uses `.example` addresses and must be replaced before real operations.
