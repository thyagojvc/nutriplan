// =============================================================================
// NutriPlan — Localização de preço (somente exibição)
// O pedido e o tracking (Pixel/CAPI) continuam SEMPRE em USD. Aqui só
// convertemos o número que a pessoa vê na página de vendas para a moeda do país
// dela (definido no passo 7 do quiz).
//
// Garantia de segurança: o valor exibido é sempre >= ao que a Hotmart cobra.
//   1. Buffer (FX_BUFFER) cobre o spread de câmbio da Hotmart + cotação defasada.
//   2. Arredondamento charm sempre PRA CIMA (nunca abaixo do convertido).
// Assim, no pior caso, o checkout vem igual ou mais barato do que ela viu.
// Nunca mais caro. Surpresa boa, nunca quebra de expectativa.
//
// FX_BUFFER é proposital de ~3%. Depois de um checkout real de teste em moeda
// local, dá pra comparar o número exibido com o cobrado pela Hotmart e ajustar
// esse valor pra ficar o mais justo possível.
// =============================================================================

export const FX_BUFFER = 1.03

// País (ISO-2, vem do passo 7) -> moeda. Fora desse mapa, cai em USD (fallback).
// EC/PA/SV ficam de fora de propósito: são dolarizados oficialmente, USD já é a moeda certa.
// VE/CU ficam de fora: câmbio instável (VES) ou sistema bancário isolado (CUP).
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  MX: 'MXN',
  CO: 'COP',
  CL: 'CLP',
  PE: 'PEN',
  AR: 'ARS',
  ES: 'EUR',
  BR: 'BRL',
  GT: 'GTQ',
  BO: 'BOB',
  PY: 'PYG',
  UY: 'UYU',
  CR: 'CRC',
  HN: 'HNL',
  NI: 'NIO',
  DO: 'DOP',
}

// Moedas que precisamos do endpoint de câmbio.
export const SUPPORTED_CURRENCIES = [
  'MXN', 'COP', 'CLP', 'PEN', 'ARS', 'EUR', 'BRL',
  'GTQ', 'BOB', 'PYG', 'UYU', 'CRC', 'HNL', 'NIO', 'DOP',
] as const

// Estilo de arredondamento charm:
//   cents90      -> termina em ,90  (EUR, USD)              ex: 18,90
//   nine         -> termina em 9    (MXN, BRL, PEN)         ex: 179
//   nineHundred  -> termina em 900  (COP, CLP, ARS)         ex: 82.900
type Charm = 'cents90' | 'nine' | 'nineHundred'

interface CurrencyConfig {
  symbol: string
  charm: Charm
  locale: string
}

const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  USD: { symbol: '$', charm: 'cents90', locale: 'en-US' },
  EUR: { symbol: '€', charm: 'cents90', locale: 'es-ES' },
  MXN: { symbol: '$', charm: 'nine', locale: 'es-MX' },
  BRL: { symbol: 'R$', charm: 'nine', locale: 'pt-BR' },
  PEN: { symbol: 'S/', charm: 'nine', locale: 'es-PE' },
  COP: { symbol: '$', charm: 'nineHundred', locale: 'es-CO' },
  CLP: { symbol: '$', charm: 'nineHundred', locale: 'es-CL' },
  ARS: { symbol: '$', charm: 'nineHundred', locale: 'es-AR' },
  GTQ: { symbol: 'Q', charm: 'nine', locale: 'es-GT' },
  BOB: { symbol: 'Bs', charm: 'nine', locale: 'es-BO' },
  PYG: { symbol: '₲', charm: 'nineHundred', locale: 'es-PY' },
  UYU: { symbol: '$', charm: 'nine', locale: 'es-UY' },
  CRC: { symbol: '₡', charm: 'nineHundred', locale: 'es-CR' },
  HNL: { symbol: 'L', charm: 'nine', locale: 'es-HN' },
  NIO: { symbol: 'C$', charm: 'nine', locale: 'es-NI' },
  DOP: { symbol: 'RD$', charm: 'nine', locale: 'es-DO' },
}

export function currencyForCountry(country: string | undefined | null): string {
  if (!country) return 'USD'
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] ?? 'USD'
}

// Sempre arredonda pra cima até o número charm imediatamente >= ao valor.
function roundCharmUp(value: number, charm: Charm): number {
  switch (charm) {
    case 'cents90': {
      let c = Math.floor(value) + 0.9
      if (c < value) c += 1
      return Math.round(c * 100) / 100
    }
    case 'nine': {
      let c = Math.floor(value / 10) * 10 + 9
      if (c < value) c += 10
      return c
    }
    case 'nineHundred': {
      let c = Math.floor(value / 1000) * 1000 + 900
      if (c < value) c += 1000
      return c
    }
  }
}

// Formata um valor em USD na moeda local.
// rate = quantas unidades da moeda local valem 1 USD. Para USD, rate = 1.
export function formatPrice(usd: number, currency: string, rate: number): string {
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD

  // Fallback USD: mostra o valor original exato, sem buffer nem charm.
  if (currency === 'USD' || !rate || rate === 1) {
    return `$${usd.toFixed(2)}`
  }

  const converted = usd * rate * FX_BUFFER
  const charmed = roundCharmUp(converted, cfg.charm)
  const decimals = cfg.charm === 'cents90' ? 2 : 0
  const num = charmed.toLocaleString(cfg.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${cfg.symbol}${num}`
}

// =============================================================================
// EQUIVALENTE LOCAL — o que a Hotmart REALMENTE cobra
// =============================================================================
// O preço da página passou a ser o USD (que é o que o pedido e o tracking usam),
// e ao lado dele mostramos quanto isso vira na moeda dela. Esse segundo número
// precisa bater com o checkout, senão a promessa quebra na hora de pagar.
//
// MEDIDO, não calculado. Em 04/08/2026 abri pay.hotmart.com/O106407229L com
// ?checkoutMode=10 e percorri o seletor "Alterar país" do próprio checkout,
// lendo o "Total de" de cada país. O multiplicador abaixo é esse total dividido
// pelo preço nominal em USD, com o câmbio do dia.
//
// Por que medido e não pela alíquota legal: a Hotmart só cobra imposto onde tem
// registro fiscal, não onde a lei manda. O Peru tem IGV de 18% e o Uruguai IVA
// de 22%, e nas vendas reais do relatório ela não cobrou nenhum dos dois
// (Preço Total == Preço do Produto). Usar alíquota legal daria preço errado.
//
// Por que por PAÍS e não por moeda: Equador, Panamá e Porto Rico usam os três
// USD. Equador e Porto Rico pagam $9.90 exato, o Panamá paga $12.00. Chavear
// por moeda erraria os três de uma vez.
//
// O número embute DUAS coisas de uma vez: o spread de câmbio da Hotmart
// (medido em ~7,4% nas 10 vendas do relatório) e o imposto local.
//
// COMO REFAZER a medição (vale quando a Hotmart mudar política fiscal, quando
// o preço mudar, ou ao entrar num país novo): abrir o checkout, trocar o país,
// ler "Total de", dividir pelo preço nominal em USD do dia.
const COUNTRY_MARKUP: Record<string, number> = {
  CL: 1.245, // IVA 19%
  MX: 1.231, // IVA 16%
  PA: 1.212, // ITBMS (cobrado em USD: B/. 12.00 para um produto de $9.90)
  AR: 1.159,
  PE: 1.106,
  BR: 1.102,
  CO: 1.085,
  UY: 1.063,
  HN: 1.057,
  CR: 1.055,
  PY: 1.054,
  EC: 1.0, // dolarizado e sem imposto: paga o valor cheio, sem acréscimo
  PR: 1.0,
}

// Casas decimais de exibição por moeda. Moedas de valor alto não usam centavos
// no dia a dia — "$33.884" e não "$33.884,12".
const NO_DECIMALS = new Set(['COP', 'CLP', 'ARS', 'PYG', 'CRC'])

// Quanto ela vai pagar de fato, na moeda dela, com imposto embutido.
// Devolve null quando não dá para prometer um número: país sem medição, moeda
// USD (aí o próprio preço já é o valor final) ou câmbio indisponível.
// Não arredonda para número "charm": o charm criava uma folga aleatória (de
// +3,4% no MXN a +15,7% no BRL) que era justamente a origem do descasamento.
export function localTotal(
  usd: number,
  country: string | null | undefined,
  rate: number,
): number | null {
  if (!country) return null
  const markup = COUNTRY_MARKUP[country.toUpperCase()]
  if (!markup || !rate || rate <= 0) return null
  return usd * markup * rate
}

export function formatLocalTotal(
  usd: number,
  country: string | null | undefined,
  currency: string,
  rate: number,
): string | null {
  const total = localTotal(usd, country, rate)
  if (total === null) return null
  // Some quando o total JÁ É o preço exibido (Equador e Porto Rico: dolarizados
  // e sem acréscimo). O corte é pelo VALOR e não pela moeda de propósito: o
  // Panamá também cobra em USD e mesmo assim sai 21% mais caro ($12.00), então
  // um `currency === 'USD'` aqui esconderia justamente o caso que mais importa.
  if (Math.abs(total - usd) < 0.01) return null
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD
  const decimals = NO_DECIMALS.has(currency) ? 0 : 2
  const num = total.toLocaleString(cfg.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${cfg.symbol}${num}`
}

// Converte um valor de REFERÊNCIA (não uma cobrança) para a moeda dela.
// Sem COUNTRY_MARKUP de propósito: o markup é o spread e o imposto que a
// Hotmart cobra, e não faz sentido aplicar isso a um custo hipotético como a
// âncora "montar por conta própria custaria $47" — ninguém vai pagar esses $47
// pela Hotmart. Aqui é conversão de câmbio pura.
//
// Existe porque a âncora e o preço PRECISAM estar na mesma moeda pra comparação
// funcionar. Em 05/08 a âncora ficou em USD ($47) enquanto o preço passou pra
// moeda local ($17.170 ARS): pra ela, 47 é um número MENOR que 17.170, então a
// âncora não só parou de ancorar, ela inverteu — parecia que montar sozinha
// saía mais barato que comprar. Nunca exibir os dois em moedas diferentes.
export function formatLocalApprox(
  usd: number,
  currency: string,
  rate: number,
): string | null {
  if (!rate || rate <= 0 || currency === 'USD') return null
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD
  const decimals = NO_DECIMALS.has(currency) ? 0 : 2
  const num = (usd * rate).toLocaleString(cfg.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${cfg.symbol}${num}`
}

// Países onde o checkout da Hotmart oferece Mercado Pago.
// Importa porque 6 das 7 vendas argentinas do histórico foram por Mercado Pago,
// e os selos da preview só mostravam VISA/Mastercard/PayPal — uma argentina sem
// cartão internacional concluía que não tinha como pagar ANTES de clicar,
// mesmo com o MP disponível lá dentro. Conferido no checkout em 05/08 (a lista
// de métodos aparece por país no seletor "Cambiar país").
// Só estes: nos demais (CR, EC, HN, PA, PR, PY) o MP não é oferecido, e mostrar
// o selo lá seria prometer método que não existe.
const MERCADO_PAGO_COUNTRIES: ReadonlySet<string> = new Set(['AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'UY'])

export function hasMercadoPago(country: string | null | undefined): boolean {
  return !!country && MERCADO_PAGO_COUNTRIES.has(country.toUpperCase())
}

// Países onde o valor do checkout NÃO é o final: a Hotmart escreve, ao lado do
// preço, "más tarifas correspondientes. Haz clic aquí para saber más".
// Hoje só a Argentina. Conferido em 04/08 percorrendo os 9 países no seletor do
// checkout: MX e CL dizem "IVA incluido" (valor fechado, imposto já dentro), e
// CO, PE, UY, CR, PY e PA não trazem nota nenhuma. Só a AR avisa que soma.
// São as percepções que o banco argentino cobra sobre compra em moeda
// estrangeira, e a Hotmart não tem como calcular porque quem aplica é o emissor
// do cartão. Por isso NÃO dá pra embutir num multiplicador: o número não existe
// até a fatura fechar.
// Consequência na copy: nesses países a página não pode dizer "é o total que
// você vai pagar". Ver o bloco de preço em preview/page.tsx.
const EXTRA_FEES: ReadonlySet<string> = new Set(['AR'])

export function hasExtraFees(country: string | null | undefined): boolean {
  return !!country && EXTRA_FEES.has(country.toUpperCase())
}

// NÃO existe um hasLocalTax aqui, de propósito. A primeira versão deduzia
// "tem imposto" de um multiplicador acima de 1,02, e isso marcava Costa Rica
// (1,055) e Paraguai (1,054) como tendo imposto quando aqueles ~5% são só
// spread de câmbio — o relatório mostra Preço Total == Preço do Produto nos
// dois. Dizer "impuestos incluidos" onde não há imposto é afirmação falsa.
//
// Separar imposto de spread exigiria evidência que eu só tenho pro México
// (relatório mostra 184 → 213,44, exatamente +16%, e o checkout exibe botão de
// IVA e campo de RFC). Chile (+24,5%) e Panamá (+21,2% em USD puro, onde não
// cabe spread) quase certamente têm imposto, mas "quase certamente" não entra
// em copy de página de vendas.
//
// A página não precisa dessa distinção: o que importa pra ela é que o número
// mostrado é o total final, e isso é verdade em todo país medido.
