/* Tracker — Midnight Focus service worker */
"use strict";

const CACHE_VERSION = "v2";
const CACHE_NAME = `midnight-focus-shell-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

/*
 * Install only after every required shell file has been cached.
 * If installation fails, the previous active worker remains available.
 */
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

/*
 * Activate the new worker and remove obsolete Tracker caches.
 */
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            name =>
              name.startsWith("midnight-focus-shell-") &&
              name !== CACHE_NAME
          )
          .map(name => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

/*
 * Only handle GET requests from this application's own origin.
 */
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Navigation:
   * Try the network first so deployed HTML updates can be received.
   * Fall back to the cached application shell when offline.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("/index.html", response.clone());
          }

          return response;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);

          return (
            (await cache.match(request)) ||
            (await cache.match("/index.html")) ||
            new Response(
              "Tracker is offline, but its application shell has not been cached yet.",
              {
                status: 503,
                headers: {
                  "Content-Type": "text/plain; charset=utf-8"
                }
              }
            )
          );
        }
      })()
    );

    return;
  }

  /*
   * Cache-first for the known application-shell resources.
   * Do not cache arbitrary same-origin resources.
   */
  if (!APP_SHELL.includes(url.pathname)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(url.pathname);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (response.ok) {
          await cache.put(url.pathname, response.clone());
        }

        return response;
      } catch (error) {
        return new Response(
          "This Tracker resource is unavailable offline.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })()
  );
});
