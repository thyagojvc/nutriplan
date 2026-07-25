// Service worker mínimo: existe só para satisfazer o critério de
// instalabilidade do Chrome/Android (precisa de um SW com fetch handler
// pra oferecer "Instalar app"). Sem cache próprio de propósito: o plano
// é dinâmico por usuário, cachear aqui criaria risco de mostrar dado velho.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
