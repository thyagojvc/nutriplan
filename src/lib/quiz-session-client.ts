'use client'

// Fallback de sessão do quiz para navegadores que não guardam o cookie.
//
// POR QUE ISSO EXISTE: o init-session devolve um cookie HttpOnly com o
// session_id, e todas as rotas do quiz leem esse cookie. Nos webviews in-app
// do Facebook e do Instagram (que é de onde vem quase todo o tráfego pago),
// o cookie frequentemente não persiste entre requisições — armazenamento
// particionado, modo privado, ou o próprio webview descartando. Sem cookie o
// save-step responde 401 e a pessoa leva "Error al guardar" logo na 1ª
// pergunta, sem nenhuma forma de seguir.
//
// Medido em 01/08 (244 sessões desde 22/07), taxa de quem responde a 1ª
// pergunta por ambiente:
//   navegador normal ... 73% (Android) / 40% (iOS)
//   Instagram in-app ... 52% (Android) / 19% (iOS)
//   Facebook in-app .... 0% (0 de 10, nas duas plataformas)
//
// COMO FUNCIONA: guardamos o session_id também do lado do cliente e o
// mandamos no header x-quiz-session. O middleware já sabe recebê-lo e
// injetá-lo como cookie na request encaminhada (ver src/middleware.ts), então
// nenhuma rota precisa mudar. O cookie real, quando existe, continua tendo
// precedência: o header é só a rede de segurança.
//
// A gravação tenta localStorage → sessionStorage → memória, nessa ordem. Os
// dois primeiros podem lançar (Safari em modo privado, webview com storage
// desligado), por isso cada um tem seu try/catch e a memória fecha a conta
// dentro da mesma aba.

const STORAGE_KEY = 'nutriplan_session_id'
const HEADER = 'x-quiz-session'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let memorySessionId: string | null = null

// Quem está esperando a sessão existir (ver whenQuizSessionReady).
let waiters: ((id: string | null) => void)[] = []

function readStore(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && UUID_RE.test(v)) return v
  } catch { /* storage bloqueado — tenta o próximo */ }
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY)
    if (v && UUID_RE.test(v)) return v
  } catch { /* idem */ }
  return null
}

/** session_id conhecido nesta aba, de qualquer uma das três camadas. */
export function getQuizSessionId(): string | null {
  return memorySessionId ?? readStore()
}

/**
 * Registra o session_id devolvido pelo init-session. Idempotente: chamar de
 * novo com o mesmo id não faz nada além de reafirmar o armazenamento.
 */
export function rememberQuizSession(id: string | null | undefined): void {
  if (!id || !UUID_RE.test(id)) return
  memorySessionId = id
  try { window.localStorage.setItem(STORAGE_KEY, id) } catch { /* segue com sessionStorage/memória */ }
  try { window.sessionStorage.setItem(STORAGE_KEY, id) } catch { /* segue com memória */ }

  if (waiters.length > 0) {
    const pending = waiters
    waiters = []
    for (const w of pending) w(id)
  }
}

/**
 * Resolve quando o session_id existir. Usado por telemetria que pode disparar
 * antes do init-session terminar (o primeiro toque na tela costuma chegar
 * antes da resposta da rede): sem isso o evento sai sem sessão e a rota o
 * descarta em silêncio.
 *
 * Sempre resolve, mesmo que a sessão nunca apareça — depois do timeout devolve
 * o que houver (possivelmente null). Telemetria nunca pode travar nada.
 */
export function whenQuizSessionReady(timeoutMs = 6000): Promise<string | null> {
  const existing = getQuizSessionId()
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let done = false
    const finish = (id: string | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(id)
    }
    const timer = setTimeout(() => {
      waiters = waiters.filter((w) => w !== finish)
      finish(getQuizSessionId())
    }, timeoutMs)
    waiters.push(finish)
  })
}

/**
 * fetch para as rotas do quiz/checkout: idêntico ao nativo, só acrescenta o
 * header de sessão quando conhecemos o id. Use no lugar de fetch() em qualquer
 * chamada que dependa da sessão do quiz.
 */
export function quizFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const id = getQuizSessionId()
  if (!id) return fetch(input, init)

  const headers = new Headers(init.headers)
  headers.set(HEADER, id)
  return fetch(input, { ...init, headers })
}
