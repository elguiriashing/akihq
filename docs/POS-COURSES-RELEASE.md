# AkiBusiness POS: course hold and fire

18 October 2026. Candidate implementation, not a production deployment or a statement of fiscal/payment compliance.

## Dependency and source boundary

Built on the kitchen-display branch for PR #40 in `elguiriashing/akihq`, whose paid-product release is AkiBusiness. Merge the service branch (#39), then kitchen (#40), then this course-control branch, reviewing the exact final heads and migration order. Do not activate a frontend against an unverified live database. No production records are changed by this PR.

## Implemented workflow

- Each open bill has a **Next items** selector. Choose immediate service or one of six course presets: starters, mains, desserts and courses 4–6. The choice is local to that bill/device; resulting item holds are authoritative shared server data. A queued product tap retains the course selected when it was tapped. Repeated taps combine only compatible still-held lines, never an already-fired course.
- The existing item editor can change an unsent line's course. Assigning a numbered course holds it; immediate service still requires the normal Send action. Sent items cannot be silently re-held or reassigned. Partial payments keep the existing item-edit restriction.
- The fullscreen course panel reviews only currently held lines in the chosen course. Staff must explicitly confirm the reviewed order version. A changed bill, expired connection snapshot or unresolved command disables firing; reloading clears confirmation. Switching the selected course also clears confirmation.
- Firing is one transactional, idempotent server command. It updates only selected held dishes, creates station-specific preparation tickets, preserves unrelated unsent edits and cancellations, and retains actor, version, before/after and UUID evidence. Existing pending-command retry and abandonment protect uncertain responses.
- Normal Send and legacy clients cannot bypass course holds. Final payment is rejected while holds remain, without partially posting payment/sale/stock. Partial payment is allowed; firing is still possible after partial payment. This records external tenders, not card capture.
- Kitchen display lines show their course and elapsed time since firing. New course dishes join Waiting while unchanged dishes retain their progress. Existing unresolved kitchen revisions remain unresolved. A later course reopens a finished KDS card without recooking previously served dishes.
- Native and browser tickets have a clearly separated **NEWLY FIRED / MARCHAR** section. Previous/current lines are reference material, not a second order. Prebills label held items. Printing still has the existing queued/claimed/spooled/uncertain lifecycle and is not proof of physical output.
- The new controls support English/Spanish, dark/light, touch, phone/tablet layouts, keyboard focus/escape, and an opaque fullscreen mobile review panel. Existing AkiSuite identity, role checks, service board, favourites, pricing and other integrations remain unchanged.

## Schema and security

`supabase/migrations/20261018184327_pos_course_control.sql` was scaffolded using Supabase CLI 2.121.0. Apply after `20261018152924_pos_kitchen_display.sql` and the existing hospitality, printer and ledger prerequisites. The migration advertises `course_contract_version=1`; new controls stay hidden when it is absent. There is no backfill and no automatic assignment or firing. Existing orders without course metadata behave as before.

Private helpers are not executable by public, anonymous, authenticated or service roles. The public RPC explicitly invokes the live hospitality guard, fixes `search_path`, scopes workspace/order/actor and uses the shared workspace transaction lock. It does not introduce tables or weaken table RLS. Migration edits to existing functions have exact contract anchors and fail atomically against an unexpected definition. Do not hand-edit anchors until the live drift is understood.

## Verification

Local disposable PGlite runs pass 19 course database cases and 15 helper/render/printing cases. The captured-schema test additionally installs the October printer and trading-day migrations before kitchen and course control. Existing service/KDS helper regressions and the dependency-free register/mobile smoke tests also pass locally.

Local Chromium passes 32 viewport/language/theme cases across 1280×800, 1024×768, 800×1280, 768×1024, 650×900, 360×800, 320×640 and 900×500, plus stale-order, explicit-confirmation, focus/escape, batch-course-entry, line-edit, uncertain-response retry and feature/permission interactions. Local execution injects fixture assets because local HTTP is unavailable, and substitutes storage/Web Locks. It is not evidence of native multi-tab behavior.

The `AkiBusiness course control review` workflow must pass on the final commit. It adds native HTTP Chromium checks with real storage, five independent PostgreSQL17 concurrency scenarios, focused regressions and clean paid-product release/cache assertions. Existing repository-wide dependency/security/Worker checks, service review and kitchen review remain enabled. Review the actual final GitHub conclusions; a workflow definition is not a test result.

## Staging acceptance and rollout

1. Apply the full migration chain to a representative staging copy; inspect function contracts, current memberships, effective permissions and RLS/security advisors. No staging or live Supabase project was inspected or modified for this change.
2. Update frontend and paired print agents together. Drain stale clients, confirm the correct AkiBusiness release assets/cache, and keep pending recovery identities intact.
3. With independently authenticated waiter, kitchen and manager devices, verify course entry, simultaneous edits, lost responses, table transfers, partial payments, held-final-payment rejection and revocation. Confirm kitchen has no false relocation/re-cook instructions.
4. Test real 58/80 mm printers, long notes, Spanish accents, paper-out, uncertain output and explicitly marked copies. Check a table with previously served starters and newly fired mains on both paper and KDS.
5. Pilot with synthetic orders before any commercial service. No invoice/compliance, settlement or physical-printer sign-off is provided by these automated tests.

## Limits and rollback

This milestone is whole-line manual firing, not per-quantity course production, custom course names, automatic product-course rules or timed firing. Ingredient/allergen data remains operator text, not a validated allergen database. Priced modifiers/variants, recipe costing, automatic stock reservation, offline order creation, integrated terminal capture/refunds and completed fiscal invoicing remain separate work.

Do not roll back the server hold/send/payment protections while open held dishes exist. Stop new course assignments, reconcile every held dish and unresolved command, retain audit/print evidence, then perform a coordinated frontend/agent/server rollback after review. Reverting just the frontend leaves server protections in place but removes staff's firing controls. Do not erase course metadata or recovery records as a workaround.
