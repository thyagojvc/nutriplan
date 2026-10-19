// Helper compartilhado: envia e-mail via Resend (API REST simples, sem SDK).
//
// Variáveis de ambiente:
//   RESEND_API_KEY      -> chave da API do Resend
//   DELIVERY_FROM_EMAIL  -> remetente, ex.: entrega@nutriplan.email (domínio já verificado)
//
// 19/10: o remetente passou a ser acesso@kitpratolimpo.com.br (domínio
// verificado no Resend). O texto abaixo é o histórico de quando era só o
// nutriplan.email, que caía no lixo do Hotmail por não bater com a marca.
// SOBRE O REMETENTE (antigo): o plano free do Resend verificava só UM domínio, e ele estava
// no nutriplan.email. Como o KPL é outra marca, a cliente compra em
// kitpratolimpo.com.br e receberia e-mail de um domínio que ela nunca viu —
// convite pra ignorar ou marcar como spam. A saída sem custo é o NOME DE
// EXIBIÇÃO: o Resend aceita o formato `Kit Prato Limpo <entrega@nutriplan.email>`
// em DELIVERY_FROM_EMAIL, e é o nome que aparece em destaque na caixa de
// entrada. O endereço técnico fica em segundo plano.
//   REPLY_TO_EMAIL -> pra onde vai a resposta dela (o suporte de verdade).
// Sem isso a resposta cai na caixa do remetente técnico, que ninguém lê.

// VERSÃO EM TEXTO (19/10). E-mail só com HTML é sinal de spam pros filtros da
// Microsoft (Hotmail/Outlook). Gera o text/plain a partir do próprio HTML:
// link vira "texto: url", e tag some.
function textoDoHtml(html) {
  return String(html || '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, txt) => {
      const rotulo = txt.replace(/<[^>]+>/g, '').trim();
      const alvo = href.replace(/^mailto:/, '');
      return rotulo && rotulo !== alvo ? `${rotulo}: ${alvo}` : alvo;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|div|li|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendEmail({ to, subject, html, text, from, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY ausente: e-mail não enviado (assunto: ' + subject + ')');
    return { ok: false };
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from || process.env.DELIVERY_FROM_EMAIL,
      to,
      subject,
      html,
      text: text || textoDoHtml(html),
      ...(replyTo || process.env.REPLY_TO_EMAIL
        ? { reply_to: replyTo || process.env.REPLY_TO_EMAIL }
        : {}),
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('Resend error', r.status, detail);
    return { ok: false };
  }
  return { ok: true };
}

module.exports = { sendEmail, textoDoHtml };
