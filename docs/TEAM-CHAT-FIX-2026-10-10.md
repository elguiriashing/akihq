# Team Chat workspace fix — 2026-10-10

Opening Team Chat threw `ReferenceError: selectedWorkspace is not defined` while rendering channel controls. `canManageTeamChat()` now reads the active workspace role from `state.workspace`, as supplied by workspace access loading. The existing owner/admin/manager permission set is preserved; the global profile role does not grant management in a different workspace.

The entrypoint uses `app-v32.js?v=34`. Service-worker cache `akihq-v100` precaches that script and the current stylesheet version to replace the previous assets.

## Validation

- The real app IIFE and route renderer execute in jsdom with only the final boot replaced in the test copy. Before the fix, eight of the nine new tests failed with the reported ReferenceError; the disabled-tool test passed.
- After the fix, all nine pass: six workspace-role cases, empty platform chat, workspace switching with stale-message removal, and disabled-tool access. Own-message deletion remains available; deleting another person's message and managing channels still require the workspace management role.
- `npm --prefix cloudflare run check`: syntax checks and 324 passing tests, one existing skip, zero failures.
- No database migrations or Worker changes are required for this frontend reference fix.

Authenticated production chat has not been exercised. Direct public-site HTTP checks from this environment returned 403, so these tests do not establish deployment completion or live account acceptance.
