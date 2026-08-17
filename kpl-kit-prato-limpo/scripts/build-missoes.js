// Gera assets/missoes.json — a base do jogo "Missão do Dia" dentro do app.
//
// Por que existe: as 86 fichas já têm título E instrução escritos no
// PROMPTS-86-ATIVIDADES.md (o doc de produção das artes). O jogo precisa
// exatamente disso, então em vez de reescrever 86 textos à mão a gente extrai
// da fonte que já é a verdade. Se um dia o texto de uma ficha mudar lá, rode
// este script de novo e o jogo acompanha, sem divergir do material impresso.
//
// A arte de cada missão vem do gallery-manifest.json, casada pelo código
// (B1-F01). Assim a criança que ainda não lê vê a mesma ilustração da ficha.
//
// Uso: node scripts/build-missoes.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MD = path.join(ROOT, 'PROMPTS-86-ATIVIDADES.md');
const MANIFEST = path.join(ROOT, 'assets', 'gallery-manifest.json');
const OUT = path.join(ROOT, 'assets', 'missoes.json');

const { BLOCKS } = require('./kit-data');

// Onde a missão acontece. O bloco já carrega essa informação, então dá pra
// derivar em vez de marcar 86 vezes na mão. Serve pro filtro "agora dá pra
// fazer o quê?" — mãe na correria da janta não quer sortear uma missão que
// pede uma tarde livre na cozinha.
const MOMENTO_POR_BLOCO = {
  1: 'mesa',    // Rituais e jogos de mesa
  2: 'mesa',    // Situações difíceis
  3: 'mesa',    // Progressão por textura
  4: 'mesa',    // Apresentação do prato
  5: 'cozinha', // Participação na cozinha
  6: 'fora',    // Brincadeiras fora da refeição
  7: 'fora',    // Histórias e faz de conta
  8: 'mesa',    // Aproximação sensorial
};

function parseMissoes() {
  const text = fs.readFileSync(MD, 'utf8');
  // Casa o cabeçalho da ficha e a linha de citação logo abaixo, até a linha
  // em branco. É o formato fixo do documento inteiro.
  const re = /^### (B(\d+)-F\d+) · (.+)\n> ([\s\S]*?)(?=\n\n)/gm;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const [, code, blocoStr, title, corpo] = m;
    const instrucao = (corpo.match(/Instru[çc][ãa]o:\s*"([^"]+)"/) || [])[1];
    if (!instrucao) {
      throw new Error(`Ficha ${code} sem instrução legível — conserte o markdown antes de gerar o jogo.`);
    }
    // MODO PINTAR pede lápis e impressão; MODO COLORIDO se faz direto.
    // O jogo avisa antes pra mãe não sortear algo que ela não consegue fazer agora.
    const precisaImprimir = /MODO PINTAR/.test(corpo);
    const bloco = Number(blocoStr);
    out.push({
      code,
      bloco,
      title: title.trim(),
      instrucao,
      momento: MOMENTO_POR_BLOCO[bloco] || 'mesa',
      imprimir: precisaImprimir,
    });
  }
  return out;
}

function main() {
  const missoes = parseMissoes();
  if (missoes.length !== 86) {
    console.warn(`Atenção: ${missoes.length} missões extraídas (esperado 86).`);
  }

  // Casa a arte pelo código. Sem a arte a missão ainda funciona (o card mostra
  // só o texto), então isto é enriquecimento, não requisito.
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const fileByCode = {};
  (manifest.blocks || []).forEach((b) => {
    (b.fichas || []).forEach((f) => {
      const code = (f.file.match(/^(B\d+-F\d+)-/) || [])[1];
      if (code) fileByCode[code] = f.file;
    });
  });

  let semArte = 0;
  missoes.forEach((mi) => {
    mi.file = fileByCode[mi.code] || null;
    if (!mi.file) semArte++;
  });

  const blocos = {};
  BLOCKS.forEach((b) => { blocos[b.n] = b.title; });

  fs.writeFileSync(OUT, JSON.stringify({ blocos, missoes }, null, 0));
  console.log(`assets/missoes.json: ${missoes.length} missões (${semArte} sem arte)`);
  const porMomento = missoes.reduce((acc, m) => { acc[m.momento] = (acc[m.momento] || 0) + 1; return acc; }, {});
  console.log('por momento:', porMomento);
  console.log('precisam imprimir:', missoes.filter((m) => m.imprimir).length);
}

main();
