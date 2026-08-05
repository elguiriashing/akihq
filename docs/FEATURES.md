# Feature status

Legend:

- **Working** — implemented in the browser app and persisted locally.
- **Optional cloud** — implemented when Supabase/Worker setup is supplied.
- **Adapter surface** — UI/data model exists; provider-specific backend/OAuth work and credentials remain.
- **Not included yet** — intentionally not presented as finished.

## Workspace and navigation

| Capability | Status | Notes |
|---|---|---|
| Dark/light themes | Working | Saved per browser |
| Comfortable/compact density | Working | Saved per browser |
| Collapsible navigation | Working | Converts to bottom navigation on phones |
| Global search | Working | Deals, contacts, companies, tasks and articles |
| Command palette | Working | `Ctrl/Cmd + K` |
| Notifications | Working | Local notification centre |
| Work timer | Working | Persistent elapsed time |
| English/Spanish setting | Working | Common interface labels; some long-form demo copy remains English |
| PWA/offline shell | Working | Requires HTTP/HTTPS |
| Multi-workspace switching | Adapter surface | Workspace selector UI/data model present; single workspace active in alpha |

## CRM

| Capability | Status | Notes |
|---|---|---|
| Deals | Working | Create, edit, delete, view details |
| Leads | Working | Create, edit, delete and convert |
| Contacts | Working | Company links, tags and details |
| Companies | Working | Contacts and deal relationships |
| Multiple pipelines | Working | Seeded venue and sales pipelines |
| Kanban | Working | Drag deals between stages |
| Table view | Working | Sortable-style operational table layout |
| Activity timeline | Working | Local audit/activity entries |
| CSV export | Working | Deals, leads, contacts, companies and products |
| Bitrix24 CSV migration | Working | Contacts, companies and deals with duplicate checks |
| Custom fields | Partial | Record schema accepts extra data; visual field builder not included yet |
| Advanced permissions | Not included yet | Current alpha is single-user/local-first |

## Communications

| Capability | Status | Notes |
|---|---|---|
| Shared inbox UI | Working | Conversation list, unread state and local replies |
| Channel labels | Working | Email/social/demo channels |
| Real email ingestion | Adapter surface | Resend/Google/Microsoft provider work required |
| Outbound email | Optional cloud | Resend endpoint included in Worker |
| SMS | Optional cloud | Twilio endpoint included in Worker |
| WhatsApp/Instagram/Facebook inbox | Adapter surface | Meta business app and webhook approval required |
| Voice/video calling | Not included yet | Zoom/Teams connection cards only |

## Tasks, projects and calendar

| Capability | Status | Notes |
|---|---|---|
| Projects | Working | CRUD and linked tasks |
| Task board | Working | Drag between statuses |
| Task list | Working | Deadlines, priority, assignees |
| Calendar month view | Working | Events and task deadlines |
| Booking pages | Partial | Booking-oriented event records; public scheduling backend not included |
| Gantt | Not included yet | Data model can be extended |
| Time tracking | Working | Global timer; detailed timesheet reports not included |

## Commerce and operations

| Capability | Status | Notes |
|---|---|---|
| Products | Working | SKU, price, cost and stock |
| Warehouses | Working | Seeded warehouses and stock adjustments |
| Stock movements | Working | Adjustment history via activity/audit records |
| Quotes | Working | CRUD and printable document |
| Invoices | Working | Statuses, totals and printable document |
| Payments | Adapter surface | Stripe/PayPal adapters need credentials/webhooks |
| Full accounting/ledger | Not included yet | No tax filing, reconciliation or compliant bookkeeping engine |
| Payroll | Not included yet | Employee directory is HR-lite only |

## Marketing, sites and automation

| Capability | Status | Notes |
|---|---|---|
| Campaign records | Working | Status, channel and performance metrics |
| Audience/consent overview | Working | Demonstration/local records |
| Landing-page records | Working | CRUD and status management |
| Form records | Working | CRUD and submission counts |
| Hosted public page rendering | Not included yet | Page builder records are internal in alpha |
| Automation rules | Working | CRUD and enable/disable state |
| Executing background automations | Adapter surface | Requires Worker/Queues/Cron or another runner |
| Generic signed webhooks | Optional cloud | Allow-listed Worker endpoint included |

## Collaboration, HR and knowledge

| Capability | Status | Notes |
|---|---|---|
| Team feed | Working | Posts, comments and reactions |
| Employee directory | Working | Role, department, status and leave balance |
| Leave workflows | Partial | Data fields present; approval flow not included |
| Knowledge base | Working | Article CRUD and Markdown display |
| Realtime multi-user editing | Not included yet | Supabase sync is whole-workspace snapshot backup |

## Analytics and data

| Capability | Status | Notes |
|---|---|---|
| Dashboard metrics | Working | Derived from workspace data |
| Funnel/revenue/task analytics | Working | Local calculations and visual bars |
| JSON backup and restore | Working | Complete workspace snapshot |
| Supabase snapshot push/pull | Optional cloud | Auth + RLS schema included |
| Immutable compliance audit | Not included yet | Local audit log can be altered with workspace data |
