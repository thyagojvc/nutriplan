// node scripts/build-blocos-thumb.js
//
// Gera a miniatura de UMA ficha por bloco, pra a seção "Os 11 blocos" da página
// de vendas mostrar que o material existe em vez de só descrevê-lo.
//
// A escolha é na mão, não é "a primeira do bloco": a ficha escolhida é a que
// melhor NOMEIA o trabalho daquele bloco quando a mãe bate o olho. Elas saem
// pequenas de propósito (260px), o suficiente pra dar a ideia e insuficiente
// pra alguém usar a ficha sem comprar.
//
// A fonte é assets/fichas-web (as JPGs de 800px que o build da galeria já faz),
// então isto roda depois de build-gallery-manifest.js.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WEB_DIR = path.join(__dirname, '..', 'assets', 'fichas-web');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'blocos-thumb');
const MANIFEST = require(path.join(__dirname, '..', 'assets', 'gallery-manifest.json'));

// bloco (posição na página) -> título da ficha escolhida
const ESCOLHA = {
  1:  'O caminho da cenoura',
  2:  'Cadu Cenoura',
  3:  'Monte o seu sanduíche',
  4:  'Só cheirar, não precisa comer',
  5:  'Passaporte dos sabores',
  6:  'Jogo da memória dos alimentos',
  7:  'A mesa sem tela',
  8:  'O tomate que tinha medo',
  9:  'A escada da textura',
  10: 'Arco-íris no prato',
  11: 'O prato da casa da vovó',
};

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const usados = new Set();
  const linhas = [];

  for (const b of MANIFEST.blocks) {
    const alvo = ESCOLHA[b.n];
    const ficha = b.fichas.find((f) => f.title === alvo);
    if (!ficha) {
      console.error(`BLOCO ${b.n} (${b.title}): não achei a ficha "${alvo}". Títulos: ` +
        b.fichas.map((f) => f.title).join(' | '));
      process.exitCode = 1;
      continue;
    }
    // Faixa larga tirada do TOPO da ficha, que é onde fica o título dela.
    // A coluna de conteúdo da página é estreita (mobile-first), então miniatura
    // ao lado do texto espremia a descrição em 4 linhas de 120px. Como faixa no
    // topo do card, a imagem ocupa a largura toda e o texto também.
    //
    // `cover` aqui não corta nada na horizontal: toda ficha é mais estreita que
    // a proporção alvo (2.26:1), então o corte é só vertical. Foi o contrário
    // que aconteceu quando o alvo era 3:4 e as fichas mais largas perdiam as
    // laterais, cortando o título.
    await sharp(path.join(WEB_DIR, ficha.file))
      .resize({ width: 520, height: 230, fit: 'cover', position: 'top' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(OUT_DIR, ficha.file));
    usados.add(ficha.file);
    linhas.push(`  bloco ${String(b.n).padStart(2)} ${b.title.padEnd(30)} -> ${ficha.file}`);
  }

  // some com miniatura de escolha antiga, senão a pasta vira depósito
  for (const old of fs.readdirSync(OUT_DIR)) if (!usados.has(old)) fs.unlinkSync(path.join(OUT_DIR, old));

  console.log(linhas.join('\n'));
  const total = [...usados].reduce((n, f) => n + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(`\n${usados.size} miniaturas, ${Math.round(total / 1024)}KB no total`);
})();
