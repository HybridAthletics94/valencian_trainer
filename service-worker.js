const CACHE = "valenciano-trainer-v10";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./app-icon.svg",
  "./data/manifest.json",
  "./data/examenes.csv",
  "./simulacros/simulacro_b2.csv",
  "./simulacros/simulacro_c1.csv",
  "./simulacros/simulacro_c2.csv",
];

self.addEventListener("install", event => {
  event.waitUntil(
    cacheAppShell()
      .catch(() => null)
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (url.pathname.endsWith(".csv") || url.pathname.endsWith(".json")) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheAppShell() {
  const cache = await caches.open(CACHE);
  const manifest = await fetch("./data/manifest.json", { cache: "no-store" })
    .then(response => response.ok ? response.json() : { files: [] })
    .catch(() => ({ files: [] }));
  const csvAssets = Array.isArray(manifest.files) ? manifest.files.map(file => `./${file}`) : [];
  const assets = unique([...CORE_ASSETS, ...csvAssets]);
  await Promise.allSettled(assets.map(asset => cache.add(asset)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) return caches.match(fallbackUrl);
    throw new Error("Offline and no cache match");
  }
}

function unique(items) {
  return [...new Set(items)];
}
