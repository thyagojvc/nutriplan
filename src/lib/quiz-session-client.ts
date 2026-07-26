// Fallback de sessão do quiz para navegadores que não persistem o cookie
// HttpOnly nutriplan_session_id (ITP do Safari/iOS e WebViews do Instagram e
// Facebook, principal origem do tráfego pago). Sem o cookie, todo POST de
// save-step retornava 401 → "Error al guardar" → abandono na 1ª pergunta,
// e o dado do /quiz-funnel mostrava iOS abandonando ~2x mais que Android.
//
// Estratégia: o init-session já devolve o session_id no corpo da resposta.
// Guardamos em memória + sessionStorage + localStorage (redundância: storages
// também podem estar bloqueados em in-app browsers) e um patch global de fetch
// anexa o id no header x-quiz-session de toda chamada same-origin a /api/.
// O middleware reinjeta esse header como cookie, então NENHUMA rota precisa
// mudar. Quando o cookie funciona, o header é ignorado (cookie tem prioridade).

const KEY = 'nutriplan_sid_fallback'

// Variável de módulo: sobrevive à navegação client-side do quiz inteiro
// (router.push não recarrega a página), mesmo se todo storage estiver bloqueado.
let memSid: string | null = null

export function rememberSessionId(sid: string) {
  if (!sid) return
  memSid = sid
  try { sessionStorage.setItem(KEY, sid) } catch {}
  try { localStorage.setItem(KEY, sid) } catch {}
}

export function recallSessionId(): string | null {
  if (memSid) return memSid
  try {
    const s = sessionStorage.getItem(KEY)
    if (s) return (memSid = s)
  } catch {}
  try {
    const s = localStorage.getItem(KEY)
    if (s) return (memSid = s)
  } catch {}
  return null
}

let installed = false

export function installQuizFetchPatch() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const orig = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('/api/')) {
        const sid = recallSessionId()
        if (sid) {
          const headers = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined),
          )
          if (!headers.has('x-quiz-session')) headers.set('x-quiz-session', sid)
          init = { ...init, headers }
        }
      }
    } catch { /* nunca deixar o patch quebrar um fetch */ }
    return orig(input, init)
  }
}
