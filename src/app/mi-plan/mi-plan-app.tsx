'use client'

// =============================================================================
// /mi-plan — o plano dela entregue ANTES do pagamento, num shell de app.
//
// Teste paralelo à /preview (que segue intocada). A diferença não é de layout,
// é de pergunta: uma página de vendas força "vale a pena comprar isto?"; um app
// com cadeados força "como eu abro isto?". A segunda pergunta é sobre posse, e
// posse é o que move quem já está cética de dieta.
//
// A TRAVA
// A aba "Desbloquear" não existe nos primeiros segundos. Ela entra por três
// caminhos, o que vier primeiro:
//   1. GATE_MS de relógio;
//   2. ela rolar o próprio plano até o fim (é o gesto que o dono pediu: dar
//      tempo de deslizar e reconhecer que o plano é dela);
//   3. ela tocar qualquer cadeado (aí ela mesma pediu, e segurar seria burrice).
//
// O caminho 3 é o que separa isto da página que serviu de referência, onde o
// cadeado responde "volta e assiste o vídeo primeiro" e manda embora quem já
// estava pronta pra pagar. Aqui nenhum cadeado é beco sem saída.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NutritionPlanJson } from '@/lib/nutrition/types'
import type { TrainingPlanJson } from '@/lib/nutrition/generate'
import type { Profile } from '@/app/(dashboard)/dashboard/dashboard-ui'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'
import { trackDualOnce, trackPixel } from '@/lib/fb-pixel'
import { quizFetch } from '@/lib/quiz-session-client'
import { MiPlanTabBar, type TabId } from './tab-bar'
import { NextStepCard } from './next-step'
import { UnlockSheet } from './lock-ui'
import { useOffer, PRICE_USD } from './use-offer'
import { MiPlanTab } from './tabs/plan-tab'
import { ResultadosTab } from './tabs/resultados-tab'
import { ListaTab } from './tabs/lista-tab'
import { BonosTab } from './tabs/bonos-tab'
import { EntrenoTab } from './tabs/entreno-tab'
import { DesbloquearTab } from './tabs/desbloquear-tab'

/** Tempo de relógio até a aba de oferta aparecer sozinha.
 *  35s é o suficiente pra ela rolar o plano e reconhecer os próprios números,
 *  e curto o bastante pra não parecer que a página está escondendo o preço.
 *  A referência usa 120s, mas lá a pessoa vem de 3 páginas de aquecimento e o
 *  ticket é 10x maior. Aqui o quiz JÁ foi o aquecimento. */
const GATE_MS = 35_000

const OPENED_AT_KEY = 'nutriplan_miplan_opened_at'

const TAB_TITLE: Record<TabId, string> = {
  plan: 'Tu Calibración Metabólica',
  resultados: 'Resultados reales',
  lista: 'Lista y guía',
  bonos: 'Tus bonos',
  entreno: 'Entrenamiento',
  desbloquear: 'Desbloquear todo',
}

/** Texto da folha por cadeado. Cada uma responde a coisa exata que ela tentou
 *  abrir — folha genérica lê como popup de venda e quebra a sensação de posse. */
function sheetCopy(lockId: string): { headline: string; body: string } {
  if (lockId.startsWith('dia_') || lockId.startsWith('semana_')) {
    return {
      headline: 'Ese día también es tuyo',
      body: 'Tus 28 días ya están armados con los mismos alimentos que elegiste y las mismas calorías del Día 1 que ya estás viendo. Solo falta abrirlos.',
    }
  }
  if (lockId.startsWith('atajo_')) {
    return {
      headline: 'Los otros 6 atajos vienen con tu plan',
      body: 'Son reglas de diez segundos que se aplican sobre la comida que ya tienes. No agregan tiempo de cocina ni cambian tu plan: cambian lo que el mismo plan produce.',
    }
  }
  if (lockId === 'entreno') {
    return {
      headline: 'Tu rutina se suma en el checkout',
      body: 'El entrenamiento es un extra opcional de $4.90, no está incluido en tu plan de comidas. Lo agregas en el siguiente paso, junto al pago, y llega armado con lo que respondiste.',
    }
  }
  const byId: Record<string, { headline: string; body: string }> = {
    lista_semana: {
      headline: 'Tu lista de compras está lista',
      body: 'Organizada por pasillo del súper, con todo lo que tus días necesitan. Vas una vez y sale todo, sin volver a mitad de semana por lo que faltó.',
    },
    guia_implementacion: {
      headline: 'Tu guía de arranque está lista',
      body: 'Qué hacer el primer día, cómo resolver el fin de semana y qué hacer cuando se te desarma la rutina. Es la parte que decide si sigues después de la semana 2.',
    },
    sustituciones: {
      headline: 'Tus sustituciones están listas',
      body: 'Si un día no encuentras un ingrediente, ya sabes por cuál cambiarlo sin romper tus macros. Es lo que evita que un imprevisto tire el plan abajo.',
    },
    bono_anticelulitis: {
      headline: 'Tu Guía Anti-Celulitis está incluida',
      body: 'Viene sin costo extra con tu plan, dentro de la misma app. Lo que sí funciona sobre la piel mientras la grasa baja.',
    },
    bono_calendario: {
      headline: 'Tu calendario de constancia está incluido',
      body: 'Marcas cada día que cumples. Es lo que te sostiene en la semana 2, que es exactamente donde las dietas se abandonan.',
    },
  }
  return byId[lockId] ?? {
    headline: 'Eso ya está armado para ti',
    body: 'Todo lo que ves bloqueado salió de tus respuestas y ya está calculado. Se abre completo con tu plan.',
  }
}

function trackEvent(event: string, detail?: string) {
  quizFetch('/api/quiz/track-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(detail ? { event, detail } : { event }),
  }).catch(() => {})
}

export function MiPlanApp({
  plan,
  profile,
  trainingPlan,
  noTraining,
  hasTrainingAnswer,
  firstName,
}: {
  plan: NutritionPlanJson
  profile: Profile
  trainingPlan: TrainingPlanJson | null
  noTraining: boolean
  hasTrainingAnswer: boolean
  /** Primeiro nome dela, ou '' se preferiu não dizer. */
  firstName: string
}) {
  const [tab, setTab] = useState<TabId>('plan')
  const [unlockedTab, setUnlockedTab] = useState(false)
  const [seenUnlockTab, setSeenUnlockTab] = useState(false)
  const [sheet, setSheet] = useState<string | null>(null)
  /** Cadeados tocados, na ordem. Alimenta a ordenação da aba de oferta. */
  const [tapped, setTapped] = useState<string[]>([])

  const offer = useOffer()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const revealOfferTab = useCallback((reason: string) => {
    setUnlockedTab((prev) => {
      if (prev) return prev
      trackEvent('miplan_offer_unlocked', reason)
      return true
    })
  }, [])

  // ── Trava 1: relógio ──────────────────────────────────────────────────────
  // O marco fica em localStorage pra sobreviver a recarregar e a voltar pelo
  // histórico. Quem já cumpriu o tempo numa visita anterior não recomeça.
  useEffect(() => {
    let openedAt = Date.now()
    try {
      const saved = Number(localStorage.getItem(OPENED_AT_KEY))
      if (saved > 0 && saved <= Date.now()) openedAt = saved
      else localStorage.setItem(OPENED_AT_KEY, String(openedAt))
    } catch { /* modo privado: cai no relógio da sessão atual */ }

    const remaining = GATE_MS - (Date.now() - openedAt)
    if (remaining <= 0) { revealOfferTab('elapsed'); return }
    const t = setTimeout(() => revealOfferTab('timer'), remaining)
    return () => clearTimeout(t)
  }, [revealOfferTab])

  // ── Trava 2: ela rolou o próprio plano até quase o fim ────────────────────
  useEffect(() => {
    if (unlockedTab || tab !== 'plan') return
    function onScroll() {
      const doc = document.documentElement
      const reached = window.scrollY + window.innerHeight >= doc.scrollHeight * 0.55
      if (reached) revealOfferTab('scroll')
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [unlockedTab, tab, revealOfferTab])

  // ── Trava 3: ela tocou um cadeado ─────────────────────────────────────────
  const handleUnlock = useCallback((lockId: string) => {
    setTapped((prev) => (prev.includes(lockId) ? prev : [...prev, lockId]))
    trackEvent('miplan_lock_tapped', lockId)
    revealOfferTab('lock_tap')
    setSheet(lockId)
  }, [revealOfferTab])

  const goToOffer = useCallback(() => {
    revealOfferTab('cta')
    setSheet(null)
    setTab('desbloquear')
  }, [revealOfferTab])

  const startCheckout = useCallback(() => {
    trackEvent('miplan_checkout_clicked')
    offer.startCheckout()
  }, [offer])

  // Troca de aba sempre volta ao topo: em app nativo cada aba tem o próprio
  // scroll, e herdar a rolagem da aba anterior é a coisa que mais denuncia
  // que isto é uma página web fingindo de app.
  //
  // A aba visitada vira evento porque neste formato ela é o equivalente ao
  // scroll da /preview: numa página de vendas a profundidade se mede rolando,
  // num app travado se mede por quantas abas distintas ela abriu. Sem isso o
  // painel só sabe que a pessoa entrou, não se ela explorou ou parou na 1ª tela.
  // Uma vez por aba por sessão ('plan' já entra marcada, é a de entrada e
  // miplan_viewed a cobre): quem vai e volta entre duas abas reescreveria a
  // mesma chave e gastaria request à toa.
  const seenTabs = useRef<Set<TabId>>(new Set(['plan']))
  const changeTab = useCallback((next: TabId) => {
    setTab(next)
    if (next === 'desbloquear') setSeenUnlockTab(true)
    if (!seenTabs.current.has(next)) {
      seenTabs.current.add(next)
      trackEvent('miplan_tab', next)
    }
    window.scrollTo({ top: 0 })
  }, [])

  // Pixel + evento de funil, uma vez por sessão.
  useEffect(() => {
    trackDualOnce('px_view_miplan', 'ViewContent', { content_name: 'miplan_app' })
    trackEvent('miplan_viewed')
  }, [])

  useEffect(() => {
    if (tab === 'desbloquear') trackEvent('miplan_offer_viewed')
  }, [tab])

  // Heartbeat de presença, igual à /preview: sem isto a pessoa some do painel
  // "ao vivo agora" assim que sai do quiz.
  useEffect(() => {
    const send = () => {
      quizFetch('/api/quiz/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 12 }),
        keepalive: true,
      }).catch(() => {})
    }
    send()
    const iv = setInterval(send, 8000)
    return () => clearInterval(iv)
  }, [])

  // InitiateCheckout do pixel só sai no clique real (dentro de useOffer); aqui
  // fica só o AddToCart do primeiro cadeado tocado, que é o sinal mais forte
  // de intenção que a página produz antes do checkout.
  useEffect(() => {
    if (tapped.length !== 1) return
    trackPixel('AddToCart', { value: PRICE_USD, currency: 'USD', content_name: 'miplan_lock' })
  }, [tapped])

  const copy = sheet ? sheetCopy(sheet) : null
  const local = offer.localPrice(PRICE_USD)

  return (
    <div className="min-h-screen bg-[#FBFAF6] font-poppins">
      <div className="mx-auto w-full max-w-2xl" ref={scrollRef}>
        {/* Top bar de app: marca à esquerda, título da aba no centro. */}
        <header className="sticky top-0 z-20 border-b border-[#EAF2E6] bg-[#FBFAF6]/95 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4">
            <NutriWordmark size="sm" />
            <h1 className="flex-1 truncate text-right font-display text-[15px] font-black leading-tight text-foreground">
              {tab === 'plan' && firstName ? `El plan de ${firstName}` : TAB_TITLE[tab]}
            </h1>
          </div>
        </header>

        <div className="p-4 pb-28">
          {tab === 'plan' && (
            <MiPlanTab plan={plan} profile={profile} firstName={firstName} onUnlock={handleUnlock} />
          )}
          {tab === 'resultados' && <ResultadosTab onCta={goToOffer} />}
          {tab === 'lista' && <ListaTab plan={plan} onUnlock={handleUnlock} />}
          {tab === 'bonos' && <BonosTab onUnlock={handleUnlock} />}
          {tab === 'entreno' && (
            <EntrenoTab trainingPlan={trainingPlan} noTraining={noTraining} onUnlock={handleUnlock} />
          )}
          {tab === 'desbloquear' && (
            <DesbloquearTab
              tapped={tapped}
              fxCountry={offer.fx.country}
              fxCurrency={offer.fx.currency}
              price={offer.price}
              localPrice={offer.localPrice}
              anchorPrice={offer.anchorPrice}
              ctaLabel={offer.ctaLabel}
              onCta={startCheckout}
              ctaState={offer.state}
              showTrainingNote={hasTrainingAnswer}
              noTraining={noTraining}
            />
          )}

          {/* Fecho de toda aba que não é a oferta: ensina que existe uma
              próxima. Ver o comentário de next-step.tsx. */}
          <NextStepCard from={tab} onGo={changeTab} />
        </div>
      </div>

      <MiPlanTabBar
        active={tab}
        onChange={changeTab}
        showUnlock={unlockedTab}
        pulseUnlock={unlockedTab && !seenUnlockTab}
      />

      <UnlockSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        headline={copy?.headline ?? ''}
        body={copy?.body ?? ''}
        priceLine={`${offer.price(PRICE_USD)} USD`}
        localLine={local ? `En tu moneda: ${local} ${offer.fx.currency}` : null}
        ctaLabel={offer.ctaLabel(PRICE_USD)}
        onCta={startCheckout}
        ctaLoading={offer.state === 'loading'}
        ctaError={offer.state === 'error'}
        onSeeAll={goToOffer}
      />
    </div>
  )
}
