// ============================================
// SERVICE WORKER - GTC PRO PANEL
// Versión 2.1 - Corregido y Robusto
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

// ========== INSTALACIÓN ==========
self.addEventListener('install', event => {
  console.log('📦 [SW] Instalando Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // Cachear archivos estáticos con manejo de errores individual
      caches.open(STATIC_CACHE_NAME).then(async cache => {
        console.log('✅ [SW] Cacheando archivos estáticos');
        
        const results = await Promise.allSettled(
          urlsToCache.map(async url => {
            try {
              await cache.add(url);
              console.log(`✅ Cacheado: ${url}`);
            } catch (error) {
              console.warn(`⚠️ No se pudo cachear: ${url}`, error.message);
            }
          })
        );
        
        const fallos = results.filter(r => r.status === 'rejected').length;
        if (fallos > 0) {
          console.warn(`⚠️ [SW] ${fallos} archivos no se pudieron cachear`);
        }
      }),
      
      caches.open(API_CACHE_NAME)
      
    ]).then(() => {
      console.log('✅ [SW] Instalación completada');
      self.skipWaiting();
    })
  );
});

// ========== ACTIVACIÓN ==========
self.addEventListener('activate', event => {
  console.log('🚀 [SW] Activando Service Worker...');
  
  event.waitUntil(
    Promise.all([
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

  if (urlsToCache.includes(url.pathname) || 
      request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'font' || 
      request.destination === 'image') {
    
    event.respondWith(staticCacheStrategy(request));
    return;
  }

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
    
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

// 2. Stale-While-Revalidate (CORREGIDA - sin event)
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Si tenemos respuesta en caché, la devolvemos y actualizamos en segundo plano
  if (cachedResponse) {
    // Actualizar caché en segundo plano (sin await para no bloquear)
    fetch(request).then(networkResponse => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone()).catch(err => 
          console.warn('⚠️ [SW] No se pudo actualizar caché:', err)
        );
      }
    }).catch(error => {
      console.warn('⚠️ [SW] Error en fetch para actualizar caché:', error);
    });
    
    return cachedResponse;
  }

  // Si no hay caché, intentamos con la red
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone()).catch(err => 
        console.warn('⚠️ [SW] No se pudo guardar en caché:', err)
      );
    }
    return networkResponse;
  } catch (error) {
    console.warn('❌ [SW] Error fetching (sin caché):', request.url, error);
    
    if (request.mode === 'navigate') {
      const staticCache = await caches.open(STATIC_CACHE_NAME);
      const offlinePage = await staticCache.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    
    return new Response('Recurso no disponible', { status: 503 });
  }
}

// ========== OFFLINE PAGE ==========
const offlineHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sin conexión - GTC Pro</title>
  <style>
    body { font-family: Arial; background: #0b0f1a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .offline-card { background: #1a1f2f; padding: 40px; border-radius: 20px; text-align: center; max-width: 400px; }
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
</html>`;

// Cachear página offline durante la instalación (ya incluido arriba)