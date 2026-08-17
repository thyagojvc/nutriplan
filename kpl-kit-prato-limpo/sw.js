// Service worker mínimo, só pra deixar o mi-kit instalável como app.
// De propósito não guarda nada em cache (o PDF passa de 90MB, não faz
// sentido reter isso no storage do celular) — todo request vai pra rede.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
