/* GranaFlow — Service Worker (cache-first, 100% offline) */
var CACHE_NAME = 'granaflow-v1';

var ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/responsive.css',
  './js/database.js',
  './js/finance.js',
  './js/events.js',
  './js/expenses.js',
  './js/calendar.js',
  './js/investments.js',
  './js/reports.js',
  './js/backup.js',
  './js/app.js',
  './assets/logo.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

// Instalação: guarda todos os arquivos no cache
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ARQUIVOS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Ativação: apaga caches de versões antigas
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (nome) {
        if (nome !== CACHE_NAME) return caches.delete(nome);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Requisições: cache primeiro, rede como alternativa
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (emCache) {
      if (emCache) return emCache;

      return fetch(event.request).then(function (resposta) {
        return resposta;
      }).catch(function () {
        // Sem internet e fora do cache: volta para a tela principal
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
