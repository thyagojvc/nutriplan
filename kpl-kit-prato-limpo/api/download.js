// GET /api/download?t=<token>
//
// Portão de entrega do kit. O PDF NÃO fica mais num nome fixo na raiz do site
// (/kit-prato-limpo.pdf era adivinhável por qualquer um). Agora ele mora em
// entrega/kit-prato-limpo-<variante>-<hash>.pdf e só quem tem um token de
// compra válido chega lá — o token é criado em api/deliver-kit.js quando o
// pagamento é confirmado e vai no e-mail do cliente.
//
// DUAS VARIANTES: o registro do token (dl:<token> no Redis) guarda o tierId
// da compra. Essencial recebe o PDF só com as fichas; Completo recebe fichas
// + bônus (calendário, cartelas, quadro de progresso, guia). É o que garante
// que quem paga o Essencial recebe exatamente o que a página promete pra esse
// plano, não o pacote inteiro — ver scripts/build-kit-pdf.js. Token sem
// tierId (comprado antes dessa mudança) cai no completo, pra não tirar nada
// de quem já tinha recebido o link antigo.
//
// Por que redirect e não servir o arquivo por aqui: função serverless na Vercel
// tem teto de ~4.5MB de corpo de resposta e o kit passa de 30MB. Então validamos
// o token aqui e mandamos o cliente pro arquivo com nome de hash.
//
// LIMITE CONHECIDO: depois do redirect o cliente enxerga a URL final, então ele
// AINDA consegue repassar esse link pra outra pessoa. O que este portão resolve
// é o problema real de hoje: ninguém chega no entregável sem ter comprado, nem
// chutando URL nem varrendo o domínio. Pra fechar também o repasse seria preciso
// hospedar o PDF fora da Vercel (R2/S3) e gerar URL assinada de curta duração a
// cada download — o resto do fluxo aqui já fica pronto pra isso.

const { redis } = require('./_kv');
const KIT_FILE = require('./_kit-file.json');

// Cada compra pode baixar várias vezes (trocou de celular, perdeu o e-mail,
// formatou o computador). O teto existe só pra um link vazado não virar
// distribuição em massa.
const MAX_DOWNLOADS = 40;

function page({ title, message, tone = 'erro' }) {
  const accent = tone === 'erro' ? '#F0673A' : '#5CA741';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>${title} · Kit Prato Limpo</title>
</head>
<body style="margin:0;background:#FBF8F1;font-family:system-ui,'Segoe UI',Roboto,sans-serif;color:#26302A">
  <div style="max-width:460px;margin:0 auto;padding:64px 24px;text-align:center">
    <div style="height:6px;width:56px;background:${accent};border-radius:99px;margin:0 auto 28px"></div>
    <h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#4B564E;margin:0 0 24px">${message}</p>
    <p style="font-size:14px;color:#7C857D;margin:0">
      Escreva pra <a href="mailto:kitpratolimpo@gmail.com" style="color:#3C7A2C;font-weight:bold">kitpratolimpo@gmail.com</a>
      que a gente resolve rapidinho.
    </p>
  </div>
</body>
</html>`;
}

function sendPage(res, status, opts) {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.send(page(opts));
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const token = String((req.query && req.query.t) || '').trim();

  // Formato conferido antes de bater no Redis: evita gastar chamada com lixo.
  if (!/^[a-f0-9]{32,64}$/.test(token)) {
    return sendPage(res, 400, {
      title: 'Link incompleto',
      message: 'Esse link de download não está completo. Confira se você copiou o endereço inteiro do e-mail de confirmação.',
    });
  }

  let record;
  try {
    record = await redis('GET', `dl:${token}`);
  } catch (err) {
    // Fail-CLOSED de propósito: aqui o risco de liberar o entregável pra quem
    // não comprou é pior que o de fazer o cliente tentar de novo em um minuto.
    // (Em deliver-kit.js é o contrário: lá o fail-open protege quem pagou.)
    console.error('download: redis indisponível', err);
    return sendPage(res, 503, {
      title: 'Instabilidade momentânea',
      message: 'Não conseguimos confirmar seu acesso agora. Tente de novo em um minuto, o link continua valendo.',
    });
  }

  if (!record) {
    return sendPage(res, 403, {
      title: 'Link inválido ou expirado',
      message: 'Esse link de download não é válido. Se você comprou o kit, use o link do e-mail de confirmação da sua compra.',
    });
  }

  let tierId = 'completo';
  try {
    const parsed = JSON.parse(record);
    if (parsed.tierId === 'essencial') tierId = 'essencial';
    // Edição profissional (22/08): PDF próprio, com as 30 fichas de consultório
    // na frente e a licença de uso. Só entra se o build já tiver gerado o
    // arquivo — sem isso o `||` abaixo entregaria o Completo em silêncio, que é
    // material de outro público e sem a licença que ela pagou pra ter.
    if (parsed.tierId === 'profissional' && KIT_FILE.profissional) tierId = 'profissional';
  } catch {}
  const fileName = KIT_FILE[tierId] || KIT_FILE.completo;

  let count = 0;
  try {
    count = Number(await redis('INCR', `dlc:${token}`)) || 0;
  } catch (err) {
    // Contador é proteção secundária: se ele falhar, o token já foi validado
    // acima, então libera o download em vez de travar quem pagou.
    console.error('download: contador falhou (liberando mesmo assim)', err);
  }

  if (count > MAX_DOWNLOADS) {
    return sendPage(res, 429, {
      title: 'Limite de downloads atingido',
      message: 'Esse link já foi usado muitas vezes. Se ainda é você tentando baixar, a gente libera de novo sem problema.',
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.writeHead(302, { Location: `/entrega/${fileName}` });
  return res.end();
};
