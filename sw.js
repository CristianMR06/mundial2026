/* ═══════════════════════════════════════════════════════════
   Service Worker · Mundial 2026 · BLUESEA Hotels
   Estrategia:
   · Estáticos (HTML, logo, fuentes, banderas) → cache-first
   · API football-data.org → network-first con fallback a caché
═══════════════════════════════════════════════════════════ */

const CACHE_V   = 'mundial2026-v1';
const API_CACHE = 'mundial2026-api-v1';

/* ── Recursos estáticos garantizados ── */
const CORE = [
  './mundial.html',
  './logoBS.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap',
];

/* ── Todas las banderas que usa la página ── */
const FLAG_CODES = [
  'mx','za','kr','cz','ca','ba','qa','ch','br','ma','ht','gb-sct',
  'us','py','au','tr','de','cw','ci','ec','nl','jp','se','tn',
  'be','eg','ir','nz','es','cv','sa','uy','fr','sn','iq','no',
  'ar','dz','at','jo','pt','cd','uz','co','gb-eng','hr','gh','pa'
];

const FLAGS_W160 = FLAG_CODES.map(c => `https://flagcdn.com/w160/${c}.png`);
const FLAGS_W40  = FLAG_CODES.map(c => `https://flagcdn.com/w40/${c}.png`);
const FLAGS_HOST = ['ca','mx','us'].map(c => `https://flagcdn.com/w80/${c}.png`);

/* ══════════════════ INSTALL ══════════════════ */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_V);

    /* Core: si falla alguno, falla la instalación */
    await cache.addAll(CORE);

    /* Banderas: se cachean de una en una para no abortar si alguna falla */
    for (const url of [...FLAGS_W160, ...FLAGS_W40, ...FLAGS_HOST]) {
      try { await cache.add(url); } catch (_) { /* continúa */ }
    }
  })());
  self.skipWaiting();
});

/* ══════════════════ ACTIVATE ══════════════════ */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_V && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ══════════════════ FETCH ══════════════════ */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* API → network-first, fallback a última respuesta cacheada */
  if (url.hostname === 'api.football-data.org') {
    e.respondWith(networkFirstApi(e.request));
    return;
  }

  /* Todo lo demás → cache-first, actualiza en background */
  e.respondWith(cacheFirst(e.request));
});

/* ── Network-first para la API ── */
async function networkFirstApi(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (_) {
    /* Sin red: devuelve caché o respuesta vacía marcada como offline */
    const cached = await caches.match(req);
    if (cached) {
      /* Clona la respuesta añadiendo cabecera para que el cliente sepa que es caché */
      const body = await cached.text();
      return new Response(body, {
        headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' }
      });
    }
    return new Response(JSON.stringify({ matches: [], _offline: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/* ── Cache-first con actualización en background ── */
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) {
    /* Revalida en background sin bloquear */
    fetch(req).then(res => {
      if (res?.ok) caches.open(CACHE_V).then(c => c.put(req, res));
    }).catch(() => {});
    return cached;
  }
  /* No está en caché: va a red y guarda */
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE_V);
      cache.put(req, res.clone());
    }
    return res;
  } catch (_) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}
