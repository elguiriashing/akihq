# PT409 revision conflict recovery — 14 October 2026

HQ-06 aligns AkiHQ with the shared production conflict contract. Fresh company
and workspace migrations now raise `PT409` for stale application revisions. An
idempotent additive migration replaces only explicit `40001` codes in the two HQ
functions for existing installations; authorization, row locks, expected
revisions, grants, security attributes and stored rows remain unchanged.

The workspace UI recognizes both `PT409` and transitional `40001` responses. It
keeps the pending mutation ahead of the committed version and shows the existing
download, reload and reapply guidance. It never automatically overwrites the
newer row.

Real app-IIFE tests cover both codes and retained version/error state. Schema
contract tests cover the fresh sources and additive migration. Apply the migration
before publishing the updated static asset, then verify a stale edit against the
deployed PostgREST version. Revert the UI/docs to roll back presentation; do not
restore `40001` on PostgREST 14 because that recreates the retry-storm condition.
