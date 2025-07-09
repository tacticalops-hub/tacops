self.skipWaiting();

const CACHE_NAME = 'tacops-v2';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './styles.css',
  './script.js',
  // Icons
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  // Map images
  './standoff-clean.png',
  './firing_range_alt.png',
  './zoo.png',
  './terminal.png',
  './tunisia.png',
  './monastery.png',
  './oasis.png',
  './rust.png',
  './hacienda.png',
  './highrise.png',
  './icebreaker.png',
  './takeoff.png',
  './vacant.png',
  './hackney_yard.png',
  './hovec_sawmill.png',
  './shipment.png',
  './scrapyard_2019.png',
  './suldal_harbor.png',
  './dome.png',
  './slums.png',
  './nuketown_russia.png',
  './meltdown.png',
  './summit.png',
  './hijacked.png',
  './crash.png',
  './crossfire.png',
  './raid.png',
  './nuketown.png',
  './killhouse.png',
  './hardhat.png',
  './saloon.png',
  './pine.png',
  './king.png',
  './docks.png',
  './shoot_house.png',
  './cage.png'
];

// Install event - cache resources and activate new SW immediately
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Activate event - clean up old caches and take control on next reload
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event - cache-first
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request)
    )
  );
});

// --- Push/notification logic unchanged ---
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle any background sync tasks
  console.log('Background sync triggered');
}

self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New CODM map update available!',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: './icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: './icons/icon-96x96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('CODM Maps', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
}); 