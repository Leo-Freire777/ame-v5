
const CACHE_NAME = 'ame-assets-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Instalação: Cache inicial de assets essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpeza de caches obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Stale-while-revalidate apenas para assets locais
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGRA CRÍTICA: NUNCA cachear chamadas da API do Supabase ou Auth
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Ignorar requests não-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Cache para assets estáticos e navegação básica
  if (event.request.mode === 'navigate' || 
      event.request.destination === 'style' || 
      event.request.destination === 'script' || 
      event.request.destination === 'image' ||
      url.pathname.endsWith('.webmanifest')) {
    
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
