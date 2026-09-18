// Separa as 10 fichas de consultorio pra imprimir e filmar a demonstracao.
//
// CRITERIO DA ESCOLHA: cobrir o protocolo de ponta a ponta (avaliacao ->
// aproximacao -> toque -> boca -> prova -> ambiente -> caso dificil -> alta).
// Na mesa, em leque, precisa dar pra ver que existe um CAMINHO, nao uma pilha
// de folha solta. Por isso nao sao 10 fichas parecidas.
//
// Saida:
//   criativos-kpl/profissional/para-imprimir/   PNGs numerados na ordem
//   criativos-kpl/profissional/fichas-para-filmar.pdf   tudo num arquivo so
//
// Rodar:  node scripts/build-fichas-para-filmar.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const RAIZ = path.join(__dirname, '..');
const FICHAS = path.join(RAIZ, 'assets', 'fichas-consultorio');
const OUT = path.join(RAIZ, '..', 'criativos-kpl', 'profissional');
const PASTA = path.join(OUT, 'para-imprimir');

// A4 retrato em pontos.
const W = 595.28;
const H = 841.89;
const MARGEM = 20;

const SELECAO = [
  ['C01-o-mapa-do-prato.png', 'avaliacao', 'O mapa do prato'],
  ['C04-escadinha-do-medo.png', 'avaliacao', 'Escadinha do medo'],
  ['C06-adivinha-pelo-cheiro.png', 'aproximacao', 'Adivinha pelo cheiro'],
  ['C11-carimbo-de-pimentao.png', 'toque', 'Carimbo de pimentão'],
  ['C16-quebra-cabeca-de-fruta.png', 'toque', 'Quebra-cabeça de fruta'],
  ['C24-a-lambida-secreta.png', 'boca', 'A lambida secreta'],
  ['C27-o-juri-do-sabor.png', 'prova', 'O júri do sabor'],
  ['C37-as-frases-da-mesa.png', 'ambiente', 'As frases da mesa'],
  ['C48-depois-do-engasgo.png', 'caso-dificil', 'Depois do engasgo'],
  ['C60-alta-com-plano-de-90-dias.png', 'alta', 'Alta com plano de 90 dias'],
];

async function main() {
  fs.rmSync(PASTA, { recursive: true, force: true });
  fs.mkdirSync(PASTA, { recursive: true });

  const pdf = await PDFDocument.create();
  pdf.setTitle('Fichas de consultório para imprimir e filmar');

  console.log('10 fichas, da avaliação até a alta:\n');
  for (let i = 0; i < SELECAO.length; i++) {
    const [arquivo, etapa, titulo] = SELECAO[i];
    const origem = path.join(FICHAS, arquivo);
    if (!fs.existsSync(origem)) { console.error('NAO ACHEI: ' + arquivo); process.exit(1); }

    const n = String(i + 1).padStart(2, '0');
    const destino = path.join(PASTA, `${n}-${etapa}-${arquivo}`);
    fs.copyFileSync(origem, destino);

    // Pro PDF: jpeg de qualidade alta pesa muito menos que PNG e imprime igual.
    const buf = await sharp(origem).jpeg({ quality: 92 }).toBuffer();
    const img = await pdf.embedJpg(buf);

    // Encaixa inteira na pagina (a ficha e 2:3, mais alta que A4), centralizada.
    const escala = Math.min((W - MARGEM * 2) / img.width, (H - MARGEM * 2) / img.height);
    const w = img.width * escala;
    const h = img.height * escala;
    const pagina = pdf.addPage([W, H]);
    pagina.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });

    console.log('  ' + n + '  ' + etapa.padEnd(13) + titulo);
  }

  const bytes = await pdf.save();
  const saida = path.join(OUT, 'fichas-para-filmar.pdf');
  fs.writeFileSync(saida, bytes);

  console.log('\nPNGs  -> criativos-kpl/profissional/para-imprimir/');
  console.log('PDF   -> criativos-kpl/profissional/fichas-para-filmar.pdf  (' +
    (bytes.length / 1024 / 1024).toFixed(1) + ' MB, ' + pdf.getPageCount() + ' páginas)');
}

main().catch((e) => { console.error(e); process.exit(1); });
