// Separa as fichas de consultorio pra imprimir e filmar a demonstracao.
//
// CRITERIO DA ESCOLHA: cobrir o protocolo de ponta a ponta (avaliacao ->
// aproximacao -> toque -> boca -> prova -> ambiente -> caso dificil -> alta).
// Na mesa, em leque, precisa dar pra ver que existe um CAMINHO, nao uma pilha
// de folha solta. Por isso nao sao 10 fichas parecidas.
//
// Saida:
//   PROFISSIONAL/criativos/para-imprimir/   PNGs numerados na ordem
//   PROFISSIONAL/criativos/fichas-para-filmar.pdf   tudo num arquivo so
//
// Rodar:  node scripts/build-fichas-para-filmar.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const RAIZ = path.join(__dirname, '..');
const FICHAS = path.join(RAIZ, 'PROFISSIONAL', 'fichas-consultorio');
const OUT = path.join(RAIZ, 'PROFISSIONAL', 'criativos');
const PASTA = path.join(OUT, 'para-imprimir');

// A4 retrato em pontos.
const W = 595.28;
const H = 841.89;
const MARGEM = 20;

// 18/09: troca de criterio. A primeira selecao cobria o protocolo inteiro, o que
// e racional mas nao para ninguem no feed. Criativo e pontape, a pagina conta o
// resto. Agora sao so as fichas em que a crianca TOCA o alimento de verdade
// dentro de uma brincadeira: as que a nutri olha e pensa "aplico na proxima
// consulta".
const SELECAO = [
  ['C11-carimbo-de-pimentao.png', 'toque', 'Carimbo de pimentão'],
  ['C16-quebra-cabeca-de-fruta.png', 'toque', 'Quebra-cabeça de fruta'],
  ['C13-boliche-de-tomate.png', 'toque', 'Boliche de tomate'],
  ['C12-torre-de-legumes.png', 'toque', 'Torre de legumes'],
  ['C15-pescaria-de-macarrao.png', 'toque', 'Pescaria de macarrão'],
  ['C14-massinha-de-comida.png', 'toque', 'Massinha de comida'],
  ['C21-magica-da-gelatina.png', 'toque', 'Mágica da gelatina'],
  ['C03-a-caixa-fechada.png', 'toque', 'A caixa fechada'],
];

async function main() {
  fs.rmSync(PASTA, { recursive: true, force: true });
  fs.mkdirSync(PASTA, { recursive: true });

  const pdf = await PDFDocument.create();
  pdf.setTitle('Fichas de consultório para imprimir e filmar');

  // Capa (gerada no ChatGPT a partir do logo) vira a primeira pagina, pra sair
  // tudo numa impressao so. Mora FORA de para-imprimir/ porque essa pasta e
  // apagada e refeita a cada rodada do script.
  const CAPA = path.join(OUT, 'capa-kit-prato-limpo.png');
  if (fs.existsSync(CAPA)) {
    const img = await pdf.embedJpg(await sharp(CAPA).jpeg({ quality: 92 }).toBuffer());
    const escala = Math.min((W - MARGEM * 2) / img.width, (H - MARGEM * 2) / img.height);
    const w = img.width * escala;
    const h = img.height * escala;
    pdf.addPage([W, H]).drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
    console.log('  capa   capa-kit-prato-limpo.png');
  }

  console.log(SELECAO.length + ' fichas de toque com alimento real:\n');
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

  console.log('\nPNGs  -> PROFISSIONAL/criativos/para-imprimir/');
  console.log('PDF   -> PROFISSIONAL/criativos/fichas-para-filmar.pdf  (' +
    (bytes.length / 1024 / 1024).toFixed(1) + ' MB, ' + pdf.getPageCount() + ' páginas)');
}

main().catch((e) => { console.error(e); process.exit(1); });
