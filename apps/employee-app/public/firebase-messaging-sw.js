/* Firebase Cloud Messaging service worker — shows "new message" push
 * notifications when the app is in the background or closed. Registered at its
 * own scope (/firebase-cloud-messaging-push-scope) so it doesn't collide with
 * the app-shell worker (sw.js). The Firebase config is passed in as query
 * params by registerForPush() since a service worker can't read process.env. */
importScripts("https://www.gstatic.com/firebasejs/11.3.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.3.0/firebase-messaging-compat.js");

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

// notify-chat sends data-only messages, so we build the notification here.
// (Data-only avoids the duplicate a `notification` payload causes on web.)
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "New message", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.conversationId || undefined, // collapse repeats from one thread
    data: { url: d.url || "/communication" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/communication";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
