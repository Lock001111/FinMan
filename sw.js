// UBAH NOMOR VERSI INI SETIAP KALI ANDA MEMPERBARUI KODE UNTUK MEMICU NOTIFIKASI UPDATE
const APP_VERSION = 'v1.2.6';
const CACHE_NAME = `fintrack-${APP_VERSION}`;

// DAFTAR LENGKAP BERKAS INTI & PUSTAKA CDN YANG DIKUNCI KE PENYIMPANAN OFFLINE
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  // Modul JavaScript Aplikasi
  './js/core-helpers.js',
  './js/state-storage.js',
  './js/dashboard.js',
  './js/transactions.js',
  './js/analysis.js',
  './js/import-export.js',
  './js/budgets.js',
  './js/trends.js',
  './js/settings-accounts.js',
  './js/reminders.js',
  './js/custom-params.js',
  './js/backup-restore.js',
  './js/navigation-ui.js',
  './js/cloud-sync.js',
  './js/applock-fs.js',
  './js/pwa-numpad.js',
  './js/app-init.js',
  // Pustaka Tampilan & Desain
  'https://cdn.tailwindcss.com',
  // Mesin Grafik & Tren
  'https://cdn.jsdelivr.net/npm/chart.js',
  // Mesin Impor & Ekspor Excel (dengan Styling)
  'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',
  // Mesin Pembuat PDF & Tabel PDF + Pratinjau PDF
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  // Ikon Aplikasi
  'https://unpkg.com/lucide@latest'
];

// 1. TAHAP INSTALASI: Unduh semua file dan simpan ke cache memori lokal
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Segera aktifkan Service Worker baru agar cache lama tidak menahan pembaruan
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(new Request(asset, { mode: 'cors' }));
        } catch (err) {
          console.warn('Gagal caching offline untuk:', asset, err);
        }
      }
    })
  );
});

// 2. TAHAP AKTIVASI: Bersihkan cache versi lama saat update diterapkan
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. TAHAP FETCH: Network-First untuk file aplikasi lokal agar update langsung masuk saat online,
//    dan Cache-First untuk pustaka eksternal (CDN) agar hemat kuota & cepat offline
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Jangan cegat lalu lintas API Google Drive (Sinkronisasi cloud wajib online)
  if (
    requestUrl.origin.includes('googleapis.com') ||
    requestUrl.origin.includes('accounts.google.com')
  ) {
    return;
  }

  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (isSameOrigin && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html', { ignoreSearch: true });
            }
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html', { ignoreSearch: true });
        }
      });
    })
  );
});

// 4. KLIK NOTIFIKASI: Fokuskan jendela FinTrack yang terbuka atau buka aplikasi
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./index.html');
      }
    })
  );
});

// 5. TERIMA PERINTAH UPDATE DARI TOMBOL APLIKASI
self.addEventListener('message', (event) => {
  if (event.data && (event.data.action === 'skipWaiting' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }

  if (event.data && event.data.action === 'getVersion') {
    event.source.postMessage({ version: APP_VERSION });
  }
});
