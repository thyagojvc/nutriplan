'use client'

// =============================================================================
// Aba "Desbloquear" — a oferta.
//
// Ela chega aqui já tendo tocado cadeados, então esta tela não apresenta um
// produto novo: ela devolve, item por item, o que a pessoa acabou de ver
// trancado. Por isso a lista é ORDENADA pelos cadeados que ela mesma tocou
// (ver `tapped`) — o que ela quis abrir aparece primeiro e marcado. É o mesmo
// fechamento de ciclo que faz o order bump funcionar na página que serviu de
// referência: o que estava trancado lá em cima é o que reaparece na hora de
// pagar, e aí já não é oferta nova, é coisa que ela já queria.
//
// O treino fica FORA da lista de incluídos de propósito: é acréscimo dentro do
// checkout, não faz parte dos $9.90.
// =============================================================================

import { Check, ShieldCheck, Mail, MessageCircle, RotateCcw, Dumbbell } from 'lucide-react'
import { hasExtraFees, hasMercadoPago } from '@/lib/pricing/localize'
import { CouponBanner, PaymentTrust, FaqSection } from '../trust'
import { PRICE_USD } from '../use-offer'

/** Cada bloco travado da app mapeado no item de oferta que o abre. */
const UNLOCK_ITEMS: { key: string; match: (id: string) => boolean; item: string; note: string }[] = [
  {
    key: 'dias',
    match: (id) => id.startsWith('dia_'),
    item: 'Tus 7 días completos',
    note: 'los otros 6 días armados con tus alimentos, no solo el que ya viste',
  },
  {
    key: 'atajos',
    match: (id) => id.startsWith('atajo_'),
    item: 'Los 7 atajos de la Calibración',
    note: 'reglas de diez segundos que aceleran el mismo plan, sin más tiempo de cocina',
  },
  {
    key: 'lista',
    match: (id) => id === 'lista_semana',
    item: 'Tu lista de compras de la semana',
    note: 'organizada por pasillo, vas una vez y sale todo',
  },
  {
    key: 'guia',
    match: (id) => id === 'guia_implementacion',
    item: 'Tu guía de arranque',
    note: 'qué hacer el primer día y cuando se te desarma la rutina',
  },
  {
    key: 'sustituciones',
    match: (id) => id === 'sustituciones',
    item: 'Tus sustituciones',
    note: 'si te falta un ingrediente, ya sabes por cuál cambiarlo',
  },
  {
    key: 'app',
    match: () => false,
    item: 'Tu app instalada en el celular',
    note: 'lo que te toca hoy, en un toque, sin abrir ningún PDF',
  },
  {
    key: 'calendario',
    match: (id) => id === 'bono_calendario',
    item: 'Tu calendario de constancia',
    note: 'lo que te sostiene en la semana 2, donde las dietas se caen',
  },
  {
    key: 'anticelulitis',
    match: (id) => id === 'bono_anticelulitis',
    item: 'Guía Anti-Celulitis',
    note: 'lo que sí funciona sobre la piel mientras la grasa baja',
  },
]

export function DesbloquearTab({
  tapped,
  fxCountry,
  fxCurrency,
  price,
  localPrice,
  anchorPrice,
  ctaLabel,
  onCta,
  ctaState,
  showTrainingNote,
  noTraining,
}: {
  /** Ids dos cadeados que ela tocou, na ordem em que tocou. */
  tapped: string[]
  fxCountry?: string
  fxCurrency: string
  price: (usd: number) => string
  localPrice: (usd: number) => string | null
  anchorPrice: (usd: number) => string
  ctaLabel: (usd: number) => string
  onCta: () => void
  ctaState: 'idle' | 'loading' | 'error'
  showTrainingNote: boolean
  noTraining: boolean
}) {
  // Ordena pelo primeiro toque de cada item. Quem não foi tocado mantém a
  // ordem original, depois dos tocados.
  const rank = (key: string) => {
    const entry = UNLOCK_ITEMS.find((u) => u.key === key)!
    const i = tapped.findIndex((id) => entry.match(id))
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const items = [...UNLOCK_ITEMS].sort((a, b) => rank(a.key) - rank(b.key))
  const wanted = new Set(items.filter((u) => rank(u.key) !== Number.MAX_SAFE_INTEGER).map((u) => u.key))

  const local = localPrice(PRICE_USD)

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border-2 border-primary/40 bg-white shadow-[0_10px_34px_rgba(15,110,86,0.13)]">
        <div className="bg-primary px-5 py-3 text-center">
          <p className="text-[13px] font-bold uppercase tracking-widest text-white/80">
            Tu Calibración Metabólica
          </p>
          <p className="text-base font-black text-white">
            Ya está calculada. Solo falta abrirla.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Lo que se desbloquea
            </p>
            <p className="mb-2.5 text-[12px] text-gray-500">
              {wanted.size > 0
                ? 'Empezando por lo que intentaste abrir.'
                : 'Todo lo que viste bloqueado, de una sola vez.'}
            </p>
            <ul className="space-y-2.5">
              {items.map(({ key, item, note }) => (
                <li key={key} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {item}
                      {wanted.has(key) && (
                        <span className="rounded-full bg-[#D85A30] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                          Lo intentaste abrir
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] leading-snug text-muted-foreground">{note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-4 text-center">
            <p className="text-[13px] leading-relaxed text-gray-700">
              Armar esto por tu cuenta (una app de seguimiento, un plan a tu medida, un calendario
              de constancia) fácilmente costaría más de{' '}
              <strong className="font-bold text-gray-900">{anchorPrice(47)}</strong>.
            </p>
            <p className="text-sm text-gray-800">Hoy, en un solo pago:</p>
            <p className="text-[2.5rem] font-black leading-none text-primary tabular-nums">
              {price(PRICE_USD)} <span className="text-lg font-bold text-primary/70">USD</span>
            </p>
            {local && (
              <p className="text-[13px] font-semibold text-gray-700">
                En tu moneda: <span className="font-bold tabular-nums text-gray-900">{local} {fxCurrency}</span>
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {hasExtraFees(fxCountry)
                    ? 'Tu banco puede sumar las percepciones de siempre por comprar en dólares.'
                    : 'Es el total que vas a pagar, nada se suma después.'}
                </span>
              </p>
            )}
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Un solo pago, sin suscripción ni cobros cada mes.
            </p>
          </div>

          <CouponBanner />

          {showTrainingNote && (
            <p className="flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-gray-600">
              <Dumbbell className="h-3.5 w-3.5 shrink-0 text-primary" />
              {noTraining
                ? 'Aunque no vayas al gimnasio, si quieres puedes sumar tu rutina en casa en el siguiente paso.'
                : 'Tu rutina de entrenamiento se suma en el siguiente paso, si la quieres.'}
            </p>
          )}

          {ctaState === 'error' && (
            <p className="text-center text-xs text-red-600">
              Error al preparar el pedido. Recarga la página e intenta de nuevo.
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={onCta}
              disabled={ctaState === 'loading'}
              className={[
                'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
                'bg-[#D85A30] shadow-[0_4px_20px_0_rgba(216,90,48,0.38)] transition-all duration-150',
                'active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
              ].join(' ')}
            >
              {ctaState === 'loading' ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  Procesando…
                </>
              ) : (
                ctaLabel(PRICE_USD)
              )}
            </button>
            {local && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                *El cobro es de {price(PRICE_USD)} USD. La conversión a {fxCurrency} es del día de hoy y puede variar un poco.
              </p>
            )}
          </div>

          <p className="flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-gray-600">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            Si no te sirve, no pagas: garantía de 14 días, sin preguntas.
          </p>

          <div className="space-y-2.5 rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] px-4 py-3.5">
            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-primary">
              Apenas pagas, esto pasa
            </p>
            <div className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[13px] leading-snug text-gray-700">
                Se abre <strong>todo lo que viste bloqueado</strong>, en esta misma pantalla. Es tu plan, no otro.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[13px] leading-snug text-gray-700">
                Recibes un correo <strong>en minutos</strong> con el enlace para instalar tu app.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[13px] leading-snug text-gray-700">
                Recibes <strong>soporte por WhatsApp</strong> si tienes cualquier duda. Hay un equipo real detrás.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[13px] leading-snug text-gray-700">
                Si en 14 días no notas cambios, te devolvemos el <strong>100%</strong>.
              </p>
            </div>
          </div>

          <PaymentTrust mercadoPago={hasMercadoPago(fxCountry)} />
        </div>
      </div>

      <FaqSection />

      <button
        type="button"
        onClick={onCta}
        disabled={ctaState === 'loading'}
        className={[
          'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
          'bg-[#D85A30] shadow-[0_4px_20px_0_rgba(216,90,48,0.38)] transition-all duration-150',
          'active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        ].join(' ')}
      >
        {ctaState === 'loading' ? 'Procesando…' : ctaLabel(PRICE_USD)}
      </button>
    </div>
  )
}
