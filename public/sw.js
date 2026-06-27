// YardSync push service worker — push-only (no caching, so the app still always
// loads the latest deploy). Shows web-push notifications and opens the relevant
// in-app URL on tap.

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}
  const title = data.title || 'YardSync'
  const options = {
    body:  data.body || '',
    icon:  '/icon-192.png',
    // Status-bar badge is rendered as a white silhouette from the alpha channel,
    // so it must be transparent (an opaque tile shows as a white square). The
    // white YS monogram on transparent is exactly that.
    badge: '/logo-mark-white.png',
    data:  { url: data.url || '/dashboard' },
    tag:   data.tag || undefined,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
