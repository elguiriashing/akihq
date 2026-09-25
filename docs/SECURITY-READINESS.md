# AkiHQ security implementation and deployment contract

Assessment date: 23 September 2026. Scope: AkiHQ browser authorization, shared Supabase workspace records, staff profiles, snapshots, access templates, exports, and application audit evidence. This is engineering evidence, not a legal certification or a complete penetration test.

## Confirmed defects and implemented corrections

| Confirmed live metadata defect | Correction in `20260923001337_security_workspace_access.sql` |
|---|---|
| Any authenticated account could read the `ws_akipasa` legacy snapshot through an unconditional workspace-ID branch. | Remove all browser grants and policies on raw snapshots; use authenticated tenant-filtered RPCs. |
| An additional permissive self-update policy allowed changing profile authority, including `app_role`; no protective trigger was present. | Remove that policy, grant updates only to explicit personal-profile columns, and reject browser changes to role, billing flags, identity or creation time. Existing checked role/billing RPCs remain available. |
| Commerce entitlement checks did not apply individual role templates. | Harden the shared `crm_has_tool` helper with current workspace status, active entitlement dates, active tool catalog and actual template membership. Unknown/disabled tools fail closed. |
| Durable-record RLS permitted all workspace members to read all record types. | Map record types to modules, enforce module permission on every operation, verify write attribution, require management authority for deletion. |
| Shared workspace membership exposed entire peer profile rows. | Remove the peer-profile policy and provide a directory containing display names, membership role/status and account timestamps only. Personal email/phone/birth-year are omitted. |
| Legacy member administration RPC allowed managers to add administrators, and member re-add could replace an owner. | Preserve internal implementation in an unexposed schema with execution revoked; checked public wrappers require owner/admin and reject owner replacement. Existing venue/provisioning triggers are unaffected. |
| Generic integration settings could contain old credentials. | Recursively redact secret/token/password/API-key/credential/authorization/private-key fields on snapshot reads and settings writes. No credential values are copied into audit. |
| Frontend audit arrays were user-editable. | New database-authored append-only audit stores actor, operation, target and SHA-256 before/after hashes, without copying record contents. Client audit arrays are explicitly not the authoritative security log. |
| POS cashiers needed catalog access but raw inventory rows include supplier costs. | Add a POS catalogue RPC with sale prices and available quantities; raw inventory remains inventory-permission gated. |

The migration preserves existing business records. Stored historical credentials are redacted at access boundaries, not indiscriminately deleted from backups; any actual credentials previously stored or broadcast must be identified and rotated through the relevant provider. Redaction does not prove that free-form text contains no secrets.

## Frontend integration contract

| RPC | Parameters | Result / requirement |
|---|---|---|
| `crm_workspace_access` | `p_workspace` | `tool_keys`, `can_administer`, `can_operate`, `can_export`, `export_tool_keys`. These replace entitlement-only UI authorization. |
| `crm_read_workspace_snapshot` | `p_workspace` | `{data, updated_at, updated_by, access}`. Apply the current `access` decision on every pull, including unchanged timestamps, before merging data. Restricted collections are empty; workspace metadata contains no role/entitlement overrides. |
| `crm_write_workspace_snapshot` | `p_workspace`, `p_data`, `p_expected_updated_at` | Same shape. Existing snapshots require the last-read timestamp. Stale writes raise SQLSTATE `40001`. Only permitted module collections are merged. Unauthorized submitted collections never overwrite stored values. |
| `crm_workspace_directory` | `p_workspace` | Array with membership columns and `profiles: {id, display_name, created_at, updated_at}`. No full profile join is needed. |
| `crm_pos_catalogue` | `p_workspace` | Array of active items: ID, workspace, SKU, name, unit, quantity available in the default MAIN location, category, sale price, active flag and updated time. No cost fields. Aggregate quantity is used only before any location balance exists for the item. |
| `crm_record_export_event` | `p_workspace`, `p_tool`, `p_rows`, optional `p_from`, `p_to` | Server audit ID; owner/admin or permitted manager required. Employee exports require owner/admin. Event means export requested, not proof of download completion. |

Snapshot mapping: tasks/projects → tasks; contacts/companies/deals/leads/pipelines → CRM; products/warehouses → inventory; invoices → sales; campaigns → marketing; pages/forms → sites; automations → automation; conversations → inbox; feed → collaboration; events → calendar; knowledge → knowledge; employees → employees. Mixed activities/audit and integration/settings objects require administration permission.

The frontend must use RPCs for automatic sync and manual cloud backup/restore, clear denied cached collections when permissions change, and retain roles only from server authorization. Full state must never be sent over public Realtime broadcasts; broadcasts may only invalidate a local cache and trigger an authorized RPC refresh. Do not overwrite a stale snapshot automatically. POS-only staff must skip inventory recommendation and movement endpoints and use the safe catalogue RPC.

An export button restriction cannot prevent an authorized reader from copying data they can already read. Sensitive information must first be restricted at its read boundary. Fiscal archive access may intentionally survive an expired commercial subscription; its separate fiscal authorization must still enforce tenant membership and the appropriate accounting role.

## Validation

`node --test tests/security-workspace.test.mjs tests/security-cumulative.test.mjs` passes 23 tests using real PostgreSQL semantics in PGlite with representative pre-migration roles, tables, grants, policies and RPCs. The cumulative tests apply all five release migrations in chronological order, exercise checkout plus the inventory stock hook under cashier permissions, and verify fiscal issuance remains gated. The authorization cases check:

- outsider/anonymous denial; self-role and subscription escalation denial; allowed profile edits;
- individual template enforcement and active/expired entitlement behavior;
- HR/CRM filtering, workspace-authority protection and cross-tenant denial;
- concurrent/stale snapshot rejection and preservation of restricted modules;
- durable record RLS, actor attribution and read-only viewer denial;
- directory minimization; member escalation and owner replacement denial;
- append-only audit visibility, permission-only role changes, payload minimization and export role checks;
- recursive integration secret redaction and cost-free cashier catalogue.

The test dependency can be supplied through `PGLITE_MODULE`. Tests create only isolated local fixtures. Production inspection queried metadata and aggregate counts/sizes, not personal records. These tests do not replace authenticated browser testing or a staging exercise with the complete deployed schema.

## Rollout, retention and outstanding operational work

Deploy RPC-aware UI and database migration together. Previous frontend builds that directly query snapshots will lose sync after this migration; serving them is not a safe rollback. Roll forward or restore a compatible build. Do not restore broad grants/policies to recover UI functionality. The migration moves three legacy membership RPC implementations into `akihq_security`, so restoring old schema definitions needs careful dependency review.

No automatic retention deletion is introduced. Different records need different schedules, and legal holds must override eligible deletion. Fiscal records, staff attendance, HR files, communications, security logs and backups must be covered separately. Task timers are not a Spanish statutory timekeeping system. The audit table contains identifying actor/target IDs and still needs a documented retention policy and a restricted maintenance procedure.

Remaining operational obligations include authenticated role testing with representative accounts, access review, incident assessment for earlier broad access, credential rotation if actual secrets were stored, MFA enrollment and recovery for privileged accounts, backup restoration evidence, processor contracts/subprocessor transparency, documented incident response and data-subject request fulfillment. Do not claim the entire suite is compliant based on this migration.

Sources consulted: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [column-level privileges](https://supabase.com/docs/guides/database/postgres/column-level-security), [Supabase changelog](https://supabase.com/changelog). The changelog's current restrictions on modifying the Realtime schema were respected; this migration does not modify that schema.
