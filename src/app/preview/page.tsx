'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Gauge, Flame, Cake, Scale, Ruler, Target, Zap,
  Sunrise, Utensils, Moon, Apple, ShoppingCart, ShieldCheck, Clock, Check, Lock, RotateCcw, X, CalendarCheck, BadgeCheck,
} from 'lucide-react'
import Image from 'next/image'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'
import { buildPreviewSample, type SampleMeal, type PreviewSample } from '@/lib/nutrition/generate'
import { trackPixel, trackDualOnce, setPixelUserData } from '@/lib/fb-pixel'
import { formatPrice, currencyForCountry } from '@/lib/pricing/localize'
import { getFoodImageUrl } from '@/lib/nutrition/food-images'

// Dispara um evento de funil pós-quiz no Supabase (fire-and-forget).
// Mesma via do preview_viewed: grava _ev_<event> em draft_answers, lido no
// dashboard /quiz-funnel. Serve para medir até onde a lead rola a preview.
function trackFunnelEvent(event: 'preview_viewed' | 'offer_reached' | 'tiers_reached' | 'page_end') {
  fetch('/api/quiz/track-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => {})
}

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

// Cada obstáculo do step 11 reformulado como benefício (não repete a palavra
// literal da opção do quiz). Usado no hero para conectar com o objetivo dela.
const OBSTACLE_HERO_PHRASE: Record<string, string> = {
  falta_tiempo:     'sin robarte horas que no tienes',
  falta_motivacion: 'sin depender de la fuerza de voluntad',
  no_se_que_comer:  'sin adivinar qué poner en el plato',
  comer_fuera:      'que se adapta cuando comes fuera',
  presupuesto:      'sin gastar de más en el súper',
  antojos:          'sin pelearte con los antojos',
}

// Monta a promessa central do hero: "Come exactamente lo que tu cuerpo necesita
// para [objetivo]" + até 2 obstáculos reformulados. Sem obstáculo, fecha com o
// remate da promessa ("ni más, ni menos").
function buildHeroPromise(goal: string, obstacles: string[]): string {
  const verbByGoal: Record<string, string> = {
    lose_fat:    'para bajar de peso',
    perder_peso: 'para bajar de peso',
    gain_muscle: 'para ganar músculo',
    ganar_masa:  'para ganar músculo',
  }
  const base = `Come exactamente lo que tu cuerpo necesita ${verbByGoal[goal] ?? 'para llegar a tu meta'}`

  const tails = obstacles
    .map((o) => OBSTACLE_HERO_PHRASE[o])
    .filter(Boolean)
    .slice(0, 2)

  if (tails.length === 0) return `${base}. Ni más, ni menos.`
  return `${base}, ${tails.join(' y ')}.`
}

// Resultados reales de pacientes (fotos con consentimiento por escrito).
// Nombres hispanos para generar identificación en los mercados meta (MX/CO/CL/ES).
const RESULTS = [
  {
    photo: '/resultados/caso-1.png', name: 'Camila', country: '🇲🇽', age: 38, result: '−17 kg en 8 meses', w: 414, h: 444,
    quote: 'Pagar un nutricionista y un entrenador por separado no me alcanzaba. Aquí tuve las dos cosas juntas y hechas para mí. En el primer mes ya había bajado 3 kilos, y lo mejor fue dejar de sentirme culpable cada vez que comía algo.',
  },
  {
    photo: '/resultados/caso-2.png', name: 'Daniela', country: '🇨🇴', age: 31, result: '−6 kg en 2 meses', w: 410, h: 433,
    quote: 'La verdad iba al gym casi todos los días pero comía a ojo y la balanza no se movía. Cuando vi mis números exactos me di cuenta de que comía de más sin notarlo. Bajé 6 kilos en 2 meses, y lo que no me esperaba es que fue sin pasar hambre.',
  },
]

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
  sample?: PreviewSample
}

// Emoji por refeição — só visual; as refeições reais vêm de buildPreviewSample.
const MEAL_EMOJI: Record<string, string> = {
  Desayuno: '☀️', Almuerzo: '🍽️', Cena: '🌙', Snack: '🍎',
}

// Título de seção editorial. O "tick" curto sob o título ecoa uma marca de
// régua/medição — assinatura visual ligada ao mecanismo "Calibración". Cards de
// dados (componente Card) usam header próprio, mantendo a hierarquia distinta.
function SectionHeading({
  title,
  subtitle,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  className?: string
}) {
  return (
    <div className={['text-center', className].filter(Boolean).join(' ')}>
      <h2 className="font-display text-[25px] font-black leading-[1.18] text-gray-900 [text-wrap:balance]">{title}</h2>
      <span aria-hidden className="mx-auto mt-2.5 block h-[3px] w-9 rounded-full bg-primary/60" />
      {subtitle ? (
        <p className="mx-auto mt-2.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}

// Ênfase de cor dentro do título — parte do texto ganha a cor da marca (verde)
// ou coral, no meio de uma frase preta. Efeito "olho pousa aqui" sem precisar
// de outra caixa/badge. Usar com moderação: 1 destaque por título, no máximo.
function Hl({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'coral' }) {
  return (
    <span className={tone === 'coral' ? 'text-[#D85A30]' : 'text-primary'}>{children}</span>
  )
}

// Uma refeição do teaser enxuto — só o 1º alimento (real, dos favoritos dela)
// aparece nítido; o resto vem com a foto real só que desfocada, deixando claro
// que TODO o prato é feito com os favoritos, não só o primeiro item.
function TeaserMealBlurred({ meal }: { meal: SampleMeal }) {
  const [first, ...rest] = meal.items
  return (
    <div className="overflow-hidden rounded-xl border border-[#D8E8D4] shadow-sm">
      <div className="flex items-center justify-between bg-primary px-3.5 py-2.5">
        <span className="text-sm font-semibold text-white">{MEAL_EMOJI[meal.name] ?? '🍴'} {meal.name}</span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[13px] font-semibold text-white">{meal.kcal} kcal</span>
      </div>
      <div className="divide-y divide-[#EAF2E6]">
        {first && (
          <div className="flex items-center gap-3 bg-primary/5 px-3.5 py-2.5">
            <TeaserThumb food={first.food} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">{first.food}</p>
              <p className="text-[13px] text-muted-foreground">{first.qty}</p>
            </div>
            <span className="shrink-0 rounded-full border border-[#D8E8D4] bg-white px-2 py-0.5 text-[10px] font-bold text-primary">Ej: tu favorito</span>
          </div>
        )}
        {rest.map((it) => (
          <div key={it.food} className="flex items-center gap-3 px-3.5 py-2.5">
            <TeaserThumb food={it.food} blurred />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-400 blur-[4px] select-none">{it.food}</p>
              <p className="text-[13px] text-muted-foreground blur-[3px] select-none">{it.qty}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 bg-[#F5FAF2] px-3.5 py-2 text-[11px] font-semibold text-primary">
        <Lock className="h-3 w-3 shrink-0" />
        Los otros {rest.length} también son tuyos, elegidos por ti. Se revelan completos en tu panel.
      </div>
    </div>
  )
}

function TeaserThumb({ food, blurred }: { food: string; blurred?: boolean }) {
  const imgUrl = getFoodImageUrl(food)
  if (!imgUrl) {
    return <span className="h-10 w-10 shrink-0 rounded-lg bg-[#EAF2E6]" />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgUrl}
      alt=""
      width={40}
      height={40}
      className={['h-10 w-10 shrink-0 rounded-lg object-cover', blurred ? 'blur-[3px]' : ''].join(' ')}
      loading="lazy"
      decoding="async"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

type ErrorKind = 'no_session' | 'calc_failed' | 'network'

export default function PreviewPage() {
  const router = useRouter()
  const [data, setData] = useState<PreviewData | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)
  const [leadInfo, setLeadInfo] = useState<{ email?: string; name?: string }>({})
  const [training, setTraining] = useState<{ experience?: string; location?: string; frequency?: string } | null>(null)
  const [inputCount, setInputCount] = useState<number | null>(null)
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [painAngle, setPainAngle] = useState<'tiempo' | 'cetica'>('cetica')
  // Até 2 obstáculos escolhidos no step 11, usados para personalizar o hero.
  const [heroObstacles, setHeroObstacles] = useState<string[]>([])
  // Câmbio para localizar o preço EXIBIDO. Default USD (fallback) até carregar.
  // O pedido e o tracking continuam sempre em USD — ver handleCta.
  const [fx, setFx] = useState<{ currency: string; rate: number }>({ currency: 'USD', rate: 1 })

  // Âncoras de scroll para medir profundidade da lead na preview (ver observer abaixo).
  const offerRef = useRef<HTMLDivElement | null>(null)
  const tiersRef = useRef<HTMLDivElement | null>(null)
  const pageEndRef = useRef<HTMLDivElement | null>(null)

  // Localiza o preço pelo país do passo 7 (o mesmo que o checkout usa).
  // Países fora do mapa ficam em USD e nem chamam a API de câmbio.
  useEffect(() => {
    let country: string | undefined
    try {
      const s7 = sessionStorage.getItem('nutriplan_step_7')
      if (s7) {
        const parsed = JSON.parse(s7) as { country?: string; country_detail?: string }
        // country_detail tem o código ISO real (ex: 'BR'); country pode ser 'OTHER' para países fora do enum DB
        country = parsed.country_detail ?? parsed.country
      }
    } catch {}

    const currency = currencyForCountry(country)
    if (currency === 'USD') return

    fetch('/api/fx')
      .then((r) => r.json())
      .then((d) => {
        const rate = d?.rates?.[currency]
        if (typeof rate === 'number' && rate > 0) setFx({ currency, rate })
      })
      .catch(() => { /* mantém fallback USD */ })
  }, [])

  // Formata um valor em USD na moeda da visitante. Usado em toda a oferta.
  const price = (usd: number) => formatPrice(usd, fx.currency, fx.rate)

  useEffect(() => {
    try {
      const s11 = sessionStorage.getItem('nutriplan_step_11')
      if (s11) {
        const { obstacles = [] } = JSON.parse(s11) as { obstacles?: string[] }
        if (obstacles.includes('falta_tiempo')) setPainAngle('tiempo')
        // Guarda no máximo 2 (ordem do quiz) para não sobrecarregar o hero.
        setHeroObstacles(obstacles.slice(0, 2))
      }
    } catch { /* mantém default 'cetica' */ }
  }, [])

  useEffect(() => {
    try {
      const s10 = sessionStorage.getItem('nutriplan_step_10')
      if (s10) {
        const parsed = JSON.parse(s10) as { experience?: string; location?: string; frequency?: string }
        if (parsed.experience && parsed.experience !== 'no_ejercicio') setTraining(parsed)
      }
    } catch {}
  }, [])

  // Cuenta los datos reales que la usuaria dio en el quiz — refuerza que el
  // plan no es una plantilla genérica, sin inventar un número falso.
  useEffect(() => {
    try {
      let count = 0
      const s1 = sessionStorage.getItem('nutriplan_step_1')
      if (s1) count += (JSON.parse(s1).likes ?? []).length

      const s2 = sessionStorage.getItem('nutriplan_step_2')
      if (s2 && JSON.parse(s2).goal) count += 1

      const s4 = sessionStorage.getItem('nutriplan_step_4')
      if (s4 && JSON.parse(s4).sex) count += 1

      const s5 = sessionStorage.getItem('nutriplan_step_5')
      if (s5) {
        const p = JSON.parse(s5) as Record<string, unknown>
        count += [p.age, p.weight_kg, p.height_cm].filter((v) => v != null).length
      }

      const s6 = sessionStorage.getItem('nutriplan_step_6')
      if (s6 && JSON.parse(s6).activity_level) count += 1

      const s7 = sessionStorage.getItem('nutriplan_step_7')
      if (s7 && JSON.parse(s7).country) count += 1

      const s8 = sessionStorage.getItem('nutriplan_step_8')
      if (s8) count += (JSON.parse(s8).restrictions ?? []).length

      const s9 = sessionStorage.getItem('nutriplan_step_9')
      if (s9) {
        const health = (JSON.parse(s9).health ?? []) as unknown[]
        count += health.length > 0 ? health.length : 1
      }

      const s10 = sessionStorage.getItem('nutriplan_step_10')
      if (s10) {
        const t = JSON.parse(s10) as Record<string, unknown>
        count += [t.experience, t.location, t.frequency].filter(Boolean).length
        count += ((t.limitations ?? []) as unknown[]).length
      }

      const s11 = sessionStorage.getItem('nutriplan_step_11')
      if (s11) count += (JSON.parse(s11).obstacles ?? []).length

      if (count > 0) setInputCount(count)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      const step12 = sessionStorage.getItem('nutriplan_step_12')
      if (step12) {
        const lead = JSON.parse(step12) as Record<string, string>
        setLeadInfo({ email: lead.email, name: lead.name })
        if (lead.email) {
          const s4 = sessionStorage.getItem('nutriplan_step_4')
          const s7 = sessionStorage.getItem('nutriplan_step_7')
          const gender = s4 ? (JSON.parse(s4) as { sex?: string }).sex : undefined
          const country = s7 ? (JSON.parse(s7) as { country?: string }).country : undefined
          setPixelUserData(lead.email, lead.name, { gender, country })
        }
      }
    } catch {}
  }, [])

  // Visualização da oferta: dispara quando a preview carrega com dados reais.
  useEffect(() => {
    if (!data) return
    trackDualOnce('px_view_preview', 'ViewContent', { content_name: 'preview_plan' })
    trackFunnelEvent('preview_viewed')
  }, [data])

  // Heartbeat de presença "ao vivo": mesma lógica do quiz, mas pra preview.
  // Sem isso, o painel "ao vivo agora" mostrava a pessoa sumindo assim que
  // ela saía do quiz e chegava na preview (que não passa por quiz-step.tsx).
  // Usa a etapa 12 (não usada como step visível do quiz) como marcador de
  // "está vendo o plano/oferta agora".
  useEffect(() => {
    if (!data) return
    const send = () => {
      fetch('/api/quiz/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 12 }),
        keepalive: true,
      }).catch(() => {})
    }
    send()
    const iv = setInterval(send, 8000)
    return () => clearInterval(iv)
  }, [data])

  // Profundidade de scroll: registra uma vez cada quando o bloco entra na tela.
  // 'offer_reached' = viu a oferta; 'tiers_reached' = chegou nos botões de tier.
  // Assim o funil mostra onde a lead para entre ver a preview e clicar.
  useEffect(() => {
    if (!data) return
    const observers: IntersectionObserver[] = []
    const watch = (el: HTMLElement | null, event: 'offer_reached' | 'tiers_reached' | 'page_end') => {
      if (!el) return
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            trackFunnelEvent(event)
            obs.disconnect()
          }
        },
        { threshold: 0.01 },
      )
      obs.observe(el)
      observers.push(obs)
    }
    watch(offerRef.current, 'offer_reached')
    watch(tiersRef.current, 'tiers_reached')
    watch(pageEndRef.current, 'page_end')
    return () => observers.forEach((o) => o.disconnect())
  }, [data])

  // Único produto na sales page. Recetas e Entrenamiento viram order bump
  // dentro do próprio checkout Hotmart (configurado no painel deles), não
  // são mais links escolhidos aqui. checkoutMode=10 é obrigatório na URL:
  // é o modelo de checkout onde os order bumps foram configurados no painel,
  // sem esse parâmetro a Hotmart serve um checkout sem a seção de bump.
  const HOTMART_BASIC_URL = 'https://pay.hotmart.com/O106407229L?checkoutMode=10'

  async function handleCta() {
    if (ctaState === 'loading') return
    setCtaState('loading')
    try {
      const r = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: 'basic' }),
      })
      const d = await r.json()
      if (!d.order_id) { setCtaState('error'); return }

      document.cookie = `nutriplan_order_id=${d.order_id}; path=/; max-age=3600; SameSite=Lax`
      if (d.idempotency_key) {
        document.cookie = `nutriplan_order_key=${d.idempotency_key}; path=/; max-age=3600; SameSite=Lax`
        sessionStorage.setItem('nutriplan_idempotency_key', d.idempotency_key)
      }

      sessionStorage.setItem('nutriplan_purchase_value', '9.90')
      trackPixel('InitiateCheckout', { value: 9.90, currency: 'USD', content_name: 'NutriPlan' }, { eventID: `initiate_checkout_${d.order_id}` })

      if (process.env.NODE_ENV !== 'production') {
        await fetch('/api/dev/simulate-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: d.order_id }),
        })
        router.push(`/exito?order=${d.order_id}`)
        return
      }

      const params = new URLSearchParams()
      if (leadInfo.email) params.set('email', leadInfo.email)
      if (leadInfo.name)  params.set('name',  leadInfo.name)
      // sck volta no payload do webhook e permite casar a compra com o pedido
      // sem depender de lead/email (o quiz não captura mais email).
      params.set('sck', d.order_id)
      window.location.href = `${HOTMART_BASIC_URL}&${params.toString()}`
    } catch {
      setCtaState('error')
    }
  }

  useEffect(() => {
    // Lê o draft do sessionStorage (preenchido passo a passo durante o quiz).
    function readSession(): { draft: Record<string, unknown>; country: string; activityLevel: string } | null {
      try {
        const draft: Record<string, unknown> = {}
        for (let n = 1; n <= 10; n++) {
          const raw = sessionStorage.getItem(`nutriplan_step_${n}`)
          if (raw) draft[`step_${n}`] = JSON.parse(raw)
        }

        const s5 = (draft.step_5 ?? {}) as Record<string, unknown>
        const s6 = (draft.step_6 ?? {}) as Record<string, unknown>
        // Sem dados físicos não dá para calcular.
        if (!s5.age || !s5.weight_kg || !s5.height_cm) return null

        // Garante activity_factor mesmo que o step 6 tenha sido salvo numa versão
        // mais antiga sem esse campo (deriva do activity_level se ausente).
        if (!s6.activity_factor && s6.activity_level) {
          const FACTORS: Record<string, number> = {
            sedentario: 1.2, ligeramente_activo: 1.375,
            moderadamente_activo: 1.55, muy_activo: 1.725,
          }
          const f = FACTORS[String(s6.activity_level)]
          if (f) draft.step_6 = { ...s6, activity_factor: f }
        }

        let country = 'OTHER'
        const activityLevel = String(s6.activity_level ?? '')
        const step7Raw = sessionStorage.getItem('nutriplan_step_7')
        if (step7Raw) {
          const s7 = JSON.parse(step7Raw) as { country?: string }
          if (s7.country) country = s7.country
        }
        return { draft, country, activityLevel }
      } catch {
        return null
      }
    }

    // ── Caminho 1: cálculo direto no browser (sem rede, sem cookie) ──────────
    const session = readSession()
    if (session) {
      try {
        const answers = parseAnswers(session.draft, session.country)
        const targets = calcTargets(answers)
        setData({
          profile: {
            age: answers.age,
            weightKg: answers.weightKg,
            heightCm: answers.heightCm,
            sex: answers.sex,
            activityLevel: session.activityLevel,
          },
          targets: {
            bmr: targets.bmr,
            tdee: targets.tdee,
            targetCalories: targets.targetCalories,
            goal: targets.goal,
            macros: targets.macros,
          },
          sample: buildPreviewSample(answers, targets),
        })
        return
      } catch {
        // Se parseAnswers lançar (dados inválidos), cai no fallback de API.
      }
    }

    // ── Caminho 2: fallback via API (aba nova, sessionStorage vazio) ──────────
    fetch('/api/quiz/preview-data')
      .then(r => r.json())
      .then(d => { if (d.error) setErrorKind('no_session'); else setData(d) })
      .catch(() => setErrorKind(session ? 'calc_failed' : 'no_session'))
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
            <a href="/quiz/5" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
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
  const sample = data.sample?.meals ?? []
  const personalized = data.sample?.personalized ?? false
  const isLoss = targets.goal === 'lose_fat' || targets.goal === 'perder_peso'
  const isGain = targets.goal === 'gain_muscle' || targets.goal === 'ganar_masa'
  const firstName = leadInfo.name?.trim().split(' ')[0]
  // Promessa central do hero, personalizada pelo objetivo + obstáculos dela.
  const heroPromise = buildHeroPromise(targets.goal, heroObstacles)

  return (
    <PageShell>
      {/* Urgência fixa: visível durante toda a rolagem, colada embaixo do
          header. Fala do PLANO se guardar (não de preço), pra criar urgência
          sem assustar com dinheiro antes de ver metabolismo/autoridade/provas. */}
      <Countdown />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-4 pt-6 pb-5 text-center space-y-3">
        {/* Badge de conclusão */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(15,110,86,0.25)]">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
          {firstName ? `${firstName}, tu Reto de 28 días está listo` : 'Tu Reto de 28 días está listo · solo para ti'}
        </div>

        {/* Promessa central — message match com o anúncio ("exactamente") + obstáculo dela */}
        {(isLoss || isGain) && (
          <h1 className="font-display text-[26px] font-black leading-[1.15] text-gray-900">
            Come <span className="text-primary">exactamente</span>
            {heroPromise.replace(/^Come exactamente/, '')}
          </h1>
        )}

        {/* Selos de personalización — refuerzan que no es una plantilla genérica */}
        {(inputCount || training) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {inputCount !== null && inputCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-bold text-primary">
                <Check className="h-3 w-3" strokeWidth={3} />
                Calculado con {inputCount} datos tuyos
              </span>
            )}
            {training && (isLoss || isGain) && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-bold text-primary">
                <Zap className="h-3 w-3" />
                {isLoss
                  ? 'Hecho para quien entrena y quiere bajar de peso'
                  : 'Hecho para quien entrena y quiere ganar músculo'}
              </span>
            )}
          </div>
        )}

        {isLoss || isGain ? (
          <>
            <p className="text-sm font-semibold text-muted-foreground">Esto calculamos para tu cuerpo</p>
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <p className="text-[13px] text-gray-400">Tu gasto</p>
                <p className="font-display text-2xl font-black leading-none text-gray-400">{targets.tdee}</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-[#D85A30]">
                  <path d="M5 12h14M19 12l-6-6M19 12l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="whitespace-nowrap rounded-full bg-[#FAECE7] px-2 py-0.5 text-[13px] font-bold text-[#993C1D]">
                  {isLoss ? `−${delta}` : `+${delta}`} kcal
                </span>
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold text-primary">Tu meta</p>
                <p className="font-display text-5xl font-black leading-none text-primary">{targets.targetCalories}</p>
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground">kcal/día</p>
            <p className="text-base font-bold text-gray-800">
              {isLoss
                ? <>Es tu número exacto, el que empieza a <span className="text-primary">bajar de peso</span> sin pasar hambre.</>
                : <>Es tu número exacto, el que empieza a <span className="text-primary">construir músculo</span> comiendo bien.</>}
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {isLoss ? 'Nada de dietas de moda ni de contar cada caloría a mano.'
                : 'Nada de comer de más a ciegas esperando que sea músculo.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-muted-foreground">Tu número exacto para no perder lo que ya lograste</p>
            <p className="font-display leading-none">
              <span className="text-6xl font-black text-primary">{targets.targetCalories}</span>
              <span className="ml-2 text-xl font-bold text-gray-500">kcal/día</span>
            </p>
            <p className="text-base font-bold text-gray-800">Sin este número, mantener se convierte en subir de a poco, sin notarlo.</p>
          </>
        )}
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          Calculado solo para ti con la <span className="font-semibold text-gray-700">Calibración Metabólica™</span>. Mira tu análisis completo abajo.
        </p>
        <p className="mx-auto max-w-xs text-sm font-semibold text-gray-800">
          {painAngle === 'tiempo'
            ? 'Ya tienes tu número. Abajo está tu plan de comidas, listo y decidido, para que tu rutina no te sabotee. Y puedes sumarle tu entrenamiento.'
            : 'Ya tienes tu número. Abajo está tu plan de comidas para tu cuerpo, y puedes sumarle tu entrenamiento. Todo listo para empezar hoy.'}
        </p>
      </div>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-4 pb-24 space-y-5">

        {/* Rumiación — nombra la sensación física diaria que ella ya vive,
            antes de cualquier prueba o mecanismo. Es la "alça pronta": no hay
            que crear el deseo, solo reconocer lo que ya siente todos los días. */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <SectionHeading title="¿Te reconocés en esto?" />
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
            <li>Te vestís de mañana y la ropa no cae como te gustaría.</li>
            <li>En una foto grupal, buscás quedar atrás o te tapás con el brazo.</li>
            <li>Ya pensaste en decir que no vas a esa reunión, con tal de no aparecer en las fotos.</li>
            <li>Al ducharte, ves lo mismo que viste esta mañana, y sentís que hoy tampoco cambió nada.</li>
          </ul>
          <p className="pt-1 text-center text-[13px] font-semibold text-gray-800">
            No es que te falte fuerza de voluntad. Es que nadie calibró un plan para lo que tu cuerpo necesita hoy.
          </p>
        </div>

        {/* Tu perfil — consolidado: dados físicos + IMC + objetivo + actividad +
            gasto calórico num único card. Corta a duplicação com o card
            "Tu metabolismo" e a timeline "Así se armó tu plan" (explicavam o
            processo, não ajudavam a decidir a compra). */}
        <Card label="Tu perfil" icon={<User className="h-4 w-4 text-primary" />}>
          <div className="grid grid-cols-4 gap-2">
            <StatCard icon={<Cake className="h-4 w-4" />}  label="Edad"      value={profile.age ? `${profile.age} años` : '—'} />
            <StatCard icon={<Scale className="h-4 w-4" />} label="Peso"      value={profile.weightKg ? `${profile.weightKg} kg` : '—'} />
            <StatCard icon={<Ruler className="h-4 w-4" />} label="Altura"    value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
            <StatCard icon={<Gauge className="h-4 w-4" />} label="IMC"       value={imc ? imc.toFixed(1) : '—'} accent />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Target className="h-4 w-4" />} label="Objetivo" value={GOAL_LABEL[targets.goal] ?? targets.goal} />
            <StatCard icon={<Zap className="h-4 w-4" />}   label="Actividad" value={ACTIVITY_LABEL[profile.activityLevel] ?? (profile.activityLevel || '—')} />
            <StatCard icon={<Flame className="h-4 w-4" />} label="Gasto calórico" value={`${targets.tdee} kcal`} />
          </div>

          {imc && (
            <div className="border-t border-[#EAF2E6] pt-4">
              <ImcScale imc={imc} />
              <div className="flex justify-between text-[11px] font-medium text-muted-foreground mt-1">
                <span>Bajo peso</span><span>Normal</span><span>Sobrepeso</span><span>Obesidad</span>
              </div>
            </div>
          )}
        </Card>

        {/* Así es tu plan — teaser de 2 comidas (no las 4). Solo el primer
            alimento de cada una aparece nítido (con foto real), el resto
            aparece con foto real mas desenfocada: deixa claro que TODO o
            plano é feito com os favoritos dela, não só o primeiro item. */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3.5 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <SectionHeading title={<>Así es <Hl>tu</Hl> plan</>} />
          <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
            Cada comida se arma con los alimentos que marcaste como favoritos en tu quiz. Te mostramos el primero de cada una:
          </p>
          <div className="space-y-3">
            {sample.slice(0, 2).map((meal) => (
              <TeaserMealBlurred key={meal.name} meal={meal} />
            ))}
          </div>

          {/* Lock: prova que há muito mais (días 2-7, otras comidas, lista) — travado */}
          <div className="flex flex-col items-center gap-2.5 rounded-xl border border-primary/15 bg-[#F5FAF2] px-4 py-3.5 text-center">
            <div className="flex flex-wrap justify-center gap-1.5">
              {[
                { Icon: Sunrise,      label: 'Desayunos' },
                { Icon: Utensils,     label: 'Almuerzos' },
                { Icon: Moon,         label: 'Cenas' },
                { Icon: Apple,        label: 'Snacks' },
                { Icon: ShoppingCart, label: 'Lista de compras' },
              ].map(({ Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-0.5 text-[13px] font-semibold text-primary">
                  <Icon className="h-3 w-3" /> {label}
                </span>
              ))}
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-800">
              <Lock className="h-3.5 w-3.5 text-primary" /> Los 7 días completos al desbloquear tu plan
            </p>
          </div>
        </div>

        {/* Autoridade — responsável técnico, foto grande na frente */}
        <div className="overflow-hidden rounded-2xl border border-[#D8E8D4] bg-white">
          <div className="relative w-full aspect-[2/3]">
            <Image
              src="/FotoNutri-full.png"
              alt="Tiago Vieira, Nutricionista"
              fill
              className="object-cover object-top"
              sizes="(max-width: 520px) 100vw, 520px"
            />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
            <div className="absolute bottom-4 right-4">
              <Image
                src="/FotoNutri.jpg"
                alt="Tiago Vieira, primer plano"
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover object-top border-[3px] border-white shadow-lg"
              />
              <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full text-[#3897F0] bg-white shadow" strokeWidth={2.2} fill="#3897F0" stroke="white" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-4 pr-20">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Quién está detrás de tu plan</p>
              <p className="font-display text-[19px] font-black text-white">Tiago Vieira</p>
              <p className="text-[13px] font-semibold text-white/90">Nutricionista · Responsable técnico</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3DE] border border-[#D8E8D4] px-2.5 py-0.5 text-[11px] font-bold text-primary">
                <ShieldCheck className="h-3 w-3" />
                Reg. 26101842
              </span>
              <span className="inline-flex items-center rounded-full bg-[#EAF3DE] border border-[#D8E8D4] px-2.5 py-0.5 text-[11px] font-bold text-primary">
                Hipertrofia femenina
              </span>
              <span className="inline-flex items-center rounded-full bg-[#EAF3DE] border border-[#D8E8D4] px-2.5 py-0.5 text-[11px] font-bold text-primary">
                Pérdida de grasa en mujeres
              </span>
            </div>

            {/* Números reais da trajetória clínica — distinto do "+1.800 planes" do app */}
            <div className="grid grid-cols-2 gap-3 border-t border-[#D8E8D4] pt-4">
              <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-3 text-center">
                <p className="text-2xl font-black text-primary">6 años</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">de trayectoria clínica</p>
              </div>
              <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-3 text-center">
                <p className="text-2xl font-black text-primary">+2.000</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">mujeres atendidas con su metodología</p>
              </div>
            </div>

            <p className="text-[13px] leading-relaxed text-muted-foreground border-t border-[#D8E8D4] pt-3">
              Todo empezó con su mamá: años probando dietas que no consideraban su cuerpo ni su rutina, sin resultados. Desde ahí Tiago se especializó en un solo objetivo, mujeres perdiendo grasa y ganando fuerza con un método pensado para su cuerpo, no una copia de lo que funciona para un hombre. Una calculadora de internet te da el mismo número que a todas. La Calibración Metabólica™ parte de tu metabolismo real y lo ajusta a ti, con el mismo criterio que usaría en una consulta.
            </p>

            {/* Soporte por WhatsApp — vive aquí (junto a quién es él), não repetido na oferta */}
            <div className="flex items-center gap-3 rounded-xl border border-[#25D366]/35 bg-[#25D366]/8 px-3.5 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] shadow-[0_2px_8px_rgba(37,211,102,0.35)]">
                <svg viewBox="0 0 24 24" fill="#fff" className="h-6 w-6">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">Soporte directo por WhatsApp</p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">No estás por tu cuenta. Tiago responde tus dudas por WhatsApp. Recibes su contacto al comprar.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados reales — antes/después (fotos con consentimiento) */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3.5 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <div className="space-y-1 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Resultados reales con la Calibración Metabólica™
            </p>
            <p className="font-display text-base font-black text-gray-900">
              Así les fue a ellas
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {RESULTS.map(({ photo, name, country, age, result, w, h, quote }) => (
              <div key={name} className="overflow-hidden rounded-xl border border-[#D8E8D4] bg-[#F5FAF2]">
                <Image
                  src={photo}
                  alt={`Antes y después de ${name}`}
                  width={w}
                  height={h}
                  className="h-auto w-full"
                />
                <div className="space-y-1.5 p-2.5">
                  <span className="inline-block rounded-full bg-primary px-2 py-0.5 text-[13px] font-black text-white">
                    {result}
                  </span>
                  <p className="text-xs font-bold text-gray-800">{country} {name}, {age}</p>
                  <p className="text-[11px] italic leading-snug text-gray-600">&ldquo;{quote}&rdquo;</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] leading-relaxed text-[#B7C3B2]">
            Resultados individuales. Varían según cada persona, su constancia y su punto de partida.
          </p>
        </div>

        {/* Sin vs Con — contraste de experiência (não de qualificação), padrão
            das páginas de low ticket. Esquerda cinza (a vida de hoje), direita
            verde (a vida com o Reto). Empurra pra decisão logo antes do "cómo". */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-4 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <SectionHeading title={<>Con el Reto, <Hl>cambia todo</Hl></>} />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-[#E5E0DC] bg-[#F7F5F3] p-3.5">
              <div className="mb-3 flex flex-col items-center gap-1.5 border-b border-dashed border-black/10 pb-3 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                  <X className="h-4 w-4" strokeWidth={3} />
                </span>
                <p className="text-[13px] font-bold text-gray-500">Sin el Reto</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Dietas genéricas que le dan a todas',
                  'Culpa cada vez que comés algo rico',
                  'Bajás y en un mes lo volvés a subir',
                  'Contar calorías a mano, o rendirte a los 3 días',
                  'No saber si de verdad está funcionando',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-gray-500">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-400">
                      <X className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
              <div className="mb-3 flex flex-col items-center gap-1.5 border-b border-dashed border-primary/20 pb-3 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-[0_3px_10px_rgba(34,109,69,0.3)]">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <p className="text-[13px] font-bold text-primary">Con el Reto</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Un plan calibrado para tu cuerpo',
                  'Comés rico, con tus antojos incluidos',
                  'Bajás de forma sostenible, hasta 1 kg por semana',
                  'Todo decidido: qué comprar y qué comer',
                  'El calendario te muestra tu avance real',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[13px] leading-snug text-gray-800">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Fotos de uso real do Reto (ferramenta em ação): cozinhando com o
            NutriPlan aberto no celular + marcando a evolução no calendário.
            Substitui a foto única do calendário e o passo-a-passo textual. */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3.5 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <SectionHeading title={<>Así vas a <Hl>usar</Hl> tu Reto</>} />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[#D8E8D4]">
              <Image
                src="/Foto_Preenchendo_Calendario/Foto cozinhando com nutriplan.png"
                alt="Mujer cocinando siguiendo su NutriPlan en el celular"
                fill
                sizes="(max-width: 640px) 50vw, 256px"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5">
                <p className="text-[11.5px] font-bold leading-tight text-white">Cocinás siguiendo tu plan</p>
              </div>
            </div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[#D8E8D4]">
              <Image
                src="/Foto_Preenchendo_Calendario/Preenchendo calendário.png"
                alt="Mujer marcando su avance en el calendario del Reto de 28 días"
                fill
                sizes="(max-width: 640px) 50vw, 256px"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5">
                <p className="text-[11.5px] font-bold leading-tight text-white">Marcás tu avance, semana a semana</p>
              </div>
            </div>
          </div>
          <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
            Recibís tu plan de comidas y tu calendario de 28 días juntos, el sistema completo. El plan te dice qué comer, el calendario te muestra que está funcionando.
          </p>
        </div>

        {/* Claim realista + ângulo anti-Ozempic. "Hasta 1 kg/semana" é ritmo
            sustentável e defensável (não promete X kg), e o "sin Mounjaro ni
            Ozempic" pega a onda cultural atual como diferencial. Sem garantia. */}
        <div className="overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Sin inyecciones ni pastillas</p>
          <p className="font-display text-[19px] font-black leading-snug text-gray-900">
            Bajá hasta <span className="text-primary">1 kg por semana</span>, sin Mounjaro ni Ozempic
          </p>
          <p className="text-sm leading-relaxed text-gray-700">
            No necesitás inyecciones ni pastillas para adelgazar. Con la Calibración Metabólica™ y comida real, tu cuerpo baja de forma sostenible, al ritmo que tu cuerpo considera saludable.
          </p>
          <p className="text-[11px] leading-relaxed text-[#B7C3B2]">
            Ritmo estimado y sostenible. Los resultados varían según cada persona, su constancia y su punto de partida.
          </p>
        </div>

        {/* Oferta con ancla de valor */}
        <div ref={offerRef} className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-white shadow-[0_10px_34px_rgba(15,110,86,0.13)]">
          {/* Header colorido */}
          <div className="bg-primary px-5 py-3 text-center">
            <p className="text-[13px] font-bold uppercase tracking-widest text-white/80">
              {isLoss ? 'Tu Reto de 28 días para bajar de peso'
                : isGain ? 'Tu Reto de 28 días para ganar músculo'
                : 'Tu Reto de 28 días'}
            </p>
            <p className="text-base font-black text-white">
              {isLoss ? '¡Tu reto está listo. Empieza hoy!'
                : isGain ? '¡Tu reto está listo. Empieza hoy!'
                : '¡Tu Reto de 28 días está listo!'}
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Mecanismo Único — destacado como THE product, não como feature */}
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">Calibración Metabólica™ validada por Tiago Vieira</p>
                <p className="text-[13px] text-muted-foreground">Calcula exactamente lo que <em>tu</em> cuerpo necesita, no una fórmula genérica</p>
              </div>
            </div>

            {/* Refuerzo del ángulo ganador (antojos/sostenibilidad) en el punto de
                decisión — congruencia con el anuncio que trae a la persona */}
            <p className="text-center text-[13px] font-semibold text-gray-800">
              Un plan pensado para tu vida real: incluye tus antojos y tu rutina, para que no lo abandones a los 3 días.
            </p>

            {/* Sistema de 2 peças — o plano (o meio) + o calendário (o
                acompanhamento) = transformação. Eleva as duas peças-herói acima
                da lista de valor, pra vender o Kit como sistema, não feature avulsa. */}
            <div>
              <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Tu Reto tiene dos partes que trabajan juntas
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-primary/25 bg-white p-3.5">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Utensils className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-bold text-gray-900">El plan: qué comer</p>
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    Tus comidas de cada día, calculadas para tu cuerpo. Con tu lista de compras y tus sustituciones.
                  </p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-primary">El camino</p>
                </div>
                <div className="rounded-xl border border-primary/25 bg-white p-3.5">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarCheck className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-bold text-gray-900">El calendario: tu avance</p>
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    Marcás cada día que completás y ves tu constancia crecer, semana a semana.
                  </p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-primary">Tu seguimiento</p>
                </div>
              </div>
              <div className="mt-2.5 rounded-xl bg-primary px-4 py-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Juntos =</p>
                <p className="text-base font-black text-white">Tu transformación de 28 días</p>
              </div>
              <p className="mt-2.5 text-center text-[13px] leading-relaxed text-gray-700">
                Un plan solo no alcanza, por eso las dietas se abandonan. El calendario es lo que te sostiene los 28 días y te muestra que está funcionando.
              </p>
            </div>

            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Todo lo que incluye tu Reto</p>
              <ul className="space-y-2.5">
                {[
                  { item: 'Tu plan de comidas, calculado para tu cuerpo', note: 'aunque ya hayas probado otras dietas sin resultado', value: 14 },
                  { item: 'Tu calendario de 28 días para marcar tu avance', note: 'lo que te sostiene para no abandonar en la semana 2', value: 9 },
                  { item: 'Lista de compras optimizada', note: 'sin dar vueltas en el súper pensando qué llevar', value: 4 },
                  { item: 'Guía de implementación', note: 'para empezar hoy sin dudas', value: 3 },
                  { item: 'Sustituciones para cada comida', note: 'si un día no tienes un ingrediente, lo cambias', value: 3 },
                  { item: 'Bono: Guía Anti-Celulitis', note: null, value: 5 },
                  { item: 'Acceso a tu panel personal + calendario descargable', note: null, value: null },
                ].map(({ item, note, value }) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="flex-1">
                      {item}
                      {note && <span className="block text-[12px] leading-snug text-muted-foreground">{note}</span>}
                    </span>
                    {value != null && (
                      <span className="shrink-0 text-[12px] font-semibold text-muted-foreground tabular-nums">{price(value)}</span>
                    )}
                  </li>
                ))}
              </ul>
              {/* Total somado riscado → padrão de empilhamento de valor (Ricardo):
                  soma real dos componentes, sem inflar, riscada contra o preço de hoje. */}
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#D8E8D4] pt-3">
                <span className="text-[13px] font-bold text-gray-800">Todo esto sumado vale</span>
                <span className="text-base font-bold text-gray-400 line-through tabular-nums">{price(38)}</span>
              </div>
            </div>

            {/* Âncora de valor: iguala (consulta) → mostra valor somado riscado →
                barateia com o preço real → tira o susto com o "por qué tan barato". */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-4 text-center space-y-1.5">
              <p className="text-[13px] text-gray-700">
                Una consulta con nutricionista cuesta <strong>{price(30)} o más</strong>, y solo te dan un plan. Aquí tienes más que eso, por una fracción.
              </p>
              <p className="text-[13px] text-gray-700">
                Y ya gastaste más que esto en dietas y planes que nunca se adaptaron a ti.
              </p>
              <p className="text-sm text-gray-800 pt-1">Hoy, en un solo pago:</p>
              <p className="text-[2.5rem] font-black leading-none text-primary tabular-nums">{price(9.90)}</p>
              <p className="text-[13px] font-bold text-gray-700">Cuesta menos que los cafés de una semana.</p>
              <p className="text-[12px] leading-relaxed text-muted-foreground pt-1">
                Lo hago digital y accesible a propósito, para que el precio no sea la excusa que te frene otra vez. Un solo pago, sin suscripción ni cobros cada mes.
              </p>
            </div>

            {ctaState === 'error' && (
              <p className="text-center text-xs text-red-600">
                Error al preparar el pedido. Recarga la página e intenta de nuevo.
              </p>
            )}

            {/* CTA único — producto único, sin comparación de tiers */}
            <div ref={tiersRef} className="pt-1">
              <button
                onClick={handleCta}
                disabled={ctaState === 'loading'}
                className={[
                  'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
                  'bg-[#D85A30] shadow-[0_4px_20px_0_rgba(216,90,48,0.38)] transition-all duration-150',
                  'hover:shadow-[0_6px_28px_0_rgba(216,90,48,0.48)] hover:brightness-[1.05] active:scale-[0.99]',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
                ].join(' ')}
              >
                {ctaState === 'loading' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    Procesando…
                  </>
                ) : (
                  `QUIERO MI RETO ahora (${price(9.90)}) →`
                )}
              </button>
              {fx.currency !== 'USD' && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  *Precio aproximado en {fx.currency}. Se cobra en tu moneda local.
                </p>
              )}
            </div>

            {/* Inversão de risco: último pensamento antes do clique, colado nos botões */}
            <p className="flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-gray-600">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              Si no te sirve, no pagas: garantía de 7 días. Y el plan es tuyo igual.
            </p>

            <PaymentTrust />
          </div>
        </div>

        {/* Garantía */}
        <div className="flex items-center gap-3 rounded-2xl border border-[#D8E8D4] bg-[#F5FAF2] p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D8E8D4] bg-white">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Garantía total de 7 días</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sigue tu plan 7 días. Si no notas ningún cambio, te devolvemos el 100% y el plan es tuyo igual.
            </p>
          </div>
        </div>

        <FaqSection />

        {/* CTA final — após perguntas frequentes */}
        <div ref={pageEndRef} className="space-y-3 pb-10">
          <button
            onClick={handleCta}
            disabled={ctaState === 'loading'}
            className={[
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
              'bg-[#D85A30] shadow-[0_4px_20px_0_rgba(216,90,48,0.38)] transition-all duration-150',
              'hover:shadow-[0_6px_28px_0_rgba(216,90,48,0.48)] hover:brightness-[1.05] active:scale-[0.99]',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
            ].join(' ')}
          >
            {ctaState === 'loading' ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                Procesando…
              </>
            ) : (
              `QUIERO MI RETO ahora (${price(9.90)}) →`
            )}
          </button>
          <PaymentTrust />
        </div>

      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// FAQ — quebra as 5 objeções mais comuns antes do CTA final
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: '¿Hay suscripción o cobros recurrentes?',
    a: 'No. Es un pago único, sin suscripción y sin cobros automáticos. Pagas una vez y el acceso a tu plan es tuyo para siempre.',
  },
  {
    q: '¿Funciona si tengo restricciones alimentarias o tiroides?',
    a: 'Sí. Durante el quiz indicaste tus preferencias y condiciones. El plan se arma con eso, y las sustituciones te permiten adaptar cualquier comida a lo que tienes disponible.',
  },
  {
    q: '¿Cómo y cuándo recibo mi plan?',
    a: 'En minutos después de tu compra recibes un correo con acceso a tu panel personal, donde puedes ver tu plan completo, descargarlo en PDF y consultarlo cuando quieras.',
  },
  {
    q: '¿Es seguro comprar aquí? ¿Qué pasa con mis datos?',
    a: 'Sí. El pago se procesa por Hotmart, una plataforma usada por millones de personas en Latinoamérica, con las mismas protecciones que cualquier compra online segura. Tus datos solo se usan para generar y enviarte tu plan.',
  },
]

function FaqSection() {
  return (
    <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
      <div className="flex items-center gap-2 border-b border-[#EAF2E6] px-5 py-3">
        <p className="font-display text-[16px] font-bold text-gray-900">
          Preguntas frecuentes
        </p>
      </div>
      <div className="divide-y divide-[#EAF2E6]">
        {FAQ_ITEMS.map(({ q, a }) => (
          <details key={q} className="group px-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-3.5 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span>{q}</span>
              <span className="mt-0.5 shrink-0 text-xl font-light text-primary leading-none transition-transform duration-150 group-open:rotate-45">+</span>
            </summary>
            <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contador de urgência — preço especial expira (persiste na sessão)
// ---------------------------------------------------------------------------

function Countdown() {
  const [secs, setSecs] = useState<number | null>(null)

  useEffect(() => {
    const KEY = 'nutriplan_offer_deadline'
    let deadline = Number(sessionStorage.getItem(KEY))
    if (!deadline || deadline < Date.now()) {
      deadline = Date.now() + 10 * 60 * 1000 // 10 minutos
      sessionStorage.setItem(KEY, String(deadline))
    }
    const tick = () => setSecs(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (secs === null) return null

  // Quando o contador zera, não congelamos em "00:00" (parece fake e quebra
  // a credibilidade). Trocamos por uma mensagem de escassez honesta e estável.
  if (secs === 0) {
    return (
      <div className="sticky top-14 z-10 flex w-full items-center justify-center gap-2 border-b border-[#F3D2C3] bg-[#FBE7DF] py-1.5 shadow-sm">
        <Clock className="h-4 w-4 shrink-0 text-[#993C1D]" />
        <span className="text-sm font-semibold text-[#993C1D]">
          Tu plan personalizado sigue reservado por hoy
        </span>
      </div>
    )
  }

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <div className="sticky top-14 z-10 flex w-full items-center justify-center gap-2 border-b border-[#F3D2C3] bg-[#FBE7DF] py-1.5 shadow-sm">
      <Clock className="h-4 w-4 shrink-0 text-[#993C1D]" />
      <span className="text-sm font-semibold text-[#993C1D]">
        Tu plan personalizado se guarda por {mm}:{ss}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trust signals (logos de pago + badges) — vão logo abaixo do CTA principal
// ---------------------------------------------------------------------------

function PaymentTrust() {
  return (
    <div className="space-y-2">
      {/* Logos de bandeiras */}
      <div className="flex items-center justify-center gap-2 pt-0.5">
        {/* VISA */}
        <div className="flex h-7 w-12 items-center justify-center rounded-md border border-[#E0E0DA] bg-white">
          <svg viewBox="0 0 48 16" width="36" height="12" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="13" fontFamily="Arial" fontSize="16" fontWeight="900" fontStyle="italic" fill="#1A1F71">VISA</text>
          </svg>
        </div>
        {/* Mastercard */}
        <div className="flex h-7 w-12 items-center justify-center rounded-md border border-[#E0E0DA] bg-white">
          <svg viewBox="0 0 38 24" width="32" height="20" xmlns="http://www.w3.org/2000/svg">
            <circle cx="13" cy="12" r="11" fill="#EB001B"/>
            <circle cx="25" cy="12" r="11" fill="#F79E1B"/>
            <path d="M19 3.5a11 11 0 0 1 0 17 11 11 0 0 1 0-17z" fill="#FF5F00"/>
          </svg>
        </div>
        {/* PayPal */}
        <div className="flex h-7 w-14 items-center justify-center rounded-md border border-[#E0E0DA] bg-white px-1">
          <svg viewBox="0 0 60 20" width="44" height="14" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#003087">Pay</text>
            <text x="28" y="15" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#009CDE">Pal</text>
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[13px] text-muted-foreground">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Pago seguro</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Acceso inmediato</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Garantía 7 días</span>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Shell da página com header de marca
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen font-poppins"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(120,24%,95%) 110px, hsl(40,32%,97%) 320px)',
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
  icon,
  badge,
  children,
}: {
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
      <div className="flex items-center justify-between border-b border-[#EAF2E6] px-5 py-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-sm">{icon}</span>
          )}
          <p className="font-display text-[16px] font-bold text-gray-900">{label}</p>
        </div>
        {badge}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={[
      'rounded-xl border p-3 text-center',
      accent ? 'border-primary/25 bg-primary/5' : 'border-[#E0EDD9] bg-[#FAFCF8]',
    ].join(' ')}>
      <div className="flex justify-center text-primary">{icon}</div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
      <p className={['mt-0.5 text-xs font-bold leading-tight', accent ? 'text-primary' : 'text-gray-800'].join(' ')}>{value}</p>
    </div>
  )
}

function ImcScale({ imc }: { imc: number }) {
  const pct = Math.max(2, Math.min(96, ((imc - 10) / 30) * 100))
  return (
    <div className="relative pt-5">
      <div
        className="absolute -translate-x-1/2 text-base leading-none text-[#D85A30] drop-shadow-sm"
        style={{ left: `${pct}%`, top: 0 }}
      >▼</div>
      <div
        className="h-3 rounded-full"
        style={{ background: 'linear-gradient(to right, #93c5fd 0%, #4ade80 32%, #fde047 62%, #f87171 100%)' }}
      />
    </div>
  )
}

