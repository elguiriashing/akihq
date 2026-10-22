# AkiSuite QR Hub

Canonical public URL: **https://qr.akihq.app/**

A tiny, independent Cloudflare Worker for printed AkiSuite business cards. It has no dependencies, cookies, analytics, sign-in, database, external fonts, or application secrets.

## Journey

- **I run a business** → [AkiHQ](https://akihq.app/) or [AkiBusiness](https://akibusiness.com/)
- **I'm here to explore** → [AkiPasa](https://akipasa.com/), [AkiDuermo](https://akiduermo.com/), or [AkiCoches](https://akicoches.com/)

Built for mobile-first QR scans, keyboard/focus navigation, browser back/forward and reduced-motion preferences. Uses a lightweight inline design with no remote assets and secure response headers.

## Test

```bash
node --check qr-hub/worker.mjs
node --test qr-hub/worker.test.mjs
```

## Release

This Worker intentionally remains separate from the AkiHQ Next.js Worker, `akihq-management-preview`.

```bash
npx wrangler deploy --config qr-hub/wrangler.jsonc
```

Worker name: `akihq-qr-hub`. Custom hostname `qr.akihq.app` is attached separately as a Cloudflare Workers custom domain in zone `akihq.app`. **Never attach the AkiHQ apex domain to this Worker.** Validate the Worker deployment first, then attach the hostname. Keep the printed QR pointed at `https://qr.akihq.app/`, which can remain unchanged as offerings evolve.
