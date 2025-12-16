/* ===============================
   SERVICE WORKER - CHAT GLOBAL
   PWA + OFFLINE + FCM
================================ */

importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js");

/* 🔹 Firebase config (MESMO do site) */
firebase.initializeApp({
  apiKey: "AIzaSyAxb2s4tzbtD1arG9UAf7UrzhFqbRrrsl8",
  authDomain: "astro-642b6.firebaseapp.com",
  projectId: "astro-642b6",
  storageBucket: "astro-642b6.appspot.com",
  messagingSenderId: "141832763492",
  appId: "1:141832763492:web:c8f6a529849bab54ee8771"
});

const messaging = firebase.messaging();

/* ===============================
   CACHE OFFLINE
================================ */

const CACHE_NAME = "chat-global-v1";
const OFFLINE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "https://cdn-icons-png.flaticon.com/512/724/724715.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Estratégia:
   - Cache First → UI
   - Network First → Firebase / API
*/
self.addEventListener("fetch", event => {
  const { request } = event;

  if (request.method !== "GET") return;

  if (request.url.includes("firebase") || request.url.includes("pollinations")) {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});

/* ===============================
   PUSH NOTIFICATION (FCM)
================================ */

/* Recebe push COM APP FECHADO */
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || "Nova mensagem";
  const body = payload.notification?.body || "Você recebeu uma nova mensagem";

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: payload.data?.url || "/"
    }
  });
});

/* ===============================
   CLICK NA NOTIFICAÇÃO
================================ */

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientsArr => {
      const client = clientsArr.find(c => c.url.includes(url));
      if (client) {
        return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
