'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantenimiento',
  health_energy: 'Salud y energía',
}

const ACTIVITY_LABEL: Record<string, string> = {
  sedentario: 'Sedentario',
  ligeramente_activo: 'Ligeramente activo',
  moderadamente_activo: 'Moderadamente activo',
  muy_activo: 'Muy activo',
}

interface PreviewData {
  profile: {
    age: number | null
    weightKg: number | null
    heightCm: number | null
    sex: string
    activityLevel: string
  }
  targets: {
    bmr: number
    tdee: number
    targetCalories: number
    goal: string
    macros: { proteinG: number; carbsG: number; fatG: number }
  }
}

export default function PreviewPage() {
  const router = useRouter()
  const [data, setData] = useState<PreviewData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/quiz/preview-data')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(true)
        else setData(d)
      })
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-muted-foreground text-sm">No encontramos tu sesión. Vuelve al quiz.</p>
          <a href="/quiz/1" className="inline-block underline text-sm">Reiniciar quiz</a>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </main>
    )
  }

  const { profile, targets } = data
  const imc = profile.weightKg && profile.heightCm
    ? profile.weightKg / Math.pow(profile.heightCm / 100, 2)
    : null

  const delta = Math.abs(targets.tdee - targets.targetCalories)

  return (
    <main className="flex min-h-screen flex-col items-center p-4 pb-32">
      <div className="w-full max-w-lg space-y-6 pt-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Tu plan está listo</h1>
          <p className="text-sm text-muted-foreground">
            Calculado según tus respuestas. Aquí está tu perfil nutricional personalizado.
          </p>
        </div>

        {/* Cards de perfil */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tu perfil</h2>
          <div className="grid grid-cols-3 gap-2">
            <ProfileCard icon="🧑" label="Edad" value={profile.age ? `${profile.age} años` : '—'} />
            <ProfileCard icon="⚖️" label="Peso" value={profile.weightKg ? `${profile.weightKg} kg` : '—'} />
            <ProfileCard icon="📏" label="Altura" value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
            <ProfileCard icon="🧮" label="IMC" value={imc ? imc.toFixed(1) : '—'} highlight />
            <ProfileCard icon="🎯" label="Objetivo" value={GOAL_LABEL[targets.goal] ?? targets.goal} />
            <ProfileCard icon="⚡" label="Actividad" value={ACTIVITY_LABEL[profile.activityLevel] ?? (profile.activityLevel || '—')} />
          </div>
        </section>

        {/* Escala IMC */}
        {imc && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tu IMC</h2>
              <ImcBadge imc={imc} />
            </div>
            <ImcScale imc={imc} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>&lt;18.5</span><span>18.5–25</span><span>25–30</span><span>&gt;30</span>
            </div>
          </section>
        )}

        {/* Metabolismo */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tu metabolismo</h2>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="TMB (reposo)" value={`${targets.bmr}`} unit="kcal"
              tooltip="Calorías que tu cuerpo necesita en reposo absoluto" />
            <Metric label="Gasto diario" value={`${targets.tdee}`} unit="kcal"
              tooltip="Lo que quemas con tu nivel de actividad" />
            <Metric label="Tu meta" value={`${targets.targetCalories}`} unit="kcal" highlight />
          </div>

          {targets.goal === 'lose_fat' && (
            <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Para <strong>perder grasa</strong>, tu plan tiene un déficit de{' '}
              <strong>{delta} kcal/día</strong>. Equivale a ~{Math.round(delta * 7 / 100) / 10} kg menos por semana.
            </p>
          )}
          {targets.goal === 'gain_muscle' && (
            <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900">
              Para <strong>ganar músculo</strong>, tu plan tiene un superávit de{' '}
              <strong>{delta} kcal/día</strong> sobre tu gasto diario.
            </p>
          )}
          {(targets.goal === 'maintain' || targets.goal === 'health_energy') && (
            <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              Tu meta calórica está alineada con tu gasto diario para <strong>mantener tu peso</strong>.
            </p>
          )}
        </section>

        {/* Donut de macros */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Distribución de macros</h2>
          <div className="flex items-center gap-6">
            <MacroDonut macros={targets.macros} />
            <div className="space-y-2 flex-1">
              <MacroLegend color="bg-rose-400" label="Proteína"
                value={`${targets.macros.proteinG}g`}
                pct={Math.round(targets.macros.proteinG * 4 / (targets.macros.proteinG * 4 + targets.macros.carbsG * 4 + targets.macros.fatG * 9) * 100)} />
              <MacroLegend color="bg-amber-400" label="Carbohidratos"
                value={`${targets.macros.carbsG}g`}
                pct={Math.round(targets.macros.carbsG * 4 / (targets.macros.proteinG * 4 + targets.macros.carbsG * 4 + targets.macros.fatG * 9) * 100)} />
              <MacroLegend color="bg-blue-400" label="Grasas"
                value={`${targets.macros.fatG}g`}
                pct={Math.round(targets.macros.fatG * 9 / (targets.macros.proteinG * 4 + targets.macros.carbsG * 4 + targets.macros.fatG * 9) * 100)} />
            </div>
          </div>
        </section>

        {/* Bloqueio — plano completo */}
        <section className="relative rounded-xl border-2 border-dashed border-primary/30 overflow-hidden">
          <div className="p-5 space-y-3 blur-sm select-none pointer-events-none" aria-hidden>
            <h2 className="font-semibold">Tu plan de 7 días</h2>
            {['Desayuno', 'Almuerzo', 'Cena'].map(m => (
              <div key={m} className="rounded-lg border p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{m}</span>
                  <span className="text-muted-foreground">??? kcal</span>
                </div>
                <div className="mt-1 space-y-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-3 rounded bg-muted w-full" style={{ width: `${60 + i * 10}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-[2px] gap-3 p-4">
            <p className="text-2xl">🔒</p>
            <p className="text-center text-sm font-semibold">Plan completo de 7 días con porciones exactas</p>
            <p className="text-center text-xs text-muted-foreground">Lista de compras · Guía de implementación · Sustituciones</p>
          </div>
        </section>

      </div>

      {/* CTA fixo na base */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4 shadow-lg">
        <div className="mx-auto max-w-lg space-y-2">
          <button
            onClick={() => router.push('/checkout')}
            className="w-full rounded-md bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-opacity"
          >
            Ver mi plan completo →
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Acceso inmediato · Pago 100% seguro
          </p>
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Componentes reutilizados
// ---------------------------------------------------------------------------

function ProfileCard({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={['rounded-lg border p-3 text-center space-y-1', highlight ? 'border-primary/30 bg-primary/5' : ''].join(' ')}>
      <p className="text-xl">{icon}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  )
}

function ImcBadge({ imc }: { imc: number }) {
  const { label, className } =
    imc < 18.5 ? { label: 'Bajo peso', className: 'bg-blue-100 text-blue-700' }
    : imc < 25  ? { label: 'Normal',    className: 'bg-green-100 text-green-700' }
    : imc < 30  ? { label: 'Sobrepeso', className: 'bg-yellow-100 text-yellow-700' }
    :              { label: 'Obesidad',  className: 'bg-red-100 text-red-700' }
  return <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${className}`}>{imc.toFixed(1)} — {label}</span>
}

function ImcScale({ imc }: { imc: number }) {
  const pct = Math.max(2, Math.min(96, ((imc - 10) / (40 - 10)) * 100))
  return (
    <div className="relative pt-4">
      <div className="absolute -top-0 -translate-x-1/2 text-primary text-lg leading-none" style={{ left: `${pct}%` }}>▼</div>
      <div className="h-3 rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(to right, #60a5fa 0%, #4ade80 30%, #facc15 60%, #f87171 100%)' }} />
    </div>
  )
}

function Metric({ label, value, unit, highlight, tooltip }: { label: string; value: string; unit: string; highlight?: boolean; tooltip?: string }) {
  return (
    <div title={tooltip} className={['rounded-lg border p-3 text-center', highlight ? 'border-primary bg-primary/5' : ''].join(' ')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span></p>
    </div>
  )
}

function MacroDonut({ macros }: { macros: { proteinG: number; carbsG: number; fatG: number } }) {
  const r = 45, circ = 2 * Math.PI * r
  const pKcal = macros.proteinG * 4, cKcal = macros.carbsG * 4, fKcal = macros.fatG * 9
  const total = pKcal + cKcal + fKcal || 1
  const pLen = (pKcal / total) * circ, cLen = (cKcal / total) * circ, fLen = (fKcal / total) * circ
  return (
    <svg className="-rotate-90 shrink-0" width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="#fb7185" strokeWidth="12"
        strokeDasharray={`${pLen} ${circ}`} strokeDashoffset={circ} strokeLinecap="butt" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="#fbbf24" strokeWidth="12"
        strokeDasharray={`${cLen} ${circ}`} strokeDashoffset={circ - pLen} strokeLinecap="butt" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="#60a5fa" strokeWidth="12"
        strokeDasharray={`${fLen} ${circ}`} strokeDashoffset={circ - pLen - cLen} strokeLinecap="butt" />
    </svg>
  )
}

function MacroLegend({ color, label, value, pct }: { color: string; label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`h-3 w-3 rounded-full shrink-0 ${color}`} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-medium">{value}</span>
      <span className="text-xs text-muted-foreground w-8 text-right">({pct}%)</span>
    </div>
  )
}
