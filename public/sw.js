/* Club At Ibis Reviewer — minimal service worker.
 * Its job is to make the portal installable (browsers require a registered worker with a fetch handler).
 * It deliberately caches nothing: every request goes to the network so reviewers never see stale request
 * data. Page navigations get a friendly message when the device is offline. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Club At Ibis</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d1522;color:#f3efe3;font-family:system-ui,sans-serif;text-align:center;padding:24px}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0 0 1.25rem;color:#9fb0c3;font-size:.9rem}button{background:#a58a47;color:#0d1522;border:0;border-radius:10px;padding:.7rem 1.4rem;font-weight:600;font-size:.95rem}</style></head><body><div><h1>You're offline</h1><p>Check your connection, then try again.</p><button onclick="location.reload()">Retry</button></div></body></html>`;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(
      () => new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});
