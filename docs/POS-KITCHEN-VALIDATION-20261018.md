# Kitchen-display candidate validation and toolchain hardening

18 October 2026. Companion to `POS-KITCHEN-RELEASE.md`, PR #40 stacked on #39. This record does not activate the migration or attest fiscal compliance.

## Hosted feature evidence

At head `f79c33c91fdf62184af7aaf83e657cc27c57ac2d`, all four application workflows passed: repository verification (run 39144994805), POS smoke (39144994800), parent service review (39144994779), and kitchen review (39144994803). The kitchen workflow includes 54 focused tests, the existing rapid-tap/printer/ledger regressions, clean AkiBusiness release/cache verification, 32 Chromium viewport/language/theme combinations plus interaction scenarios, and three independent-connection PostgreSQL 17 concurrency scenarios. Parent service browser checks separately cover 32 combinations.

The first hosted browser run exposed a test timing assumption: dispatching a form submit is not completion of a command scheduled through native Web Locks. The test now waits for the persisted recall state, cleared recovery record and closed dialog, and asserts exactly one reasoned recall command. The correction did not remove the recall assertions or change production command handling.

## Dependency remediation

The original Wrangler 4.124.0 development dependency tree produced four high-severity npm audit entries, including transitive sharp and undici. The isolated candidate run 39144989166 tested the official stable Wrangler 4.149.0, pinned exactly, with its normal dependency resolution. It resolves sharp 0.35.5 and undici 7.29.1. All production dependency entries in the lockfile remain unchanged; only development-toolchain entries changed.

Candidate evidence: clean npm install; npm audit reported zero known vulnerabilities; repository tests reported 437 passes, zero failures, one pre-existing optional Spain workbook fixture skip; Worker dry-run compilation succeeded. No deployment credentials, production database or live business data were used. The temporary source-object export workflow is removed from the final tree. Permanent read-only CI now rejects known high/critical dependency findings and compiles the Worker with `--dry-run`.

Primary advisories: https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w and https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3. Vendor release: https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%404.149.0. Audit results are a point-in-time dependency check, not a full security certification.

## Final release decision

Re-run all checks on the final published PR head, including the hardening commit. The PR discussion records that exact head and resulting workflow states. New kitchen settings remain OFF by default. Required before production: reviewed staging migration, explicit service handover, independently authenticated staff devices, actual printer/tablet tests, and a rollout decision. No merge or production activation is implied by this document.
