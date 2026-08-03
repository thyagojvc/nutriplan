'use client'

import { Component, useEffect, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { trackDualOnce, setPixelExternalId } from '@/lib/fb-pixel'
import { quizFetch, rememberQuizSession, whenQuizSessionReady, getQuizSessionId } from '@/lib/quiz-session-client'

interface Props {
  stepNumber: number
  totalSteps: number
  displayStep: number
  displayTotal: number
  detectedCountry?: string
}

const CHUNK_RELOAD_FLAG = 'nutriplan_chunk_reloaded'

// TELA EM BRANCO NO iOS — o que isto conserta (03/08):
// os steps são todos dynamic(ssr:false) e, até aqui, sem loading e sem
// boundary. Se o chunk do step não baixasse (rede do webview in-app cortando o
// download do bundle), o QuizStep montava normalmente — disparando page_visible
// e o heartbeat de presença, que vivem AQUI no pai — mas a pergunta em si não
// renderizava nada. Resultado: tela em branco, sem nada pra tocar, com a sessão
// parecendo saudável no banco.
// Essa é exatamente a assinatura das sessões iOS que não entram: page_visible
// presente, _live_1 presente, q1_interacted AUSENTE (o listener é pointerdown
// na window, então captaria qualquer toque — logo, ninguém tocou na tela) e
// zero steps. Em 03/08, mesmo anúncio e mesma hora, Android fez 5/5 e iOS 1/4.
// A pessoa de Honduras voltou 32 min depois (updated_at) e continuou em 0.
// Falha de chunk é quase sempre transitória, então um reload resolve; o flag
// em sessionStorage impede laço infinito se o problema for permanente.
function StepLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

class StepBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(err: Error) {
    const detail = `boundary ${err?.name || '?'} ${err?.message || ''}`.slice(0, 140)
    try {
      quizFetch('/api/quiz/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'js_error', detail }),
        keepalive: true,
      }).catch(() => {})
    } catch { /* telemetria nunca propaga */ }

    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) !== '1') {
        sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1')
        window.location.reload()
      }
    } catch { /* storage bloqueado: cai na tela de retry do render */ }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No pudimos cargar la pregunta. Toca para intentarlo de nuevo.
        </p>
        <button
          type="button"
          onClick={() => {
            try { sessionStorage.removeItem(CHUNK_RELOAD_FLAG) } catch { /* ignora */ }
            window.location.reload()
          }}
          className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm active:scale-95"
        >
          Reintentar
        </button>
      </div>
    )
  }
}

// ssr: false em todos os steps — evita hydration mismatch com sessionStorage.
// loading: StepLoading — sem ele, chunk lento = tela branca indistinguível de
// bug (ver nota do StepBoundary acima).
const Step1Likes       = dynamic(() => import('./step1-likes').then(m => ({ default: m.Step1Likes })), { ssr: false, loading: StepLoading })
const Step2Goal        = dynamic(() => import('./step2-goal').then(m => ({ default: m.Step2Goal })), { ssr: false, loading: StepLoading })
const Step3MustHave    = dynamic(() => import('./step3-must-have').then(m => ({ default: m.Step3MustHave })), { ssr: false, loading: StepLoading })
const Step4Sex         = dynamic(() => import('./step4-sex').then(m => ({ default: m.Step4Sex })), { ssr: false, loading: StepLoading })
const Step5Physical    = dynamic(() => import('./step5-physical').then(m => ({ default: m.Step5Physical })), { ssr: false, loading: StepLoading })
const Step6Activity    = dynamic(() => import('./step6-activity').then(m => ({ default: m.Step6Activity })), { ssr: false, loading: StepLoading })
const Step7CountrySelect = dynamic(() => import('./step7-country-select').then(m => ({ default: m.Step7CountrySelect })), { ssr: false, loading: StepLoading })
const Step8Restrictions = dynamic(() => import('./step8-restrictions').then(m => ({ default: m.Step8Restrictions })), { ssr: false, loading: StepLoading })
const Step9Health      = dynamic(() => import('./step9-health').then(m => ({ default: m.Step9Health })), { ssr: false, loading: StepLoading })
const Step10Exercise   = dynamic(() => import('./step10-exercise').then(m => ({ default: m.Step10Exercise })), { ssr: false, loading: StepLoading })
const Step11Obstacle   = dynamic(() => import('./step11-obstacle').then(m => ({ default: m.Step11Obstacle })), { ssr: false, loading: StepLoading })
const Step12Form       = dynamic(() => import('./step12-form').then(m => ({ default: m.Step12Form })), { ssr: false, loading: StepLoading })
const Step13BodyConcern = dynamic(() => import('./step13-body-concern').then(m => ({ default: m.Step13BodyConcern })), { ssr: false, loading: StepLoading })

function useEnsureSession(stepNumber: number) {
  const [error, setError] = useState(false)
  // Muda pra forçar uma nova rodada de tentativas (botão "Reintentar").
  const [attemptRound, setAttemptRound] = useState(0)

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

    let cancelled = false

    async function attempt(): Promise<boolean> {
      const adRef = new URLSearchParams(window.location.search).get('utm_content') ?? undefined
      // Página nasceu em segundo plano (preload do in-app browser do IG/FB):
      // marca a sessão como carga fantasma, pra separar no funil "ninguém viu
      // essa página" de "pessoa real que viu e desistiu".
      const hidden = document.visibilityState === 'hidden'
      try {
        // Mandamos o id conhecido no header também aqui: quando o cookie não
        // persiste (webview in-app), é o que permite ao init-session reconhecer
        // a sessão existente em vez de criar uma nova a cada montagem.
        const res = await quizFetch('/api/quiz/init-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ad_ref: adRef, hidden }),
        })
        if (!res.ok) return false
        try {
          const data = await res.json()
          // Guarda no cliente ANTES de qualquer outra chamada: é o que faz o
          // quiz funcionar onde o cookie é descartado.
          rememberQuizSession(data?.session_id)
          if (data?.tracking_id) void setPixelExternalId(data.tracking_id)
        } catch { /* resposta sem json — segue sem external_id */ }
        // Isolado: telemetria nunca pode derrubar a sessão. Antes isto ficava
        // solto dentro do .then(), então qualquer exceção aqui caía no .catch()
        // do fetch e pintava a tela de erro fatal, mesmo com a sessão criada.
        try {
          trackDualOnce('px_quiz_start', 'QuizStart', undefined, { custom: true })
        } catch { /* pixel/adblock — irrelevante pro quiz */ }
        return true
      } catch {
        return false
      }
    }

    // POR QUE TENTAR DE NOVO: quase todo o tráfego chega por webview in-app do
    // IG/FB, onde requisição cair é rotina (rede móvel, página pré-carregada em
    // segundo plano que o iOS suspende antes do fetch terminar). Uma única falha
    // aqui deixava a pessoa numa tela morta, e o save-step não sabe se recuperar
    // (devolve 401 sem sessão), então não havia nenhum caminho adiante.
    async function run() {
      for (const wait of [0, 1200, 3500]) {
        if (cancelled) return
        if (wait) await new Promise((r) => setTimeout(r, wait))
        if (await attempt()) { if (!cancelled) setError(false); return }
      }
      if (!cancelled) setError(true)
    }
    void run()

    // Se a página nasceu escondida (preload do in-app browser) e o fetch morreu
    // com ela suspensa, tenta de novo assim que ela aparecer de verdade.
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (getQuizSessionId()) return
      void run()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [stepNumber, attemptRound])

  return { error, retry: () => { setError(false); setAttemptRound((n) => n + 1) } }
}

// Sinal mínimo pra separar "pessoa nunca tocou na tela" (preload de in-app
// browser, bounce antes do JS rodar) de "tocou mas não completou" (fricção
// real no step). EFEITO SEPARADO de propósito: não gate, não bloqueia, não
// atrasa nada da criação de sessão (foi misturar as duas coisas que quebrou
// o iOS na tentativa anterior, ver memória ios-quiz-abandonment-investigation).
// Falha silenciosa (.catch vazio) — não pode nunca impedir o quiz de seguir.
// Dispara um evento de funil sem depender da ordem de chegada: espera a sessão
// existir antes de mandar. O track-event descarta em silêncio (200, sem gravar)
// qualquer evento que chegue sem sessão, e o primeiro toque na tela costuma
// acontecer ANTES do init-session responder — era por isso que o q1_interacted
// registrava 7 de 124 respostas reais da 1ª pergunta (0 de 27 no iOS).
function sendFunnelEvent(event: 'q1_interacted' | 'page_visible') {
  void whenQuizSessionReady().then((id) => {
    if (!id) return
    quizFetch('/api/quiz/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {})
  })
}

function useTrackFirstInteraction(stepNumber: number) {
  useEffect(() => {
    if (stepNumber !== 5) return
    const send = () => sendFunnelEvent('q1_interacted')
    window.addEventListener('pointerdown', send, { once: true })
    window.addEventListener('keydown', send, { once: true })
    return () => {
      window.removeEventListener('pointerdown', send)
      window.removeEventListener('keydown', send)
    }
  }, [stepNumber])
}

// Promove a sessão de "carga fantasma" pra visita real. Junto com o _hidden_load
// marcado no init-session, é o par que separa preload de in-app browser (página
// criada e nunca exibida) de pessoa que viu a tela e desistiu. Sem isso, as duas
// coisas ficam indistinguíveis no funil e o abandono da entrada parece maior do
// que é. O emissor nunca tinha sido implementado: o evento existia na rota e no
// comentário do init-session, mas nada no cliente o mandava.
function useTrackPageVisible(stepNumber: number) {
  useEffect(() => {
    if (stepNumber !== 5) return
    if (document.visibilityState === 'visible') { sendFunnelEvent('page_visible'); return }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      sendFunnelEvent('page_visible')
      document.removeEventListener('visibilitychange', onVisible)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [stepNumber])
}

export function QuizStep({ stepNumber, totalSteps, displayStep, displayTotal, detectedCountry }: Props) {
  const { error: sessionError, retry: retrySession } = useEnsureSession(stepNumber)
  useTrackFirstInteraction(stepNumber)
  useTrackPageVisible(stepNumber)

  // Heartbeat de presença "ao vivo": informa a etapa visível atual a cada 8s.
  // Alimenta o painel ao vivo do quiz-funnel. Para quando a aba fecha (o painel
  // então deixa de contar esta sessão após a janela de expiração).
  useEffect(() => {
    if (displayStep < 1) return
    const send = () => {
      quizFetch('/api/quiz/presence', {
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

  // Só aparece depois das 3 tentativas falharem. Antes era um beco sem saída
  // ("Recarga la página", sem botão): num webview in-app muita gente não sabe
  // como recarregar, então isso era o fim da linha pra ela.
  if (sessionError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No pudimos conectar. Revisa tu internet e inténtalo de nuevo.
        </p>
        <button
          type="button"
          onClick={retrySession}
          className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm active:scale-95"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const props = { stepNumber: displayStep, totalSteps: displayTotal }

  // MAPEAMENTO URL → COMPONENTE
  //
  // A SEQUÊNCIA DE URLs é fixa e NÃO muda quando o quiz é reordenado:
  //   5 → 1 → 2 → 6 → 4 → 8 → 9 → 10 → 11 → 13 → 12
  // Ela é fixa porque /quiz/5 é a porta de entrada pra onde os ANÚNCIOS ATIVOS
  // apontam (ver memória quiz-route-numbering). Renumerar as rotas quebraria o
  // link dos anúncios em produção e exigiria reeditá-los, o que reinicia o
  // aprendizado da campanha. Então reordenar o quiz = trocar QUEM renderiza em
  // cada URL, aqui embaixo, mais o router.push de cada componente.
  //
  // 02/08: nova ordem visível, do mais fácil de responder pro mais sensível.
  // Antes a 1ª tela pedia idade/peso/altura logo na chegada do anúncio; agora
  // abre com o objetivo (1 toque) e o dado físico só vem no 5º passo.
  //   URL 5 = 1º objetivo          (Step2Goal, entrada)
  //   URL 1 = 2º rutina diaria     (Step6Activity, + país oculto)
  //   URL 2 = 3º sexo biológico    (Step4Sex)
  //   URL 6 = 4º alimentos         (Step1Likes)
  //   URL 4 = 5º dados físicos     (Step5Physical)
  //   URL 8..12 = restante, inalterado
  //
  // IMPORTANTE: as chaves de dados continuam fixas por COMPONENTE, não por URL —
  // cada Step sempre salva na sua chave (físico→step_5, objetivo→step_2 etc.),
  // então a preview e o cálculo não são afetados pela reordenação. Quem precisa
  // acompanhar a ordem nova é o VISIT_ORDER do painel /quiz-funnel.
  //
  // O boundary envolve TODOS os steps: a falha que ele pega (chunk do dynamic
  // que não baixa) não é específica da entrada, e sem ele o sintoma é tela em
  // branco silenciosa em qualquer passo.
  function step() {
    if (stepNumber === 5)  return <Step2Goal {...props} />
    if (stepNumber === 1)  return <Step6Activity {...props} detectedCountry={detectedCountry} />
    if (stepNumber === 2)  return <Step4Sex {...props} />
    if (stepNumber === 6)  return <Step1Likes {...props} detectedCountry={detectedCountry} />
    if (stepNumber === 4)  return <Step5Physical {...props} />
    if (stepNumber === 3)  return <Step3MustHave {...props} />
    if (stepNumber === 7)  return <Step7CountrySelect stepNumber={displayStep} totalSteps={displayTotal} detectedCountry={detectedCountry} />
    if (stepNumber === 8)  return <Step8Restrictions {...props} />
    if (stepNumber === 9)  return <Step9Health {...props} />
    if (stepNumber === 10) return <Step10Exercise {...props} />
    if (stepNumber === 11) return <Step11Obstacle {...props} />
    if (stepNumber === 13) return <Step13BodyConcern {...props} />
    return <Step12Form {...props} />
  }

  return <StepBoundary>{step()}</StepBoundary>
}
