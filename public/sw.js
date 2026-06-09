const CACHE_VERSION = "groove-metronome-v2-ios-audio-stage";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/brand/nsm-white.png",
  "/metronome-sounds/reapertips/marimba-accent.wav",
  "/metronome-sounds/reapertips/marimba-normal.wav",
  "/metronome-sounds/reapertips/marimba-sub.wav",
  "/metronome-sounds/reapertips/clave-accent.wav",
  "/metronome-sounds/reapertips/clave-normal.wav",
  "/metronome-sounds/reapertips/clave-sub.wav",
  "/metronome-sounds/reapertips/tight-accent.wav",
  "/metronome-sounds/reapertips/tight-normal.wav",
  "/metronome-sounds/reapertips/tight-sub.wav",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
