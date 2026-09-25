const CACHE = "akihq-v92";
const ASSETS = [
  "./assets/hospitality-pos.js?v=1",
  "./assets/hospitality-pos.css?v=1",
  "./",
  "./index.html",
  "./assets/styles.css?v=57",
  "./assets/app-v32.js?v=26",
  "./assets/commerce-export.js?v=2",
  "./assets/checkout-session.js?v=1",
  "./assets/fiscal-core.js?v=1",
  "./assets/inventory-ops.js?v=1",
  "./assets/suite-controls.js?v=1",
  "./assets/company-manager.js?v=11",
  "./assets/company-manager.css?v=2",
  "./assets/company-import-worker.js?v=1",
  "./assets/company-import-core.js?v=1",
  "./assets/vendor/xlsx-0.20.3.min.js",
  "./assets/support-desk.js?v=2",
  "./assets/support-desk.css?v=1",
  "./config.js?v=40",
  "./assets/supabase.js?v=40",
  "./assets/logo.svg",
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
