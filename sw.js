const CACHE_NAME = 'codm-maps-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/script.js',
  '/styles.css',
  '/manifest.json',
  // Map images
  '/standoff-clean.png',
  '/firing_range_alt.png',
  '/zoo.png',
  '/terminal.png',
  '/tunisia.png',
  '/monastery.png',
  '/oasis.png',
  '/rust.png',
  '/hacienda.png',
  '/highrise.png',
  '/icebreaker.png',
  '/takeoff.png',
  '/vacant.png',
  '/hackney_yard.png',
  '/hovec_sawmill.png',
  '/shipment.png',
  '/scrapyard_2019.png',
  '/suldal_harbor.png',
  '/dome.png',
  '/slums.png',
  '/nuketown_russia.png',
  '/meltdown.png',
  '/summit.png',
  '/hijacked.png',
  '/crash.png',
  '/crossfire.png',
  '/raid.png',
  '/nuketown.png',
  '/killhouse.png',
  '/hardhat.png',
  '/saloon.png',
  '/pine.png',
  '/king.png',
  '/docks.png',
  '/shoot_house.png',
  '/cage.png'
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
          return caches.match('/standoff-clean.png');
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
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-96x96.png'
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
      clients.openWindow('/')
    );
  }
}); 