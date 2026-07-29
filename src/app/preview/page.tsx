'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Gauge, Flame, Cake, Scale, Ruler, Target, Zap,
  Sunrise, Utensils, Moon, Apple, ShoppingCart, ShieldCheck, Check, Lock, RotateCcw, BadgeCheck,
  Mail, MessageCircle, Smartphone, Dumbbell,
} from 'lucide-react'
import Image from 'next/image'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'
import { buildPreviewSample, type SampleMeal, type PreviewSample } from '@/lib/nutrition/generate'
// Os combos vêm do MESMO módulo que o gerador usa: a preview nunca pode
// prometer um combo que o plano entregue não tenha.
import { COMBOS, COMBOS_BY_ID, type Combo } from '@/lib/nutrition/combos'
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

// Sub-headline del hero: dice el objetivo específico de ella + hasta 2
// obstáculos reformulados. La headline ya nombra el producto tangible (el
// plan); esta línea dice el objetivo y para quién es, no vende una promesa
// genérica de transformación.
interface HeroSubheadline {
  prefix: string
  // Trecho numérico (promessa de kg) isolado pra poder destacar em cor/peso
  // no render, sem quebrar o resto da frase.
  highlight?: string
  suffix: string
}

function buildHeroSubheadline(goal: string, obstacles: string[]): HeroSubheadline {
  const objectiveByGoal: Record<string, { prefix: string; highlight?: string }> = {
    lose_fat:    { prefix: 'Para bajar ', highlight: 'hasta 4 kg en 1 mes' },
    perder_peso: { prefix: 'Para bajar ', highlight: 'hasta 4 kg en 1 mes' },
    gain_muscle: { prefix: 'Para ganar músculo comiendo bien' },
    ganar_masa:  { prefix: 'Para ganar músculo comiendo bien' },
  }
  const { prefix, highlight } = objectiveByGoal[goal] ?? { prefix: 'Para llegar a tu meta, sin dietas genéricas' }

  const tails = obstacles
    .map((o) => OBSTACLE_HERO_PHRASE[o])
    .filter(Boolean)
    .slice(0, 2)

  const suffix = tails.length === 0 ? '.' : `, ${tails.join(' y ')}.`

  return { prefix, highlight, suffix }
}

// Resultados reales de pacientes (fotos con consentimiento por escrito).
// Nombres hispanos para generar identificación en los mercados meta (MX/CO/CL/ES).
// Ordem escolhida: Camila abre com o maior número, Fernanda vem em segundo
// porque a fala dela é a única que prova sozinha o argumento do app (a dieta
// no celular sustentando a constância), e o card 2 é o que aparece cortado
// na borda sem precisar rolar.
const RESULTS: {
  photo: string; name: string; country: string; age: number
  result: string; w: number; h: number; quote?: string
}[] = [
  {
    photo: '/resultados/caso-1.png', name: 'Camila', country: '🇲🇽', age: 38, result: '−17 kg en 8 meses', w: 414, h: 444,
    quote: 'Pagar un nutricionista y un entrenador por separado no me alcanzaba. Aquí tuve las dos cosas juntas y hechas para mí. En el primer mes ya había bajado 3 kilos, y lo mejor fue dejar de sentirme culpable cada vez que comía algo.',
  },
  {
    photo: '/resultados/caso-3.png', name: 'Fernanda', country: '🇨🇱', age: 29, result: '−7 kg en 3 meses', w: 402, h: 430,
    quote: 'Lo pensé mucho antes de comprar porque creía que tal vez no iba a funcionar para mí. Pero cuando empecé a usarlo descubrí que no hacía falta ningún milagro para bajar de peso, solo seguir una dieta armada especialmente para mi rutina y para mi cuerpo. Cuando entendí eso, el resultado llegó rápido y de forma natural.',
  },
  {
    photo: '/resultados/caso-4.png', name: 'Carolina', country: '🇪🇸', age: 42, result: '−10 kg en 4 meses', w: 407, h: 436,
    quote: 'Lo que más me gustó de la Calibración Metabólica fue que la dieta está basada en cosas que me gustan y que ya compro en el día a día. No tuve que buscar alimentos ni suplementos difíciles de conseguir, y me sentí mucho más joven.',
  },
  {
    photo: '/resultados/caso-2.png', name: 'Noelia', country: '🇵🇾', age: 42, result: '−8 kg en 3 meses', w: 1080, h: 1350,
    quote: 'Es maravilloso tener toda mi dieta en el celular, eso ayuda muchísimo a mantener la constancia y a no abandonar. Fue la primera vez que logré seguir el paso a paso, y bajé de peso sin dificultades.',
  },
  {
    photo: '/resultados/caso-5.png', name: 'Yuliana R.', country: '🇨🇴', age: 27, result: '9 meses de transformación', w: 640, h: 842,
    quote: 'Nunca imaginé que en 9 meses iba a conseguir el cuerpo de mis sueños. Hoy estoy en mi mejor etapa. No sabía los secretos para quemar grasa más rápido y acelerar el metabolismo, y por eso no tenía motivación ni para alimentarme bien ni para entrenar. Después de conocer a la doctora María Fernanda mi vida cambió completamente y estoy muy agradecida por todo.',
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

// Destaca que ESTA refeição não é uma composição qualquer: executa um combo
// específico do Método CALIBRA. O benefício vem legível (é o que gera desejo),
// o nome/execução exata do combo vem borrado (é o que ela paga para destravar).
// Mesmo padrão visual do resto do teaser (nítido = grátis, borrado = trancado).
function ComboTease({ combo, benefit }: { combo: Combo; benefit: string }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-[#EAF2E6] bg-gradient-to-r from-primary/10 to-primary/5 px-3.5 py-3">
      <span className="mt-0.5 shrink-0 text-lg">{combo.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold leading-snug text-gray-900">{benefit}</p>
        <p className="mt-1 select-none text-[11px] font-semibold leading-snug text-primary/70 blur-[3px]">
          Método CALIBRA · Combo {combo.letter} ({combo.name}): {combo.action}
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
          <Lock className="h-2.5 w-2.5" /> Se revela completo en tu app
        </p>
      </div>
    </div>
  )
}

// Uma refeição do teaser enxuto — só o 1º alimento (real, dos favoritos dela)
// aparece nítido; o resto vem com a foto real só que desfocada, deixando claro
// que TODO o prato é feito com os favoritos, não só o primeiro item.
function TeaserMealBlurred({ meal, combo, comboBenefit }: { meal: SampleMeal; combo?: Combo; comboBenefit?: string }) {
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
      {combo && comboBenefit && <ComboTease combo={combo} benefit={comboBenefit} />}
      <div className="flex items-center gap-1.5 bg-[#F5FAF2] px-3.5 py-2 text-[11px] font-semibold text-primary">
        <Lock className="h-3 w-3 shrink-0" />
        Los otros {rest.length} también son tuyos, elegidos por ti. Se revelan completos en tu app.
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

// Qual combo do Método CALIBRA se destaca em cada tipo de refeição do teaser,
// e o benefício (legível) que acompanha. São combos reais de combos.ts — a
// escolha aqui é ilustrativa (o combo do dia de verdade roda por rotação, ver
// comboForDay em generate.ts), mas a combinação em si é a que de fato se aplica
// a esse tipo de refeição no ciclo real.
const MEAL_TEASE: Record<string, { comboId: string; benefit: string }> = {
  Desayuno: { comboId: 'lleno', benefit: 'Esta combinación cierra tu hambre por horas, sin que tengas que comer de más.' },
  Almuerzo: { comboId: 'inverso', benefit: 'Esta combinación evita el bajón de las 3 de la tarde que te manda directo a picar algo.' },
}

type ErrorKind = 'no_session' | 'calc_failed' | 'network'

export default function PreviewPage() {
  const router = useRouter()
  const [data, setData] = useState<PreviewData | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)
  const [leadInfo, setLeadInfo] = useState<{ email?: string; name?: string }>({})
  const [training, setTraining] = useState<{ experience?: string; location?: string; frequency?: string } | null>(null)
  // true só quando ela respondeu explicitamente que não treina (step 10) —
  // diferente de não ter passado pelo step, onde não sabemos nada dela.
  const [noTraining, setNoTraining] = useState(false)
  const [inputCount, setInputCount] = useState<number | null>(null)
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'error'>('idle')
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
        else if (parsed.experience === 'no_ejercicio') setNoTraining(true)
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
  // Sub-headline do hero, personalizada pelo objetivo + obstáculos dela.
  const heroSubheadline = buildHeroSubheadline(targets.goal, heroObstacles)

  return (
    <PageShell>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-4 pt-6 pb-5 text-center space-y-3">
        {/* Badge de conclusão. Texto enxuto de propósito: com o peso de fonte
            mais forte do site, a frase completa ("...ya está hecha · solo
            para ti") não cabia numa linha só e o check ficava flutuando no
            meio de 2 linhas. items-start é rede de segurança pra telas bem
            estreitas onde ainda quebre. */}
        <div className="inline-flex items-start gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(15,110,86,0.25)]">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} />
          {/* firstName nunca vem preenchido hoje (step12 parou de capturar nome,
              ver comentário em step12-form.tsx) — mantido pronto pra quando
              essa captura voltar, sem usar aqui pra não quebrar o texto. */}
          Tu Calibración Metabólica, lista para ti
        </div>

        {/* Headline tangibiliza el producto (el plan calculado); la sub-headline
            dice el objetivo/para quién es. No vendemos una transformación
            genérica, vendemos el plan concreto que ya está armado. */}
        <h1 className="font-display text-[26px] font-black leading-[1.15] text-gray-900">
          Tu <span className="text-primary">Método CALIBRA</span>, calculado para tu cuerpo
        </h1>
        <p className="text-sm font-semibold text-gray-700">
          {heroSubheadline.prefix}
          {heroSubheadline.highlight && (
            <span className="font-black text-primary">{heroSubheadline.highlight}</span>
          )}
          {heroSubheadline.suffix}
        </p>

        {/* Selos de personalización — refuerzan que no es una plantilla genérica.
            O selo de app vem primeiro e é incondicional: sem ele a headline
            ("plan de comidas") deixa a leitora assumir PDF, e a prova em video
            só aparece ~900px abaixo. */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-bold text-primary">
            <Smartphone className="h-3 w-3" strokeWidth={2.5} />
            La app se instala en tu celular
          </span>
          {(inputCount || training) && (
            <>
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
            </>
          )}
        </div>

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
            <p className="text-base font-bold text-gray-800">Este es tu número exacto.</p>
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
          Ya está todo armado por ti. No tienes que calcular ni decidir nada: el Método CALIBRA ya hizo el trabajo, solo abres tu plan y sigues las 7 combinaciones.
        </p>
      </div>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-4 pb-24 space-y-5">

        {/* Prova social imediata — dobra "prova social" logo após o hook.
            2 de los 4 casos reales (RESULTS) aparecen aquí en grade fija;
            los otros 2 siguen en el carrusel más abajo, junto al resto de
            la narrativa de resultados. Mismos datos, sin inventar nada. */}
        <div className="grid grid-cols-2 gap-2.5">
          {RESULTS.slice(0, 2).map(({ photo, name, country, age, result, w, h }) => (
            <div key={name} className="overflow-hidden rounded-xl border border-[#D8E8D4] bg-[#F5FAF2]">
              <Image
                src={photo}
                alt={`Antes y después de ${name}`}
                width={w}
                height={h}
                className="h-auto w-full"
              />
              <div className="space-y-1 p-2.5">
                <span className="inline-block rounded-full bg-primary px-2 py-0.5 text-[12px] font-black text-white">
                  {result}
                </span>
                <p className="text-xs font-bold text-gray-800">{country} {name}, {age}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Agita a dor — espeja las voces de la cabeza (dudas reales antes de
            comprar) y responde cada una señalando un villano externo (dietas
            genéricas, falta de tiempo), nunca a ella. Regla dura del proyecto:
            nunca "no tuviste disciplina", siempre "el método anterior falló". */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3.5 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <SectionHeading title={<>¿Te suena <Hl>conocido</Hl>?</>} />
          <div className="space-y-2.5">
            {[
              {
                voice: '"Ya lo intenté todo y nada funcionó."',
                reframe: 'No era falta de disciplina: eran dietas genéricas que no se ajustaban a tu cuerpo.',
              },
              {
                voice: '"No tengo tiempo para dietas complicadas."',
                reframe: 'El problema es que te pedían tiempo que no tienes, no que tú no puedas hacerlo.',
              },
              {
                voice: '"Tengo miedo de ilusionarme otra vez."',
                reframe: 'Esta vez el plan se ajusta a ti, no al revés. Por eso es diferente.',
              },
            ].map(({ voice, reframe }) => (
              <div key={voice} className="rounded-xl border border-[#EAF2E6] bg-[#F9FBF7] p-3.5 space-y-1.5">
                <p className="text-[13px] italic leading-snug text-gray-500">{voice}</p>
                <p className="text-[13px] font-semibold leading-snug text-gray-800">{reframe}</p>
              </div>
            ))}
          </div>
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
            {sample.slice(0, 2).map((meal) => {
              const tease = MEAL_TEASE[meal.name]
              const combo = tease ? COMBOS_BY_ID[tease.comboId] : undefined
              return (
                <TeaserMealBlurred key={meal.name} meal={meal} combo={combo} comboBenefit={tease?.benefit} />
              )
            })}
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

        {/* ── Mecanismo: los 7 combos ─────────────────────────────
            Vive AQUI, entre o teaser do plano e a prova social: ela acabou de
            ver O QUE come, agora entende POR QUE isso funciona diferente, e só
            depois vê prova e preço. É a seção que justifica o ticket.
            Regra dura: nomes e taglines vêm de combos.ts, nunca hardcoded, e a
            AÇÃO de cada combo fica travada (é o que ela compra). */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-4 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <div className="space-y-1.5 text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
              <Flame className="h-3 w-3" /> El mecanismo
            </p>
            <p className="font-display text-xl font-black leading-tight text-gray-900">
              No es que comas menos. Es que dejas de tener hambre.
            </p>
          </div>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Todas las dietas que probaste fallaron por lo mismo: te pedían aguantar. La Calibración
            Metabólica no te pide aguantar nada. Combina tus alimentos de una forma específica para que
            el hambre baje sola. Y cuando el hambre baja, comes menos sin proponértelo, sin contar nada
            y sin pelear contigo misma.
          </p>

          {/* Revelação do acrônimo ANTES da lista: ela precisa saber que o
              método tem nome antes de ler os 7 itens, senão a lista vira uma
              lista de dicas soltas em vez de um sistema fechado. */}
          <div className="rounded-xl border border-primary/25 bg-[#F5FAF2] px-4 py-3.5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              A ese método lo llamamos
            </p>
            <div className="mt-2 flex justify-center gap-1.5">
              {COMBOS.map((c) => (
                <span
                  key={c.id}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-base font-black text-white shadow-sm"
                >
                  {c.letter}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-gray-700">
              Una letra por combinación. Las 7 juntas forman <strong className="font-bold text-primary">CALIBRA</strong>: el nombre nace de tu{' '}
              <span className="font-bold text-primary">Calibra</span>ción{' '}
              <span className="font-bold text-primary">Metabol</span>ica, porque eso es justo lo que hacen. Calibran tu hambre y aceleran tu metabolismo, día a día.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-2.5 text-center">
              <p className="text-lg font-black leading-none text-primary">30%</p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                de las calorías de la proteína se gastan solo en digerirla
              </p>
            </div>
            <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-2.5 text-center">
              <p className="text-lg font-black leading-none text-primary">2,5x</p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                más grasa quemada frente al grupo control, en estudios clínicos
              </p>
            </div>
            <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-2.5 text-center">
              <p className="text-lg font-black leading-none text-primary">7</p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                combinaciones, una por día, de 10 segundos cada una
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {COMBOS.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#D8E8D4] bg-white p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-[13px] font-black text-white">
                  {c.letter}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-900">
                    {c.emoji} {c.name}
                  </p>
                  <p className="text-[12px] leading-snug text-muted-foreground">{c.tagline}</p>
                </div>
                <Lock className="h-3.5 w-3.5 shrink-0 text-primary/50" />
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-primary px-4 py-3.5 text-center">
            <p className="text-[13px] font-bold leading-snug text-white">
              No tienes que memorizar ninguna. Cada día tu app te muestra la combinación de ese día,
              con la cantidad exacta y el momento en que se toma.
            </p>
          </div>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Cada dato de esta página viene de estudios publicados. Te los enviamos por correo junto a tu
            plan, para que los leas tú misma.
          </p>
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
            <p className="text-[11px] font-semibold text-muted-foreground">
              Desliza para ver más →
            </p>
          </div>

          {/* Carrossel horizontal com os 2 casos restantes (Camila e Fernanda já
              apareceram logo cedo, ver bloco de prova social após o hero).
              O card cortado na borda direita é a affordance de que tem mais.
              -mx-5/px-5 anula o padding do container pra o corte encostar na
              borda do bloco, senão o peek parece bug de layout. */}
          <div className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RESULTS.slice(2).map(({ photo, name, country, age, result, w, h, quote }) => (
              <div
                key={name}
                className="flex w-[64%] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[#D8E8D4] bg-[#F5FAF2]"
              >
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
                  {quote && (
                    <p className="text-[11px] italic leading-snug text-gray-600">&ldquo;{quote}&rdquo;</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] leading-relaxed text-[#B7C3B2]">
            Resultados individuales. Varían según cada persona, su constancia y su punto de partida.
          </p>
        </div>

        {/* App instalable — prueba en video de que no es un PDF suelto, es un
            panel que vive en el celular (mismo ángulo "desde tu celular" del
            párrafo de arriba, ahora mostrado, no solo dicho). */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3.5 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <SectionHeading
            title={<>Tu Calibración Metabólica, ahora en <Hl>una app</Hl></>}
            subtitle="No es un PDF que se pierde en tus descargas. Se instala en tu celular con el ícono en la pantalla, y ahí está tu plan cada vez que abres la nevera."
          />
          {/* Moldura de celular: o video em si é uma tela recortada, sem
              proporção fixa de aparelho, então "object-contain" + bezel
              escura disfarça sobra/corte como se fosse a moldura mesmo. */}
          <div className="relative mx-auto w-full max-w-[230px] rounded-[2.2rem] bg-[#141416] p-2 shadow-[0_16px_38px_rgba(0,0,0,0.28)]">
            {/* Botões laterais (decorativos) */}
            <div className="absolute -left-[2px] top-[76px] h-9 w-[3px] rounded-l-sm bg-[#2a2a2c]" />
            <div className="absolute -left-[2px] top-[120px] h-9 w-[3px] rounded-l-sm bg-[#2a2a2c]" />
            <div className="absolute -right-[2px] top-[96px] h-12 w-[3px] rounded-r-sm bg-[#2a2a2c]" />

            <div className="relative overflow-hidden rounded-[1.7rem] bg-black">
              <video
                src="/app-nutriplan-demo.mp4"
                controls
                playsInline
                preload="metadata"
                className="block aspect-[9/19.5] w-full bg-black object-contain"
              />
              {/* Home indicator */}
              <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 h-1 w-16 -translate-x-1/2 rounded-full bg-white/60" />
            </div>
          </div>
        </div>

        {/* Claim realista + ângulo anti-Ozempic. "Hasta 1 kg/semana" é ritmo
            sustentável e defensável (não promete X kg), e o "sin Mounjaro ni
            Ozempic" pega a onda cultural atual como diferencial. Sem garantia. */}
        <div className="overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Sin inyecciones ni pastillas</p>
          <p className="font-display text-[19px] font-black leading-snug text-gray-900">
            Baja hasta <span className="text-primary">1 kg por semana</span>, sin Mounjaro ni Ozempic
          </p>
          <p className="text-sm leading-relaxed text-gray-700">
            No necesitás inyecciones ni pastillas para adelgazar. Con la Calibración Metabólica™ y comida real, tu cuerpo baja de forma sostenible, al ritmo que tu cuerpo considera saludable.
          </p>
          <p className="text-[11px] leading-relaxed text-[#B7C3B2]">
            Ritmo estimado y sostenible. Los resultados varían según cada persona, su constancia y su punto de partida.
          </p>
        </div>

        {/* Autoridade — reduzida ao essencial: foto pequena + nome + 1 frase +
            2 números. Vive AQUI, logo antes da oferta: é a última coisa que a
            pessoa vê antes do preço, reforçando "quem está por trás" no
            momento exato da decisão (em vez de lá em cima, longe do CTA). */}
        <div className="overflow-hidden rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Image
                src="/FotoNutri.jpg"
                alt="María Fernanda, Nutricionista"
                width={56}
                height={56}
                className="h-14 w-14 rounded-full object-cover object-top border-2 border-[#D8E8D4]"
              />
              <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full text-[#3897F0] bg-white shadow" strokeWidth={2.2} fill="#3897F0" stroke="white" />
            </div>
            <div>
              <p className="font-display text-base font-black text-gray-900">María Fernanda</p>
              <p className="text-[13px] font-semibold text-muted-foreground">Nutricionista · Responsable técnica</p>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            La Calibración Metabólica fue desarrollada bajo la orientación de una profesional de la nutrición: un método de 7 combinaciones (CALIBRA) diseñado para adaptar tu alimentación a tus objetivos, tus antojos y tu rutina real.
          </p>

          <div className="grid grid-cols-2 gap-3 border-t border-[#D8E8D4] pt-4">
            <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-3 text-center">
              <p className="text-2xl font-black text-primary">+2.000</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">mujeres acompañadas con nuestra metodología</p>
            </div>
            <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-3 text-center">
              <p className="text-2xl font-black text-primary">6 años</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">de experiencia clínica</p>
            </div>
          </div>

          {/* Soporte por WhatsApp — vive aquí (junto a quién es él), não repetido na oferta.
                Promete SUPORTE, não acesso pessoal à nutricionista (evita expectativa de
                consulta individual incompatível com o ticket de $9.90). */}
            <div className="flex items-center gap-3 rounded-xl border border-[#25D366]/35 bg-[#25D366]/8 px-3.5 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] shadow-[0_2px_8px_rgba(37,211,102,0.35)]">
                <svg viewBox="0 0 24 24" fill="#fff" className="h-6 w-6">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">Soporte directo por WhatsApp</p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">No estás por tu cuenta. Recibes soporte por WhatsApp después de tu compra ante cualquier duda.</p>
              </div>
            </div>
        </div>

        {/* Cómo funciona — a propósito reducido a 4 pasos bien simples, sem
            explicar o mecanismo de novo (isso já foi feito em "El mecanismo").
            Objetivo único desta dobra: parecer extremamente fácil de fazer. */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-4 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <SectionHeading title={<>Así de <Hl>fácil</Hl> es</>} subtitle="Cuatro pasos. Nada más." />
          <div className="space-y-2.5">
            {[
              { n: 1, text: 'Adquieres el Método CALIBRA' },
              { n: 2, text: 'Descargas la app en tu celular' },
              { n: 3, text: 'Ves y ejecutas la combinación del día' },
              { n: 4, text: 'Sientes los resultados desde los primeros días' },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-center gap-3 rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-black text-white">
                  {n}
                </span>
                <p className="text-sm font-bold text-gray-900">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Oferta con ancla de valor */}
        <div ref={offerRef} className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-white shadow-[0_10px_34px_rgba(15,110,86,0.13)]">
          {/* Header colorido */}
          <div className="bg-primary px-5 py-3 text-center">
            <p className="text-[13px] font-bold uppercase tracking-widest text-white/80">
              {isLoss ? 'Tu Calibración Metabólica para bajar de peso'
                : isGain ? 'Tu Calibración Metabólica para ganar músculo'
                : 'Tu Calibración Metabólica'}
            </p>
            <p className="text-base font-black text-white">
              ¡Tu Calibración Metabólica está lista. Empieza hoy!
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Mecanismo Único — destacado como THE product, não como feature.
                O acrônimo CALIBRA (os 7 combos, ver combos.ts) é a parte
                EXECUTÁVEL do mecanismo: não é mais "calcula por ti", é "ella
                hace 7 cosas concretas y el hambre baja". */}
            <div className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Funciona con el Método CALIBRA™</p>
                  <p className="text-[13px] text-muted-foreground">7 combinaciones diarias validadas por María Fernanda, para que tu cuerpo pida menos comida en vez de que tú se lo prohíbas</p>
                </div>
              </div>
              <div className="flex justify-center gap-1.5">
                {COMBOS.map((c) => (
                  <span
                    key={c.id}
                    title={c.name}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[13px] font-black text-white"
                  >
                    {c.letter}
                  </span>
                ))}
              </div>
            </div>

            {/* Refuerzo del ángulo ganador (antojos/sostenibilidad) en el punto de
                decisión — congruencia con el anuncio que trae a la persona */}
            <p className="text-center text-[13px] font-semibold text-gray-800">
              Un plan pensado para tu vida real: incluye tus antojos y tu rutina, para que no lo abandones a los 3 días.
            </p>

            {/* Sistema de 2 peças — o plano (execução das 7 combos) + o
                calendário (o que sustenta a execução de forma contínua). Fotos
                reais (não ícone genérico) pra não ler como "só um plan de
                comidas": ela vê a mulher usando o app na cozinha e marcando
                o calendário, mesma linguagem visual da seção de resultados. */}
            <div>
              <p className="text-center text-[13px] leading-relaxed text-gray-700">
                Saber las 7 combinaciones no alcanza si las dejas a la mitad. Por eso tu Calibración Metabólica viene en dos partes:
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="overflow-hidden rounded-xl border border-primary/25 bg-white">
                  <Image
                    src="/foto-app-celular.png"
                    alt="Ejecutando el Método CALIBRA desde la app"
                    width={454}
                    height={805}
                    className="w-full aspect-[4/5] object-cover object-center"
                  />
                  <div className="p-3">
                    <p className="text-[13px] font-bold text-gray-900">El plan: tus 7 secretos aplicados</p>
                    <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                      Cada día ya viene con el Método CALIBRA ejecutado: sabes exactamente qué combinación toca hoy, sin adivinar nada.
                    </p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-primary">El camino</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-primary/25 bg-white">
                  <Image
                    src="/foto-calendario.png"
                    alt="Marcando tu calendario de constancia"
                    width={941}
                    height={1672}
                    className="w-full aspect-[4/5] object-cover object-center"
                  />
                  <div className="p-3">
                    <p className="text-[13px] font-bold text-gray-900">El calendario: para no abandonar</p>
                    <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                      Marcas cada día que cumples tus combinaciones. Es lo que hace que el método se sostenga las 4 semanas, no solo los primeros días.
                    </p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-primary">Tu seguimiento</p>
                  </div>
                </div>
              </div>
              <div className="mt-2.5 rounded-xl bg-primary px-4 py-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Juntos =</p>
                <p className="text-base font-black text-white">Tu transformación continua</p>
              </div>
              <p className="mt-2.5 text-center text-[13px] leading-relaxed text-gray-700">
                Un plan solo no alcanza, por eso las dietas se abandonan. El Método CALIBRA es lo que te sostiene en el tiempo, y el calendario te muestra que está funcionando.
              </p>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Todo lo que incluye tu Calibración Metabólica</p>
              <p className="mb-2.5 text-[12px] text-gray-500">Para que veas exactamente qué te llevás, no un &ldquo;paquete&rdquo; sin nombre.</p>
              <ul className="space-y-2.5">
                {[
                  // O app abre a lista: é o item que ancora o valor de todos os
                  // outros (não é um pacote de PDFs soltos). "Panel" era palavra
                  // nossa, não dela.
                  { item: 'Tu app con tu Calibración Metabólica instalada en el celular', note: 'tu plan, tu lista y tu calendario en un solo toque, sin buscar archivos' },
                  { item: 'El Método CALIBRA: tus 7 combinaciones diarias', note: 'una por día, con la cantidad exacta y el momento en que se toma' },
                  { item: 'Tu plan de comidas, calculado para tu cuerpo', note: 'aunque ya hayas probado otras dietas sin resultado' },
                  { item: 'Tu calendario para marcar tu avance', note: 'lo que te sostiene para no abandonar en la semana 2' },
                  { item: 'Lista de compras optimizada', note: 'incluye lo que necesitas para el Método CALIBRA' },
                  { item: 'Sustituciones para cada comida', note: 'si un día no tienes un ingrediente, lo cambias' },
                  { item: 'Bono: Guía Anti-Celulitis', note: null },
                  { item: 'Calendario descargable para imprimir', note: null },
                ].map(({ item, note }) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="flex-1">
                      {item}
                      {note && <span className="block text-[12px] leading-snug text-muted-foreground">{note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pra quem é — autoqualifica antes do preço: reduz reembolso de
                quem compra achando que é milagre de 1 semana, e a bullet
                "no es para ti" é a que dá credibilidade ao resto (só promete
                o que promete mesmo). */}
            <div className="rounded-xl border border-primary/25 bg-[#F5FAF2] p-4 space-y-2.5">
              <p className="text-center text-[11px] font-bold uppercase tracking-widest text-primary">¿Es para ti?</p>
              <ul className="space-y-1.5">
                {[
                  'Quieres bajar de peso sin pasarte el día contando calorías',
                  'No tienes tiempo para armar tu propia dieta desde cero',
                  'Ya probaste dietas genéricas que no se ajustaron a ti',
                  'Prefieres un plan que se adapte a tus antojos, no al revés',
                  'Te interesa un método con mecanismo propio (las 7 combinaciones CALIBRA), no una lista de comidas sin explicación',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[13px] text-gray-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={3} />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-[12px] leading-snug text-muted-foreground">
                No es para ti si buscas bajar 10 kg en una semana. Ningún método sano hace eso, y tampoco el nuestro.
              </p>
            </div>

            {/* Precio directo, sin empilhamento tipo "vale $1000" (lógica de
                high ticket que soaria falso aqui). A âncora é uma comparação
                honesta e modesta: o que custaria montar isso por conta própria. */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-4 text-center space-y-2.5">
              <p className="text-[13px] leading-relaxed text-gray-700">
                Armar esto por tu cuenta (una app de seguimiento, un plan a tu medida, un calendario de constancia) fácilmente costaría más de <strong className="font-bold text-gray-900">{price(47)}</strong>.
              </p>
              <p className="text-sm text-gray-800">Hoy, en un solo pago:</p>
              <p className="text-[2.5rem] font-black leading-none text-primary tabular-nums">{price(9.90)}</p>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Un solo pago, sin suscripción ni cobros cada mes.
              </p>
            </div>

            {/* Menção única ao bump de treino, condicionada à resposta do step 10.
                Pra quem treina: confirma a expectativa de quem chegou pelo
                criativo "dieta + treino". Pra quem respondeu que não treina:
                vira menção de personalização (sabemos que ela não vai à
                academia) em vez de empurrar o bump, mencionando a opção de
                treinar em casa sem forçar a venda. O bump em si é configurado
                no painel da Hotmart (checkoutMode=10 acima). */}
            {(training || noTraining) && (
              <p className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-gray-600">
                <Dumbbell className="h-3.5 w-3.5 text-primary" />
                {training
                  ? '¿Entrenas? En el siguiente paso podrás sumar tu plan de entrenamiento.'
                  : 'Aunque no vayas al gimnasio, si quieres puedes sumar rutinas para entrenar en casa en el siguiente paso.'}
              </p>
            )}

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
                  `Ver mi plan por ${price(9.90)} →`
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
              Si no te sirve, no pagas: garantía de 14 días, sin preguntas. Y el plan es tuyo igual.
            </p>

            {/* "Qué pasa apenas pagas": mata a objeção nº1 de ticket baixo no
                LatAm no exato momento do preço, "e se eu pagar e não receber
                nada / for golpe?". No dado, 167 pessoas viram o preço e saíram;
                a maioria não sai por preço ($9.90 já é baixo), sai por
                desconfiança. Aqui a entrega vira concreta e verificável, com
                pessoa real por trás, sem esconder na FAQ (que fica fechada). */}
            <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] px-4 py-3.5 space-y-2.5">
              <p className="text-center text-[11px] font-bold uppercase tracking-widest text-primary">Apenas pagas, esto pasa</p>
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-[13px] leading-snug text-gray-700">
                  Recibes un correo <strong>en minutos</strong> con el enlace para instalar tu app. Tu plan ya está generado adentro, no esperas nada.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-[13px] leading-snug text-gray-700">
                  Recibes <strong>soporte por WhatsApp</strong> por si tienes cualquier duda. Hay un equipo real detrás, no un bot.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-[13px] leading-snug text-gray-700">
                  Si en 14 días no notás cambios, te devolvemos el <strong>100%</strong>. El riesgo es nuestro, no tuyo.
                </p>
              </div>
            </div>

            <PaymentTrust />
          </div>
        </div>

        {/* Custo de não agir — vilão continua sendo externo (las dietas
            genéricas, el método anterior), nunca ela. Objetivo: fazer sentir
            que esperar tem um custo real, sem culpar quem está lendo. */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-2.5 text-center shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Una última cosa</p>
          <p className="font-display text-[19px] font-black leading-snug text-gray-900">
            Si hoy no haces nada, nada cambia.
          </p>
          <p className="text-sm leading-relaxed text-gray-700">
            Las dietas genéricas van a seguir estando ahí, pidiéndote fuerza de voluntad que ya sabes que no sostiene. Dentro de un mes, sin un método que calibre tu hambre, lo más probable es que sigas en el mismo lugar, buscando la próxima dieta que tampoco se va a ajustar a ti.
          </p>
          <p className="text-sm font-bold text-gray-800">
            El Método CALIBRA existe para que esta vez sea diferente.
          </p>
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
              `Ver mi plan por ${price(9.90)} →`
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
    q: '¿Es seguro comprar aquí? ¿Qué pasa con mis datos?',
    a: 'Sí. El pago se procesa por Hotmart, una plataforma usada por millones de personas en Latinoamérica, con las mismas protecciones que cualquier compra online segura. Tus datos solo se usan para generar y enviarte tu plan.',
  },
  {
    q: '¿Cómo y cuándo recibo mi plan?',
    a: 'Al instante. Apenas se confirma tu pago recibes un correo con el link para descargar la app de NutriPlan, con tu plan ya generado adentro. La descargas desde el celular y la tienes a mano cada vez que vas a comer o a hacer las compras. Si no ves el correo, revisa spam o escríbenos por WhatsApp y te lo reenviamos.',
  },
  {
    q: 'Ya probé muchas dietas y ninguna funcionó. ¿Por qué esta sí?',
    a: 'Porque las dietas genéricas solo te dicen qué comer, y eso no alcanza si igual te da hambre todo el día. Tu plan viene con el Método CALIBRA: 7 combinaciones (una por día) que hacen que el hambre baje sola, en vez de pedirte que la aguantes con fuerza de voluntad. Eso es lo que faltaba en las dietas anteriores, y es lo que te sostiene después de la semana 2.',
  },
  {
    q: 'No tengo mucho tiempo para cocinar. ¿Igual me sirve?',
    a: 'Sí, está pensado exactamente para eso. Las comidas son sencillas y reales, con tu lista de compras ya optimizada y sustituciones para cuando te falte un ingrediente. El Método CALIBRA tampoco agrega trabajo: cada combinación toma 10 segundos (por ejemplo, tomar tu mezcla o cambiar el orden en que comes), no una receta nueva. No necesitas más tiempo en la cocina, solo seguir la combinación del día.',
  },
  {
    q: '¿Hay suscripción o cobros recurrentes?',
    a: 'No. Es un pago único, sin suscripción y sin cobros automáticos. Pagas una vez y el acceso a tu plan es tuyo para siempre.',
  },
  {
    q: '¿Con qué puedo pagar?',
    a: 'Con tarjeta de crédito o débito, y con los medios de pago locales disponibles en tu país a través de Hotmart. En el checkout ves todas las opciones antes de confirmar.',
  },
  {
    q: '¿Funciona si tengo restricciones alimentarias o tiroides?',
    a: 'Sí. Durante el quiz indicaste tus preferencias y condiciones. El plan se arma con eso, y las sustituciones te permiten adaptar cualquier comida a lo que tienes disponible.',
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
        <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Garantía 14 días</span>
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

