'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NutriLogo, NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantenimiento',
  health_energy: 'Salud y energía',
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

type ErrorKind = 'no_session' | 'calc_failed' | 'network'

export default function PreviewPage() {
  const router = useRouter()
  const [data, setData] = useState<PreviewData | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)

  useEffect(() => {
    function buildDraftFromSession(): { draft: Record<string, unknown>; country: string } | null {
      try {
        const draft: Record<string, unknown> = {}
        let hasStep5 = false
        let hasStep6 = false
        for (let n = 1; n <= 10; n++) {
          const raw = sessionStorage.getItem(`nutriplan_step_${n}`)
          if (!raw) continue
          draft[`step_${n}`] = JSON.parse(raw)
          if (n === 5) hasStep5 = true
          if (n === 6) hasStep6 = true
        }
        if (!hasStep5 || !hasStep6) return null

        let country = 'OTHER'
        const step7Raw = sessionStorage.getItem('nutriplan_step_7')
        if (step7Raw) {
          const s7 = JSON.parse(step7Raw) as { country?: string }
          if (s7.country) country = s7.country
        }
        return { draft, country }
      } catch {
        return null
      }
    }

    const local = buildDraftFromSession()

    if (!local) {
      // sessionStorage vazio → tenta fallback via cookie+banco
      fetch('/api/quiz/preview-data')
        .then(r => r.json())
        .then(d => { if (d.error) setErrorKind('no_session'); else setData(d) })
        .catch(() => setErrorKind('network'))
      return
    }

    fetch('/api/quiz/preview-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_answers: local.draft, country: local.country }),
    })
      .then(r => r.json())
      .then(d => {
        if (!d.error) { setData(d); return }
        if (d.error === 'calc_failed') { setErrorKind('calc_failed'); return }
        // outro erro no POST → tenta GET como último recurso
        return fetch('/api/quiz/preview-data')
          .then(r => r.json())
          .then(d2 => { if (d2.error) setErrorKind('no_session'); else setData(d2) })
      })
      .catch(() => setErrorKind('network'))
  }, [])

  if (errorKind) {
    const msgs: Record<ErrorKind, { emoji: string; title: string; body: string }> = {
      no_session: {
        emoji: '😕',
        title: 'No encontramos tu sesión',
        body: 'Parece que el quiz fue completado en otro dispositivo o la sesión expiró. Vuelve al quiz para continuar.',
      },
      calc_failed: {
        emoji: '⚠️',
        title: 'Error al calcular tu perfil',
        body: 'Tus respuestas están guardadas pero no pudimos generar el análisis. Intenta de nuevo o vuelve al quiz.',
      },
      network: {
        emoji: '📡',
        title: 'Error de conexión',
        body: 'No se pudo cargar tu análisis. Verifica tu conexión a internet e intenta de nuevo.',
      },
    }
    const { emoji, title, body } = msgs[errorKind]
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-20 text-center px-6">
          <p className="text-3xl">{emoji}</p>
          <p className="font-bold text-gray-800">{title}</p>
          <p className="text-sm text-muted-foreground max-w-xs">{body}</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {errorKind !== 'no_session' && (
              <button
                onClick={() => { setErrorKind(null); window.location.reload() }}
                className="inline-flex items-center gap-2 rounded-xl border border-primary px-5 py-3 text-sm font-bold text-primary"
              >
                Intentar de nuevo
              </button>
            )}
            <a href="/quiz/1" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
              Volver al quiz →
            </a>
          </div>
        </div>
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">Cargando tu análisis…</p>
        </div>
      </PageShell>
    )
  }

  const { profile, targets } = data
  const imc = profile.weightKg && profile.heightCm
    ? profile.weightKg / Math.pow(profile.heightCm / 100, 2)
    : null
  const delta = Math.abs(targets.tdee - targets.targetCalories)
  const totalKcal = targets.macros.proteinG * 4 + targets.macros.carbsG * 4 + targets.macros.fatG * 9 || 1
  const isLoss = targets.goal === 'lose_fat' || targets.goal === 'perder_peso'
  const isGain = targets.goal === 'gain_muscle' || targets.goal === 'ganar_masa'

  return (
    <PageShell>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-4 pt-6 pb-5 text-center space-y-3">
        {/* Badge de conclusão */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1 text-xs font-semibold text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Análisis listo · Solo para ti
        </div>

        <h1 className="text-2xl font-black leading-tight text-gray-900">
          Tu plan nutricional<br />
          <span className="text-primary">está calculado</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          Basado en tus respuestas, creamos un perfil nutricional único.
          Revísalo antes de desbloquearlo.
        </p>
      </div>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-4 pb-32 space-y-3">

        {/* Perfil */}
        <Card label="Tu perfil">
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon="🎂" label="Edad"      value={profile.age ? `${profile.age} años` : '—'} />
            <StatCard icon="⚖️" label="Peso"      value={profile.weightKg ? `${profile.weightKg} kg` : '—'} />
            <StatCard icon="📏" label="Altura"    value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
            <StatCard icon="🧮" label="IMC"       value={imc ? imc.toFixed(1) : '—'} accent />
            <StatCard icon="🎯" label="Objetivo"  value={GOAL_LABEL[targets.goal] ?? targets.goal} />
            <StatCard icon="⚡" label="Actividad" value={ACTIVITY_LABEL[profile.activityLevel] ?? (profile.activityLevel || '—')} />
          </div>
        </Card>

        {/* IMC */}
        {imc && (
          <Card label="Tu IMC" badge={<ImcBadge imc={imc} />}>
            <ImcScale imc={imc} />
            <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-1">
              <span>Bajo peso</span><span>Normal</span><span>Sobrepeso</span><span>Obesidad</span>
            </div>
          </Card>
        )}

        {/* Metabolismo */}
        <Card label="Tu metabolismo">
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="TMB"  sub="en reposo"    value={targets.bmr}            />
            <MetricCard label="TDEE" sub="gasto diario" value={targets.tdee}           />
            <MetricCard label="Meta" sub="kcal/día"     value={targets.targetCalories} accent />
          </div>

          <div className={[
            'rounded-xl border px-4 py-3 text-sm leading-relaxed',
            isLoss ? 'border-blue-100 bg-blue-50 text-blue-900'
            : isGain ? 'border-green-100 bg-green-50 text-green-900'
            : 'border-[#D4E8D0] bg-[#EBF6E4] text-[#1e4d2e]',
          ].join(' ')}>
            {isLoss && (
              <>Tu plan tiene un <strong>déficit de {delta} kcal/día</strong> — equivale a ~{(Math.round(delta * 7 / 100) / 10).toFixed(1)} kg menos por semana.</>
            )}
            {isGain && (
              <>Tu plan tiene un <strong>superávit de {delta} kcal/día</strong> sobre tu gasto diario para construir músculo.</>
            )}
            {!isLoss && !isGain && (
              <>Tu meta calórica está alineada con tu gasto para <strong>mantener tu peso</strong> de forma saludable.</>
            )}
          </div>
        </Card>

        {/* Macros */}
        <Card label="Distribución de macronutrientes">
          <div className="flex items-center gap-5">
            <MacroDonut macros={targets.macros} />
            <div className="flex-1 space-y-2.5">
              <MacroRow color="#fb7185" label="Proteína"      g={targets.macros.proteinG} kcalPerG={4} total={totalKcal} />
              <MacroRow color="#fbbf24" label="Carbohidratos" g={targets.macros.carbsG}   kcalPerG={4} total={totalKcal} />
              <MacroRow color="#60a5fa" label="Grasas"        g={targets.macros.fatG}     kcalPerG={9} total={totalKcal} />
            </div>
          </div>
        </Card>

        {/* Plano bloqueado */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/25 bg-white">
          {/* Conteúdo fake desfocado */}
          <div className="select-none blur-[3px] pointer-events-none p-5 space-y-3 opacity-60" aria-hidden>
            <p className="font-bold text-gray-800 text-sm">Tu plan de 7 días</p>
            {['Lunes', 'Martes', 'Miércoles'].map(d => (
              <div key={d} className="rounded-xl border border-[#D8E8D4] p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">{d}</span>
                  <span className="text-muted-foreground">{targets.targetCalories} kcal</span>
                </div>
                <div className="space-y-1.5">
                  {[88, 72, 60].map((w, i) => (
                    <div key={i} className="h-2 rounded-full bg-primary/20" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Overlay com conteúdo */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
            style={{ background: 'linear-gradient(to bottom, rgba(235,246,228,0.65) 0%, rgba(245,250,242,0.96) 50%)' }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D8E8D4] bg-white shadow-sm">
              <NutriLogo size={28} />
            </div>
            <div className="space-y-1.5">
              <p className="font-black text-gray-900">Plan completo de 7 días</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                Porciones exactas · Lista de compras · Guía de implementación
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {['🍳 Desayunos', '🥗 Almuerzos', '🍲 Cenas', '🍌 Snacks'].map(t => (
                <span key={t} className="rounded-full border border-primary/20 bg-primary/8 px-3 py-0.5 text-xs font-semibold text-primary">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3">
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Lo que dicen nuestros usuarios
          </p>
          {[
            { name: 'María G.', country: '🇲🇽', text: 'Bajé 4 kg en el primer mes siguiendo el plan al pie de la letra.' },
            { name: 'Carlos M.', country: '🇨🇴', text: 'Por fin entendí cómo comer para ganar músculo sin pasar hambre.' },
          ].map(({ name, country, text }) => (
            <div key={name} className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-3.5 space-y-1.5">
              <div className="flex items-center gap-1">
                {'⭐⭐⭐⭐⭐'.split('').map((s, i) => <span key={i} className="text-xs">{s}</span>)}
              </div>
              <p className="text-sm leading-relaxed text-gray-700">"{text}"</p>
              <p className="text-xs font-bold text-primary">{country} {name}</p>
            </div>
          ))}
        </div>

      </div>

      {/* ── CTA fixo ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#D8E8D4] bg-white/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="mx-auto max-w-lg space-y-2">
          <button
            onClick={() => router.push('/checkout')}
            className={[
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
              'bg-primary shadow-[0_4px_20px_0_rgba(0,0,0,0.18)] transition-all duration-150',
              'hover:shadow-[0_6px_28px_0_rgba(0,0,0,0.22)] hover:brightness-[1.04] active:scale-[0.99]',
            ].join(' ')}
          >
            Desbloquear mi plan completo
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-80">
              <path d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span>🔒</span> Pago seguro</span>
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1"><span>⚡</span> Acceso inmediato</span>
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1"><span>📧</span> Soporte incluido</span>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// Shell da página com header de marca
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(148,28%,95%) 90px, hsl(80,18%,97%) 220px)',
      }}
    >
      {/* Header fixo com marca */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/85 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      <div className="flex flex-col items-center">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componentes internos
// ---------------------------------------------------------------------------

function Card({
  label,
  badge,
  children,
}: {
  label: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#EAF2E6] px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        {badge}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className={[
      'rounded-xl border p-3 text-center',
      accent ? 'border-primary/25 bg-primary/5' : 'border-[#E0EDD9] bg-[#FAFCF8]',
    ].join(' ')}>
      <p className="text-base">{icon}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
      <p className="mt-0.5 text-xs font-bold leading-tight text-gray-800">{value}</p>
    </div>
  )
}

function ImcBadge({ imc }: { imc: number }) {
  const { label, cls } =
    imc < 18.5 ? { label: 'Bajo peso', cls: 'border-blue-100 bg-blue-50 text-blue-700' }
    : imc < 25  ? { label: 'Normal',    cls: 'border-green-100 bg-green-50 text-green-700' }
    : imc < 30  ? { label: 'Sobrepeso', cls: 'border-yellow-100 bg-yellow-50 text-yellow-700' }
    :              { label: 'Obesidad',  cls: 'border-red-100 bg-red-50 text-red-700' }
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {imc.toFixed(1)} · {label}
    </span>
  )
}

function ImcScale({ imc }: { imc: number }) {
  const pct = Math.max(2, Math.min(96, ((imc - 10) / 30) * 100))
  return (
    <div className="relative pt-5">
      <div
        className="absolute -translate-x-1/2 text-base leading-none text-primary drop-shadow-sm"
        style={{ left: `${pct}%`, top: 0 }}
      >▼</div>
      <div
        className="h-3 rounded-full"
        style={{ background: 'linear-gradient(to right, #93c5fd 0%, #4ade80 32%, #fde047 62%, #f87171 100%)' }}
      />
    </div>
  )
}

function MetricCard({ label, sub, value, accent }: { label: string; sub: string; value: number; accent?: boolean }) {
  return (
    <div className={[
      'rounded-xl border p-3 text-center',
      accent ? 'border-primary/25 bg-primary/5' : 'border-[#E0EDD9] bg-[#FAFCF8]',
    ].join(' ')}>
      <p className={['text-xs font-black', accent ? 'text-primary' : 'text-gray-700'].join(' ')}>{label}</p>
      <p className="text-[10px] text-muted-foreground mb-1">{sub}</p>
      <p className="text-xl font-black text-gray-900">{value}</p>
      <p className="text-[10px] text-muted-foreground">kcal</p>
    </div>
  )
}

function MacroDonut({ macros }: { macros: { proteinG: number; carbsG: number; fatG: number } }) {
  const r = 44, circ = 2 * Math.PI * r
  const pK = macros.proteinG * 4, cK = macros.carbsG * 4, fK = macros.fatG * 9
  const total = pK + cK + fK || 1
  const pL = (pK / total) * circ, cL = (cK / total) * circ, fL = (fK / total) * circ
  return (
    <svg className="-rotate-90 shrink-0" width="108" height="108" viewBox="0 0 108 108">
      <circle cx="54" cy="54" r={r} fill="none" stroke="#E0EDD9" strokeWidth="14" />
      <circle cx="54" cy="54" r={r} fill="none" stroke="#fb7185" strokeWidth="14"
        strokeDasharray={`${pL} ${circ}`} strokeDashoffset={circ} />
      <circle cx="54" cy="54" r={r} fill="none" stroke="#fbbf24" strokeWidth="14"
        strokeDasharray={`${cL} ${circ}`} strokeDashoffset={circ - pL} />
      <circle cx="54" cy="54" r={r} fill="none" stroke="#60a5fa" strokeWidth="14"
        strokeDasharray={`${fL} ${circ}`} strokeDashoffset={circ - pL - cL} />
    </svg>
  )
}

function MacroRow({ color, label, g, kcalPerG, total }: {
  color: string; label: string; g: number; kcalPerG: number; total: number
}) {
  const pct = Math.round((g * kcalPerG) / total * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="flex-1 text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-gray-800">{g}g</span>
        <span className="w-8 text-right text-[10px] text-muted-foreground">({pct}%)</span>
      </div>
      <div className="h-1 w-full rounded-full bg-border ml-4">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
