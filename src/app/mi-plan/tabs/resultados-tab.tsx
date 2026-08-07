'use client'

// =============================================================================
// Aba "Resultados" — segunda posição na barra, de propósito.
//
// Numa página de vendas a prova social vive no meio da leitura e quem não rola
// até lá nunca a encontra. Aqui a leitura não é linear: ela navega em ziguezague
// entre abas, então a prova precisa de um lugar fixo e óbvio. Segunda aba é o
// primeiro toque natural depois de olhar o próprio plano, e é exatamente o
// momento em que a dúvida aparece: "bonito, mas isso funciona pra alguém?".
//
// Abre pela Fernanda: a fala dela é a única que responde a essa pergunta com a
// própria hesitação ("creía que tal vez no iba a funcionar para mí").
// =============================================================================

import Image from 'next/image'
import { ShieldCheck } from 'lucide-react'
import { RESULTS } from '../results-data'

export function ResultadosTab({ onCta }: { onCta: () => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5 text-center">
        <p className="font-display text-[19px] font-black leading-tight text-gray-900 [text-wrap:balance]">
          Ellas empezaron con el mismo plan que acabas de ver
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-700">
          Mismas dudas, misma rutina apretada, mismos intentos fallidos antes.
        </p>
      </div>

      <div className="space-y-4">
        {RESULTS.map(({ photo, name, country, age, result, w, h, quote }) => (
          <article
            key={name}
            className="overflow-hidden rounded-2xl border border-[#D8E8D4] bg-white shadow-[0_4px_18px_rgba(15,110,86,0.07)]"
          >
            <Image
              src={photo}
              alt={`Antes y después de ${name}`}
              width={w}
              height={h}
              className="w-full object-cover"
            />
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900">
                  {name} {country} <span className="font-normal text-muted-foreground">· {age} años</span>
                </p>
                <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[11px] font-black text-white">
                  {result}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-gray-700">&ldquo;{quote}&rdquo;</p>
            </div>
          </article>
        ))}
      </div>

      {/* Autoridade dupla — quem responde tecnicamente pelo plano que ela
          acabou de ver na aba anterior. */}
      <div className="overflow-hidden rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-4">
        <Image
          src="/autoridad-maria-fernanda-thyago.png"
          alt="María Fernanda y Tiago Vieira, responsables técnicos de la Calibración Metabólica"
          width={1122}
          height={1402}
          className="-mx-5 -mt-5 mb-1 aspect-[1122/1402] w-[calc(100%+2.5rem)] max-w-none object-cover object-top"
        />
        <div>
          <p className="font-display text-base font-black text-gray-900">María Fernanda y Tiago Vieira</p>
          <p className="text-[13px] font-semibold text-muted-foreground">Responsables técnicos</p>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          María Fernanda y Tiago Vieira son los creadores de la Calibración Metabólica, y los
          responsables técnicos de que cada plan se ajuste a tus objetivos, tus antojos y tu
          rutina real.
        </p>
        <div className="grid grid-cols-2 gap-3 border-t border-[#D8E8D4] pt-4">
          <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-3 text-center">
            <p className="text-2xl font-black text-primary">+2.000</p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">mujeres acompañadas con nuestros planes</p>
          </div>
          <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-3 text-center">
            <p className="text-2xl font-black text-primary">6 años</p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">de experiencia clínica</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 rounded-2xl border border-[#D8E8D4] bg-white p-5 text-center">
        <p className="text-[13.5px] leading-relaxed text-gray-700">
          Tu plan ya está armado con tus datos. Lo único que falta es abrirlo completo.
        </p>
        <button
          type="button"
          onClick={onCta}
          className="w-full rounded-xl bg-[#D85A30] py-3.5 text-sm font-black text-white shadow-[0_4px_20px_0_rgba(216,90,48,0.38)] transition-all active:scale-[0.99]"
        >
          Quiero abrir mi plan completo →
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-gray-600">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
          Garantía de 14 días
        </p>
      </div>
    </div>
  )
}
