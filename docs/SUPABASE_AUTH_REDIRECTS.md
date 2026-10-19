# Supabase authentication redirect migration — AkiSuite

Status: **Hosted allowlist settings remain unverified.** Repository changes do **not** modify hosted Auth configuration.

The owner confirmed that project `vhpbvcfkcteswlsdjrfl` is the production Supabase project; its dashboard display name is not authoritative.
Project: `vhpbvcfkcteswlsdjrfl`
Dashboard: https://supabase.com/dashboard/project/vhpbvcfkcteswlsdjrfl/auth/url-configuration

## Preserve the current Site URL

Leave the existing Supabase **Site URL** as it is until the centralized authentication design has been verified. Do **not** replace it with an individual product domain; it is the fallback destination for emails that omit a redirect URL.

## Callback routes and allowlist

The three extracted Next.js apps implement locale-specific callbacks at these exact paths:

```text
https://akibusiness.com/en/auth/callback
https://akibusiness.com/es/auth/callback
https://akiduermo.com/en/auth/callback
https://akiduermo.com/es/auth/callback
https://akicoches.com/en/auth/callback
https://akicoches.com/es/auth/callback
```

Implementation in source does not prove that these URLs are present in the hosted **Additional Redirect URLs** list or that provider login succeeds on the real domains. Read the current Site URL and allowlist before changing either; preserve every existing entry and append only required exact URLs. Do not enable broad production wildcards.

AkiHQ is a separate application. Inspect its actual OAuth, magic-link and recovery destinations before adding any AkiHQ URLs; do not guess a callback path.

## Domain role-swap boundary

The current live role mapping is still different from the target: `akibusiness.com` serves listing management and `akihq.app` serves operations. Keep this auth contract accurate until the coordinated role swap is verified. Both domains must remain active for their final roles; do not redirect either whole domain to the other. Validate auth callbacks and return destinations on the application that will serve each domain before changing routing.

Keep existing AkiPasa and legacy-domain callback URLs. Add preview callback hosts only when fixed and trusted; avoid blanket wildcards on production hosts.

## Verification checklist

- [ ] Read the hosted Site URL and existing Additional Redirect URLs. Preserve every currently needed URL.
- [ ] Append only the exact production callback entries required by the deployed applications, then read back and verify settings.
- [ ] Inspect AkiHQ auth flows and determine exact callback/recovery URLs before allowlisting them.
- [ ] Verify each app's trusted-origin validation and safe local auth destinations.
- [ ] Verify signup confirmation, magic link, OAuth PKCE, password recovery, sign-out and account continuity on real domains and both locales.
- [ ] Update an external OAuth provider's authorized redirect URI only if the Supabase provider callback itself changes (normally it remains `https://vhpbvcfkcteswlsdjrfl.supabase.co/auth/v1/callback`).
- [ ] Do not enable old-domain redirects that can swallow auth codes before the new callbacks work.
- [ ] Never change hosted GoTrue configuration through direct Postgres SQL.

Reference: https://supabase.com/docs/guides/auth/redirect-urls
