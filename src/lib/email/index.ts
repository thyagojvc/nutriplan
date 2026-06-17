import { Resend } from 'resend'

// Cliente instanciado de forma lazy: não criar no carregamento do módulo, pois
// o construtor do Resend estoura se RESEND_API_KEY estiver ausente — e isso
// quebraria o build da Vercel (fase "Collecting page data") em ambientes sem a chave.
let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY no está configurada en este entorno.')
    }
    _resend = new Resend(apiKey)
  }
  return _resend
}

// Sem domínio próprio: usa o sender de teste do Resend (só entrega ao dono da conta)
// Com domínio verificado: trocar RESEND_FROM para 'NutriPlan <noreply@seudominio.com>'
const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export async function sendPlanReadyEmail({
  to,
  name,
  magicLink,
}: {
  to: string
  name: string
  magicLink: string
}) {
  const displayName = name || 'amigo/a'

  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Tu plan nutricional personalizado está listo ✅',
    html: `<!DOCTYPE html>
<html lang="es">
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#111;">
  <h1 style="font-size:22px;margin-bottom:8px;">¡Tu plan está listo! 🎉</h1>
  <p style="color:#555;margin-bottom:4px;">Hola ${displayName},</p>
  <p style="color:#555;margin-bottom:28px;">
    Tu plan nutricional personalizado ya fue generado. Haz clic en el botón para acceder a él:
  </p>
  <a href="${magicLink}"
     style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
            padding:13px 28px;border-radius:6px;font-weight:600;font-size:16px;">
    Ver mi plan →
  </a>
  <p style="margin-top:32px;font-size:12px;color:#999;line-height:1.7;">
    Este enlace es personal e intransferible. Expira en 24 horas.<br>
    Si no realizaste esta compra, puedes ignorar este correo.
  </p>
</body>
</html>`,
  })
}
