/* Totemtou — media cache service worker.
   Caches the hero video and key imagery so repeat visits load instantly.
   Cache-first for the listed media; everything else passes through to network. */
const CACHE = 'tt-media-v1';
const MEDIA = [
  'https://storage.zopuai.com/video-conversions/converted-1782424788803-YSIG.webm',
  'https://storage.zopuai.com/uploads/Xf4rwFTwTbQjKEP76YcWhKKkSP33-CLH4.jpeg',
  'https://storage.zopuai.com/uploads/Xf4rwFTwTbQjKEP76YcWhKKkSP33-0D0E.jpeg',
  'https://storage.zopuai.com/converted/user-OJXX.webp',
  'https://storage.zopuai.com/converted/user-B3IS.webp',
  'https://storage.zopuai.com/converted/user-DI7N.webp',
  'https://storage.zopuai.com/converted/user-NLIU.webp',
  'https://storage.zopuai.com/converted/user-69E9.webp',
  'https://storage.zopuai.com/converted/user-680J.webp',
  'https://storage.zopuai.com/converted/user-5YE1.webp'
];
const MEDIA_SET = new Set(MEDIA);

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // no-cors so cross-origin CDN responses can be stored (opaque)
      Promise.allSettled(MEDIA.map(url => cache.add(new Request(url, { mode: 'no-cors' }))))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (event.request.method !== 'GET' || !MEDIA_SET.has(url)) return;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(url, { ignoreVary: true });
      if (hit) return hit;
      try {
        const res = await fetch(event.request);
        try { cache.put(url, res.clone()); } catch (e) {}
        return res;
      } catch (e) {
        // last resort — let the browser try again on its own
        return fetch(event.request);
      }
    })
  );
});
