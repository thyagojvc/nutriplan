// Fonte única dos blocos e bônus do kit — usado por build-kit-pdf.js e
// build-gallery-manifest.js. Mudou o nome ou a descrição de um bloco? Só
// muda aqui que os dois scripts pegam a versão nova.

const BONUSES = [
  { id: 'BONUS-01', title: 'Calendário de 30 dias', desc: 'Uma atividade por dia. Pinte o quadradinho quando terminar.' },
  { id: 'BONUS-02', title: 'Cartelas do sorteio', desc: 'Recorte, dobre e deixe a criança sortear a atividade do dia.' },
  { id: 'BONUS-03', title: 'Quadro de progresso', desc: 'Marque cada alimento novo aceito e veja a evolução numa folha só.' },
  { id: 'BONUS-04', title: 'Guia rápido de mesa', desc: 'O que ajuda e o que atrapalha na hora da refeição. Cole na geladeira.' },
];

const BLOCKS = [
  // ORDEM (27/08): por quanto a CRIANÇA faz sozinha, do mais interativo pro
  // mais conduzido pelo adulto. Ver [[kpl_ficha_interativa_vale_mais]]: folha
  // que a criança preenche tem valor percebido maior que cartão de instrução
  // pro adulto, então o que ela faz sozinha abre o kit e abre a página.
  //
  // O que isso custou: "Situações difíceis" (festa, escola, casa de avó) saiu
  // do 2º lugar pro último, e era o bloco em que a mãe em crise se reconhecia
  // de cara. A troca foi deliberada, valor percebido na frente do espelho.
  //
  // `n` é CHAVE DE ARQUIVO, não posição: é o que casa `B11-F120-*.png` com o
  // bloco em build-gallery-manifest.js, build-kit-pdf.js e build-missoes.js.
  // Nunca renumere. O número que aparece pro comprador é a posição no array,
  // e quem calcula isso são os builds.
  { n: 11, title: 'Folhas de brincar', desc: 'Labirinto, caça-palavras, ligar e contar. A criança faz sozinha, com lápis.' },
  { n: 10, title: 'Folhas para colorir', desc: 'Uma folha por amigo do prato. Só imprimir e deixar a criança colorir do jeito dela.' },
  { n: 5, title: 'Participação na cozinha', desc: 'A criança ajuda a preparar o que vai comer.' },
  { n: 8, title: 'Aproximação sensorial', desc: 'Contato com o alimento sem obrigação de comer.' },
  { n: 9, title: 'Vontade de experimentar', desc: 'Curiosidade e coragem de dentro pra fora, sem depender de pressão.' },
  { n: 6, title: 'Brincadeiras fora da refeição', desc: 'Quebra a associação entre comida e conflito.' },
  { n: 1, title: 'Rituais e jogos de mesa', desc: 'Dinâmicas de 5 minutos que mudam o clima da refeição.' },
  { n: 7, title: 'Histórias e faz de conta', desc: 'Narrativas curtas com o alimento como personagem.' },
  { n: 3, title: 'Progressão por textura', desc: 'De crocante para macio, de purê para pedaço.' },
  { n: 4, title: 'Apresentação do prato', desc: 'Montagem visual, porcionamento e escolha guiada.' },
  { n: 2, title: 'Situações difíceis', desc: 'Festa, escola, casa de avó, viagem e criança doente.' },
];


// ETAPAS DA EDIÇÃO PROFISSIONAL (22/08) — as fichas de consultório, feitas pra
// a nutricionista aplicar NA SESSÃO, com alimento de verdade na mesa. São outra
// categoria das fichas de casa: cada uma traz "o que observar" (leitura
// clínica), "o que dizer e o que evitar" (fala pronta, pra mãe repetir certo em
// casa) e "leva para casa" (a ponte que faz a orientação sobreviver até a
// próxima consulta). Ficam ANTES dos blocos caseiros no PDF profissional.
//
// Os arquivos são assets/fichas-consultorio/C<NN>-<slug>.png, e `range` é a
// faixa de NN de cada etapa — é isso que agrupa ficha em etapa, não o nome.
const PRO_STAGES = [
  { code: 'A', title: 'Avaliação inicial', desc: 'Mapear o repertório real e a raiz da recusa antes de intervir.', range: [1, 5] },
  { code: 'B', title: 'Aproximação sem contato', desc: 'Olhar e cheirar. A criança conhece o alimento sem precisar tocar.', range: [6, 10] },
  { code: 'C', title: 'Toque e manipulação', desc: 'A mão entra no alimento dentro de um jogo, sem expectativa de comer.', range: [11, 16] },
  { code: 'D', title: 'Som, corte e transformação', desc: 'O alimento muda de forma na frente dela e deixa de ser imprevisível.', range: [17, 21] },
  { code: 'E', title: 'Aproximação da boca', desc: 'Lábio, língua e mordida sem o contrato de engolir.', range: [22, 26] },
  { code: 'F', title: 'Prova e registro', desc: 'Provar com direito de recusa, e registrar o avanço entre as sessões.', range: [27, 30] },
  { code: 'G', title: 'Recusa e crise', desc: 'O que fazer quando o único repertório da criança é dizer não.', range: [31, 35] },
  { code: 'H', title: 'A ficha do adulto', desc: 'Aplicadas com o cuidador, não com a criança. É ele que muda primeiro.', range: [36, 40] },
  { code: 'I', title: 'Rotina e ambiente', desc: 'Horário, líquido, tela e lugar à mesa. O prato é só o fim da linha.', range: [41, 45] },
  { code: 'J', title: 'Casos difíceis', desc: 'Repertório mínimo, só triturado, medo depois do engasgo e náusea antecipatória.', range: [46, 50] },
  { code: 'K', title: 'Expansão do repertório', desc: 'Depois que ela prova: como virar hábito, volume e comida fora de casa.', range: [51, 55] },
  { code: 'L', title: 'Manutenção e alta', desc: 'Provar a evolução, sobreviver à recaída e dar alta com plano.', range: [56, 60] },
];

// "C11-carimbo-de-pimentao.png" -> "Carimbo de pimentao"
function titleFromProFile(file) {
  const slug = file.replace(/^C\d+-/, '').replace(/\.(png|jpe?g)$/i, '');
  const text = slug.split('-').filter(Boolean).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Título de verdade (com acento) vem de PROMPTS-86-ATIVIDADES.md — o nome do
// arquivo perdeu acentuação na hora de salvar (ex: "o-garfo-magico.png" em
// vez de "mágico"). Cai pro slug do arquivo só se por acaso faltar entrada
// lá (ficha nova ainda não documentada).
const fs = require('fs');
const path = require('path');

let titleMap = null;
function loadTitleMap() {
  if (titleMap) return titleMap;
  titleMap = {};
  const mdPath = path.join(__dirname, '..', 'PROMPTS-86-ATIVIDADES.md');
  const text = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
  const re = /^### (B\d+-F\d+) · (.+)$/gm;
  let m;
  while ((m = re.exec(text))) {
    titleMap[m[1]] = m[2].trim();
  }
  return titleMap;
}

// "B3-F19-a-escada-da-textura.png" -> "A escada da textura" (fallback sem acento)
function titleFromSlug(file) {
  const slug = file.replace(/^B\d+-F\d+-/, '').replace(/\.(png|jpe?g)$/i, '');
  const words = slug.split('-').filter(Boolean);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function titleFromFile(file) {
  const code = (file.match(/^(B\d+-F\d+)-/) || [])[1];
  const map = loadTitleMap();
  return (code && map[code]) || titleFromSlug(file);
}

module.exports = { BLOCKS, BONUSES, PRO_STAGES, titleFromFile, titleFromProFile };
