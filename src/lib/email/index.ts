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

// Envolve o action_link do Supabase numa página intermediária para evitar que
// scanners de phishing (Gmail, Outlook) consumam o token antes do clique real.
// A página /auth/magic lê o link do hash via JS — scanners não executam JS.
function wrapMagicLink(actionLink: string): string {
  const encoded = Buffer.from(actionLink).toString('base64')
  const baseUrl = 'https://nutriplan-tzyt.vercel.app'
  return `${baseUrl}/auth/magic#${encoded}`
}

// Layout base compartilhado pelos e-mails transacionais.
function emailLayout({
  heading,
  greeting,
  body,
  magicLink,
  cta,
  footer,
}: {
  heading: string
  greeting: string
  body: string
  magicLink: string
  cta: string
  footer: string
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#111;">
  <h1 style="font-size:22px;margin-bottom:8px;">${heading}</h1>
  <p style="color:#555;margin-bottom:4px;">${greeting}</p>
  <p style="color:#555;margin-bottom:28px;">${body}</p>
  <a href="${magicLink}"
     style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
            padding:13px 28px;border-radius:6px;font-weight:600;font-size:16px;">
    ${cta}
  </a>
  <p style="margin-top:32px;font-size:12px;color:#999;line-height:1.7;">${footer}</p>
</body>
</html>`
}

// E-mail enviado após o pagamento aprovado (plano recém-gerado).
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
    html: emailLayout({
      heading: '¡Tu plan está listo! 🎉',
      greeting: `Hola ${displayName},`,
      body: 'Tu plan nutricional personalizado ya fue generado. Haz clic en el botón para acceder a él:',
      magicLink: wrapMagicLink(magicLink),
      cta: 'Ver mi plan →',
      footer:
        'Este enlace es personal e intransferible. Expira en 24 horas.<br>' +
        'Si no realizaste esta compra, puedes ignorar este correo.',
    }),
  })
}

// E-mail disparado quando uma renovação é detectada no webhook.
// O link aponta para /checkin?token=XXX onde o usuário responde 3 perguntas
// antes de receber o plano da fase seguinte.
export async function sendCheckinReminderEmail({
  to,
  name,
  checkinUrl,
  phaseNumber,
}: {
  to: string
  name: string
  checkinUrl: string
  phaseNumber: 1 | 2 | 3
}) {
  const phaseLabels: Record<number, string> = {
    1: 'Adaptación',
    2: 'Aceleración',
    3: 'Consolidación',
  }
  const phase = phaseLabels[phaseNumber] ?? 'Actualización'
  const displayName = name || 'amigo/a'

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Tu plan del mes ${phaseNumber} está a punto de generarse 🔄`,
    html: emailLayout({
      heading: `¡Mes ${phaseNumber}: Fase ${phase}! 🌱`,
      greeting: `Hola ${displayName},`,
      body:
        `Tu suscripción se renovó y ya estamos listos para generar tu plan de la Fase ${phase}. ` +
        `Responde 3 preguntas rápidas para que podamos ajustar tu plan a tu progreso real:`,
      magicLink: checkinUrl,
      cta: 'Actualizar mi plan →',
      footer:
        'Este enlace expira en 7 días. Si no completas el check-in, tu plan se generará ' +
        'automáticamente con tus datos originales.<br>' +
        'Si tienes dudas, responde a este correo.',
    }),
  })
}

// E-mail de acesso (login sem contraseña) disparado pela tela de login.
export async function sendLoginLinkEmail({
  to,
  magicLink,
}: {
  to: string
  magicLink: string
}) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Tu enlace de acceso a NutriPlan',
    html: emailLayout({
      heading: 'Accede a tu plan 🔑',
      greeting: 'Hola,',
      body: 'Recibimos una solicitud de acceso a tu cuenta. Haz clic en el botón para entrar — sin contraseña:',
      magicLink: wrapMagicLink(magicLink),
      cta: 'Acceder a mi plan →',
      footer:
        'Este enlace es personal e intransferible. Expira en 1 hora.<br>' +
        'Si no solicitaste este acceso, puedes ignorar este correo.',
    }),
  })
}
