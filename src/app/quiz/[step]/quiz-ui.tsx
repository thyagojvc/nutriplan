'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

const BACK_FLAG = 'nutriplan_can_go_back'

// ---------------------------------------------------------------------------
// NutriPlan — sistema de UI compartilhado do quiz
// Logo SVG, Header, Progress, Cards, Options, Inputs, CTA
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Logo SVG — folha orgânica com veias, construída com paths
// ---------------------------------------------------------------------------

export function NutriLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="NutriPlan"
    >
      {/* Corpo da folha */}
      <path
        d="M12 2.5C7.5 2.5 3.5 6.8 3.5 12C3.5 16.4 6.2 20 10 21.8L12 22.5L14 21.8C17.8 20 20.5 16.4 20.5 12C20.5 6.8 16.5 2.5 12 2.5Z"
        fill="currentColor"
        className="text-primary"
      />
      {/* Veia central */}
      <path
        d="M12 21.5V11.5"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Veia esquerda */}
      <path
        d="M12 17.5L9 14.5"
        stroke="white"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Veia direita */}
      <path
        d="M12 14.5L15 11.5"
        stroke="white"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Wordmark — "Nutri" leve + "Plan" pesado = identidade tipográfica
// ---------------------------------------------------------------------------

export function NutriWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = { sm: 72, md: 120, lg: 160 }[size]

  return (
    <Image
      src="/Logo Clara NutriPlan.png"
      alt="NutriPlan"
      height={h}
      width={h * 4}
      className="select-none object-contain"
      style={{ height: h, width: 'auto' }}
    />
  )
}

// ---------------------------------------------------------------------------
// Tagline — aparece apenas no primeiro passo
// ---------------------------------------------------------------------------

export function NutriTagline() {
  return (
    <p className="text-xs text-muted-foreground text-center tracking-wide">
      Tu nutrición, a tu medida.
    </p>
  )
}

// ---------------------------------------------------------------------------
// Layout principal do quiz — header + fundo de marca
// ---------------------------------------------------------------------------

export function QuizLayout({
  children,
  showTagline,
}: {
  children: React.ReactNode
  showTagline?: boolean
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(148,28%,95%) 90px, hsl(80,18%,97%) 220px)',
      }}
    >
      {/* Header de marca fixo */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/80 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      <main className="flex flex-col items-center p-4 pb-12 pt-6">
        {showTagline && (
          <div className="mb-4 quiz-enter">
            <NutriTagline />
          </div>
        )}
        <div className="w-full max-w-lg space-y-4">{children}</div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barra de progresso — segmentada por seções + badge %
// ---------------------------------------------------------------------------

// Curva de aceleração da barra: avança rápido no início e desacelera perto
// do fim (efeito "barra de VSL"), pra passar sensação de rapidez sem mentir
// o total de passos. displayed = 100 * (1 - (1 - linear)^EASE_K).
const PROGRESS_EASE_K = 1.8

export function QuizProgress({
  step,
  total,
  pct,
}: {
  step: number
  total: number
  pct: number
}) {
  const router = useRouter()
  const easedPct = Math.round(100 * (1 - Math.pow(1 - pct / 100, PROGRESS_EASE_K)))

  // Mostra voltar só se acabou de avançar (flag gravada pelo QuizCta)
  const [canGoBack, setCanGoBack] = useState(false)
  useEffect(() => {
    setCanGoBack(
      step > 1 && step < total &&
      sessionStorage.getItem(BACK_FLAG) === '1'
    )
  }, [step, total])

  // Volta pelo histórico do navegador: robusto à ordem das URLs do fluxo
  // (que não é sequencial — ver VISIBLE_ORDER em page.tsx).
  function handleBack() {
    sessionStorage.removeItem(BACK_FLAG)
    router.back()
  }

  return (
    <div className="space-y-2 quiz-enter">
      <div className="flex items-center justify-between">
        <div>
          {canGoBack && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M11 7H3M3 7L6.5 3.5M3 7L6.5 10.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Anterior
            </button>
          )}
        </div>
        <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-bold text-primary border border-primary/20">
          {easedPct}%
        </span>
      </div>
      {/* Barra contínua, sem divisões — avanço acelerado no início */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(148,18%,88%)]">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${easedPct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card do quiz
// ---------------------------------------------------------------------------

export function QuizCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-sm quiz-enter quiz-enter-delay-1">
      <div className="p-6 space-y-5">{children}</div>
    </div>
  )
}

// "confirm" = confirma a resposta anterior (ou um número já calculável com ela)
// antes de fazer a próxima pergunta. Cria uma narrativa contínua ("isso que
// você respondeu virou isso") em vez de perguntas soltas, o que segura mais
// a pessoa no quiz.
export function QuizHeader({
  title,
  subtitle,
  confirm,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  confirm?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      {confirm && (
        // bg-primary/8 (opacidade via Tailwind) não renderiza nesse projeto —
        // bug pré-existente (border-primary/N funciona, bg-primary/N não).
        // Usa hsl() explícito com alpha pra não depender disso.
        <div
          className="flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5"
          style={{ backgroundColor: 'hsl(148, 52%, 28%, 0.08)', borderColor: 'hsl(148, 52%, 28%, 0.22)' }}
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary">
            <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-xs font-semibold leading-relaxed text-primary">{confirm}</p>
        </div>
      )}
      <div className="space-y-1.5">
        <h1 className="text-[1.15rem] font-bold leading-snug text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Opção de seleção única — card com emoji + checkmark animado
// ---------------------------------------------------------------------------

export function QuizOption({
  label,
  desc,
  emoji,
  selected,
  onSelect,
}: {
  label: string
  desc?: string
  emoji?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left',
        'transition-all duration-150 active:scale-[0.99]',
        selected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-[#D8E8D4] bg-white hover:border-primary/40 hover:bg-primary/[0.03]',
      ].join(' ')}
    >
      {emoji && (
        <span className="shrink-0 text-xl leading-none">{emoji}</span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={[
            'text-sm font-semibold leading-snug',
            selected ? 'text-primary' : 'text-gray-800',
          ].join(' ')}
        >
          {label}
        </p>
        {desc && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
        )}
      </div>
      <CheckCircle visible={selected} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Chip de multi-seleção
// ---------------------------------------------------------------------------

export function QuizChip({
  label,
  emoji,
  selected,
  onToggle,
  fullWidth,
  exclude,
}: {
  label: string
  emoji?: string
  selected: boolean
  onToggle: () => void
  fullWidth?: boolean
  // exclude: modo "evitar" — seleção fica vermelha com X (em vez de verde com check).
  // Usado no step de alimentos que o usuário NÃO come.
  exclude?: boolean
}) {
  const selectedCls = exclude
    ? 'border-red-400 bg-red-50 font-semibold text-red-600 ring-1 ring-red-200'
    : 'border-primary bg-primary/5 font-semibold text-primary ring-1 ring-primary/20'
  // Sombra sutil no estado ocioso: sinaliza que é clicável, não só um rótulo
  // de texto (usuários menos familiarizados com tecnologia tendem a não
  // perceber botões planos sem elevação).
  const idleCls = exclude
    ? 'border-[#E6D6D6] bg-white text-gray-700 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:border-red-300 hover:bg-red-50/50 hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)]'
    : 'border-[#D8E8D4] bg-white text-gray-700 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)]'

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
        'transition-all duration-150 active:scale-[0.99]',
        fullWidth ? 'w-full' : '',
        selected ? selectedCls : idleCls,
      ].join(' ')}
    >
      {emoji && (
        <span className={['text-base leading-none', exclude && selected ? 'opacity-50 grayscale' : ''].join(' ')}>
          {emoji}
        </span>
      )}
      <span className={['leading-tight', exclude && selected ? 'line-through decoration-red-400' : ''].join(' ')}>
        {label}
      </span>
      {selected && (
        <span className="ml-auto shrink-0">
          {exclude ? (
            // X vermelho — sinaliza "evitar"
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-red-500">
              <path d="M2 2L9 9M9 2L2 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none" className="text-primary">
              <path d="M1 4.5L4 7.5L10 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export function QuizInput({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
      )}
      <input
        {...props}
        className={[
          'w-full rounded-xl border border-[#D8E8D4] bg-white px-4 py-3 text-sm text-gray-900',
          'placeholder:text-gray-400',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          'transition-shadow duration-150',
          props.className ?? '',
        ].join(' ')}
      />
      {hint && <p className="text-xs text-red-500">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slider numérico — número grande animado + trilho arrastável (edad/peso/altura)
// ---------------------------------------------------------------------------

export function QuizSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unit: string
  hint?: React.ReactNode
}) {
  const pct = ((value - min) / (max - min)) * 100

  // Texto local do número editável — só reconcilia com o valor real (clampado
  // entre min/max) no blur/Enter, pra não atrapalhar quem está digitando
  // (ex: apagar "165" pra escrever "170" passaria por estados intermediários
  // inválidos se clampássemos a cada tecla).
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  function commit(raw: string) {
    const n = Math.round(Number(raw))
    if (Number.isFinite(n)) {
      onChange(Math.min(max, Math.max(min, n)))
    } else {
      setText(String(value))
    }
  }

  return (
    <div className="space-y-2.5">
      <p className="text-center text-sm font-semibold text-gray-700">{label}</p>

      <div className="flex items-baseline justify-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="quiz-number-input w-24 bg-transparent text-center font-display text-[2.75rem] font-black leading-none text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/25 rounded-lg"
        />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {unit}
        </span>
      </div>

      <input
        type="range"
        className="quiz-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) ${pct}%, hsl(var(--muted)) ${pct}%)`,
        }}
      />

      <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>

      {hint && <p className="text-center text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Campo numérico — número grande editável por toque + botões +/-, sem arrastar
// nada (substitui o QuizSlider onde o trilho era mais trabalhoso que digitar).
// ---------------------------------------------------------------------------

export function QuizNumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unit: string
  hint?: React.ReactNode
}) {
  // Mesmo padrão do QuizSlider: texto local só reconcilia no blur/Enter, pra
  // não atrapalhar quem está apagando o número pra digitar outro.
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  function clamp(n: number) {
    return Math.min(max, Math.max(min, n))
  }

  function commit(raw: string) {
    const n = Math.round(Number(raw))
    if (Number.isFinite(n)) {
      onChange(clamp(n))
    } else {
      setText(String(value))
    }
  }

  function bump(delta: number) {
    onChange(clamp(value + delta))
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-sm font-semibold text-gray-700">{label}</p>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => bump(-step)}
          aria-label={`Restar ${step} ${unit}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D8E8D4] bg-white text-xl font-bold text-primary shadow-sm transition-colors hover:bg-[#F5FAF2] active:scale-95"
        >
          −
        </button>

        <div className="flex min-w-[11.5rem] items-baseline justify-center gap-1.5 rounded-2xl border border-[#D8E8D4] bg-[#F5FAF2] px-4 py-4">
          <input
            type="number"
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="quiz-number-input w-[6.5rem] bg-transparent text-center font-display text-[2.25rem] font-black leading-[1.3] text-primary tabular-nums focus:outline-none"
          />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {unit}
          </span>
        </div>

        <button
          type="button"
          onClick={() => bump(step)}
          aria-label={`Sumar ${step} ${unit}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D8E8D4] bg-white text-xl font-bold text-primary shadow-sm transition-colors hover:bg-[#F5FAF2] active:scale-95"
        >
          +
        </button>
      </div>

      {hint && <p className="text-center text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stepper compacto em linha — versão horizontal do QuizNumberField para telas
// com vários campos numéricos (ex: entrada do quiz: edad + peso + altura).
// Vem pré-preenchido com um valor plausível: corrigir um número visível é mais
// leve que preencher um campo vazio, e o 1º toque vira um tap no −/+ em vez de
// digitação (teclado só abre se a pessoa tocar no número).
// ---------------------------------------------------------------------------

export function QuizStepperRow({
  label,
  emoji,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string
  emoji: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unit: string
}) {
  // Texto local reconcilia só no blur/Enter (mesmo padrão do QuizNumberField),
  // pra não clampar estados intermediários enquanto a pessoa digita.
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  function clamp(n: number) {
    return Math.min(max, Math.max(min, n))
  }

  function commit(raw: string) {
    const n = Math.round(Number(raw))
    if (Number.isFinite(n)) {
      onChange(clamp(n))
    } else {
      setText(String(value))
    }
  }

  const btnCls =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8E8D4] bg-white text-lg font-bold text-primary shadow-sm transition-all hover:bg-[#F5FAF2] active:scale-90'

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#D8E8D4] bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-xl leading-none">{emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-gray-800">{label}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{unit}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={`Restar ${label}`} className={btnCls}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="quiz-number-input w-16 rounded-lg bg-[#F5FAF2] py-1.5 text-center font-display text-2xl font-black leading-none text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={`Sumar ${label}`} className={btnCls}>
          +
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Botão CTA
// ---------------------------------------------------------------------------

export function QuizCta({
  onClick,
  disabled,
  loading,
  children,
  type = 'button',
}: {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  children?: React.ReactNode
  type?: 'button' | 'submit'
}) {
  // Marca que houve avanço in-quiz (habilita o "Anterior" no passo seguinte).
  // Vale para type button e submit — em submit, onClick roda antes do submit
  // nativo e onClick? é undefined, então o form ainda envia normalmente.
  function handleClick() {
    sessionStorage.setItem(BACK_FLAG, '1')
    onClick?.()
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={[
        'quiz-enter quiz-enter-delay-2',
        'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white',
        'bg-primary shadow-[0_4px_14px_0_rgba(0,0,0,0.15)] transition-all duration-150',
        'hover:shadow-[0_6px_20px_0_rgba(0,0,0,0.18)] hover:brightness-[1.04]',
        'active:scale-[0.99] active:shadow-none',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:brightness-100',
      ].join(' ')}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
          Guardando…
        </>
      ) : (
        <>
          {children ?? 'Continuar'}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="opacity-70">
            <path
              d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Modal de intenção de saída — usado só na primeira pregunta do quiz (maior
// ponto de abandono: quem clica no anúncio e nem chega a responder nada).
// Renderizar como irmão dos cards (nunca dentro de um com "quiz-enter": a
// animação deixa um transform: translateY(0) residual no elemento parado,
// e isso quebra position:fixed dos filhos, prendendo o overlay dentro do
// card em vez da tela inteira).
// ---------------------------------------------------------------------------

export function ExitIntentModal({
  onStay,
  onLeave,
}: {
  onStay: () => void
  onLeave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <span
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: '#FBE7DF' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 8v5M12 16.5h.01M10.29 3.86l-8.16 14.14A1.5 1.5 0 0 0 3.43 20.5h17.14a1.5 1.5 0 0 0 1.3-2.5L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z"
              stroke="#993C1D"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2 className="font-display text-lg font-black text-gray-900">¿Ya te vas?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tu Reto de 28 días, personalizado para ti, está a solo unas preguntas de distancia. Termina en menos de 60 segundos.
        </p>
        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={onStay}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_0_rgba(0,0,0,0.15)] transition-all duration-150 hover:brightness-[1.04] active:scale-[0.99]"
          >
            Continuar mi plan
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="w-full text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            Salir de todos modos
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mensagem de erro inline
// ---------------------------------------------------------------------------

export function QuizError({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
      <span className="mt-px shrink-0">⚠️</span>
      {message}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Separador de seção (para steps com múltiplos grupos)
// ---------------------------------------------------------------------------

export function QuizSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {title}
        <span className="h-px flex-1 bg-border" />
      </p>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Interno — check circle animado
// ---------------------------------------------------------------------------

function CheckCircle({ visible }: { visible: boolean }) {
  return (
    <span
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
        visible
          ? 'bg-primary scale-100 opacity-100'
          : 'border border-[#D8E8D4] scale-90 opacity-0',
      ].join(' ')}
    >
      {visible && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path
            d="M1 3.5L3 5.5L8 1"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}
