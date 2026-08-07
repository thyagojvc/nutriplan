'use client'

// =============================================================================
// Barra inferior do /mi-plan.
//
// É a peça que faz a página parecer app e não página de vendas: barra fixa,
// ícone + rótulo, troca instantânea sem recarregar. Cinco abas existem desde o
// primeiro segundo; a sexta ("Desbloquear") entra depois, com animação, e é a
// única com cor de destaque — quando ela aparece, aparece como novidade.
// =============================================================================

import { Utensils, Heart, ClipboardList, Gift, Dumbbell, Unlock } from 'lucide-react'

export type TabId = 'plan' | 'resultados' | 'lista' | 'bonos' | 'entreno' | 'desbloquear'

// Rótulos curtos por medição, não por gosto: com 6 abas em 375px cada uma fica
// com ~62px, e a 9px de fonte qualquer palavra acima de 7 caracteres entra em
// reticências ("Desbloquear" media 65px e cortava). O nome longo de cada aba
// não se perde: aparece inteiro no cabeçalho quando ela está aberta
// (ver TAB_TITLE em mi-plan-app).
const TABS: { id: TabId; label: string; Icon: typeof Utensils }[] = [
  { id: 'plan',        label: 'Calibra', Icon: Utensils },
  { id: 'resultados',  label: 'Ellas',   Icon: Heart },
  { id: 'lista',       label: 'Lista',   Icon: ClipboardList },
  { id: 'bonos',       label: 'Bonos',   Icon: Gift },
  { id: 'entreno',     label: 'Entreno', Icon: Dumbbell },
  { id: 'desbloquear', label: 'Abrir',   Icon: Unlock },
]

export function MiPlanTabBar({
  active,
  onChange,
  showUnlock,
  pulseUnlock,
}: {
  active: TabId
  onChange: (id: TabId) => void
  /** A aba de oferta só entra depois que ela viu o plano (ver o gate em mi-plan-app). */
  showUnlock: boolean
  /** Ponto coral no ícone enquanto ela ainda não abriu a aba nova. */
  pulseUnlock: boolean
}) {
  const visible = TABS.filter((t) => t.id !== 'desbloquear' || showUnlock)

  // overflow-hidden na barra: com 6 abas em flex-1 o arredondamento subpixel
  // somava 1px a mais que a viewport e o corpo da página ganhava scroll lateral.
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t border-[#D8E8D4] bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-between">
        {visible.map(({ id, label, Icon }) => {
          const isActive = id === active
          const isUnlockTab = id === 'desbloquear'
          const tint = isUnlockTab
            ? 'text-[#D85A30]'
            : isActive
              ? 'text-primary'
              : 'text-muted-foreground'

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors',
                isUnlockTab ? 'animate-[tab-in_260ms_ease-out]' : '',
              ].join(' ')}
            >
              <span className="relative">
                <Icon className={`h-[18px] w-[18px] ${tint}`} strokeWidth={isActive ? 2.5 : 2} />
                {isUnlockTab && pulseUnlock && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-[#D85A30]" />
                )}
              </span>
              <span className={`w-full truncate px-0.5 text-center text-[9px] font-bold leading-none ${tint}`}>
                {label}
              </span>
              {isActive && (
                <span
                  aria-hidden
                  className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full ${isUnlockTab ? 'bg-[#D85A30]' : 'bg-primary'}`}
                />
              )}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes tab-in {
          from { transform: scale(0.7); opacity: 0 }
          to   { transform: scale(1);   opacity: 1 }
        }
      `}</style>
    </nav>
  )
}
