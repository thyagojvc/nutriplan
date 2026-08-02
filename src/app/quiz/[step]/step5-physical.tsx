'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizStepperRow, QuizCta, QuizError } from './quiz-ui'
import { quizFetch } from '@/lib/quiz-session-client'

interface PhysicalData {
  age: number
  weight_kg: number
  height_cm: number
}

// Valores iniciais plausíveis pro avatar (mulher 25-45 LATAM). A tela abre com
// números visíveis pra corrigir, não campos vazios pra preencher: o 1º toque
// vira um tap no −/+ (ou no número, pra digitar) em vez de digitação obrigatória
// com teclado pulando na tela — era o maior atrito quando esta era a 1ª tela.
const DEFAULTS: PhysicalData = { age: 30, weight_kg: 70, height_cm: 160 }

interface Props {
  stepNumber: number
  totalSteps: number
}

// 21/07: inputs digitados viraram steppers pré-preenchidos (QuizStepperRow).
// 02/08: deixou de ser a porta de entrada e virou o 5º passo. As features de 1ª
// tela (apresentação do método, exit-intent no botão voltar, evento
// QuizFirstAnswer) migraram pro Step2Goal, que é a nova entrada. Pedir peso e
// idade agora acontece depois de quatro respostas fáceis, quando já existe
// vínculo, em vez de ser a primeira coisa exigida de quem vem do anúncio.
export function Step5Physical({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  // Confirma os alimentos favoritos (respondidos no passo anterior) antes da
  // pergunta atual.
  const [likesCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const cached = sessionStorage.getItem('nutriplan_step_1')
      const parsed = cached ? (JSON.parse(cached) as { likes?: string[] }) : {}
      return parsed.likes?.length ?? 0
    } catch { return 0 }
  })

  const [data, setData] = useState<PhysicalData>(() => {
    if (typeof window === 'undefined') return DEFAULTS
    try {
      const cached = sessionStorage.getItem('nutriplan_step_5')
      if (!cached) return DEFAULTS
      const parsed = JSON.parse(cached) as Partial<PhysicalData>
      return {
        age: Number(parsed.age) || DEFAULTS.age,
        weight_kg: Number(parsed.weight_kg) || DEFAULTS.weight_kg,
        height_cm: Number(parsed.height_cm) || DEFAULTS.height_cm,
      }
    } catch { return DEFAULTS }
  })

  const [ageBlocked, setAgeBlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleChange(field: keyof PhysicalData, val: number) {
    const next = { ...data, [field]: val }
    setData(next)
    setAgeBlocked(false)
    try {
      sessionStorage.setItem('nutriplan_step_5', JSON.stringify(next))
    } catch { /* in-app browsers com storage restrito: segue sem cache local */ }
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    if (data.age < 18) {
      setAgeBlocked(true)
      return
    }

    setSaving(true)
    setError(false)
    try {
      const res = await quizFetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 5, answers: { age: data.age, weight_kg: data.weight_kg, height_cm: data.height_cm } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/8') // → restricciones alimentarias
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  if (ageBlocked) {
    return (
      <QuizLayout>
        <QuizCard>
          <div className="py-4 text-center space-y-4">
            <p className="text-5xl">🚫</p>
            <h1 className="text-xl font-bold text-gray-900">Lo sentimos</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              NutriPlan es exclusivo para personas mayores de 18 años.
              No podemos continuar con tu solicitud.
            </p>
          </div>
        </QuizCard>
      </QuizLayout>
    )
  }

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <form onSubmit={handleContinue} className="space-y-4">
        <QuizCard>
          <QuizHeader
            confirm={
              likesCount > 0
                ? `${likesCount} alimento${likesCount !== 1 ? 's' : ''} favorito${likesCount !== 1 ? 's' : ''} guardado${likesCount !== 1 ? 's' : ''}. Ahora, tus datos físicos.`
                : 'Preferencias registradas. Ahora, tus datos físicos.'
            }
            title="Ahora, tus datos físicos"
            subtitle="Ajusta cada número al tuyo. Los usaremos para calcular tus calorías y macros exactos."
          />

          {/* Selo de privacidad — dado sensível (peso) pede reforço visual
              próprio, não só uma frase solta no subtitle. */}
          <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2.5 text-sm font-bold text-primary">
            <span className="text-sm">🔒</span>
            Nadie más los verá. 100% privado y confidencial.
          </div>

          <div className="space-y-2.5">
            <QuizStepperRow
              label="Edad"
              emoji="🎂"
              unit="años"
              min={16}
              max={90}
              value={data.age}
              onChange={(v) => handleChange('age', v)}
            />
            <QuizStepperRow
              label="Peso"
              emoji="⚖️"
              unit="kg"
              min={40}
              max={250}
              value={data.weight_kg}
              onChange={(v) => handleChange('weight_kg', v)}
            />
            <QuizStepperRow
              label="Altura"
              emoji="📏"
              unit="cm"
              min={130}
              max={220}
              value={data.height_cm}
              onChange={(v) => handleChange('height_cm', v)}
            />
          </div>

          {data.age < 18 && (
            <p className="text-center text-sm text-red-500">Debes tener al menos 18 años.</p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Ajusta con − y +. Cuanto más exactos, más preciso será tu plan 🎯
          </p>

          {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
        </QuizCard>

        <QuizCta type="submit" loading={saving} />
      </form>
    </QuizLayout>
  )
}
