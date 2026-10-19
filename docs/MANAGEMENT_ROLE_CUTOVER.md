# Management role cutover candidate

This management source now lives in `elguiriashing/akihq` and retains historical
business routes, database/entitlement keys and the `AKIHQ_GATEWAY` binding.
`NEXT_PUBLIC_AKISUITE_ROLE_SWAP=true` builds its public management identity as
AkiHQ at `https://akihq.app`; the operations destination becomes AkiBusiness at
`https://akibusiness.com`. Unset/false keeps the existing live roles. This switch
is compiled: changing a Worker variable without rebuilding is insufficient.

The exact same switch must be used by the operations and discovery releases.
Explicit valid HTTPS/local preview URL overrides remain supported; known legacy
canonical defaults are remapped. Callback origins remain request-host-derived
with an independent exact preview allowlist, never arbitrary forwarded headers.
Only the active canonical management domain is trusted; the opposite domain
must serve its own operations build. Local `/en/business` and `/es/business`
paths remain valid. Neither whole domain is redirected.

Header/app switcher, auth labels, canonical metadata, PWA name/icon, robots,
claim/booking management email links and historical welcome template brands use
the same capability-to-brand map. Existing email kind identifiers and sender
identity remain stable. No queued email is replayed or sent by this change.
Health adds publicProduct/roleSwapEnabled while retaining historical product ID.

## Required coordinated release

1. Inspect current Cloudflare connected-build triggers and preserve running routes.
   This source does not alter those remote settings. The existing named preview
   Worker may have a production custom domain; its workflow isolation guard must
   pass before any optional deployment. Build-only preview is the default.
2. Build both application roles at reviewed exact commits, with the switch true,
   on genuinely isolated preview origins. The manual preview workflow exposes a
   role_swap input; no push automatically enables it.
3. Preserve Supabase Site URL and existing allowlist. Append exact AkiHQ
   `/en/auth/callback` and `/es/auth/callback` entries for this application;
   inspect actual operations callbacks independently. Verify signup, OAuth,
   recovery, local logout and same-user identity on both hosts before routing.
4. Verify membership/RLS, legacy claims, venues, accommodation and fleet actions,
   both languages/themes and mobile/desktop. Free hub access is NOT established
   by a brand switch: existing entitlement guards remain until the coordinated
   organisation/location policy and migration are reviewed and tested.
5. Switch both domain bindings to their validated role builds together, retaining
   both active domains and legacy deep-link compatibility. Verify exact source,
   health publicProduct, TLS and authenticated owner/editor/other-tenant journeys.

Rollback restores recorded Worker/Pages versions and domain bindings together;
rebuild with flag false if restoring source. Preserve Auth allowlist entries while
sessions settle. No database deletion, subscription rewrite, source_venue_id
unlinking or membership rewrite is part of rollback.

Independent accommodation/private operations onboarding and production acceptance
remain separate coordinated work. This candidate creates no dummy venue,
organisation, public listing or customer charge. It does not make the whole
migration complete.

## Free home and existing resource guards

In swap mode the hub home requires authenticated accepted-terms identity, not a
personal Business subscription. Its queries remain RLS-scoped; this allows new
users and independent rental members to reach existing free branch onboarding.
Entering the hub grants no mutation authority. Existing venue members already
pass requireBusinessAccess without payment; venue mutations keep their existing
membership/RPC/RLS checks. Rental actions retain branch-specific authorization.
Premium event templates/recurrence remain protected by readiness flags and
akisuite_venue_premium for the selected venue. Private property and company/location
onboarding require the separate additive schema and scoped application work.

## Private operating location onboarding

`/[locale]/business/locations` lists only the caller's active memberships through
list_managed_operating_locations(), a narrow metadata RPC; operational RLS is not bypassed.
Creation requires the role switch and server AKISUITE_PRIVATE_LOCATIONS_READY=true;
default is false until AkiPasa migration 20261016003000 and its rollback-only SQL
acceptance are verified. The action authenticates with requireUser, calls only
create_private_operating_location(p_request_id,p_name), retains the UUID/name for
unavailable or ambiguous retries, and shows conflicts without generating a new ID.
Successful creation returns to the RLS-owned list. It creates no listing, sends no
mail and grants no subscription. Operations links name the exact selected workspace.
Existing operational membership remains independently server-enforced there.

## 2026-10-15 | Explicit company grouping candidate

The free management hub adds company creation and explicit existing-location
attachment through reviewed authenticated RPCs. Creating a company does not
create public listings, assign customer subscriptions or inherit operational
permissions. Company location metadata with a null membership role has no
operations link. Standalone private location creation remains available; only
canonical workspace owners can request attachment, and SQL also checks company
owner/admin authority. Existing workspace/venue relationships are never detached
or regrouped automatically. A legacy workspace may aggregate multiple venues;
this UI does not establish a new physical-location mapping. The server
AKISUITE_ORGANISATIONS_READY gate remains false pending migration20261016030000
and live acceptance. Paginated lists have explicit bounds. Name/request identity
is retained on conflicts and unavailable retries. Source revert/closedgate rolls
back presentation without deleting legitimate companies or mappings.

Rental branch attachment additionally requires migration 20261016040000. The
caller explicitly selects an owned branch and owned canonical workspace; the
server RPC validates both roles and rejects reassignment. Its private relation
never appears on the public rental-company row. Existing branch/fleet/reservation
IDs and daily role checks remain intact. Independent property creation can also
select an existing owned workspace; its reviewed creation RPC validates ownership
and there is no implicit reassignment of legacy properties. Existing workspace
aggregates remain intact pending owner-reviewed reconciliation.
