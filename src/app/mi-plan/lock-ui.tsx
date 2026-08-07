'use client'

// =============================================================================
// Primitivos de bloqueio do /mi-plan.
//
// A regra visual da página inteira cabe em uma frase: nítido = ela já tem,
// borrado = ela abre pagando. Nunca esconder um bloco travado (um card vazio
// não gera vontade nenhuma), sempre mostrar a forma dele com o conteúdo fora
// de foco — é o que transforma "não sei o que tem ali" em "quero ver aquilo".
//
// Nenhum lock é beco sem saída: todo toque num cadeado abre a folha de
// desbloqueio. Diferente da referência que inspirou esta página, aqui o
// cadeado nunca responde "volta e assiste o vídeo primeiro".
// =============================================================================

import { useEffect } from 'react'
import { Lock, ShieldCheck, X } from 'lucide-react'

/**
 * Instrução de toque.
 *
 * Existe porque num app travado a affordance desaparece: uma fila de chips
 * cinza com cadeado lê como legenda, não como botão, e a pessoa fica presa na
 * primeira tela achando que viu tudo. Custa uma linha e é a diferença entre ela
 * descobrir que o plano continua ou não.
 */
export function TapHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#D85A30]/50 bg-[#FDF6F3] px-3 py-2">
      <span aria-hidden className="animate-[nudge_1.5s_ease-in-out_infinite] text-base leading-none">
        👆
      </span>
      <p className="text-[12px] leading-snug text-gray-800">{children}</p>
      <style>{`
        @keyframes nudge {
          0%, 100% { transform: translateY(0) }
          50%      { transform: translateY(-3px) }
        }
      `}</style>
    </div>
  )
}

/** Etiqueta pequena de "bloqueado", pra cantos de card. */
export function LockChip({ label = 'Bloqueado' }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
      <Lock className="h-2.5 w-2.5" strokeWidth={2.6} />
      {label}
    </span>
  )
}

/**
 * Envelope de conteúdo travado: renderiza os filhos borrados e sem interação,
 * com um cadeado por cima. `intensity` regula o quanto ainda dá pra ler — o
 * suficiente pra reconhecer que é comida de verdade, nunca o suficiente pra
 * usar sem pagar.
 */
export function Blurred({
  children,
  intensity = 4,
  className,
}: {
  children: React.ReactNode
  intensity?: number
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={['pointer-events-none select-none', className].filter(Boolean).join(' ')}
      style={{ filter: `blur(${intensity}px)` }}
    >
      {children}
    </div>
  )
}

/**
 * Bloco travado padrão: preview borrada + faixa clicável embaixo.
 * `onUnlock` recebe o id do bloco pra registrar QUAL cadeado ela tocou (esse
 * dado é o que diz o que ela realmente quer, e depois ordena os bumps).
 */
export function LockedBlock({
  id,
  title,
  hint,
  onUnlock,
  children,
  intensity,
}: {
  id: string
  title: string
  hint: string
  onUnlock: (id: string) => void
  children: React.ReactNode
  intensity?: number
}) {
  return (
    <button
      type="button"
      onClick={() => onUnlock(id)}
      className="relative block w-full overflow-hidden rounded-2xl border border-[#D8E8D4] bg-white text-left shadow-[0_4px_18px_rgba(15,110,86,0.07)] transition-transform active:scale-[0.99]"
    >
      <div className="relative">
        <Blurred intensity={intensity}>{children}</Blurred>
        {/* Véu que escurece de leve o topo e some perto da faixa, pra a
            transição entre borrado e nítido não ficar com corte duro. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.72) 100%)' }}
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_20px_rgba(15,110,86,0.35)]">
            <Lock className="h-5 w-5" strokeWidth={2.4} />
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3 border-t border-[#EAF2E6] bg-[#F5FAF2] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold leading-tight text-gray-900">{title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{hint}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-[#D85A30] px-3 py-2 text-[12px] font-black text-white">
          Abrir
        </span>
      </div>
    </button>
  )
}

/**
 * Folha inferior de desbloqueio. Aparece ao tocar qualquer cadeado.
 *
 * Ela chega aqui porque QUIS abrir alguma coisa, então o texto nunca começa
 * vendendo: começa confirmando que aquilo já é dela e que só falta abrir.
 * O verbo é sempre "abrir/desbloquear", nunca "comprar" — a página inteira
 * está construída em cima da sensação de posse, e "comprar" a desfaz.
 */
export function UnlockSheet({
  open,
  onClose,
  headline,
  body,
  priceLine,
  localLine,
  ctaLabel,
  onCta,
  ctaLoading,
  ctaError,
  onSeeAll,
}: {
  open: boolean
  onClose: () => void
  headline: string
  body: string
  priceLine: string
  localLine?: string | null
  ctaLabel: string
  onCta: () => void
  ctaLoading?: boolean
  ctaError?: boolean
  onSeeAll: () => void
}) {
  // Trava o scroll do fundo enquanto a folha está aberta, senão o corpo da
  // página rola atrás dela e o gesto de fechar vira rolagem acidental.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div className="relative w-full max-w-2xl animate-[sheet-up_180ms_ease-out] rounded-t-3xl border-t border-[#D8E8D4] bg-white px-5 pb-7 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.22)]">
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-[#D8E8D4]" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-3">
          <p className="font-display text-[20px] font-black leading-tight text-gray-900 [text-wrap:balance]">
            {headline}
          </p>
          <p className="text-[13.5px] leading-relaxed text-gray-700">{body}</p>

          <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-center">
            <p className="text-[12px] text-gray-700">Un solo pago, sin suscripción:</p>
            <p className="text-[2rem] font-black leading-none text-primary tabular-nums">{priceLine}</p>
            {localLine && (
              <p className="mt-1 text-[12.5px] font-semibold text-gray-700">{localLine}</p>
            )}
          </div>

          {ctaError && (
            <p className="text-center text-xs text-red-600">
              Error al preparar el pedido. Recarga la página e intenta de nuevo.
            </p>
          )}

          <button
            type="button"
            onClick={onCta}
            disabled={ctaLoading}
            className={[
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
              'bg-[#D85A30] shadow-[0_4px_20px_0_rgba(216,90,48,0.38)] transition-all duration-150',
              'active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
            ].join(' ')}
          >
            {ctaLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                Procesando…
              </>
            ) : (
              ctaLabel
            )}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-gray-600">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            Garantía de 14 días. Si no te sirve, te devolvemos todo.
          </p>

          <button
            type="button"
            onClick={onSeeAll}
            className="w-full py-1 text-center text-[12.5px] font-bold text-primary underline underline-offset-2"
          >
            Continuar viendo mi Calibración Metabólica
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sheet-up {
          from { transform: translateY(14px); opacity: 0.6 }
          to   { transform: translateY(0);    opacity: 1   }
        }
      `}</style>
    </div>
  )
}
