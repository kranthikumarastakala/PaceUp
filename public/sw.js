// PaceUp Service Worker — Phase 7
const CACHE = 'paceup-v1'
const STATIC = [
  '/',
  '/dashboard',
  '/manifest.json',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  // Network-first for API calls, cache-first for static assets
  if (e.request.url.includes('/api/') || e.request.url.includes('supabase')) {
    return // Let network handle it
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res
        const clone = res.clone()
        caches.open(CACHE).then(cache => cache.put(e.request, clone))
        return res
      }).catch(() => caches.match('/'))
    })
  )
})

// Push notification handler
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'PaceUp', {
      body: data.body ?? 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url ?? '/notifications' },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = e.notification.data?.url ?? '/notifications'
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
