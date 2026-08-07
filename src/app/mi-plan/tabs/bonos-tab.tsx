'use client'

// =============================================================================
// Aba "Bonos" — os 7 atajos + os bônus que acompanham o plano.
//
// REGRA DURA (decisão de 04/08, ver offer_calibracion_is_product): antes da
// compra os 7 atajos NÃO aparecem como sumário. Listar os sete com nome e
// explicação foi o que fez 130 pessoas lerem tudo e não comprarem: quem
// entende o método inteiro de graça não precisa comprá-lo.
//
// O que fica visível aqui é só a ESTRUTURA, nunca o conteúdo:
//   · o atajo 1 (Candado) aberto, porque ela já o recebeu no Día 1;
//   · o momento do dia de cada um (não entrega mecanismo nenhum, e é o que
//     faz ela pensar "tem um pra noite? qual?");
//   · a chía do atajo 3, único ingrediente revelado de propósito — prova que
//     existe conhecimento real por trás, mantendo o resto trancado.
// O nome dos outros seis vem borrado. É forma sem conteúdo, que é exatamente
// o que abre curiosidade em vez de fechá-la.
// =============================================================================

import { Sparkles, CalendarDays, Lock } from 'lucide-react'
import { COMBOS } from '@/lib/nutrition/combos'
import { SectionTitle } from '@/app/(dashboard)/dashboard/dashboard-ui'
import { LockChip } from '../lock-ui'

export function BonosTab({ onUnlock }: { onUnlock: (id: string) => void }) {
  const [first, ...rest] = COMBOS

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5">
        <p className="font-display text-[18px] font-black leading-tight text-gray-900 [text-wrap:balance]">
          Los 7 atajos que aceleran tu Calibración
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-700">
          Reglas de diez segundos que se aplican sobre el plan que ya tienes. No agregan tiempo
          de cocina, no cambian tus comidas. Cambian el resultado de las mismas.
        </p>
        <p className="mt-2 text-[12px] font-bold text-primary">
          Tienes 1 de 7. Los otros 6 vienen con tu plan.
        </p>
      </div>

      <section className="space-y-3">
        <SectionTitle>Tu atajo abierto</SectionTitle>
        <div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-white shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <div className="flex items-center gap-3 border-b border-[#EAF2E6] bg-primary/5 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
              {first.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                Atajo 1 de 7 · {first.moment}
              </p>
              <p className="font-display text-[16px] font-black leading-tight text-gray-900">
                {first.name}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              Abierto
            </span>
          </div>
          <div className="space-y-2 p-4">
            <p className="text-[13.5px] font-bold text-gray-900">{first.tagline}</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{first.action}</p>
            <p className="text-[12px] leading-snug text-primary">
              Está aplicado en tu Día 1. Puedes hacerlo esta misma noche.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Los otros 6</SectionTitle>
        <div className="space-y-2.5">
          {rest.map((combo, i) => (
            <button
              key={combo.id}
              type="button"
              onClick={() => onUnlock(`atajo_${combo.n}`)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#D8E8D4] bg-white p-3.5 text-left shadow-[0_2px_10px_rgba(15,110,86,0.05)] transition-transform active:scale-[0.99]"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
                <span className="opacity-40">{combo.emoji}</span>
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                  <Lock className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Atajo {i + 2} de 7 · {combo.moment}
                </p>
                <p
                  aria-hidden
                  className="select-none font-display text-[16px] font-black leading-tight text-gray-400"
                  style={{ filter: 'blur(5px)' }}
                >
                  {combo.name}
                </p>
                {/* O único ingrediente revelado de todo o método. Existe pra
                    provar que há conhecimento real por trás dos cadeados. */}
                {combo.revealedIngredient && (
                  <p className="mt-1 text-[12px] leading-snug text-primary">
                    {combo.revealedIngredient.emoji} Uno de sus ingredientes es{' '}
                    <strong className="font-bold">{combo.revealedIngredient.name}</strong>. Los demás siguen bloqueados.
                  </p>
                )}
              </div>
              <LockChip />
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Además, incluidos</SectionTitle>

        <button
          type="button"
          onClick={() => onUnlock('bono_anticelulitis')}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#D85A30]/35 bg-[#FDF6F3] p-4 text-left transition-transform active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D85A30]/10 text-[#D85A30]">
            <Sparkles className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-bold text-gray-900">Guía Anti-Celulitis</p>
              <span className="rounded-full bg-[#D85A30] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                Gratis
              </span>
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              Lo que sí funciona sobre la piel mientras la grasa baja.
            </p>
          </div>
          <LockChip />
        </button>

        <button
          type="button"
          onClick={() => onUnlock('bono_calendario')}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#D85A30]/35 bg-[#FDF6F3] p-4 text-left transition-transform active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D85A30]/10 text-[#D85A30]">
            <CalendarDays className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-bold text-gray-900">Tu calendario de constancia</p>
              <span className="rounded-full bg-[#D85A30] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                Gratis
              </span>
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              Marcas cada día que cumples. Es lo que sostiene la semana 2, donde las dietas se caen.
            </p>
          </div>
          <LockChip />
        </button>
      </section>
    </div>
  )
}
