const CACHE = "akihq-v108";
const ASSETS = [
  "./assets/floor-editor.js?v=2",
  "./assets/hospitality-pos.js?v=13",
  "./assets/pos-ledger.js?v=1",
  "./assets/pos-ledger.css?v=1",
  "./assets/pos-responsive.css?v=3",
  "./assets/pos-printer-station.js?v=2",
  "./assets/pos-printer-station.css?v=2",
  "./assets/hospitality-pos.css?v=9",
  "./assets/pos-v4.js?v=1",
  "./assets/pos-v4-dialogs.js?v=1",
  "./assets/pos-v4.css?v=2",
  "./",
  "./index.html",
  "./assets/styles.css?v=60",
  "./assets/app-v32.js?v=34",
  "./assets/commerce-export.js?v=3",
  "./assets/checkout-session.js?v=2",
  "./assets/fiscal-core.js?v=2",
  "./assets/inventory-ops.js?v=2",
  "./assets/suite-controls.js?v=2",
  "./assets/company-manager.js?v=11",
  "./assets/company-manager.css?v=2",
  "./assets/company-import-worker.js?v=1",
  "./assets/company-import-core.js?v=1",
  "./assets/vendor/xlsx-0.20.3.min.js",
  "./assets/support-desk.js?v=2",
  "./assets/support-desk.css?v=1",
  "./config.js?v=41",
  "./assets/supabase.js?v=40",
  "./assets/logo.svg",
  "./assets/icons/favicon.ico",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-16.png",
  "./assets/icons/icon-32.png",
  "./assets/icons/icon-48.png",
  "./assets/icons/icon-64.png",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-192.png",
  "./assets/icons/maskable-512.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isDocument = event.request.mode === "navigate" || url.pathname.endsWith("/index.html");
  const needsFreshCopy = isDocument || event.request.destination === "script" || event.request.destination === "style" || url.pathname.endsWith("/config.js") || url.pathname.endsWith("/assets/supabase.js");
  if (needsFreshCopy) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(async () => (await caches.match(event.request)) || (isDocument ? caches.match("./index.html") : Response.error()))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => Response.error()))
  );
});
