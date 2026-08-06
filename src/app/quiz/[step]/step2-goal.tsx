'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError, ExitIntentModal } from './quiz-ui'
import { quizFetch } from '@/lib/quiz-session-client'
import { trackDualOnce } from '@/lib/fb-pixel'

const EXIT_FLAG = 'nutriplan_exit_intent_shown'

// Mesma detecção usada em install-app-banner.tsx. Serve pra pular o intercept
// de histórico do exit-intent só no iOS (ver comentário no useEffect abaixo).
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

// PONTO CEGO QUE ISTO FECHA: quando o save da 1ª resposta falha, a pessoa vê
// "Error al guardar" e sai — e no banco a sessão fica idêntica à de quem nunca
// tocou em nada (zero passos, nenhum evento). Isso torna impossível separar
// "tentou e o site quebrou" de "olhou e desistiu", que é justamente a pergunta
// que decide se o gargalo da entrada é bug ou copy.
// O detalhe vira sufixo da chave (ver track-event): o status separa as causas,
// 401 = sessão perdida no webview, 5xx = servidor, 400 = payload.
// Falha silenciosa de propósito: telemetria nunca pode atrapalhar o quiz.
function reportSaveFailure(event: 'save_step_failed' | 'save_step_error', detail: string) {
  try {
    quizFetch('/api/quiz/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, detail }),
      keepalive: true,
    }).catch(() => {})
  } catch { /* nunca propaga */ }
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
      if (!res.ok) { reportSaveFailure('save_step_failed', String(res.status)); setError(true); setSaving(false); return }
      // Marca "iniciou o quiz de fato" (respondeu a 1ª pergunta). Junto com o
      // QuizStart (dispara no landing), permite montar no Meta o público de
      // exclusão "clicou no link mas não iniciou" = QuizStart EXCLUDE QuizFirstAnswer.
      trackDualOnce('px_quiz_first_answer', 'QuizFirstAnswer', undefined, { custom: true })
      router.push('/quiz/1') // → rutina diaria
    } catch (e) {
      reportSaveFailure('save_step_error', e instanceof Error ? e.message : 'erro')
      setError(true)
      setSaving(false)
    }
  }

  const handleContinue = () => { if (selected) submit(selected) }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      {/* Message match com o criativo "orgmain1": quem clicou no anúncio já
          leu essa frase no hook, então repeti-la aqui confirma que caiu no
          lugar certo em vez de estranhar uma tela nova. Substituiu a pill de
          "60 segundos" (mesma promessa de tempo, dita como headline em vez
          de badge pequeno) — testar se sobe a taxa de interação. */}
      <p className="text-center font-display text-2xl font-black leading-snug text-primary">
        Arma tu <span className="text-[#D85A30]">calibración metabólica</span> en menos de 2 minutos
      </p>

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
