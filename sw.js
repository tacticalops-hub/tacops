const BASE = '/CODM%20site';
const CACHE_NAME = 'codm-maps-v1.0.3';
const urlsToCache = [
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/styles.css',
  BASE + '/script.js',
  // Icons
  BASE + '/icons/icon-72x72.png',
  BASE + '/icons/icon-96x96.png',
  BASE + '/icons/icon-128x128.png',
  BASE + '/icons/icon-144x144.png',
  BASE + '/icons/icon-152x152.png',
  BASE + '/icons/icon-192x192.png',
  BASE + '/icons/icon-384x384.png',
  BASE + '/icons/icon-512x512.png',
  // Map images
  BASE + '/standoff-clean.png',
  BASE + '/firing_range_alt.png',
  BASE + '/zoo.png',
  BASE + '/terminal.png',
  BASE + '/tunisia.png',
  BASE + '/monastery.png',
  BASE + '/oasis.png',
  BASE + '/rust.png',
  BASE + '/hacienda.png',
  BASE + '/highrise.png',
  BASE + '/icebreaker.png',
  BASE + '/takeoff.png',
  BASE + '/vacant.png',
  BASE + '/hackney_yard.png',
  BASE + '/hovec_sawmill.png',
  BASE + '/shipment.png',
  BASE + '/scrapyard_2019.png',
  BASE + '/suldal_harbor.png',
  BASE + '/dome.png',
  BASE + '/slums.png',
  BASE + '/nuketown_russia.png',
  BASE + '/meltdown.png',
  BASE + '/summit.png',
  BASE + '/hijacked.png',
  BASE + '/crash.png',
  BASE + '/crossfire.png',
  BASE + '/raid.png',
  BASE + '/nuketown.png',
  BASE + '/killhouse.png',
  BASE + '/hardhat.png',
  BASE + '/saloon.png',
  BASE + '/pine.png',
  BASE + '/king.png',
  BASE + '/docks.png',
  BASE + '/shoot_house.png',
  BASE + '/cage.png'
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

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/tacops/')
    );
  }
}); 