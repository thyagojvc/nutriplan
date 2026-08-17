// Helper compartilhado: envia e-mail via Resend (API REST simples, sem SDK).
//
// Variáveis de ambiente:
//   RESEND_API_KEY      -> chave da API do Resend
//   DELIVERY_FROM_EMAIL  -> remetente, ex.: entrega@nutriplan.email (domínio já verificado)
//
// SOBRE O REMETENTE: o plano free do Resend verifica só UM domínio, e ele está
// no nutriplan.email. Como o KPL é outra marca, a cliente compra em
// kitpratolimpo.com.br e receberia e-mail de um domínio que ela nunca viu —
// convite pra ignorar ou marcar como spam. A saída sem custo é o NOME DE
// EXIBIÇÃO: o Resend aceita o formato `Kit Prato Limpo <entrega@nutriplan.email>`
// em DELIVERY_FROM_EMAIL, e é o nome que aparece em destaque na caixa de
// entrada. O endereço técnico fica em segundo plano.
//   REPLY_TO_EMAIL -> pra onde vai a resposta dela (o suporte de verdade).
// Sem isso a resposta cai na caixa do remetente técnico, que ninguém lê.

async function sendEmail({ to, subject, html, from, replyTo }) {
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

module.exports = { sendEmail };
