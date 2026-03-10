// ============================================
// SERVICE WORKER - GTC PRO PANEL
// Versión 2.0 - Robusto y Profesional
// ============================================

const CACHE_NAME = 'gtc-panel-v2';
const API_CACHE_NAME = 'gtc-api-v1';
const STATIC_CACHE_NAME = 'gtc-static-v1';

// Archivos estáticos para cachear (siempre disponibles offline)
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Recursos que se actualizan frecuentemente (estrategia network-first)
const dynamicResources = [
  '/api/', // Si tuvieras API
  '/data/' // Si tuvieras datos dinámicos
];

// ========== INSTALACIÓN ==========
self.addEventListener('install', event => {
  console.log('📦 [SW] Instalando Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Cachear archivos estáticos
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('✅ [SW] Cacheando archivos estáticos');
        return cache.addAll(urlsToCache).catch(error => {
          console.error('❌ [SW] Error cacheando archivos:', error);
          // No fallar la instalación si algún archivo no se puede cachear
        });
      }),
      // Inicializar cache para API
      caches.open(API_CACHE_NAME)
    ]).then(() => {
      console.log('✅ [SW] Instalación completada');
      self.skipWaiting(); // Activar inmediatamente
    })
  );
});

// ========== ACTIVACIÓN ==========
self.addEventListener('activate', event => {
  console.log('🚀 [SW] Activando Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Limpiar caches viejos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (![STATIC_CACHE_NAME, API_CACHE_NAME, CACHE_NAME].includes(cacheName)) {
              console.log('🗑️ [SW] Eliminando cache viejo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Reclamar clientes para controlar todas las pestañas
      self.clients.claim()
    ]).then(() => {
      console.log('✅ [SW] Activación completada');
    })
  );
});

// ========== ESTRATEGIA DE FETCH ==========
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Estrategia para archivos estáticos (cache-first)
  if (urlsToCache.includes(url.pathname) || 
      request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'font' || 
      request.destination === 'image') {
    
    event.respondWith(staticCacheStrategy(request));
    return;
  }

  // Estrategia para API/datos (network-first con fallback a cache)
  if (url.pathname.includes('/api/') || url.pathname.includes('/data/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Estrategia por defecto (stale-while-revalidate)
  event.respondWith(staleWhileRevalidateStrategy(request));
});

// ========== ESTRATEGIAS DE CACHE ==========

// 1. Cache First - Para archivos estáticos
async function staticCacheStrategy(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('❌ [SW] Error fetching:', request.url, error);
    
    // Si es una página HTML y no hay internet, mostrar offline.html
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// 2. Network First - Para datos dinámicos
async function networkFirstStrategy(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('⚠️ [SW] Network failed, usando cache para:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si no hay cache ni internet, devolver error personalizado
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Sin conexión a internet' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// 3. Stale-While-Revalidate - Para recursos generales
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const networkPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(error => {
    console.warn('⚠️ [SW] Network error:', error);
    return null;
  });

  if (cachedResponse) {
    // Devolver cache primero y actualizar en segundo plano
    event.waitUntil(networkPromise);
    return cachedResponse;
  }

  // Si no hay cache, esperar la red
  return networkPromise || new Response('Recurso no encontrado', { status: 404 });
}

// ========== MANEJO DE BACKGROUND SYNC (opcional) ==========
self.addEventListener('sync', event => {
  if (event.tag === 'sync-clientes') {
    event.waitUntil(syncClientes());
  }
});

async function syncClientes() {
  try {
    const cache = await caches.open('sync-queue');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
        }
      } catch (error) {
        console.error('Error sincronizando:', error);
      }
    }
  } catch (error) {
    console.error('Error en sync:', error);
  }
}

// ========== NOTIFICACIONES PUSH (opcional) ==========
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('GTC Pro', options)
  );
});

// ========== MENSAJES DESDE LA APP ==========
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

// ========== OFFLINE PAGE ==========
// Crear página offline por defecto si no existe
const offlineHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sin conexión - GTC Pro</title>
  <style>
    body { font-family: Arial; background: #0b0f1a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .offline-card { background: #1a1f2f; padding: 40px; border-radius: 20px; text-align: center; }
    h1 { color: #00c2ff; }
    button { background: #00c2ff; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="offline-card">
    <h1>📡 Sin conexión</h1>
    <p>No tenés internet en este momento.</p>
    <p>Algunas funciones pueden no estar disponibles.</p>
    <button onclick="window.location.reload()">Reintentar</button>
  </div>
</body>
</html>
`;

// Cachear página offline durante la instalación
self.addEventListener('install', event => {
  const offlineResponse = new Response(offlineHTML, {
    headers: { 'Content-Type': 'text/html' }
  });
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      return cache.put('/offline.html', offlineResponse);
    })
  );
});