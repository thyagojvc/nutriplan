// Leitura do User-Agent. Fica aqui, e nao dentro de uma rota, porque o
// presence.js (visita) e o deliver-kit.js (venda) precisam classificar do
// mesmo jeito. Se cada um tivesse a sua copia, uma hora a lista de visitas e
// a de vendas passariam a chamar o mesmo aparelho de coisas diferentes.
function detectPlatform(ua) {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
  return 'Other';
}

module.exports = { detectPlatform };
