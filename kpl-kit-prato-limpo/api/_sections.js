// Lista única das seções da página, na ordem em que aparecem (usada pelo
// heartbeat de presença e pelo funil do painel). Atualize aqui se adicionar
// ou remover uma seção da página das mães.
// (27/08: a página das mães voltou a ser a raiz. A Edição Profissional foi
// pra /profissional e continua sem rastreamento de seção.)
const SECTIONS = [
  { id: 'hero', label: 'Topo (hero)' },
  // 30/08: a dor passou a vir ANTES do índice na página (agitar o problema
  // antes de mostrar o mecanismo). A ordem aqui acompanha, então dado anterior
  // a essa data tem esses dois índices trocados em relação ao que a pessoa viu.
  { id: 'dores', label: 'A dor (agitação)' },
  { id: 'indice', label: 'Índice de sintomas' },
  // 14/09: a secao #antesdepois saiu da pagina. A entrada FICA de proposito:
  // tirar daqui remapearia o indice de todo dado ja coletado. Hoje a linha dela
  // no painel significa "passou daquele ponto da pagina".
  { id: 'antesdepois', label: 'Antes vs Depois' },
  { id: 'como', label: 'Como funciona' },
  { id: 'ficha', label: 'Ficha de exemplo' },
  { id: 'blocos', label: '8 blocos do sistema' },
  // 03/09: a seção "Tudo que vem no kit" saiu da página, então sai daqui
  // também. Dado anterior a essa data tem um índice a mais nesse ponto: o que
  // era 'materiais' virou 'depoimentos' na leitura do painel.
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

// Trilha da EDIÇÃO PROFISSIONAL (/profissional). Funil separado pelo mesmo
// motivo do quiz: é outra página, outro público e outro preço, então misturar
// com as seções da página das mães faria o painel somar coisas diferentes.
// Vive no campo `proMax` do visitante. A ordem aqui É o funil: os últimos
// passos não são seções roladas, são ações (escolheu plano, aplicou cupom,
// gerou o Pix), e por isso ficam no fim, mais fundo que qualquer rolagem.
const PRO_STEPS = [
  { id: 'p_topo', label: '1. Topo' },
  // 22/09: a secao da dor ficava ENTRE o topo e as tres pecas sem ser medida,
  // entao quem rolava ate ela e saia era contado como "parou no topo". Era isso
  // que fazia o abandono do topo parecer maior do que e.
  { id: 'p_dentro', label: '2. Viu o material por dentro' },
  { id: 'p_dor', label: '3. A dor' },
  { id: 'p_pecas', label: '4. As três peças' },
  { id: 'p_ficha', label: '5. Ficha por dentro' },
  { id: 'p_app', label: '6. O aplicativo' },
  { id: 'p_junto', label: '7. Vem junto' },
  // 22/09: a secao de bonus entrou aqui no meio. Nao renumera nada no banco:
  // o que fica gravado no visitor e o ID do passo, e o indice e calculado na
  // leitura (ver funnel-data), entao visita antiga continua no lugar certo.
  { id: 'p_bonus', label: '8. Os bônus' },
  { id: 'p_licenca', label: '9. Licença de uso' },
  { id: 'p_checkout', label: '10. Chegou no checkout' },
  { id: 'p_plano', label: '11. Escolheu um plano' },
  { id: 'p_dados', label: '12. Começou a preencher' },
  { id: 'p_pix', label: '13. Gerou o Pix' },
  { id: 'p_pago', label: '14. Pagou' },
];

// Trilha do QUIZ PROFISSIONAL (/quiz-pro). Quarta trilha do painel. Separada
// do quiz das maes porque e outro publico, outro preco e outras perguntas:
// somar as duas daria um funil que nao descreve nenhuma das duas.
const PRO_QUIZ_STEPS = [
  { id: 'pq1', label: '1. Onde atende' },
  { id: 'pq2', label: '2. Quantas crianças por mês' },
  { id: 'pq3', label: '3. Idade da maioria' },
  { id: 'pq4', label: '4. O que mais trava' },
  { id: 'pq5', label: '5. Tempo de preparo' },
  { id: 'pq6', label: '6. Tarefa de casa hoje' },
  { id: 'pq7', label: '7. Usa material impresso' },
  { id: 'pqresultado', label: '8. Resultado' },
  { id: 'pqcta', label: '9. Clicou pra ver o kit' },
];

module.exports = { SECTIONS, QUIZ_STEPS, PRO_STEPS, PRO_QUIZ_STEPS };
