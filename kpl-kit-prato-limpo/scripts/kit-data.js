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
  { n: 1, title: 'Rituais e jogos de mesa', desc: 'Dinâmicas de 5 minutos que mudam o clima da refeição.' },
  { n: 2, title: 'Situações difíceis', desc: 'Festa, escola, casa de avó, viagem e criança doente.' },
  { n: 3, title: 'Progressão por textura', desc: 'De crocante para macio, de purê para pedaço.' },
  { n: 4, title: 'Apresentação do prato', desc: 'Montagem visual, porcionamento e escolha guiada.' },
  { n: 5, title: 'Participação na cozinha', desc: 'A criança ajuda a preparar o que vai comer.' },
  { n: 6, title: 'Brincadeiras fora da refeição', desc: 'Quebra a associação entre comida e conflito.' },
  { n: 7, title: 'Histórias e faz de conta', desc: 'Narrativas curtas com o alimento como personagem.' },
  { n: 8, title: 'Aproximação sensorial', desc: 'Contato com o alimento sem obrigação de comer.' },
  { n: 9, title: 'Vontade de experimentar', desc: 'Curiosidade e coragem de dentro pra fora, sem depender de pressão.' },
];

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

module.exports = { BLOCKS, BONUSES, titleFromFile };
