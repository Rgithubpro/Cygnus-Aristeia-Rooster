import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

clientsClaim()
// a new version waits until the page asks for it (see src/update.js)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// Pictures (logos, banners, announcements, class page) are stored on first view and stay available offline.
registerRoute(
  ({ url }) => url.pathname.startsWith('/storage/v1/object/public/afbeeldingen/'),
  new CacheFirst({
    cacheName: 'aristeia-afbeeldingen',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// ---- push notifications ----
self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Aristeia', {
      body: d.body || '',
      icon: d.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      image: d.image || undefined,
      vibrate: [200, 100, 200],
      tag: d.tag || undefined,
      data: { url: d.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const vensters = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const v of vensters) if ('focus' in v) return v.focus()
      return self.clients.openWindow(url)
    })(),
  )
})
