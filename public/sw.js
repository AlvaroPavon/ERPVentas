const CACHE_NAME = 'notas-venta-v2';

const STATIC_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/router.js',
  '/js/i18n.js',
  '/js/app.js',
  '/js/pages/login.js',
  '/js/pages/register.js',
  '/js/pages/home.js',
  '/js/pages/sales.js',
  '/js/pages/sessions.js',
  '/js/pages/companies.js',
  '/js/pages/company-detail.js',
  '/js/pages/profile.js',
  '/js/pages/activity.js',
  '/js/pages/join-requests.js',
  '/js/pages/inventory.js',
  '/js/pages/commissions.js',
  '/js/pages/chat.js',
  '/js/chat.js',
  '/locales/es.json',
  '/locales/en.json',
  '/locales/ca.json',
  '/locales/eu.json',
  '/locales/gl.json',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Notas de Venta', body: '', icon: '/icons/icon-192.svg' };
  try { data = event.data.json(); } catch {}

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.svg',
    badge: data.badge || '/icons/icon-192.svg',
    data: data.data || {},
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Sin conexión' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // CDN requests - network first
  if (url.hostname.includes('cdn') || url.hostname.includes('cdnjs') || url.hostname.includes('jsdelivr')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Static files - cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response.clone());
          return response;
        });
      });
    })
  );
});
