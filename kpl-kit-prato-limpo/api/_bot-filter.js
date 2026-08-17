// Filtro best-effort pra não poluir o /funil com robôs/scanners: bloqueia IPs
// que pertencem a datacenters/nuvem conhecidos, nunca clientes reais (mãe
// brasileira no celular/wifi de casa não sai de faixa da AWS/Meta/OVH etc).
// NÃO é exaustivo — é a lista dos ranges que já vimos batendo no site (crawler
// de revisão de anúncio da Meta, scanners genéricos assim que o domínio ficou
// público com HTTPS). Se aparecer um IP de datacenter novo repetindo, é só
// adicionar o range aqui.

const DATACENTER_RANGES = [
  // Meta/Facebook (crawler de revisão de anúncio — visto repetidamente)
  '31.13.24.0/21', '31.13.64.0/18', '66.220.144.0/20', '69.63.176.0/20',
  '173.252.64.0/18', '157.240.0.0/16', '204.15.20.0/22',
  // Scaleway / Online SAS (visto batendo no domínio novo)
  '62.210.0.0/16', '51.15.0.0/16', '163.172.0.0/16', '212.83.128.0/19', '151.115.0.0/16',
  // OVH
  '51.68.0.0/14', '54.36.0.0/14', '137.74.0.0/16', '145.239.0.0/16',
  '149.202.0.0/16', '151.80.0.0/16', '176.31.0.0/16', '178.32.0.0/15',
  '188.165.0.0/16', '5.135.0.0/16',
  // DigitalOcean
  '104.131.0.0/16', '104.236.0.0/16', '138.68.0.0/16', '138.197.0.0/16',
  '157.245.0.0/16', '159.65.0.0/16', '159.89.0.0/16', '161.35.0.0/16',
  '165.227.0.0/16', '167.71.0.0/16', '167.99.0.0/16', '178.62.0.0/16',
  '188.166.0.0/16', '206.189.0.0/16',
  // Google Cloud (blocos principais de VM)
  '34.64.0.0/10', '35.184.0.0/13', '35.192.0.0/14', '35.196.0.0/15', '35.198.0.0/16',
  // AWS (blocos grandes e inequívocos)
  '3.0.0.0/8', '13.32.0.0/15', '18.130.0.0/16', '52.0.0.0/8', '54.36.0.0/16',
  '35.80.0.0/12', '34.192.0.0/10', '15.176.0.0/12',
  // Hetzner
  '5.9.0.0/16', '78.46.0.0/15', '88.99.0.0/16', '136.243.0.0/16', '148.251.0.0/16', '176.9.0.0/16',
];

function ipToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr(ipInt, cidr) {
  const [range, bitsStr] = cidr.split('/');
  const rangeInt = ipToInt(range);
  const bits = Number(bitsStr);
  if (rangeInt === null || Number.isNaN(bits)) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function isDatacenterIP(ip) {
  const ipInt = ipToInt(String(ip || '').trim());
  if (ipInt === null) return false;
  return DATACENTER_RANGES.some((cidr) => inCidr(ipInt, cidr));
}

module.exports = { isDatacenterIP };
