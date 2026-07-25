// Primitivos visuais compartilhados entre as abas do painel (Mi Plan, Lista,
// Bonos, Entrenamiento, Perfil) — mesma linguagem visual do PDF de entrega.

export const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantenimiento',
  health_energy: 'Salud y energía',
}

export const ACTIVITY_LABEL: Record<string, string> = {
  sedentario: 'Sedentario',
  ligeramente_activo: 'Ligeramente activo',
  moderadamente_activo: 'Moderadamente activo',
  muy_activo: 'Muy activo',
}

export const SEX_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  male: 'Masculino',
  female: 'Femenino',
}

export const DOC_LABEL: Record<string, string> = {
  nutrition_plan: 'Plan nutricional (PDF)',
  training_plan: 'Plan de entrenamiento (PDF)',
  anti_celulitis: 'Guía anti-celulitis (PDF)',
  recipes: '28 recetas fitness (PDF)',
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export const WEEK_PHASES = [
  { label: 'Adaptación',    color: 'text-emerald-600' },
  { label: 'Calibración',   color: 'text-emerald-600' },
  { label: 'Aceleración',   color: 'text-amber-500'   },
  { label: 'Consolidación', color: 'text-rose-500'    },
]

export const MEAL_EMOJI: Record<string, string> = {
  Desayuno: '☀️',
  Almuerzo: '🍽️',
  Cena: '🌙',
  Snack: '🍎',
}

export const MACRO = {
  protein: { solid: '#C25E6B', chipBg: '#F6E6E9', chipText: '#A2434F' },
  carb:    { solid: '#C8952F', chipBg: '#F5EAD4', chipText: '#8A6416' },
  fat:     { solid: '#5286B0', chipBg: '#E5EEF5', chipText: '#3C6588' },
} as const

export interface Profile {
  age: number | null
  weightKg: number | null
  heightCm: number | null
  sex: string
  activityLevel: string
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-foreground">
      <span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
      {children}
    </h2>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  )
}

export function ProfileCard({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={['rounded-lg border p-3 text-center space-y-1', highlight ? 'border-primary/30 bg-primary/5' : ''].join(' ')}>
      <p className="text-xl">{icon}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  )
}

export function ImcBadge({ imc }: { imc: number }) {
  const { label, className } =
    imc < 18.5 ? { label: 'Bajo peso', className: 'bg-blue-100 text-blue-700' }
    : imc < 25  ? { label: 'Normal',    className: 'bg-green-100 text-green-700' }
    : imc < 30  ? { label: 'Sobrepeso', className: 'bg-yellow-100 text-yellow-700' }
    :              { label: 'Obesidad',  className: 'bg-red-100 text-red-700' }
  return (
    <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${className}`}>
      {imc.toFixed(1)} — {label}
    </span>
  )
}

export function ImcScale({ imc }: { imc: number }) {
  const pct = Math.max(2, Math.min(96, ((imc - 10) / (40 - 10)) * 100))
  return (
    <div className="relative pt-4">
      <div
        className="absolute -top-0 -translate-x-1/2 text-primary text-lg leading-none"
        style={{ left: `${pct}%` }}
      >▼</div>
      <div className="h-3 rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(to right, #60a5fa 0%, #4ade80 30%, #facc15 60%, #f87171 100%)' }} />
    </div>
  )
}

export function MacroDonut({ macros }: { macros: { proteinG: number; carbsG: number; fatG: number } }) {
  const r = 45
  const circ = 2 * Math.PI * r
  const pKcal = macros.proteinG * 4
  const cKcal = macros.carbsG * 4
  const fKcal = macros.fatG * 9
  const total = pKcal + cKcal + fKcal || 1
  const pLen = (pKcal / total) * circ
  const cLen = (cKcal / total) * circ
  const fLen = (fKcal / total) * circ

  return (
    <svg className="-rotate-90 shrink-0" width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={MACRO.protein.solid} strokeWidth="12"
        strokeDasharray={`${pLen} ${circ}`} strokeDashoffset={circ} strokeLinecap="butt" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={MACRO.carb.solid} strokeWidth="12"
        strokeDasharray={`${cLen} ${circ}`} strokeDashoffset={circ - pLen} strokeLinecap="butt" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={MACRO.fat.solid} strokeWidth="12"
        strokeDasharray={`${fLen} ${circ}`} strokeDashoffset={circ - pLen - cLen} strokeLinecap="butt" />
    </svg>
  )
}

export function MacroLegend({ color, label, value, pct }: { color: string; label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-medium">{value}</span>
      <span className="text-xs text-muted-foreground w-8 text-right">({pct}%)</span>
    </div>
  )
}

export function Metric({ label, value, unit, highlight, tooltip }: {
  label: string; value: string; unit: string; highlight?: boolean; tooltip?: string
}) {
  return (
    <div title={tooltip}
      className={['rounded-lg border p-3 text-center', highlight ? 'border-primary bg-primary/5' : ''].join(' ')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">
        {value}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

export function MetabolismExplain({ goal, tdee, target }: { goal: string; tdee: number; target: number }) {
  const delta = Math.abs(tdee - target)
  if (goal === 'lose_fat') return (
    <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
      Para <strong>perder grasa</strong>, tu plan tiene un déficit de{' '}
      <strong>{delta} kcal/día</strong> respecto a lo que tu cuerpo quema.
      Esto equivale a ~{Math.round((delta * 7) / 7700 * 10) / 10} kg menos por semana en condiciones ideales.
    </p>
  )
  if (goal === 'gain_muscle') return (
    <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900">
      Para <strong>ganar masa muscular</strong>, tu plan tiene un superávit de{' '}
      <strong>{delta} kcal/día</strong> sobre tu gasto diario.
      Suficiente para construir músculo sin acumular grasa en exceso.
    </p>
  )
  return (
    <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      Tu meta calórica está alineada con tu gasto diario para <strong>mantener tu peso</strong> actual.
    </p>
  )
}
