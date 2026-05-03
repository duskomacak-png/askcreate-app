const CACHE_NAME = "startwork-pro-v1116";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=1116",
  "./script.js?v=1116",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const file of APP_SHELL) {
      try { await cache.add(file); } catch (e) { console.warn("Cache skip:", file); }
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (e) { return caches.match("./index.html"); }
  })());
});
