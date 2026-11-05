// UBAH NOMOR VERSI INI SETIAP KALI ANDA MEMPERBARUI KODE UNTUK MEMICU NOTIFIKASI UPDATE
const CACHE_NAME = 'fintrack-v1.0.5';

// DAFTAR LENGKAP BERKAS INTI & PUSTAKA CDN YANG DIKUNCI KE PENYIMPANAN OFFLINE
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  // Pustaka Tampilan & Desain
  'https://cdn.tailwindcss.com',
  // Mesin Grafik & Tren
  'https://cdn.jsdelivr.net/npm/chart.js',
  // Mesin Impor & Ekspor Excel
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  // Mesin Pembuat PDF & Tabel PDF
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  // Ikon Aplikasi
  'https://unpkg.com/lucide@latest'
];

// 1. TAHAP INSTALASI: Unduh semua file dan simpan ke cache memori lokal
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Unduh asset satu per satu agar jika salah satu gagal tidak membatalkan yang lain
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

// 3. TAHAP FETCH: Strategi Cache-First untuk Pustaka, Network-First untuk File Utama
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Jangan cegat lalu lintas API Google Drive (Sinkronisasi cloud wajib online)
  if (
    requestUrl.origin.includes('googleapis.com') ||
    requestUrl.origin.includes('accounts.google.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Jika berkas sudah ada di cache lokal, langsung gunakan tanpa internet
      if (cachedResponse) {
        // Khusus index.html, periksa pembaruan di latar belakang jika sedang online
        if (event.request.mode === 'navigate' || event.request.url.includes('index.html')) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      // Jika belum ada di cache, unduh dari internet lalu simpan otomatis
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
        // Fallback jika offline penuh dan membuka rute baru
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// 4. TERIMA PERINTAH UPDATE DARI TOMBOL APLIKASI
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
