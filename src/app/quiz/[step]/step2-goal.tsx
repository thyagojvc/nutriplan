'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError, ExitIntentModal } from './quiz-ui'
import { quizFetch } from '@/lib/quiz-session-client'
import { trackDualOnce } from '@/lib/fb-pixel'
// Mesma fonte que a preview e o gerador usam — a entrada do quiz não pode
// prometer um método diferente do que é entregue.
import { COMBOS } from '@/lib/nutrition/combos'

const EXIT_FLAG = 'nutriplan_exit_intent_shown'

// Mesma detecção usada em install-app-banner.tsx. Serve pra pular o intercept
// de histórico do exit-intent só no iOS (ver comentário no useEffect abaixo).
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

const GOALS = [
  { id: 'perder_peso',   label: 'Perder peso',          desc: 'Quiero reducir mi grasa corporal',                     emoji: '🔥' },
  { id: 'mantener',      label: 'Mantener mi peso',      desc: 'Quiero mantenerme saludable sin cambiar mi peso',      emoji: '⚖️' },
  { id: 'ganar_masa',    label: 'Ganar masa muscular',   desc: 'Quiero aumentar mi masa muscular',                     emoji: '💪' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

// 02/08: Step2Goal é a PORTA DE ENTRADA do quiz. A URL de entrada continua sendo
// /quiz/5 (é pra lá que os anúncios apontam e ela não muda), só passou a
// renderizar este componente — ver a nota do mapeamento em quiz-step.tsx.
// Por ser a 1ª tela, concentra as features de entrada, herdadas do Step5Physical:
// apresentação do método (60s + CALIBRA), exit-intent no botão voltar (o maior
// ponto de abandono é quem clica no anúncio e não responde nada) e o evento
// QuizFirstAnswer ao concluir a 1ª pergunta.
// Perguntar o OBJETIVO primeiro troca o custo de entrada: antes a 1ª tela pedia
// idade/peso/altura (dado sensível antes de qualquer vínculo); agora abre com
// uma escolha de 1 toque que a pessoa quer responder.
export function Step2Goal({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_2')
      const parsed = cached ? (JSON.parse(cached) as { goal?: string }) : {}
      return parsed.goal ?? null
    } catch { return null }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)

  // Ref pra o listener de popstate ler o estado mais recente sem cair em
  // closure obsoleta (o listener é registrado uma única vez, no mount).
  const stateRef = useRef({ answered: !!selected, saving })
  useEffect(() => { stateRef.current = { answered: !!selected, saving } }, [selected, saving])

  // Intercepta o botão "voltar" só nesta primeira pregunta (URL de entrada dos
  // anúncios), que é onde mais gente abandona sem sequer responder nada. Empilha
  // uma entrada extra no histórico: o primeiro "voltar" fica retido aqui (mostra
  // o modal), o segundo já deixa sair normal, pra não virar uma prisão de botão.
  // guardPushedRef evita empilhar 2x: em dev o Strict Mode roda este efeito duas
  // vezes (mount → cleanup → mount) só pra flagar efeitos colaterais não-idempotentes.
  //
  // Desligado no iOS desde 25/07: Safari e principalmente o WebView do Instagram/
  // Facebook lidam com histórico de forma menos previsível que Chrome/Android, e
  // este pushState/popstate era suspeito de piorar o abandono lá.
  const guardPushedRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isIOS()) return
    try {
      if (sessionStorage.getItem(EXIT_FLAG) === '1') return
    } catch { return }
    if (stateRef.current.answered) return

    if (!guardPushedRef.current) {
      guardPushedRef.current = true
      window.history.pushState(null, '', window.location.href)
    }

    function handlePopState() {
      if (stateRef.current.answered || stateRef.current.saving) return
      try {
        if (sessionStorage.getItem(EXIT_FLAG) === '1') return
        sessionStorage.setItem(EXIT_FLAG, '1')
      } catch { /* storage bloqueado: mostra o modal mesmo assim, só não memoriza */ }
      setShowExitModal(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function handleLeaveAnyway() {
    setShowExitModal(false)
    router.back()
  }

  function handleSelect(id: string) {
    setSelected(id)
    // sessionStorage pode falhar (ex: navegador interno do Instagram/Facebook
    // com armazenamento restrito) — não pode bloquear o avanço se isso acontecer.
    try {
      sessionStorage.setItem('nutriplan_step_2', JSON.stringify({ goal: id }))
    } catch { /* segue sem cache local; o save-step ainda persiste no banco */ }
    // Escolha única: avança direto, sem exigir o clique em Continuar
    submit(id)
  }

  async function submit(goal: string) {
    if (!goal || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await quizFetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, answers: { goal } }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }
      // Marca "iniciou o quiz de fato" (respondeu a 1ª pergunta). Junto com o
      // QuizStart (dispara no landing), permite montar no Meta o público de
      // exclusão "clicou no link mas não iniciou" = QuizStart EXCLUDE QuizFirstAnswer.
      trackDualOnce('px_quiz_first_answer', 'QuizFirstAnswer', undefined, { custom: true })
      router.push('/quiz/1') // → rutina diaria
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const handleContinue = () => { if (selected) submit(selected) }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      {/* Apresentação do mecanismo — primeira coisa que ela vê ao chegar do
          anúncio. O quiz tem um PORQUÊ (existe um método, tem nome, e o quiz é
          o que o ajusta a ela) antes de pedir a primeira resposta.
          Letras vêm de COMBOS pra nunca divergir do que o plano entrega. */}
      <div className="relative overflow-hidden rounded-2xl border border-[#D8E8D4] bg-[#F5FAF2] px-4 pb-4 pt-3.5 text-center shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
        {/* Halo decorativo atrás das letras — dá profundidade sem pesar */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-28 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{ backgroundColor: 'hsl(148, 52%, 28%, 0.16)' }}
        />

        <div className="relative space-y-2.5">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <span className="text-sm">⏱️</span> 60 segundos
          </p>

          {/* A palavra se forma na frente dela (stagger via animationDelay) */}
          <div className="flex justify-center gap-1.5" role="img" aria-label="Método CALIBRA">
            {COMBOS.map((c, i) => (
              <span
                key={c.id}
                aria-hidden
                className="calibra-letter flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-display text-[17px] font-black text-white shadow-[0_3px_10px_rgba(34,109,69,0.32)]"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {c.letter}
              </span>
            ))}
          </div>

          <p className="font-display text-[19px] font-black leading-[1.18] tracking-tight text-gray-900">
            No es que comas menos.<br />
            Es que <span className="text-primary">dejas de tener hambre</span>.
          </p>

          <p className="text-sm leading-relaxed text-gray-700">
            CALIBRA son 7 combinaciones, una por día, que hacen que el hambre baje sola.
            El nombre nace de tu <span className="font-bold text-primary">Calibra</span>ción{' '}
            <span className="font-bold text-primary">Metabol</span>ica: calibran tu hambre y aceleran tu metabolismo.
            Responde 60 segundos y las ajustamos a tu cuerpo, tus antojos y tu rutina.
          </p>
        </div>
      </div>

      <QuizCard>
        <QuizHeader
          title="¿Cuál es tu objetivo principal?"
          subtitle="Tu plan será completamente diferente según lo que elijas."
        />

        <div className="space-y-2.5">
          {GOALS.map(({ id, label, desc, emoji }) => (
            <QuizOption
              key={id}
              label={label}
              desc={desc}
              emoji={emoji}
              selected={selected === id}
              onSelect={() => handleSelect(id)}
            />
          ))}
        </div>

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      <QuizCta onClick={handleContinue} disabled={!selected} loading={saving} />

      {showExitModal && (
        <ExitIntentModal onStay={() => setShowExitModal(false)} onLeave={handleLeaveAnyway} />
      )}
    </QuizLayout>
  )
}
