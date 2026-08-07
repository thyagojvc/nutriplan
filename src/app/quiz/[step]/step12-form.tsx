'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizCard, QuizCta } from './quiz-ui'
import { trackDualOnce } from '@/lib/fb-pixel'
import { quizFetch } from '@/lib/quiz-session-client'
import { cleanFirstName } from '@/lib/first-name'

// Passo 12 — NÃO é mais formulário de captura de e-mail.
// Virou uma tela-ponte emocional antes da preview: espelha o obstáculo que a
// pessoa declarou no passo 11 e devolve a culpa pra fora (o método falhou, não
// ela), criando um micro-compromisso antes de ela ver o preço.
// O país já é gravado no passo 7 e a preview/checkout não dependem de lead nem
// de sessão "submetida", então não capturamos mais e-mail aqui. A identidade
// pós-compra vem do e-mail digitado na própria Hotmart no pagamento.
// (Consequência: a rota /api/quiz/submit-step12 ficou sem uso.)
//
// O NOME (07/08/2026) — único campo digitado do quiz inteiro, e fica aqui de
// propósito: é o último passo, então o custo de um campo a mais é o menor de
// todo o funil (11 passos de compromisso já investidos), e o retorno é imediato,
// porque a tela seguinte já abre com "Armada para <nome>". Pedir o nome cedo
// cobraria o mesmo teclado sem nenhum pagamento visível.
//
// Nunca é obrigatório: o "Prefiero no decirlo" existe pra que ninguém morra aqui
// com o teclado aberto. Vale mais o plano sem nome do que a lead perdida.

interface Props {
  stepNumber: number
  totalSteps: number
}

type Reframe = { eyebrow: string; title: string; body: string }

// Reframe dinâmico por obstáculo do passo 11. Sempre joga a culpa no método/
// contexto, nunca na força de vontade dela (fórmula anti-culpa).
const REFRAMES: Record<string, Reframe> = {
  falta_tiempo: {
    eyebrow: 'Lo que de verdad pasó',
    title: 'El tiempo nunca jugó a tu favor.',
    body: 'No te faltó disciplina. Te faltaron horas en el día. Por eso tu plan está hecho para resolverse rápido, sin robarte el poco tiempo que ya tienes.',
  },
  falta_motivacion: {
    eyebrow: 'Lo que de verdad pasó',
    title: 'Nunca fue falta de fuerza de voluntad.',
    body: 'Llevas años demostrando que tienes de sobra. Lo que falló siempre fue el plan, no tú. Este está hecho para sostenerse incluso en los días en que no tienes ganas.',
  },
  no_se_que_comer: {
    eyebrow: 'Lo que de verdad pasó',
    title: 'No tenías por qué adivinar qué comer.',
    body: 'Perderte entre tanta información nunca fue tu culpa. Decidir qué comer era trabajo del plan, no tuyo. Aquí ya está resuelto por ti.',
  },
  comer_fuera: {
    eyebrow: 'Lo que de verdad pasó',
    title: 'Tu rutina no cabía en una dieta cualquiera.',
    body: 'Comes fuera, trabajas, no paras. Un plan rígido nunca iba a funcionar contigo. Este se adapta a cómo vives de verdad, no al revés.',
  },
  presupuesto: {
    eyebrow: 'Lo que de verdad pasó',
    title: 'Comer bien no tiene por qué costar una fortuna.',
    body: 'El problema nunca fue tu esfuerzo. Era que nadie pensó tu plan con comida real y accesible. Este sí lo hace.',
  },
  antojos: {
    eyebrow: 'Lo que de verdad pasó',
    title: 'Los antojos no son falta de control.',
    body: 'Son la señal de un plan que te dejaba con hambre. El tuyo incluye lo que te gusta, para que no tengas que resistir sola todo el tiempo.',
  },
}

const FALLBACK: Reframe = {
  eyebrow: 'Lo que de verdad pasó',
  title: 'El problema nunca fuiste tú.',
  body: 'Fueron las dietas que te pedían un tiempo y una vida que no tienes. Tu plan parte de tu rutina real, no de una ideal.',
}

// Escolhe o reframe: prioriza "falta de tempo" (vilão central da persona) se
// estiver entre os selecionados; senão usa o primeiro obstáculo conhecido.
function pickReframe(): Reframe {
  if (typeof window === 'undefined') return FALLBACK
  try {
    const raw = sessionStorage.getItem('nutriplan_step_11')
    const parsed = raw ? (JSON.parse(raw) as { obstacles?: string[] }) : {}
    const obstacles = parsed.obstacles ?? []
    if (obstacles.includes('falta_tiempo')) return REFRAMES.falta_tiempo
    for (const o of obstacles) {
      if (REFRAMES[o]) return REFRAMES[o]
    }
  } catch {}
  return FALLBACK
}

export function Step12Form({ stepNumber, totalSteps }: Props) {
  const router = useRouter()
  const [reframe] = useState<Reframe>(pickReframe)
  const [going, setGoing] = useState(false)
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const cached = sessionStorage.getItem('nutriplan_step_12')
      return cached ? ((JSON.parse(cached) as { first_name?: string }).first_name ?? '') : ''
    } catch { return '' }
  })

  const firstName = cleanFirstName(name)

  function go(value: string) {
    if (going) return
    setGoing(true)

    // sessionStorage primeiro: é o que a /mi-plan lê sem rede, no mesmo instante.
    try {
      sessionStorage.setItem('nutriplan_step_12', JSON.stringify({ first_name: value }))
    } catch { /* modo privado: o plano sai sem nome, e tudo bem */ }

    // O save-step é enviado mas NÃO é esperado nem checado. Um nome é enfeite de
    // personalização; travar a saída do quiz num POST que pode falhar seria
    // trocar conversão por cosmética.
    if (value) {
      quizFetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 12, answers: { first_name: value } }),
        keepalive: true,
      }).catch(() => {})
    }

    // Mantém o sinal de quiz concluído para o Pixel (antes era no submit do form).
    trackDualOnce('px_quiz_complete', 'QuizComplete', undefined, { custom: true })
    router.push('/calculando' as never)
  }

  return (
    <QuizLayout>
      {/* Barra de progresso — 100% no último paso */}
      <div className="space-y-2 px-0.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Paso {stepNumber} de {totalSteps}
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            100%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#C8E8BC' }}>
          <div className="h-full w-full rounded-full bg-primary" />
        </div>
      </div>

      <QuizCard>
        <div className="space-y-4">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            {reframe.eyebrow}
          </span>

          <h1 className="text-2xl font-black leading-tight text-gray-900">
            {reframe.title}
          </h1>

          <p className="text-[1.05rem] leading-relaxed text-gray-700">
            {reframe.body}
          </p>

          {/* Linha-identidade universal — a virada que prepara a oferta */}
          <div className="rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3">
            <p className="text-base font-semibold leading-snug text-gray-900">
              Por primera vez, el plan se adapta a ti. No tú a él.
            </p>
          </div>

          {/* O nome. Vem logo depois da linha "el plan se adapta a ti" porque é a
              prova imediata dela: ela escreve o nome e o plano sai com o nome. */}
          <div className="space-y-2 border-t border-border pt-4">
            <label htmlFor="first_name" className="block text-base font-bold text-gray-900">
              ¿Cómo te llamas?
            </label>
            <p className="text-sm text-muted-foreground">
              Para armar tu plan a tu nombre.
            </p>
            <input
              id="first_name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && firstName) go(firstName) }}
              placeholder="Tu nombre"
              autoComplete="given-name"
              enterKeyHint="go"
              maxLength={30}
              className="w-full rounded-xl border-2 border-border bg-white px-4 py-3.5 text-[1.05rem] font-semibold text-gray-900 outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </div>
      </QuizCard>

      <QuizCta onClick={() => go(firstName)} disabled={going || !firstName}>
        {firstName ? `Ver el plan de ${firstName}` : 'Ver mi plan'}
      </QuizCta>

      {/* Saída sem nome. Discreta, mas sempre presente: nenhum passo do quiz
          pode ser beco sem saída por causa de um campo opcional. */}
      <button
        type="button"
        onClick={() => go('')}
        disabled={going}
        className="mx-auto block text-sm text-muted-foreground underline underline-offset-2 disabled:opacity-50"
      >
        Prefiero no decirlo
      </button>

      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        Al continuar, aceptas nuestra{' '}
        <a href="/privacidad" target="_blank" className="underline hover:text-foreground">
          Política de Privacidad
        </a>
        .
      </p>
    </QuizLayout>
  )
}
