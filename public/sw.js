// YardSync push service worker — push-only (no caching, so the app still always
// loads the latest deploy). Shows web-push notifications, renders lock-screen
// action buttons, and opens the relevant target on tap.

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
    // Carry per-action data so notificationclick can route Navigate/Complete.
    data:  { url: data.url || '/dashboard', navigateUrl: data.navigateUrl, scheduleId: data.scheduleId },
    tag:   data.tag || undefined,
    // Lock-screen buttons (crew field flow): Navigate → maps, Mark complete → app.
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : undefined,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const d = event.notification.data || {}

  // Resolve the tap target from the action:
  //  - Navigate → the external maps deep-link (opens the maps app)
  //  - Mark complete → the app with a ?complete intent (the authenticated app
  //    performs the write; the SW can't hold the user's auth)
  //  - body/default → the notification's url
  let target = d.url || '/dashboard'
  if (event.action === 'navigate' && d.navigateUrl) target = d.navigateUrl
  else if (event.action === 'complete' && d.scheduleId) target = '/calendar?complete=' + encodeURIComponent(d.scheduleId)

  const isExternal = /^https?:\/\//.test(target) && target.indexOf(self.location.origin) !== 0

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // External (maps) → always a new window. In-app → focus an existing window
      // (and navigate it to the intent) if one is open, else open a new one.
      if (!isExternal) {
        const base = target.split('?')[0]
        for (const client of list) {
          if (client.url.indexOf(base) !== -1 && 'focus' in client) {
            return client.focus().then((c) => (c && c.navigate ? c.navigate(target) : c))
          }
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
