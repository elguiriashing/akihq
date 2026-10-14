# Entity labels and modal keyboard preparation

Prepared and reviewed locally on 14 October 2026. The user has approved
implementation, commits, merges and live release. Actual deployed-source and
production acceptance evidence will be recorded after release.

## Problem and resulting behavior

An isolated Chromium review of the actual app reproduced twelve Deal controls
without associated labels. Opening New Deal left focus on the underlying New
record button, and the next Tab reached background Add deal.

Generated entity controls now have stable IDs, associated labels and help-text
descriptions. The entity modal has a named heading and localized Close control.
Shared ARIA modal dialogs enter focus, contain Tab and programmatic focus, and
return focus to their opening control when dismissed. Equivalent controls are
matched when the app replaces its DOM. Focused draft values and caret positions
survive both portal and root renders. Native `showModal()` dialogs retain browser
focus management. Ctrl/Cmd+K opens the global command palette after an existing
dialog is dismissed, preventing it from capturing focus behind payment overlays.
Existing close/submit/backdrop/Escape handlers remain in use.

The JavaScript entry and service-worker cache identity advance together to v37
and `akihq-v111`. No authorization, field names, validation, workspace storage,
command payload, payment/printing operation, API or schema changes are made.

## Validation

- `node tests/dialog-accessibility.test.mjs`: ten actual-app inert cases passed,
  including all fifteen generated entity types, modal/drawer dismissal, nested
  focus return, disabled/hidden controls, native-dialog exclusion and root-owned
  hospitality-style draft/caret restoration.
- `AKIHQ_PLAYWRIGHT_PATH=/workspace/akipasa/node_modules/@playwright/test
  BROWSER_PATH=/usr/bin/chromium node tests/dialog-accessibility-browser.cjs`:
  sixteen real-browser Deal interactions passed across EN/ES, light/dark,
  360x780, 600x780, 1280x800 and 640x400. Screenshots live in
  `test-results/dialog-accessibility`. Additional Chromium cases passed with the
  actual hospitality overlay CSS, root-owned draft/caret restoration, blocked
  obscured command shortcuts and a real native `showModal()` dialog.
  This optional harness accepts a locally
  installed Playwright path; no application dependency is added.
- A broader disposable browser review exercised nineteen route views in 228
  locale/theme/width combinations, finding no document overflow or page errors.
  This checks shell and fixture/empty presentation, not every live workflow.
- Existing PoS v4 and mobile-checkout smoke scripts passed. Membership cache/nav
  tests and syntax/whitespace checks passed. Existing print-agent tests passed
  four cases with loopback network enabled; restricted-network execution failed
  the actual local TCP emulator.
- The complete `npm run check --prefix cloudflare` subsequently passed: 350
  tests passed, zero failed and one existing actual-workbook fixture was skipped.
  Current-head CI and read-only production release preflight remain separate gates.

Every browser request in these fixtures is restricted to its loopback static
server, and final boot is replaced only in the test copy with disposable state.
No actual backend, authenticated customer record, provider, email, payment,
production deployment or hardware was accessed.

## Limits and rollback

The synthetic hospitality dialog verifies the shared manager and root render,
not a real payment/printer workflow. The browser matrix exercises Deal; real
native company-import workflow, staff/manager tenant
sessions, device accessibility and physical printers still need acceptance.
Fiscal issuance and actual card charging remain unavailable. Revert the source,
matching entry/cache identities and tests to roll back; no data restoration or
operation replay is needed.
