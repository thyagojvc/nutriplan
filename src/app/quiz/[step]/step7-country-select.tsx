'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type DbCountry = 'MX' | 'CO' | 'CL' | 'ES' | 'OTHER'

// Apenas estes 4 têm preço em moeda local dedicado; todo o resto cai em 'OTHER' (USD).
const PRICED_COUNTRIES = new Set<string>(['MX', 'CO', 'CL', 'ES'])

function toDbCountry(code: string | undefined): DbCountry {
  return code && PRICED_COUNTRIES.has(code) ? (code as DbCountry) : 'OTHER'
}

interface Props {
  stepNumber: number
  totalSteps: number
  detectedCountry?: string
}

// Sem UI: o país já vem da geolocalização do Vercel (lido em page.tsx). Não pedimos
// mais confirmação manual — o Hotmart detecta (e cobra) no país correto de novo na
// hora do pago; isso aqui só alimenta a prévia de preço local na nossa página de
// checkout, então um "melhor esforço" automático é suficiente.
export function Step7CountrySelect({ detectedCountry }: Props) {
  const router = useRouter()
  const [error, setError] = useState(false)
  const [retrying, setRetrying] = useState(false)

  async function persistAndAdvance() {
    setError(false)
    const dbCountry = toDbCountry(detectedCountry)

    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 7,
          answers: { country: dbCountry, country_detail: detectedCountry ?? null },
          country: dbCountry, // p_country → atualiza generation_sessions.country
        }),
      })

      if (!res.ok) {
        setError(true)
        return
      }

      sessionStorage.setItem('nutriplan_step_7', JSON.stringify({ country: dbCountry, country_detail: detectedCountry ?? null }))
      router.replace('/quiz/8')
    } catch {
      setError(true)
    }
  }

  useEffect(() => {
    persistAndAdvance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            No pudimos continuar. Verifica tu conexión e intenta de nuevo.
          </p>
          <button
            type="button"
            onClick={() => {
              setRetrying(true)
              persistAndAdvance().finally(() => setRetrying(false))
            }}
            disabled={retrying}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {retrying ? 'Intentando…' : 'Reintentar'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
    </main>
  )
}
