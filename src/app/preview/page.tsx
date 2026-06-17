'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantenimiento',
  health_energy: 'Salud y energía',
  // quiz values
  perder_peso: 'Perder peso',
  mantener: 'Mantener peso',
  ganar_masa: 'Ganar músculo',
}

const ACTIVITY_LABEL: Record<string, string> = {
  sedentario: 'Sedentario',
  ligeramente_activo: 'Liger. activo',
  moderadamente_activo: 'Mod. activo',
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
      .then(d => { if (d.error) setError(true); else setData(d) })
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-2xl">😕</p>
          <p className="text-sm text-muted-foreground">No encontramos tu sesión. Vuelve al quiz.</p>
          <a href="/quiz/1" className="inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
            Reiniciar quiz
          </a>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4"
        style={{ background: 'linear-gradient(180deg, #E6F4DF 0px, #F5FAF2 100px, #F5FAF2 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">Cargando tu análisis…</p>
        </div>
      </main>
    )
  }

  const { profile, targets } = data
  const imc = profile.weightKg && profile.heightCm
    ? profile.weightKg / Math.pow(profile.heightCm / 100, 2)
    : null
  const delta = Math.abs(targets.tdee - targets.targetCalories)
  const totalKcal = targets.macros.proteinG * 4 + targets.macros.carbsG * 4 + targets.macros.fatG * 9 || 1

  return (
    <main
      className="flex min-h-screen flex-col items-center pb-32"
      style={{ background: 'linear-gradient(180deg, #D4EDCA 0px, #EBF6E4 80px, #F5FAF2 200px, #F5FAF2 100%)' }}
    >
      {/* Hero */}
      <div className="w-full max-w-lg px-4 pt-8 pb-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <span className="text-lg">🥗</span>
          <span className="font-bold text-primary text-sm tracking-wide">NutriPlan</span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          ✅ Tu plan personalizado está listo
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Aquí está tu análisis nutricional</h1>
        <p className="text-sm text-muted-foreground">
          Calculado exclusivamente para ti, basado en tus {' '}
          <span className="font-semibold text-primary">respuestas del quiz</span>.
        </p>
      </div>

      <div className="w-full max-w-lg px-4 space-y-4">

        {/* Cards de perfil */}
        <Card>
          <SectionLabel>Tu perfil</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <ProfileCard icon="🎂" label="Edad" value={profile.age ? `${profile.age} años` : '—'} />
            <ProfileCard icon="⚖️" label="Peso"   value={profile.weightKg ? `${profile.weightKg} kg` : '—'} />
            <ProfileCard icon="📏" label="Altura"  value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
            <ProfileCard icon="🧮" label="IMC"     value={imc ? imc.toFixed(1) : '—'} highlight />
            <ProfileCard icon="🎯" label="Objetivo" value={GOAL_LABEL[targets.goal] ?? targets.goal} />
            <ProfileCard icon="⚡" label="Actividad" value={ACTIVITY_LABEL[profile.activityLevel] ?? (profile.activityLevel || '—')} />
          </div>
        </Card>

        {/* Escala IMC */}
        {imc && (
          <Card>
            <div className="flex items-center justify-between">
              <SectionLabel>Tu IMC</SectionLabel>
              <ImcBadge imc={imc} />
            </div>
            <ImcScale imc={imc} />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Bajo peso</span><span>Normal</span><span>Sobrepeso</span><span>Obesidad</span>
            </div>
          </Card>
        )}

        {/* Metabolismo */}
        <Card>
          <SectionLabel>Tu metabolismo</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="TMB" sub="en reposo" value={targets.bmr} unit="kcal" />
            <MetricCard label="TDEE" sub="gasto diario" value={targets.tdee} unit="kcal" />
            <MetricCard label="Tu meta" sub="calorías/día" value={targets.targetCalories} unit="kcal" highlight />
          </div>

          {targets.goal === 'lose_fat' || targets.goal === 'perder_peso' ? (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
              Para <strong>perder grasa</strong>, tu plan tiene un déficit de{' '}
              <strong>{delta} kcal/día</strong> — equivale a ~{(Math.round(delta * 7 / 100) / 10).toFixed(1)} kg menos por semana.
            </div>
          ) : targets.goal === 'gain_muscle' || targets.goal === 'ganar_masa' ? (
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-900">
              Para <strong>ganar músculo</strong>, tu plan tiene un superávit de{' '}
              <strong>{delta} kcal/día</strong> sobre tu gasto diario.
            </div>
          ) : (
            <div className="rounded-xl bg-[#F0F8EC] border border-[#C8E4BC] px-4 py-3 text-sm text-[#2d6a2d]">
              Tu meta calórica está alineada con tu gasto para <strong>mantener tu peso</strong> de forma saludable.
            </div>
          )}
        </Card>

        {/* Donut de macros */}
        <Card>
          <SectionLabel>Distribución de macros</SectionLabel>
          <div className="flex items-center gap-6">
            <MacroDonut macros={targets.macros} />
            <div className="flex-1 space-y-2.5">
              <MacroRow color="#fb7185" label="Proteína"      value={`${targets.macros.proteinG}g`}
                pct={Math.round(targets.macros.proteinG * 4 / totalKcal * 100)} />
              <MacroRow color="#fbbf24" label="Carbohidratos" value={`${targets.macros.carbsG}g`}
                pct={Math.round(targets.macros.carbsG * 4 / totalKcal * 100)} />
              <MacroRow color="#60a5fa" label="Grasas"        value={`${targets.macros.fatG}g`}
                pct={Math.round(targets.macros.fatG * 9 / totalKcal * 100)} />
            </div>
          </div>
        </Card>

        {/* Seção bloqueada */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-white">
          {/* Conteúdo fake desfocado */}
          <div className="select-none blur-sm pointer-events-none p-5 space-y-3" aria-hidden>
            <p className="font-bold text-gray-800">Tu plan de 7 días</p>
            {['Lunes', 'Martes', 'Miércoles'].map(d => (
              <div key={d} className="rounded-xl border border-[#DDE8D8] p-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold">{d}</span>
                  <span className="text-muted-foreground">{targets.targetCalories} kcal</span>
                </div>
                <div className="space-y-1.5">
                  {[90, 75, 65].map((w, i) => (
                    <div key={i} className="h-2.5 rounded-full bg-[#D8EDD0]" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            style={{ background: 'linear-gradient(to bottom, rgba(245,250,242,0.7) 0%, rgba(245,250,242,0.95) 100%)' }}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md text-2xl border border-[#DDE8D8]">
              🔒
            </span>
            <div className="space-y-1">
              <p className="font-bold text-gray-900">Plan completo de 7 días</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Con porciones exactas · Lista de compras · Guía de implementación · Sustituciones
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {['🍳 Desayunos', '🥗 Almuerzos', '🍲 Cenas', '🍌 Snacks'].map(t => (
                <span key={t} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Testimonios rápidos */}
        <div className="rounded-2xl bg-white border border-[#DDE8D8] p-5 space-y-3">
          <p className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Lo que dicen quienes ya tienen su plan
          </p>
          {[
            { name: 'María G.', text: 'Bajé 4 kg en el primer mes siguiendo el plan al pie de la letra.', star: '⭐⭐⭐⭐⭐' },
            { name: 'Carlos M.', text: 'Por fin entendí cómo comer para ganar músculo sin pasar hambre.', star: '⭐⭐⭐⭐⭐' },
          ].map(({ name, text, star }) => (
            <div key={name} className="rounded-xl bg-[#F5FAF2] border border-[#DDE8D8] p-3 space-y-1">
              <p className="text-xs">{star}</p>
              <p className="text-sm text-gray-700 leading-relaxed">"{text}"</p>
              <p className="text-xs font-semibold text-primary">{name}</p>
            </div>
          ))}
        </div>

      </div>

      {/* CTA fixo */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#DDE8D8] bg-white/95 backdrop-blur-sm p-4 shadow-xl">
        <div className="mx-auto max-w-lg space-y-2">
          <button
            onClick={() => router.push('/checkout')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-white shadow-md hover:brightness-105 hover:shadow-lg transition-all"
          >
            Desbloquear mi plan completo
            <span className="opacity-70">→</span>
          </button>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>🔒 Pago seguro</span>
            <span>⚡ Acceso inmediato</span>
            <span>📧 Soporte incluido</span>
          </div>
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#DDE8D8] bg-white p-5 shadow-sm space-y-4">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</p>
  )
}

function ProfileCard({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={[
      'rounded-xl border p-3 text-center space-y-0.5',
      highlight ? 'border-primary/30 bg-primary/5' : 'border-[#DDE8D8] bg-[#FAFCF8]',
    ].join(' ')}>
      <p className="text-lg">{icon}</p>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xs font-bold leading-tight text-gray-800">{value}</p>
    </div>
  )
}

function ImcBadge({ imc }: { imc: number }) {
  const { label, cls } =
    imc < 18.5 ? { label: 'Bajo peso', cls: 'bg-blue-100 text-blue-700' }
    : imc < 25  ? { label: 'Normal',    cls: 'bg-green-100 text-green-700' }
    : imc < 30  ? { label: 'Sobrepeso', cls: 'bg-yellow-100 text-yellow-700' }
    :              { label: 'Obesidad',  cls: 'bg-red-100 text-red-700' }
  return (
    <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${cls}`}>
      {imc.toFixed(1)} · {label}
    </span>
  )
}

function ImcScale({ imc }: { imc: number }) {
  const pct = Math.max(2, Math.min(96, ((imc - 10) / 30) * 100))
  return (
    <div className="relative pt-5">
      <div
        className="absolute -translate-x-1/2 text-base leading-none text-primary"
        style={{ left: `${pct}%`, top: 0 }}
      >▼</div>
      <div
        className="h-3 rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(to right, #93c5fd 0%, #4ade80 30%, #fde047 60%, #f87171 100%)' }}
      />
    </div>
  )
}

function MetricCard({ label, sub, value, unit, highlight }: {
  label: string; sub: string; value: number; unit: string; highlight?: boolean
}) {
  return (
    <div className={[
      'rounded-xl border p-3 text-center',
      highlight ? 'border-primary bg-primary/5' : 'border-[#DDE8D8] bg-[#FAFCF8]',
    ].join(' ')}>
      <p className={['text-xs font-bold', highlight ? 'text-primary' : 'text-gray-700'].join(' ')}>{label}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground">{unit}</p>
    </div>
  )
}

function MacroDonut({ macros }: { macros: { proteinG: number; carbsG: number; fatG: number } }) {
  const r = 44, circ = 2 * Math.PI * r
  const pKcal = macros.proteinG * 4
  const cKcal = macros.carbsG * 4
  const fKcal = macros.fatG * 9
  const total = pKcal + cKcal + fKcal || 1
  const pLen = (pKcal / total) * circ
  const cLen = (cKcal / total) * circ
  const fLen = (fKcal / total) * circ
  return (
    <svg className="-rotate-90 shrink-0" width="108" height="108" viewBox="0 0 108 108">
      <circle cx="54" cy="54" r={r} fill="none" stroke="#E8F0E4" strokeWidth="13" />
      <circle cx="54" cy="54" r={r} fill="none" stroke="#fb7185" strokeWidth="13"
        strokeDasharray={`${pLen} ${circ}`} strokeDashoffset={circ} />
      <circle cx="54" cy="54" r={r} fill="none" stroke="#fbbf24" strokeWidth="13"
        strokeDasharray={`${cLen} ${circ}`} strokeDashoffset={circ - pLen} />
      <circle cx="54" cy="54" r={r} fill="none" stroke="#60a5fa" strokeWidth="13"
        strokeDasharray={`${fLen} ${circ}`} strokeDashoffset={circ - pLen - cLen} />
    </svg>
  )
}

function MacroRow({ color, label, value, pct }: { color: string; label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-bold text-gray-800">{value}</span>
      <span className="w-8 text-right text-[10px] text-muted-foreground">({pct}%)</span>
    </div>
  )
}
