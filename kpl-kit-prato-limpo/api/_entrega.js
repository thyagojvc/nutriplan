// Criação do acesso da compra e o e-mail de confirmação.
//
// Mora aqui porque DOIS caminhos entregam de verdade:
//   deliver-kit.js -> fluxo normal, o polling da tela de sucesso confirmou;
//   webhook.js     -> caminho órfão, a cliente fechou a aba antes disso.
// Enquanto isso era código solto no deliver-kit, o webhook não tinha como
// entregar e só avisava o admin: quem fechava a aba não recebia nada e
// precisava reclamar pra ser atendida.

const crypto = require('crypto');
const { redis } = require('./_kv');

// Um ano: a cliente compra hoje e pode querer reimprimir a ficha daqui a meses.
const DOWNLOAD_TTL_SECONDS = 365 * 24 * 60 * 60;

// Cria o acesso exclusivo da compra. O Completo ganha o link pra /mi-kit (a
// casca de app); o Essencial ganha o link direto do PDF — o app é vendido
// como diferencial só do Completo, então é isso mesmo que separa os dois na
// prática, não só no texto da página. Devolve null se o Redis falhar — nesse
// caso o e-mail sai sem botão, em vez de sair com um botão quebrado.
// `extra` entra no registro do token (o resend-access marca `reenvio: true`
// ali, pra dar pra saber depois que aquele acesso saiu na mão e não pela
// compra).
async function createDownloadLink(paymentId, email, name, tierId, extra) {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const registro = Object.assign({ paymentId, email, name, tierId, ts: Date.now() }, extra || {});
    await redis('SET', `dl:${token}`, JSON.stringify(registro), 'EX', DOWNLOAD_TTL_SECONDS);
    // Guarda o caminho inverso pra dar suporte ("perdi o e-mail") sem precisar
    // varrer o banco atrás do token.
    await redis('SET', `dltok:${paymentId}`, token, 'EX', DOWNLOAD_TTL_SECONDS);

    // Fila do e-mail de upgrade (só Essencial). É um zset com a data como
    // score, então o cron lê só quem já passou do prazo, em vez de varrer
    // `dl:*` atrás de compras antigas. Um ZADD por venda contra uma varredura
    // diária: a cota do Redis já estourou uma vez aqui, não dá pra repetir.
    // Reenvio manual (resend-access) NÃO entra: `extra.reenvio` marca esses.
    if (tierId === 'essencial' && !(extra && extra.reenvio)) {
      await redis('ZADD', 'upsell:fila', String(Date.now()), token).catch(() => {});
    }
    const base = (process.env.PUBLIC_BASE_URL || 'https://kitpratolimpo.com.br').replace(/\/+$/, '');
    // 'upgrade' entra aqui: quem paga a diferença vira Completo pra todos os
    // efeitos, então recebe o link do app e não o do PDF avulso.
    // 'profissional' entra aqui desde 23/08: a Edição Profissional é vendida
    // como kit COMPLETO (as 189 fichas + o aplicativo), então a nutricionista
    // recebe o link do app, e não o PDF avulso. Ela não perde o PDF: o próprio
    // /mi-kit tem o botão "Baixar o kit em PDF" apontando pra /api/download,
    // que já sabe servir a variante profissional.
    const isCompleto = tierId === 'completo' || tierId === 'completo_promo' || tierId === 'upgrade' || tierId === 'profissional';
    return isCompleto ? `${base}/mi-kit?t=${token}` : `${base}/api/download?t=${token}`;
  } catch (err) {
    console.error('entrega: falhou ao criar token de download', err);
    return null;
  }
}

function confirmationEmailHtml({ name, tierName, downloadUrl }) {
  const firstName = String(name || '').trim().split(' ')[0] || 'oi';
  const downloadBlock = downloadUrl
    ? `<p style="text-align: center; margin: 24px 0;">
      <a href="${downloadUrl}" style="background: #5CA741; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">Acessar meu Kit Prato Limpo</a>
    </p>
    <p style="font-size: 13px; color: #7C857D; text-align: center;">Este link é só seu, ligado à sua compra. Guarde este e-mail para acessar de novo quando precisar.</p>`
    : `<p>Vamos te mandar o acesso no WhatsApp que você cadastrou no checkout. Se preferir não esperar, escreva para kitpratolimpo@gmail.com que a gente manda na hora.</p>`;

  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #26302A;">
    <h1 style="font-size: 22px; margin-bottom: 8px;">Pagamento confirmado! 🍽️</h1>
    <p>${firstName}, recebemos seu pagamento do <strong>${tierName}</strong>.</p>
    ${downloadBlock}
    <p>Também mandamos o acesso no WhatsApp que você cadastrou no checkout.</p>
    <p>Se o botão acima não funcionar, escreva para <a href="mailto:kitpratolimpo@gmail.com">kitpratolimpo@gmail.com</a> que resolvemos rapidamente.</p>
    <p style="margin-top: 24px;">Guarde este e-mail como comprovante da sua compra.</p>
  </div>`;
}

module.exports = { createDownloadLink, confirmationEmailHtml, DOWNLOAD_TTL_SECONDS };
