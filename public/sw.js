// Service Worker for ajournl. PWA
const CACHE_NAME = 'ajournl-v1'
const urlsToCache = ['/', '/manifest.json', '/icon-192x192.png', '/icon-512x512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
      .catch((err) => console.log('SW install error:', err))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request))
    return
  }

  const url = new URL(event.request.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    event.respondWith(fetch(event.request))
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseToCache = response.clone()
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request)
      })
  )
})
