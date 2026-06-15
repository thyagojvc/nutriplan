'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const COUNTRIES = [
  { code: 'MX', label: 'México', flag: '🇲🇽' },
  { code: 'CO', label: 'Colombia', flag: '🇨🇴' },
  { code: 'CL', label: 'Chile', flag: '🇨🇱' },
  { code: 'ES', label: 'España', flag: '🇪🇸' },
] as const

type CountryCode = (typeof COUNTRIES)[number]['code']

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step7CountrySelect({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<CountryCode | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_7')
      const parsed = cached ? (JSON.parse(cached) as { country?: CountryCode }) : {}
      return parsed.country ?? null
    } catch {
      return null
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function handleSelect(code: CountryCode) {
    setSelected(code)
    // Cache local imediato — mesma chave que os outros steps usam
    sessionStorage.setItem('nutriplan_step_7', JSON.stringify({ country: code }))
  }

  async function handleContinue() {
    if (!selected || saving) return
    setSaving(true)
    setError(false)

    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 7,
          answers: { country: selected },
          country: selected,           // p_country → atualiza generation_sessions.country
        }),
      })

      if (!res.ok) {
        setError(true)
        return
      }

      router.push('/quiz/8')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paso {stepNumber} de {totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">¿En qué país vives?</h1>
            <p className="text-sm text-muted-foreground">
              Usaremos esto para mostrarte los precios en tu moneda local.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {COUNTRIES.map(({ code, label, flag }) => (
              <button
                key={code}
                type="button"
                onClick={() => handleSelect(code)}
                className={[
                  'flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors',
                  selected === code
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-border hover:border-primary/50',
                ].join(' ')}
              >
                <span className="text-2xl">{flag}</span>
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive">
              Error al guardar. Verifica tu conexión e intenta de nuevo.
            </p>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
      </div>
    </main>
  )
}
