# Public privacy and shared deletion instructions

2026-10-25 candidate: the product EN/ES privacy page and shared account link direct
people to the central public account-deletion instructions without requiring an
installed app. Shared account controls remain authenticated and unchanged.

Owner-approved operating policy: a human processes a verified account request
within 48 hours and sends a manually written confirmation from support@akipasa.com.
Shared identity scope, retained business records, documented legal exceptions,
90-day operational logs, support/minimal deletion evidence for 12 months after
closure, and applicable Spanish business/accounting records for 6 years from the
last entry are disclosed. No backup deadline or automated deletion is promised.

Public rollout depends on the central manual process/retention implementation and
public /{locale}/account-deletion page being ready and verified. This copy does
not establish that deployment or provider cleanup occurred. Supabase/RLS, auth
callbacks, booking and billing mutations are unchanged. Authorised workspace
and provider records have distinct retention obligations.

Regression: shared-native-account.test.tsx renders both public languages and
checks contacts, manual processing, retention periods and central links.
Full hosted checks and canonical public readback are required before acceptance.
