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
