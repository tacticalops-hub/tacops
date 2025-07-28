self.skipWaiting();

const CACHE_NAME = 'tacops-v2';
const urlsToCache = [
  './index.html',
  './resources/manifest.json',
  './resources/css/main.css',
  './resources/js/main.js',
  './resources/js/ui.js',
  './resources/js/sw-register.js',
  './resources/js/sw.js',
  // Icons
  './resources/icons/icon-72x72.png',
  './resources/icons/icon-96x96.png',
  './resources/icons/icon-128x128.png',
  './resources/icons/icon-144x144.png',
  './resources/icons/icon-152x152.png',
  './resources/icons/icon-192x192.png',
  './resources/icons/icon-384x384.png',
  './resources/icons/icon-512x512.png',
  // Map images
  './resources/images/standoff-clean.png',
  './resources/images/firing_range_alt.png',
  './resources/images/zoo.png',
  './resources/images/terminal.png',
  './resources/images/tunisia.png',
  './resources/images/monastery.png',
  './resources/images/oasis.png',
  './resources/images/rust.png',
  './resources/images/hacienda.png',
  './resources/images/highrise.png',
  './resources/images/icebreaker.png',
  './resources/images/takeoff.png',
  './resources/images/vacant.png',
  './resources/images/hackney_yard.png',
  './resources/images/hovec_sawmill.png',
  './resources/images/shipment.png',
  './resources/images/scrapyard_2019.png',
  './resources/images/suldal_harbor.png',
  './resources/images/dome.png',
  './resources/images/slums.png',
  './resources/images/nuketown_russia.png',
  './resources/images/meltdown.png',
  './resources/images/summit.png',
  './resources/images/hijacked.png',
  './resources/images/crash.png',
  './resources/images/crossfire.png',
  './resources/images/raid.png',
  './resources/images/nuketown.png',
  './resources/images/killhouse.png',
  './resources/images/hardhat.png',
  './resources/images/saloon.png',
  './resources/images/pine.png',
  './resources/images/king.png',
  './resources/images/docks.png',
  './resources/images/shoot_house.png',
  './resources/images/cage.png'
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
    icon: './resources/icons/icon-192x192.png',
    badge: './resources/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: './resources/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: './resources/icons/icon-96x96.png'
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