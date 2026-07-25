import { Sparkles, ChefHat, Download } from 'lucide-react'
import { SectionTitle } from '../dashboard-ui'

function BonusCard({
  Icon,
  title,
  description,
  href,
}: {
  Icon: typeof Sparkles
  title: string
  description: string
  href?: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#D8E8D4] bg-white shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="font-display text-[15px] font-bold text-foreground leading-tight">{title}</p>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
              Bono
            </span>
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 border-t border-[#EAF2E6] bg-[#F7FBF5] py-2.5 text-[13px] font-bold text-primary hover:bg-[#EEF6EA] transition-colors"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2.4} />
          Descargar PDF
        </a>
      )}
    </div>
  )
}

export function BonusTab({
  antiCelulitisHref,
  recipesHref,
}: {
  antiCelulitisHref?: string
  recipesHref?: string
}) {
  return (
    <div className="space-y-4">
      <SectionTitle>Tus bonos desbloqueados</SectionTitle>

      <BonusCard
        Icon={Sparkles}
        title="Guía anti-celulitis"
        description="Rutina complementaria de automasaje y hábitos para trabajar la piel mientras avanzas en tu plan."
        href={antiCelulitisHref}
      />

      {recipesHref && (
        <BonusCard
          Icon={ChefHat}
          title="28 recetas fitness"
          description="Un mes de recetas listas para variar tu plan sin salir de tus macros."
          href={recipesHref}
        />
      )}
    </div>
  )
}
