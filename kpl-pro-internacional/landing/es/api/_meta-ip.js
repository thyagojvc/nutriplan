// IPs da propria Meta (rede AS32934). Quem chega por eles nao e cliente: e o robo de revisao
// que abre a pagina de todo anuncio novo (31/10/2026: 4 "visitas" no mesmo minuto em que o
// anuncio foi publicado, de Android, iPhone e navegador do Instagram, todas desses IPs).
// Cliente de verdade, mesmo no navegador do Instagram, chega pelo IP da propria internet.
// Arquivo com "_" na frente: a Vercel nao transforma em rota.
const V4 = [
  '31.13.24.0/21', '31.13.64.0/18', '45.64.40.0/22', '57.141.0.0/16', '57.144.0.0/14', '66.220.144.0/20', '69.63.176.0/20',
  '69.171.224.0/19', '74.119.76.0/22', '102.132.96.0/20', '103.4.96.0/22', '129.134.0.0/16', '147.75.208.0/20',
  '157.240.0.0/16', '163.70.128.0/17', '173.252.64.0/18', '179.60.192.0/22', '185.60.216.0/22', '185.89.216.0/22',
  '199.201.64.0/22', '204.15.20.0/22',
].map((c) => { const [ip, n] = c.split('/'); return [num(ip), Number(n)]; });

function num(ip) { return ip.split('.').reduce((t, x) => t * 256 + Number(x), 0); }

module.exports = function ipDaMeta(ip) {
  ip = String(ip || '').trim().toLowerCase();
  if (!ip) return false;
  if (ip.includes(':')) return ip.startsWith('2a03:2880:') || ip.startsWith('2a03:2881:') || ip.startsWith('2620:0:1c') || ip.startsWith('2620:10d:c');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const x = num(ip);
  return V4.some(([base, n]) => Math.floor(x / 2 ** (32 - n)) === Math.floor(base / 2 ** (32 - n)));
};
