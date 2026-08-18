// node scripts/dev-server.js  →  http://localhost:4321
//
// Servidor local só pra desenvolvimento. Existe porque servir a pasta como
// estático puro (python -m http.server) não deixa abrir o app: `/mi-kit` só
// mostra as abas se `/api/kit-access` responder que a compra é válida, e num
// estático esse endpoint dá 404, então o app fica eternamente na tela de
// bloqueado. Aqui esse endpoint é fingido e a compra é sempre válida.
//
// Serve só pra ver a interface (jogo, pintura, galeria). Não roda as funções
// de verdade da Vercel: pagamento, entrega e webhook não passam por aqui.
// Pra testar isso, deploy de preview.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 4321;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json',
};

http.createServer((req, res) => {
  let rota = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (rota === '/api/kit-access') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ valid: true, appLocked: false, name: 'Teste' }));
  }
  // Qualquer outra API responde ok pra nada quebrar em tela.
  if (rota.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }

  if (rota === '/') rota = '/index.html';
  let arquivo = path.join(ROOT, rota);
  // cleanUrls do vercel.json: /mi-kit serve mi-kit.html
  if (!fs.existsSync(arquivo) && fs.existsSync(arquivo + '.html')) arquivo += '.html';

  if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404');
  }

  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(arquivo).pipe(res);
}).listen(PORT, () => {
  console.log('KPL dev: http://localhost:' + PORT + '/mi-kit?t=teste');
});
