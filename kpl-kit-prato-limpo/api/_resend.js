// Helper compartilhado: envia e-mail via Resend (API REST simples, sem SDK).
//
// Variáveis de ambiente:
//   RESEND_API_KEY      -> chave da API do Resend
//   DELIVERY_FROM_EMAIL  -> remetente, ex.: entrega@nutriplan.email (domínio já verificado)

async function sendEmail({ to, subject, html, from }) {
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
