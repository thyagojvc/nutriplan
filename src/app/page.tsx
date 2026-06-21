import Link from 'next/link'
import Image from 'next/image'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

const BENEFITS = [
  { emoji: '🔥', title: 'Cuánto comer exacto', desc: 'Tu metabolismo y gasto calórico calculado para tu cuerpo — sin adivinar' },
  { emoji: '📏', title: 'Dónde estás hoy', desc: 'Tu IMC real y qué tan cerca estás de tu objetivo' },
  { emoji: '🥗', title: 'Qué comer y cuánto', desc: 'Proteína, carbos y grasas a tu medida — para no pasar hambre' },
  { emoji: '📋', title: 'Plan semana a semana', desc: 'Comidas reales con porciones exactas, según tus gustos' },
]

const PROOF_NUMBERS = [
  { value: '+2.400', label: 'planes generados' },
  { value: '4.8 ★',  label: 'valoración media' },
  { value: '3 min',  label: 'para tu resultado' },
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
            Gratis · Personalizado · Solo 3 minutos
          </div>

          <h1 className="text-[2rem] font-black leading-tight text-gray-900">
            Por fin sabrás exactamente<br />
            <span className="text-primary">cuánto debes comer</span>
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed max-w-[20rem] mx-auto">
            {/* TODO: atualizar para 12 quando steps 3 e 10 forem reativados (IA + order bump) */}
            El problema nunca fue tu fuerza de voluntad. Las dietas genéricas
            te dan el mismo número de calorías que a todos, y tu metabolismo
            es único. Responde 9 preguntas y descubre cuánto necesita
            comer <span className="font-semibold text-gray-700">tu</span> cuerpo.
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E8D4] bg-white px-3 py-1 text-xs text-muted-foreground">
            <span>👩‍⚕️</span>
            <span>Metodología validada por nutriólogos certificados</span>
          </div>
        </div>

        {/* ── Método Calibración Metabólica ────────────────────── */}
        <div className="w-full max-w-lg mb-3 quiz-enter quiz-enter-delay-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-center mb-3">
            El método Calibración Metabólica
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: '1', t: 'Calcula', d: 'Tu metabolismo real' },
              { n: '2', t: 'Calibra', d: 'Calorías y macros' },
              { n: '3', t: 'Come', d: 'Lo que te gusta' },
            ].map(({ n, t, d }) => (
              <div key={n} className="rounded-2xl border border-[#D8E8D4] bg-white p-3 text-center shadow-sm">
                <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-white">{n}</div>
                <p className="text-sm font-bold text-gray-900">{t}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Lo que vas a descubrir ───────────────────────────── */}
        <div className="w-full max-w-lg space-y-3 quiz-enter quiz-enter-delay-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-center">
            Lo que vas a descubrir
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {BENEFITS.map(({ emoji, title, desc }) => (
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
            {PROOF_NUMBERS.map(({ value, label }) => (
              <div key={label} className="flex-1 py-4 text-center">
                <p className="text-xl font-black text-primary">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Testimonios ─────────────────────────────────────── */}
        <div className="w-full max-w-lg mt-2.5 space-y-2.5 quiz-enter quiz-enter-delay-2">
          <div className="rounded-2xl border border-[#D8E8D4] bg-[#F5FAF2] p-4">
            <div className="flex gap-3 items-start">
              <Image
                src="/testimonios/valeria.png"
                alt="Valeria R."
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-full object-cover object-top"
              />
              <div>
                <div className="flex gap-0.5 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="11" height="11" viewBox="0 0 11 11" fill="#f59e0b">
                      <path d="M5.5 1l1.1 3.3H10L7.2 6.4l1 3.1L5.5 7.7 2.8 9.5l1-3.1L1 4.3h3.4z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-gray-700">
                  &ldquo;Siempre pensé que tenía que pasar hambre para bajar de peso. Con mi plan vi exactamente qué comer y en qué cantidad. Bajé 5 kg en 6 semanas sin restricciones extremas.&rdquo;
                </p>
                <p className="mt-1.5 text-xs font-bold text-primary">🇲🇽 Valeria R. — Ciudad de México</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#D8E8D4] bg-[#F5FAF2] p-4">
            <div className="flex gap-3 items-start">
              <Image
                src="/testimonios/andrea.png"
                alt="Andrea M."
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-full object-cover object-top"
              />
              <div>
                <div className="flex gap-0.5 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="11" height="11" viewBox="0 0 11 11" fill="#f59e0b">
                      <path d="M5.5 1l1.1 3.3H10L7.2 6.4l1 3.1L5.5 7.7 2.8 9.5l1-3.1L1 4.3h3.4z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-gray-700">
                  &ldquo;Con dos hijos no tenía tiempo para contar calorías. El plan me dijo exactamente qué comer, cuánto y cuándo. En 3 semanas ya me sentía diferente.&rdquo;
                </p>
                <p className="mt-1.5 text-xs font-bold text-primary">🇨🇴 Andrea M. — Bogotá</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Para ti si ──────────────────────────────────────── */}
        <div className="w-full max-w-lg mt-2.5 rounded-2xl border border-[#D8E8D4] bg-white shadow-sm p-5 quiz-enter quiz-enter-delay-2">
          <p className="text-sm font-bold text-gray-900 mb-3">Este plan es para ti si…</p>
          <ul className="space-y-2">
            {[
              'No sabes exactamente cuánto comer para tu cuerpo',
              'Has probado dietas pero no ves resultados duraderos',
              'Quieres comer rico sin pasar hambre ni contar calorías',
              'Buscas un plan real, no genérico de internet',
            ].map(item => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                <span className="mt-0.5 shrink-0 text-primary font-bold">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

      </main>

      {/* ── CTA fijo ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#D8E8D4] bg-white/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="mx-auto max-w-lg space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="flex -space-x-2">
              {[
                '/testimonios/valeria.png',
                '/testimonios/andrea.png',
                '/testimonios/maria.png',
                '/testimonios/ana.png',
              ].map((src) => (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full border-2 border-white object-cover object-top"
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              <span className="font-bold text-gray-700">+2.400 mujeres</span> ya calcularon su plan
            </span>
          </div>
          <Link
            href="/quiz/1"
            className={[
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
              'bg-primary shadow-[0_4px_20px_0_rgba(0,0,0,0.18)]',
              'hover:brightness-[1.04] hover:shadow-[0_6px_28px_0_rgba(0,0,0,0.22)]',
              'transition-all duration-150 active:scale-[0.99]',
            ].join(' ')}
          >
            Calcular mi plan gratis
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
