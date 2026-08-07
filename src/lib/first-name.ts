// O nome que a pessoa digita no último passo do quiz, tratado pra ir num título.
//
// Fica num módulo próprio (e não dentro do step do quiz) porque quem mais usa
// isto é a /mi-plan e a /calculando: importar do step arrastaria o pixel e o
// quiz-ui pro bundle de páginas que não precisam de nenhum dos dois.

/** Primeiro nome, uma palavra, capitalizada, sem números nem símbolos.
 *  Ela digita "maria fernanda 😊" e a tela mostra "Maria".
 *  Devolve string vazia quando não sobrar nada aproveitável — aí toda a página
 *  cai no texto sem nome, que continua existindo pra quem não quis dizer. */
export function cleanFirstName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const first = raw
    .replace(/[^\p{L}\p{M}\s'-]/gu, '')
    .trim()
    .split(/\s+/)[0] ?? ''
  if (first.length < 2) return ''
  const cut = first.slice(0, 18)
  return cut.charAt(0).toLocaleUpperCase('es') + cut.slice(1).toLocaleLowerCase('es')
}

/** Lê o nome do draft do quiz (sessionStorage ou draft_answers do banco). */
export function firstNameFromDraft(draft: Record<string, unknown> | null | undefined): string {
  const s12 = (draft?.step_12 ?? {}) as Record<string, unknown>
  return cleanFirstName(s12.first_name)
}
