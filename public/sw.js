const ROOT = new URL('./', self.location.href).pathname
const CACHE_PREFIX = `burger-feast-${ROOT}-`
const CACHE = `${CACHE_PREFIX}v3`
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'burger-mark.svg', 'app-icon.svg', 'app-icon-512.png', 'apple-touch-icon.png']
  .map((path) => `${ROOT}${path}`)

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    const response = await fetch(`${ROOT}index.html`, { cache: 'reload' })
    const html = await response.text()
    const assets = Array.from(html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g), (match) => new URL(match[1], self.location.href).href)
    await cache.addAll([...SHELL, ...assets])
  })())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(ROOT)) return
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)))
        }
        return response
      })
      .catch(() => caches.match(event.request).then(async (cached) => cached || (event.request.mode === 'navigate' ? await caches.match(`${ROOT}index.html`) : null) || Response.error())),
  )
})
