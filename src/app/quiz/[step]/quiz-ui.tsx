'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'

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
  const height = { sm: 28, md: 36, lg: 50 }[size]

  return (
    <Image
      src="/Logo Clara NutriPlan.png"
      alt="NutriPlan"
      height={height}
      width={height * 3}
      className="select-none object-contain"
      style={{ height, width: 'auto' }}
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
  const pathname = usePathname()
  const actualStep = parseInt(pathname?.split('/').pop() ?? '0', 10)

  // Mostra voltar só se acabou de avançar (flag gravada pelo QuizCta)
  const [canGoBack, setCanGoBack] = useState(false)
  useEffect(() => {
    setCanGoBack(
      step > 1 && step < total &&
      sessionStorage.getItem(BACK_FLAG) === '1'
    )
  }, [step, total])

  function handleBack() {
    sessionStorage.removeItem(BACK_FLAG)
    router.push(`/quiz/${actualStep - 1}`)
  }

  return (
    <div className="space-y-2 quiz-enter">
      <div className="grid grid-cols-3 items-center">
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
        <span className="text-center text-xs font-semibold text-muted-foreground tracking-wide">
          Paso {step} de {total}
        </span>
        <div className="flex justify-end">
          <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-bold text-primary border border-primary/20">
            {pct}%
          </span>
        </div>
      </div>
      {/* Barra segmentada */}
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < step
          const active = i === step - 1
          return (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all duration-500"
              style={{
                background: filled
                  ? 'hsl(148, 52%, 28%)'
                  : 'hsl(148, 18%, 88%)',
                opacity: active ? 1 : filled ? 0.75 : 0.4,
                transform: active ? 'scaleY(1.3)' : 'scaleY(1)',
              }}
            />
          )
        })}
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

export function QuizHeader({
  title,
  subtitle,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-[1.15rem] font-bold leading-snug text-gray-900">{title}</h1>
      {subtitle && (
        <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
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
  const idleCls = exclude
    ? 'border-[#E6D6D6] bg-white text-gray-700 hover:border-red-300 hover:bg-red-50/50'
    : 'border-[#D8E8D4] bg-white text-gray-700 hover:border-primary/40 hover:bg-primary/[0.03]'

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
  function handleClick() {
    sessionStorage.setItem(BACK_FLAG, '1')
    onClick?.()
  }

  return (
    <button
      type={type}
      onClick={type === 'button' ? handleClick : undefined}
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
