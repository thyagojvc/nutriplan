import React from 'react'

// ---------------------------------------------------------------------------
// Primitivos de UI compartilhados por todos os steps do quiz
// Apenas estilo — nenhuma lógica de negócio aqui.
// ---------------------------------------------------------------------------

export function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen flex-col items-center p-4 pb-10"
      style={{
        background:
          'linear-gradient(180deg, #E6F4DF 0px, #F5FAF2 100px, #F5FAF2 100%)',
      }}
    >
      {/* Marca no topo */}
      <div className="mb-6 mt-2 flex items-center gap-1.5 self-center">
        <span className="text-lg">🥗</span>
        <span className="font-bold text-primary text-sm tracking-wide">NutriPlan</span>
      </div>

      <div className="w-full max-w-lg space-y-4">{children}</div>
    </main>
  )
}

// ---------------------------------------------------------------------------

export function QuizProgress({ step, total, pct }: { step: number; total: number; pct: number }) {
  return (
    <div className="space-y-2 px-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Paso {step} de {total}
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
          {pct}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: '#C8E8BC' }}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function QuizCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#DDE8D8] bg-white p-6 shadow-sm space-y-5">
      {children}
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
      <h1 className="text-xl font-bold leading-snug text-gray-900">{title}</h1>
      {subtitle && (
        <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Opção de seleção única — com emoji, check, efeito lift ao selecionar

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
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150',
        selected
          ? 'border-primary bg-[#EAF6E4] shadow-sm'
          : 'border-[#DDE8D8] bg-white hover:border-primary/50 hover:bg-[#F3FAF0]',
      ].join(' ')}
    >
      {emoji && <span className="shrink-0 text-xl">{emoji}</span>}
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
      <CheckMark visible={selected} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Chip de multi-seleção — tamanho menor, shape de tag

export function QuizChip({
  label,
  emoji,
  selected,
  onToggle,
  fullWidth,
}: {
  label: string
  emoji?: string
  selected: boolean
  onToggle: () => void
  fullWidth?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all duration-150',
        fullWidth ? 'w-full' : '',
        selected
          ? 'border-primary bg-[#EAF6E4] font-semibold text-primary shadow-sm'
          : 'border-[#DDE8D8] bg-white text-gray-700 hover:border-primary/50 hover:bg-[#F3FAF0]',
      ].join(' ')}
    >
      {emoji && <span className="text-base">{emoji}</span>}
      <span className="leading-tight">{label}</span>
      {selected && (
        <span className="ml-auto shrink-0 text-primary">
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path
              d="M1 5L4.5 8.5L11 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Input estilizado

export function QuizInput({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
      )}
      <input
        {...props}
        className={[
          'w-full rounded-xl border border-[#DDE8D8] bg-white px-4 py-3 text-sm text-gray-900',
          'placeholder:text-gray-400',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          'transition-shadow duration-150',
          props.className ?? '',
        ].join(' ')}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Botão CTA principal

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
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white',
        'bg-primary shadow-md transition-all duration-150',
        'hover:brightness-105 hover:shadow-lg active:scale-[0.99]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
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
          <span className="opacity-70">→</span>
        </>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Mensagem de erro

export function QuizError({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
      {message}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Separador de seção dentro de QuizCard

export function QuizSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checkmark interno

function CheckMark({ visible }: { visible: boolean }) {
  if (!visible) return <span className="h-5 w-5 shrink-0" />
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
        <path
          d="M1 4L3.5 6.5L9 1"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
