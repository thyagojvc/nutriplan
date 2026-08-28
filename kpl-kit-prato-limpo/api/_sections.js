// Lista única das seções da página, na ordem em que aparecem (usada pelo
// heartbeat de presença e pelo funil do painel). Atualize aqui se adicionar
// ou remover uma seção da página das mães.
// (27/08: a página das mães voltou a ser a raiz. A Edição Profissional foi
// pra /profissional e continua sem rastreamento de seção.)
const SECTIONS = [
  { id: 'hero', label: 'Topo (hero)' },
  { id: 'indice', label: 'Índice de sintomas' },
  { id: 'dores', label: 'A dor (agitação)' },
  { id: 'antesdepois', label: 'Antes vs Depois' },
  { id: 'como', label: 'Como funciona' },
  { id: 'ficha', label: 'Ficha de exemplo' },
  { id: 'blocos', label: '8 blocos do sistema' },
  { id: 'materiais', label: 'Materiais e bônus' },
  { id: 'depoimentos', label: 'Depoimentos' },
  { id: 'garantia', label: 'Garantia' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'faq', label: 'FAQ' },
];

// Trilha do QUIZ (/quiz.html). É um funil SEPARADO de propósito: quem cai direto
// no index.html nunca passou pelo quiz, então não pode contar como se tivesse
// passado. Por isso o progresso do quiz vive no campo `quizMax` do visitante, e
// não no mesmo `maxSection` da página.
const QUIZ_STEPS = [
  { id: 'q1', label: '1. Idade da criança' },
  { id: 'q2', label: '2. O que acontece na mesa' },
  { id: 'q3', label: '3. Há quanto tempo' },
  { id: 'q4', label: '4. O que já tentou' },
  { id: 'q5', label: '5. Tempo por dia' },
  { id: 'qresultado', label: '6. Resultado' },
  { id: 'qcta', label: '7. Clicou pra ver o kit' },
];

module.exports = { SECTIONS, QUIZ_STEPS };
