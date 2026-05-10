const CACHE_NAME = "askcreate-app-v1320";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=1320",
  "./script.js?v=1320",
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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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


self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = { title: "Novi kvar prijavljen", body: event.data ? event.data.text() : "Otvorite panel šefa mehanizacije." }; }
  const title = payload.title || "🚨 Novi kvar prijavljen";
  const options = {
    body: payload.body || "Otvorite AskCreate panel šefa mehanizacije.",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: payload.tag || "askcreate-mechanic-defect",
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [250, 120, 250, 120, 450],
    timestamp: Date.now(),
    actions: [
      { action: "open", title: "Otvori kvar" }
    ],
    data: {
      url: payload.url || "./?ulaz=mehanika",
      badgeCount: payload.badgeCount || 1
    }
  };
  event.waitUntil((async () => {
    try { if (self.registration.setAppBadge) await self.registration.setAppBadge(options.data.badgeCount); } catch (e) {}
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification?.data?.url || "./?ulaz=mehanika", self.location.origin).href;
  event.waitUntil((async () => {
    try { if (self.registration.clearAppBadge) await self.registration.clearAppBadge(); } catch (e) {}
    const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      if (client.url && new URL(client.url).origin === self.location.origin) {
        await client.focus();
        client.postMessage?.({ type: "open-mechanic-panel" });
        return;
      }
    }
    await clients.openWindow(targetUrl);
  })());
});
