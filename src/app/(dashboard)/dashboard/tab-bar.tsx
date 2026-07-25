'use client'

import { Utensils, ClipboardList, Gift, Dumbbell, User } from 'lucide-react'

export type TabId = 'plan' | 'lista' | 'bonos' | 'entrenamiento' | 'perfil'

const TABS: { id: TabId; label: string; Icon: typeof Utensils }[] = [
  { id: 'plan', label: 'Mi Plan', Icon: Utensils },
  { id: 'lista', label: 'Lista', Icon: ClipboardList },
  { id: 'bonos', label: 'Bonos', Icon: Gift },
  { id: 'entrenamiento', label: 'Entreno', Icon: Dumbbell },
  { id: 'perfil', label: 'Perfil', Icon: User },
]

// Barra inferior fixa, estilo app nativo. showTrainingBadge chama atenção
// pra quem ainda não comprou o bump de entrenamiento (upsell sutil, não intrusivo).
export function TabBar({
  active,
  onChange,
  showTrainingBadge,
}: {
  active: TabId
  onChange: (id: TabId) => void
  showTrainingBadge?: boolean
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D8E8D4] bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-between px-1">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors"
            >
              <span className="relative">
                <Icon
                  className={isActive ? 'h-5 w-5 text-primary' : 'h-5 w-5 text-muted-foreground'}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                {id === 'entrenamiento' && showTrainingBadge && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#D85A30]" />
                )}
              </span>
              <span
                className={[
                  'text-[10px] font-semibold leading-none',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                ].join(' ')}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
