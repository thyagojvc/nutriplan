'use client'

// =============================================================================
// Aba "Lista" — lista de compras, guia de implementação e substituições.
//
// A lista do Día 1 vem aberta porque ela de fato TEM o Día 1: prometer o dia e
// esconder o que precisa comprar pra executá-lo seria uma entrega pela metade,
// e entrega pela metade destrói exatamente a confiança que esta página existe
// pra construir. A lista da semana inteira (o bônus que ela compra) fica atrás
// do cadeado, com o conteúdo real borrado por baixo.
// =============================================================================

import type { NutritionPlanJson } from '@/lib/nutrition/types'
import { ShoppingCart, Check } from 'lucide-react'
import { SectionTitle } from '@/app/(dashboard)/dashboard/dashboard-ui'
import { LockedBlock } from '../lock-ui'

export function ListaTab({
  plan,
  onUnlock,
}: {
  plan: NutritionPlanJson
  onUnlock: (id: string) => void
}) {
  // O que ela precisa comprar pra executar o dia que já é dela. Sai do próprio
  // Día 1, então nunca promete um ingrediente que o dia não use.
  const day1Foods = Array.from(
    new Set(plan.days[0].meals.flatMap((m) => m.items.map((i) => i.food))),
  )

  const totalItems = plan.shoppingList.reduce((acc, c) => acc + c.items.length, 0)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle>Para tu Día 1</SectionTitle>
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary">
            <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.6} />
            Abierto · {day1Foods.length} ingredientes
          </p>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {day1Foods.map((food) => (
              <li key={food} className="flex items-start gap-1.5 text-[13px] text-gray-800">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" strokeWidth={3} />
                <span className="min-w-0 flex-1">{food}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
            Nada raro, nada de tienda especializada. Es lo que ya compras.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Tu lista de la semana</SectionTitle>
        <LockedBlock
          id="lista_semana"
          title={`${totalItems} ingredientes, organizados por pasillo del súper`}
          hint="Vas una vez, sale todo. Sin volver a mitad de semana por lo que faltó."
          onUnlock={onUnlock}
        >
          <div className="space-y-3 p-4">
            {plan.shoppingList.map((cat, i) => (
              <div key={i}>
                <p className="text-sm font-medium">{cat.category}</p>
                <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                  {cat.items.map((it, j) => <li key={j}>{it.name}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </LockedBlock>
      </section>

      <section className="space-y-3">
        <SectionTitle>Cómo empezar</SectionTitle>
        <LockedBlock
          id="guia_implementacion"
          title="Tu guía de arranque, paso por paso"
          hint="Qué hacer el primer día, el primer fin de semana y cuando se te desarma la rutina."
          onUnlock={onUnlock}
        >
          <div className="p-4">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              {plan.implementationGuide.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        </LockedBlock>
      </section>

      {plan.substitutions.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Si te falta algo</SectionTitle>
          <LockedBlock
            id="sustituciones"
            title={`${plan.substitutions.length} sustituciones listas`}
            hint="Cuando no encuentras un ingrediente, ya sabes por cuál cambiarlo sin romper tus macros."
            onUnlock={onUnlock}
          >
            <div className="p-4">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {plan.substitutions.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{s.food}</span> → {s.alternatives.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </LockedBlock>
        </section>
      )}
    </div>
  )
}
