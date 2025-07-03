const CACHE_NAME = 'codm-maps-v1.0.0';
const urlsToCache = [
  '/tacops/',
  '/tacops/index.html',
  '/tacops/manifest.json',
  // Map images
  '/tacops/standoff-clean.png',
  '/tacops/firing_range_alt.png',
  '/tacops/zoo.png',
  '/tacops/terminal.png',
  '/tacops/tunisia.png',
  '/tacops/monastery.png',
  '/tacops/oasis.png',
  '/tacops/rust.png',
  '/tacops/hacienda.png',
  '/tacops/highrise.png',
  '/tacops/icebreaker.png',
  '/tacops/takeoff.png',
  '/tacops/vacant.png',
  '/tacops/hackney_yard.png',
  '/tacops/hovec_sawmill.png',
  '/tacops/shipment.png',
  '/tacops/scrapyard_2019.png',
  '/tacops/suldal_harbor.png',
  '/tacops/dome.png',
  '/tacops/slums.png',
  '/tacops/nuketown_russia.png',
  '/tacops/meltdown.png',
  '/tacops/summit.png',
  '/tacops/hijacked.png',
  '/tacops/crash.png',
  '/tacops/crossfire.png',
  '/tacops/raid.png',
  '/tacops/nuketown.png',
  '/tacops/killhouse.png',
  '/tacops/hardhat.png',
  '/tacops/saloon.png',
  '/tacops/pine.png',
  '/tacops/king.png',
  '/tacops/docks.png',
  '/tacops/shoot_house.png',
  '/tacops/cage.png'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.log('Cache failed:', error);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // If both cache and network fail, return a fallback
        if (event.request.destination === 'image') {
          return caches.match('/tacops/standoff-clean.png');
        }
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle any background sync tasks
  console.log('Background sync triggered');
}

// Handle push notifications (for future features)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New CODM map update available!',
    icon: '/tacops/icons/icon-192x192.png',
    badge: '/tacops/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/tacops/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/tacops/icons/icon-96x96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('CODM Maps', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/tacops/')
    );
  }
}); 