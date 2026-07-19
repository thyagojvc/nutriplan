'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { trackDualOnce, setPixelExternalId } from '@/lib/fb-pixel'

interface Props {
  stepNumber: number
  totalSteps: number
  displayStep: number
  displayTotal: number
  detectedCountry?: string
}

// ssr: false em todos os steps — evita hydration mismatch com sessionStorage
const Step1Likes       = dynamic(() => import('./step1-likes').then(m => ({ default: m.Step1Likes })), { ssr: false })
const Step2Goal        = dynamic(() => import('./step2-goal').then(m => ({ default: m.Step2Goal })), { ssr: false })
const Step3MustHave    = dynamic(() => import('./step3-must-have').then(m => ({ default: m.Step3MustHave })), { ssr: false })
const Step4Sex         = dynamic(() => import('./step4-sex').then(m => ({ default: m.Step4Sex })), { ssr: false })
const Step5Physical    = dynamic(() => import('./step5-physical').then(m => ({ default: m.Step5Physical })), { ssr: false })
const Step6Activity    = dynamic(() => import('./step6-activity').then(m => ({ default: m.Step6Activity })), { ssr: false })
const Step7CountrySelect = dynamic(() => import('./step7-country-select').then(m => ({ default: m.Step7CountrySelect })), { ssr: false })
const Step8Restrictions = dynamic(() => import('./step8-restrictions').then(m => ({ default: m.Step8Restrictions })), { ssr: false })
const Step9Health      = dynamic(() => import('./step9-health').then(m => ({ default: m.Step9Health })), { ssr: false })
const Step10Exercise   = dynamic(() => import('./step10-exercise').then(m => ({ default: m.Step10Exercise })), { ssr: false })
const Step11Obstacle   = dynamic(() => import('./step11-obstacle').then(m => ({ default: m.Step11Obstacle })), { ssr: false })
const Step12Form       = dynamic(() => import('./step12-form').then(m => ({ default: m.Step12Form })), { ssr: false })
const Step13BodyConcern = dynamic(() => import('./step13-body-concern').then(m => ({ default: m.Step13BodyConcern })), { ssr: false })

function useEnsureSession(stepNumber: number) {
  const [error, setError] = useState(false)
  useEffect(() => {
    // /quiz/5 é a porta de entrada (ver nota abaixo) — só cria sessão ali,
    // igual o QuizStart. Visitas diretas a outras URLs não geram sessão.
    //
    // Chamamos init-session em TODA montagem do /quiz/5 (sem guard permanente de
    // sessionStorage) de propósito: init-session é idempotente (revalida o cookie
    // e reusa a sessão se ela ainda existe no banco) e, se o cookie estiver órfão
    // — sessão apagada pela limpeza, mas cookie ainda vivo por 7 dias — cria uma
    // sessão nova. Assim, quem abandona e volta pra tentar de novo não trava com
    // "Error al guardar" no 1º passo. O QuizStart continua disparando 1x por
    // sessão (dedupe do trackDualOnce), sem inflar a contagem.
    if (stepNumber !== 5) return
    // Captura o criativo/anúncio de origem (utm_content) da URL, se veio de
    // anúncio pago. Configurar no Meta Ads: URL parameters -> utm_content={{ad.name}}
    const adRef = new URLSearchParams(window.location.search).get('utm_content') ?? undefined
    fetch('/api/quiz/init-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_ref: adRef }),
    })
      .then(async (res) => {
        try {
          const data = await res.json()
          if (data?.tracking_id) void setPixelExternalId(data.tracking_id)
        } catch { /* resposta sem json — segue sem external_id, sem bloquear o quiz */ }
        // Dispara QuizStart só depois da resposta do init-session: garante que o
        // cookie nutriplan_session_id já foi gravado pelo navegador antes do POST
        // pro capi-event, senão o servidor não acha sessão pra mandar external_id
        // (era uma corrida entre os dois fetches, por isso QuizStart tinha nota de
        // match quality pior que os outros eventos do funil).
        trackDualOnce('px_quiz_start', 'QuizStart', undefined, { custom: true })
      })
      .catch(() => setError(true))
  }, [stepNumber])
  return { error }
}

export function QuizStep({ stepNumber, totalSteps, displayStep, displayTotal, detectedCountry }: Props) {
  const { error: sessionError } = useEnsureSession(stepNumber)

  // Heartbeat de presença "ao vivo": informa a etapa visível atual a cada 8s.
  // Alimenta o painel ao vivo do quiz-funnel. Para quando a aba fecha (o painel
  // então deixa de contar esta sessão após a janela de expiração).
  useEffect(() => {
    if (displayStep < 1) return
    const send = () => {
      fetch('/api/quiz/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: displayStep }),
        keepalive: true,
      }).catch(() => {})
    }
    // 1º beat com atraso curto: dá tempo do cookie de sessão (init-session) existir.
    const first = setTimeout(send, 1500)
    const iv = setInterval(send, 8000)
    return () => { clearTimeout(first); clearInterval(iv) }
  }, [displayStep])

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-destructive">
          Error al iniciar la sesión. Recarga la página.
        </p>
      </div>
    )
  }

  const props = { stepNumber: displayStep, totalSteps: displayTotal }

  // NOTA: a URL /quiz/5 é a porta de entrada dos anúncios e por isso renderiza o
  // 1º passo do fluxo.
  //
  // 19/07: reordenado pra bater com o anúncio (promete "plano + treino
  // personalizados em 60s"). A entrada (URL 5) agora renderiza DADOS FÍSICOS
  // (Step5Physical): idade/peso/altura. Depois alimentos (1), objetivo (2),
  // atividade (6), e o resto. Com isso o mapeamento URL→componente voltou a ser
  // NATURAL (URL N = StepN), sem os swaps 5↔11 anteriores.
  // As features de "página de entrada" (banner dos 60s, exit-intent no botão
  // voltar, evento QuizFirstAnswer) migraram do obstáculo pra Step5Physical, que
  // é a nova 1ª tela.
  // IMPORTANTE: as chaves de dados continuam fixas por COMPONENTE, não por URL —
  // cada Step sempre salva na sua chave (físico→step_5, obstáculo→step_11 etc.),
  // então a preview e o cálculo não são afetados pela reordenação. Só o
  // router.push de cada passo muda pra formar a nova sequência (ver cada arquivo).
  if (stepNumber === 1)  return <Step1Likes {...props} detectedCountry={detectedCountry} />
  if (stepNumber === 2)  return <Step2Goal {...props} />
  if (stepNumber === 3)  return <Step3MustHave {...props} />
  if (stepNumber === 4)  return <Step4Sex {...props} />
  if (stepNumber === 5)  return <Step5Physical {...props} />
  if (stepNumber === 6)  return <Step6Activity {...props} detectedCountry={detectedCountry} />
  if (stepNumber === 7)  return <Step7CountrySelect stepNumber={displayStep} totalSteps={displayTotal} detectedCountry={detectedCountry} />
  if (stepNumber === 8)  return <Step8Restrictions {...props} />
  if (stepNumber === 9)  return <Step9Health {...props} />
  if (stepNumber === 10) return <Step10Exercise {...props} />
  if (stepNumber === 11) return <Step11Obstacle {...props} />
  if (stepNumber === 13) return <Step13BodyConcern {...props} />
  return <Step12Form {...props} />
}
