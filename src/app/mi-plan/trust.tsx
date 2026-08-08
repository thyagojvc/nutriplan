'use client'

// Selos de pagamento e cupom. Cópia local (o /mi-plan roda isolado da /preview
// de propósito, ver comentário em results-data.ts). Mercado Pago só aparece
// onde a Hotmart de fato oferece: em AR ele é o meio de 6 em cada 7 vendas, e
// quem não tem cartão internacional desistia antes de clicar sem saber que
// estava disponível lá dentro.

import { useEffect, useState } from 'react'
import { Lock, Zap, RotateCcw, Tag, Flame } from 'lucide-react'

// Balão de actividad reciente. NUNCA inventa nombres ni compras individuales
// (eso es prueba social falsa, prohibido en este proyecto): usa el conteo
// real de /api/quiz/recent-activity, que solo responde algo cuando hay
// volumen real (mínimo 3 pedidos) y si no, no muestra nada.
export function LiveActivityToast() {
  const [data, setData] = useState<{ count: number; label: string } | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/quiz/recent-activity')
      .then((r) => r.json())
      .then((d: { count: number | null; label: string | null }) => {
        if (!cancelled && d.count && d.label) setData({ count: d.count, label: d.label })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!data) return
    let timer: ReturnType<typeof setTimeout>
    const cycle = (delay: number) => {
      timer = setTimeout(() => {
        setVisible(true)
        timer = setTimeout(() => {
          setVisible(false)
          cycle(20_000 + Math.random() * 25_000)
        }, 4500)
      }, delay)
    }
    cycle(6_000 + Math.random() * 6_000)
    return () => clearTimeout(timer)
  }, [data])

  if (!data) return null

  return (
    <div
      className={[
        'pointer-events-none fixed inset-x-0 bottom-[76px] z-40 flex justify-center px-4 transition-all duration-500',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      ].join(' ')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-2 rounded-full border border-[#D8E8D4] bg-white/95 px-4 py-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.12)] backdrop-blur-md">
        <Flame className="h-4 w-4 shrink-0 text-[#D85A30]" strokeWidth={2.4} />
        <p className="text-[12.5px] font-semibold leading-snug text-gray-800">
          {data.count} personas compraron su Calibración {data.label}
        </p>
      </div>
    </div>
  )
}

export function CouponBanner() {
  return (
    <div className="space-y-1.5 rounded-xl border-2 border-dashed border-[#D85A30] bg-[#FFF4EF] px-4 py-3 text-center">
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#D85A30]">
        <Tag className="h-3.5 w-3.5" strokeWidth={2.5} />
        Cupón válido solo hoy
      </p>
      <p className="text-sm leading-snug text-gray-800">
        Usa el código <span className="font-black tracking-wide text-[#D85A30]">BAJARHOY</span> al pagar y llévate{' '}
        <span className="font-black text-gray-900">10% off</span>
      </p>
    </div>
  )
}

export function PaymentTrust({ mercadoPago = false }: { mercadoPago?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2 pt-0.5">
        <div className="flex h-7 w-12 items-center justify-center rounded-md border border-[#E0E0DA] bg-white">
          <svg viewBox="0 0 48 16" width="36" height="12" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="13" fontFamily="Arial" fontSize="16" fontWeight="900" fontStyle="italic" fill="#1A1F71">VISA</text>
          </svg>
        </div>
        <div className="flex h-7 w-12 items-center justify-center rounded-md border border-[#E0E0DA] bg-white">
          <svg viewBox="0 0 38 24" width="32" height="20" xmlns="http://www.w3.org/2000/svg">
            <circle cx="13" cy="12" r="11" fill="#EB001B" />
            <circle cx="25" cy="12" r="11" fill="#F79E1B" />
            <path d="M19 3.5a11 11 0 0 1 0 17 11 11 0 0 1 0-17z" fill="#FF5F00" />
          </svg>
        </div>
        <div className="flex h-7 w-14 items-center justify-center rounded-md border border-[#E0E0DA] bg-white px-1">
          <svg viewBox="0 0 60 20" width="44" height="14" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#003087">Pay</text>
            <text x="28" y="15" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#009CDE">Pal</text>
          </svg>
        </div>
        {mercadoPago && (
          <div className="flex h-7 items-center justify-center rounded-md border border-[#E0E0DA] bg-white px-1.5">
            <svg viewBox="0 0 80 20" width="62" height="14" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="14" fontFamily="Arial" fontSize="13" fontWeight="bold" fill="#00B1EA">Mercado</text>
              <text x="52" y="14" fontFamily="Arial" fontSize="13" fontWeight="bold" fill="#2D3277">Pago</text>
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[13px] text-muted-foreground">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Pago seguro</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Acceso inmediato</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Garantía 14 días</span>
      </div>
    </div>
  )
}

const FAQ_ITEMS = [
  {
    q: '¿Qué pasa apenas pago?',
    a: 'Se desbloquea todo lo que viste bloqueado y recibes un correo en minutos con el enlace para instalar tu app, con tu plan ya generado adentro. No esperas a que alguien te lo arme: ya está armado, es el mismo que estuviste viendo.',
  },
  {
    q: '¿Es seguro comprar aquí?',
    a: 'Sí. El pago se procesa por Hotmart, una plataforma usada por millones de personas en Latinoamérica, con las mismas protecciones que cualquier compra online segura. Tus datos solo se usan para generar y enviarte tu plan.',
  },
  {
    q: 'Ya probé muchas dietas y ninguna funcionó. ¿Por qué esta sí?',
    a: 'Porque las dietas genéricas son la misma lista para todas, y si tu cuerpo no responde igual, el problema pareces tú. Aquí el plan se arma al revés: parte de tu metabolismo, tus horarios y lo que ya te gusta comer. Es justamente lo que acabas de ver en tu Día 1.',
  },
  {
    q: 'No tengo mucho tiempo para cocinar. ¿Igual me sirve?',
    a: 'Sí, está pensado exactamente para eso. Las comidas son sencillas y reales, con tu lista de compras ya optimizada y sustituciones para cuando te falte un ingrediente. Es la comida que ya haces, en las porciones que tu cuerpo necesita.',
  },
  {
    q: '¿Hay suscripción o cobros recurrentes?',
    a: 'No. Es un pago único, sin suscripción y sin cobros automáticos. Pagas una vez y el acceso a tu plan es tuyo para siempre.',
  },
  {
    q: '¿Y si no me sirve?',
    a: 'Tienes 14 días de garantía. Pides el reembolso y te devolvemos el 100%, sin preguntas.',
  },
]

export function FaqSection() {
  return (
    <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
      <div className="flex items-center gap-2 border-b border-[#EAF2E6] px-5 py-3">
        <p className="font-display text-[16px] font-bold text-gray-900">Preguntas frecuentes</p>
      </div>
      <div className="divide-y divide-[#EAF2E6]">
        {FAQ_ITEMS.map(({ q, a }) => (
          <details key={q} className="group px-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-3.5 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span>{q}</span>
              <span className="mt-0.5 shrink-0 text-xl font-light leading-none text-primary transition-transform duration-150 group-open:rotate-45">+</span>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
