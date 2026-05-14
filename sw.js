const CACHE_NAME = "askcreate-app-v1334";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=1334",
  "./script.js?v=1334",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const file of APP_SHELL) {
      try {
        await cache.add(file);
      } catch (e) {
        console.warn("AskCreate cache skip:", file, e);
      }
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
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

    try {
      return await fetch(event.request);
    } catch (e) {
      return caches.match("./index.html");
    }
  })());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: "🚨 Novi kvar prijavljen",
      body: event.data ? event.data.text() : "Otvorite AskCreate panel šefa mehanizacije."
    };
  }

  const title = data.title || "🔔 AskCreate obaveštenje";
  const targetUrl = data.url || "./?ulaz=radnik";
  const badgeCount = Number(data.badgeCount || 1);

  const options = {
    body: data.body || "Otvorite AskCreate.app.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",

    // Ne koristimo stalno isti tag, da Android ne zameni staru notifikaciju bez nove vizuelne značke.
    tag: data.tag || ("askcreate-notification-" + Date.now()),

    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [300, 120, 300, 120, 500],
    timestamp: Date.now(),

    actions: [
      { action: "open", title: data.actionTitle || "Otvori" }
    ],

    data: {
      url: targetUrl,
      badgeCount,
      createdAt: Date.now()
    }
  };

  event.waitUntil((async () => {
    try {
      if (self.registration && self.registration.setAppBadge) {
        await self.registration.setAppBadge(badgeCount);
      }
    } catch (e) {
      console.warn("AskCreate badge failed:", e);
    }

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification && event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "./?ulaz=radnik",
    self.location.origin
  ).href;

  event.waitUntil((async () => {
    try {
      if (self.registration && self.registration.clearAppBadge) {
        await self.registration.clearAppBadge();
      }
    } catch (e) {
      console.warn("AskCreate clear badge failed:", e);
    }

    const allClients = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of allClients) {
      if (client.url && new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if (client.postMessage) {
          client.postMessage({
            type: data.type || "ASKCREATE_OPEN_NOTIFICATION",
            url: targetUrl
          });
        }
        return;
      }
    }

    await clients.openWindow(targetUrl);
  })());
});
