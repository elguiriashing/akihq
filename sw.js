const CACHE = "akihq-v47";
const ASSETS = [
  "./",
  "./index.html",
  "./assets/styles.css?v=45",
  "./assets/app-v31.js?v=47",
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
