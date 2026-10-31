"use strict";

const CACHE_NAME = "tracker-cache-v1";

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icon.png"
];

// Install: cache the application shell for offline use.
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Activate: remove outdated caches after a version change.
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch: serve cached application files offline.
self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Only intercept requests from this app's own origin.
    if (url.origin !== self.location.origin) return;

    // For page navigation, prefer the cached app shell.
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const copy = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => cache.put("./index.html", copy));

                        return response;
                    }

                    throw new Error("Network response unavailable");
                })
                .catch(async () => {
                    return await caches.match(request) ||
                        await caches.match("./index.html") ||
                        await caches.match("./");
                })
        );

        return;
    }

    // For static assets, prefer the cache and fall back to the network.
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) return cachedResponse;

                return fetch(request).then(response => {
                    if (response && response.ok) {
                        const copy = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, copy));
                    }

                    return response;
                });
            })
    );
});
