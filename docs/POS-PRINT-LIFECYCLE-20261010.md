# PoS printer destinations and settlement lifecycle (10 October 2026)

## Staff workflow
The Printer Station has three live destinations:
- **Kitchen / Bar**: kitchen/bar preparation and order revisions for open tables. The staff member presses **Send** when ready; products are not auto-fired on each tap.
- **Client Bill Unpaid**: the latest queued pre-bill for an open order, created when **Pre-bill** is selected.
- **Client Bill Paid**: the final payment record for a fully settled, closed order. AkiHQ opens this destination automatically after successful final payment so staff can hand the printed paid bill to the client.

**History & Review** is not a fourth printing destination. It retains confirmations, superseded tickets and claimed/uncertain print attempts requiring reconciliation. Records are never deleted just because a table has settled.

## Database enforcement
`supabase/migrations/20261010221500_pos_print_destinations.sql`:
- Adds ticket state `superseded` to the existing checked status values.
- BEFORE INSERT guard retires older queued pre-bills and prevents partial-payment records or stale post-settlement kitchen/pre-bill copies from appearing in the active printer queue.
- AFTER order-close trigger retires still-queued preparation, pre-bill and earlier payment receipts; preserves the newest fully paid client receipt as the print candidate.
- Backfills existing queued records from already closed tables and duplicates of still-unpaid pre-bills without modifying printed/claimed/uncertain/spooled evidence.
- Extends hospitality overview tickets with `order_status` and `order_label` so all clients classify the same order lifecycle and the frontend does not rely on the bounded recent-orders list.
- Native printer agent polls only queued tickets, so superseded records are never fetched for unattended printing. No changes to native agent pairing, authentication, or print outcome protocol.

## Safety
Claimed, uncertain, spooled and confirmed tickets are never automatically retried or deleted. After payment, a claimed/uncertain kitchen ticket is visible in History & Review for explicit paper verification, but may not be started again. A superseded queued ticket is never offered a print action. Paid receipts remain operational evidence marked not a fiscal invoice; this release does not add payment processing, fiscal invoices, or refund operations.

## Acceptance
- Editing products before payment + **Send** => Kitchen / Bar revision, not an unpaid/paid bill.
- **Pre-bill** => one current unprinted Client Bill Unpaid; repeated pre-bills supersede previously unprinted versions.
- Partial payment => order remains open; no premature paid receipt printed by the agent.
- Final payment => table clears; active old queued preparation/prebill jobs become `superseded` and disappear from active queues; only final paid receipt remains queued in Client Bill Paid; UI opens Paid directly.
- All historical tickets remain in History & Review. Existing claimed/uncertain tickets still need paper verification; the agent cannot re-send superseded tickets.
- Validate terminal app, staff permissions, 58/80mm, native agent, split payments, PWA cache and printer offline/uncertain cases.

## Deployment order
Run automated GitHub checks and review SQL first. Apply this migration to the verified AkiHQ Supabase project, verify triggers/statuses and existing active-queue counts without deleting records, then merge the matching frontend to AkiHQ `main`. This document does not constitute a fiscal/legal certification.
