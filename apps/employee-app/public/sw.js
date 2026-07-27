// Minimal app-shell service worker — caches the login shell for offline
// install-to-home-screen per Architecture Document §7. Not a full offline
// data strategy (Server Components/Server Actions still need network) —
// just enough that the PWA opens to something instead of a browser error
// when offline.
const CACHE_NAME = "macro-app-shell-v1";
const SHELL_URLS = ["/login", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/login")))
  );
});
