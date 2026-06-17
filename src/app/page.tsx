import Link from 'next/link'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

const WHAT_YOU_GET = [
  { emoji: '🔥', title: 'Tu metabolismo', desc: 'TMB y gasto calórico diario exacto' },
  { emoji: '⚖️', title: 'Tu IMC', desc: 'Clasificación y distancia a tu meta' },
  { emoji: '🥗', title: 'Tus macros', desc: 'Proteína, carbos y grasas a tu medida' },
  { emoji: '📋', title: 'Plan nutricional completo', desc: 'Comidas concretas según tus gustos' },
]

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(148,28%,95%) 90px, hsl(80,18%,97%) 220px)',
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/85 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-36">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="w-full max-w-lg pt-8 pb-6 text-center space-y-4 quiz-enter">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Personalizado · Gratis · Solo 3 minutos
          </div>

          <h1 className="text-[2rem] font-black leading-tight text-gray-900">
            Tu plan nutricional<br />
            <span className="text-primary">a tu medida</span>
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed max-w-[17rem] mx-auto">
            Responde 12 preguntas y recibe tu IMC, metabolismo y macros
            calculados para tu objetivo.
          </p>
        </div>

        {/* ── Lo que vas a descubrir ───────────────────────────── */}
        <div className="w-full max-w-lg space-y-3 quiz-enter quiz-enter-delay-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-center">
            Lo que vas a descubrir
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {WHAT_YOU_GET.map(({ emoji, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-[#D8E8D4] bg-white p-4 space-y-1.5 shadow-sm"
              >
                <p className="text-2xl">{emoji}</p>
                <p className="text-sm font-bold text-gray-900">{title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Números ─────────────────────────────────────────── */}
        <div className="w-full max-w-lg mt-3 rounded-2xl border border-[#D8E8D4] bg-white shadow-sm quiz-enter quiz-enter-delay-2">
          <div className="flex items-center divide-x divide-[#EAF2E6]">
            {[
              { value: '+2.400', label: 'planes generados' },
              { value: '4.8 ★', label: 'valoración media' },
              { value: '3 min', label: 'para tu resultado' },
            ].map(({ value, label }) => (
              <div key={label} className="flex-1 py-4 text-center">
                <p className="text-xl font-black text-primary">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Testimonio ──────────────────────────────────────── */}
        <div className="w-full max-w-lg mt-2.5 rounded-2xl border border-[#D8E8D4] bg-[#F5FAF2] p-4 quiz-enter quiz-enter-delay-2">
          <div className="flex gap-3 items-start">
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/12 flex items-center justify-center text-lg">
              😊
            </div>
            <div>
              <p className="text-sm leading-relaxed text-gray-700">
                &ldquo;En 3 minutos tuve mi plan completo. Bajé 5 kg en 6 semanas siguiéndolo al pie de la letra.&rdquo;
              </p>
              <p className="mt-1.5 text-xs font-bold text-primary">🇲🇽 Valeria R.</p>
            </div>
          </div>
        </div>

      </main>

      {/* ── CTA fijo ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#D8E8D4] bg-white/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="mx-auto max-w-lg space-y-2">
          <Link
            href="/quiz/1"
            className={[
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
              'bg-primary shadow-[0_4px_20px_0_rgba(0,0,0,0.18)]',
              'hover:brightness-[1.04] hover:shadow-[0_6px_28px_0_rgba(0,0,0,0.22)]',
              'transition-all duration-150 active:scale-[0.99]',
            ].join(' ')}
          >
            Comenzar mi evaluación
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-80">
              <path
                d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Sin tarjeta · Sin registro previo · Resultado inmediato
          </p>
        </div>
      </div>
    </div>
  )
}
