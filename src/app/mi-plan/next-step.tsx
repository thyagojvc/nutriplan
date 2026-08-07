'use client'

// =============================================================================
// A rota guiada entre as abas.
//
// PROBLEMA QUE ISTO RESOLVE: barra de abas é affordance fraca. A pessoa entra,
// lê a primeira tela até o fim, não registra que os ícones lá embaixo levam a
// outro lugar, e sai achando que viu o produto inteiro. Numa página de vendas
// isso não acontece porque só existe rolar; num app com abas, acontece o tempo
// todo.
//
// A correção não é gritar "olha a barra". É dar um PRÓXIMO PASSO no fim de cada
// aba, com o nome e o ícone da aba de destino, para que o cartão ensine a barra
// em vez de competir com ela. Ela toca o cartão, a aba muda, e na segunda vez
// ela já sabe que pode usar a barra direto.
//
// Peso visual de propósito baixo (contorno verde, não coral): o botão coral é
// sempre o de comprar, e dois botões fortes na mesma tela dividem o clique.
// =============================================================================

import { Heart, ClipboardList, Gift, Dumbbell, Unlock, ArrowRight, type LucideIcon } from 'lucide-react'
import type { TabId } from './tab-bar'

const NEXT: Partial<Record<TabId, { tab: TabId; label: string; teaser: string; Icon: LucideIcon }>> = {
  plan: {
    tab: 'resultados',
    label: 'Resultados',
    teaser: 'Mujeres que empezaron con el mismo plan que acabas de ver',
    Icon: Heart,
  },
  resultados: {
    tab: 'lista',
    label: 'Lista',
    teaser: 'Lo que tienes que comprar para tu Día 1, ya calculado',
    Icon: ClipboardList,
  },
  lista: {
    tab: 'bonos',
    label: 'Bonos',
    teaser: 'Los 7 atajos que aceleran tu Calibración',
    Icon: Gift,
  },
  bonos: {
    tab: 'entreno',
    label: 'Entreno',
    teaser: 'Tu rutina, armada con lo que respondiste',
    Icon: Dumbbell,
  },
  entreno: {
    tab: 'desbloquear',
    label: 'Abrir',
    teaser: 'Todo lo que viste bloqueado, de una sola vez',
    Icon: Unlock,
  },
}

export function NextStepCard({ from, onGo }: { from: TabId; onGo: (tab: TabId) => void }) {
  const next = NEXT[from]
  if (!next) return null
  const { tab, label, teaser, Icon } = next

  return (
    <button
      type="button"
      onClick={() => onGo(tab)}
      className="mt-6 flex w-full items-center gap-3 rounded-2xl border-2 border-primary/30 bg-white p-4 text-left shadow-[0_4px_18px_rgba(15,110,86,0.07)] transition-transform active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Siguiente
        </span>
        <span className="block font-display text-[16px] font-black leading-tight text-gray-900">
          {label}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{teaser}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.6} />
    </button>
  )
}
