// Gera os DOIS bonus da Edicao Profissional (22/09):
//
//   1. Mapa das 12 etapas  -> uma folha so, de parede. O caminho inteiro da
//      avaliacao ate a alta, com quantas fichas tem cada etapa.
//   2. Pacote de 8 sessoes -> guia dizendo o que fazer em cada consulta: qual
//      ficha aplicar, o que observar e o que a familia leva pra casa.
//
// POR QUE ESTES DOIS: entraram no lugar da "licenca de uso" e do "link da
// familia", que eram bonus fracos (a licenca ja aparece em tres lugares da
// pagina, e o link da familia so interessa DEPOIS da compra). Estes dois
// atacam a duvida real de quem esta comecando: "tenho 189 fichas, e agora,
// qual eu uso em quem, e em que ordem?".
//
// NADA AQUI E INVENTADO: as 12 etapas, os textos delas e os nomes das fichas
// saem de api/_consultorio.json, que e a mesma fonte do app. Se uma ficha
// mudar de nome la, muda aqui tambem, e o script quebra se sumir.
//
// ONDE CAI: entrega/mapa-12-etapas-<hash>.pdf e entrega/pacote-8-sessoes-<hash>.pdf,
// nomes gravados em api/_kit-file.json nas chaves "mapa" e "pacote".
//
// Rodar:  node scripts/build-bonus-profissional.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const OUTPUT_DIR = path.join(__dirname, '..', 'entrega');
const MANIFEST_PATH = path.join(__dirname, '..', 'api', '_kit-file.json');
const STAGES = require('../api/_consultorio.json').stages;

const W = 595.28;
const H = 841.89;
const M = 44;

// Paleta do kit (mesma do profissional.html).
const GREEN = rgb(0.361, 0.655, 0.255);
const GREEN_DARK = rgb(0.235, 0.478, 0.173);
const MINT = rgb(0.910, 0.945, 0.867);
const ORANGE = rgb(0.949, 0.569, 0.122);
const ORANGE_SOFT = rgb(0.992, 0.922, 0.812);
const CORAL = rgb(0.941, 0.404, 0.227);
const INK = rgb(0.149, 0.188, 0.165);
const TEXT = rgb(0.294, 0.337, 0.306);
const MUTED = rgb(0.486, 0.522, 0.490);
const BORDER = rgb(0.914, 0.890, 0.835);
const CREAM = rgb(0.984, 0.973, 0.945);
const WHITE = rgb(1, 1, 1);

let bold, regular;
let minY = H;
const marca = (y) => { if (y < minY) minY = y; };

// Helvetica so aceita WinAnsi: acento passa, emoji nao.
function ansi(s) {
  return String(s)
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/–|—/g, '-').replace(/…/g, '...')
    .replace(/[^\x00-\xFF]/g, '');
}
function text(page, s, x, y, { size = 10, font = regular, color = TEXT } = {}) {
  marca(y);
  page.drawText(ansi(s), { x, y, size, font, color });
}
function centered(page, s, y, { size = 10, font = regular, color = TEXT, cx = W / 2 } = {}) {
  const t = ansi(s);
  marca(y);
  page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y, size, font, color });
}
// Quebra por largura real da fonte, nao por contagem de caracteres.
function quebra(s, largura, size, font) {
  const linhas = [];
  let linha = '';
  for (const palavra of ansi(s).split(/\s+/)) {
    const teste = linha ? linha + ' ' + palavra : palavra;
    if (font.widthOfTextAtSize(teste, size) > largura && linha) { linhas.push(linha); linha = palavra; }
    else linha = teste;
  }
  if (linha) linhas.push(linha);
  return linhas;
}
function paragrafo(page, s, x, y, largura, { size = 9, font = regular, color = TEXT, passo = null } = {}) {
  const p = passo || size * 1.32;
  for (const linha of quebra(s, largura, size, font)) {
    text(page, linha, x, y, { size, font, color });
    y -= p;
  }
  return y;
}

function rodape(page, esquerda) {
  page.drawLine({ start: { x: M, y: 50 }, end: { x: W - M, y: 50 }, thickness: 0.8, color: BORDER });
  page.drawText(ansi(esquerda), { x: M, y: 36, size: 7.5, font: regular, color: MUTED });
  const t = ansi('Kit Prato Limpo - Edição Profissional');
  page.drawText(t, { x: W - M - regular.widthOfTextAtSize(t, 7.5), y: 36, size: 7.5, font: regular, color: MUTED });
  // O rodape NAO passa pelo marca(): ele mora abaixo da linha de proposito, e
  // conta-lo faria a conferencia de estouro acusar erro em toda folha.
}

function cabecalho(page, { titulo, subtitulo, altura = 96 }) {
  page.drawRectangle({ x: 0, y: H - altura, width: W, height: altura, color: GREEN });
  page.drawRectangle({ x: 0, y: H - altura - 4, width: W, height: 4, color: GREEN_DARK, opacity: 0.25 });
  text(page, titulo, M, H - altura + 40, { size: 20, font: bold, color: WHITE });
  text(page, subtitulo, M, H - altura + 22, { size: 9.5, font: regular, color: WHITE });
  return H - altura - 26;
}

/* =========================================================
   BONUS 1: MAPA DAS 12 ETAPAS (uma folha)
   ========================================================= */
function mapaDasEtapas(pdf) {
  const page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });

  cabecalho(page, {
    titulo: 'O mapa das 12 etapas',
    subtitulo: 'Da avaliação inicial até a alta. Onde cada uma das 60 fichas entra.',
    altura: 88,
  });

  // Duas colunas de seis. Cabe numa folha A4 e da pra colar na parede.
  const colW = (W - M * 2 - 14) / 2;
  const linhaH = 104;
  const topo = H - 88 - 34;

  STAGES.forEach((etapa, i) => {
    const col = i % 2;
    const lin = Math.floor(i / 2);
    const x = M + col * (colW + 14);
    const y = topo - lin * linhaH;

    page.drawRectangle({ x, y: y - linhaH + 14, width: colW, height: linhaH - 12, color: WHITE, borderColor: BORDER, borderWidth: 1 });
    // Trilho colorido na esquerda: da a sensacao de caminho, nao de lista.
    page.drawRectangle({ x, y: y - linhaH + 14, width: 4, height: linhaH - 12, color: i < 6 ? GREEN : ORANGE });

    // Selo da letra da etapa
    page.drawCircle({ x: x + 26, y: y - 6, size: 12, color: i < 6 ? MINT : ORANGE_SOFT });
    centered(page, etapa.code, y - 10, { size: 11, font: bold, color: i < 6 ? GREEN_DARK : CORAL, cx: x + 26 });

    text(page, etapa.title, x + 44, y - 4, { size: 10.5, font: bold, color: INK });
    text(page, etapa.fichas.length + ' fichas', x + 44, y - 16, { size: 7.5, font: bold, color: MUTED });

    let yy = paragrafo(page, etapa.desc, x + 14, y - 32, colW - 26, { size: 7.8, color: TEXT });
    yy -= 2;
    // Nomes reais das fichas: e o que prova que o mapa nao e enfeite.
    paragrafo(page, etapa.fichas.map((f) => f.title).join(' · '), x + 14, yy, colW - 26, { size: 7, color: GREEN_DARK, passo: 9 });
  });

  rodape(page, 'Mapa das 12 etapas  |  bônus da Edição Profissional');
}

/* =========================================================
   BONUS 2: PACOTE DE 8 SESSOES
   ========================================================= */

// Acha a ficha pelo titulo. Se o nome mudar no _consultorio.json, o build
// quebra aqui em vez de imprimir uma ficha que nao existe mais.
function ficha(titulo) {
  for (const s of STAGES) {
    for (const f of s.fichas) if (f.title.toLowerCase() === titulo.toLowerCase()) return { titulo: f.title, etapa: s.title, code: s.code };
  }
  throw new Error('ficha nao encontrada no _consultorio.json: ' + titulo);
}

const SESSOES = [
  {
    n: 1, nome: 'Descobrir o que ela come de verdade',
    porque: 'Antes de propor qualquer alimento novo, você precisa do repertório real, não do que a mãe lembra na hora da consulta.',
    aplicar: ['O mapa do prato', 'O que a boca aceita'],
    observar: 'Quantos alimentos sobram na cesta do NUNCA COMI, e se a recusa é de textura, cheiro ou marca.',
    casa: 'Semáforo dos alimentos',
  },
  {
    n: 2, nome: 'Arrumar a mesa antes de arrumar o prato',
    porque: 'A maior parte do travamento está no adulto e na rotina. Mexer nisso primeiro faz as sessões seguintes renderem.',
    aplicar: ['O mapa da mesa', 'As frases da mesa'],
    observar: 'Quem serve o prato, quanto tempo dura a refeição e quantas frases de pressão aparecem.',
    casa: 'A linha do dia',
  },
  {
    n: 3, nome: 'Chegar perto sem precisar comer',
    porque: 'Olhar e cheirar tira a ameaça do alimento. A criança ganha contato sem o contrato de engolir.',
    aplicar: ['Adivinha pelo cheiro', 'Retrato do alimento'],
    observar: 'Se ela afasta a cabeça, e em que distância a recusa começa.',
    casa: 'Detetive de cores',
  },
  {
    n: 4, nome: 'A mão entra no alimento',
    porque: 'O toque vem antes da boca. Dentro de um jogo, a mão aceita o que a boca ainda recusa.',
    aplicar: ['Carimbo de pimentão', 'Quebra-cabeça de fruta'],
    observar: 'Se ela toca com a mão inteira ou com um dedo só, e se pede para limpar na hora.',
    casa: 'Massinha de comida',
  },
  {
    n: 5, nome: 'O alimento muda de forma na frente dela',
    porque: 'O que muda de forma deixa de ser imprevisível. É aqui que a curiosidade passa na frente do medo.',
    aplicar: ['Mágica da gelatina', 'Chef de tesoura'],
    observar: 'Se ela aceita a versão nova de um alimento que já recusava na forma original.',
    casa: 'O alimento que muda',
  },
  {
    n: 6, nome: 'Lábio, língua e mordida',
    porque: 'A boca entra em partes: encostar, lamber e morder são três passos, não um.',
    aplicar: ['A lambida secreta', 'O bigode'],
    observar: 'Até onde ela vai sozinha, e se recua quando percebe que está indo longe.',
    casa: 'Beijo no alimento',
  },
  {
    n: 7, nome: 'Provar com direito de recusar',
    porque: 'A prova só vira hábito quando ela sabe que pode cuspir. Sem essa saída, ela nem começa.',
    aplicar: ['O júri do sabor', 'O contrato do provador'],
    observar: 'Se ela prova mais quando a recusa está autorizada por escrito.',
    casa: 'Diário de conquistas',
    nota: 'Se a sessão virar crise, troque na hora por O termômetro do não ou A pausa de 30 segundos, da etapa G.',
  },
  {
    n: 8, nome: 'Fechar o ciclo e dar alta com plano',
    porque: 'A família precisa ver o avanço em número, e levar um plano para o dia em que a recaída vier.',
    aplicar: ['O gráfico do repertório', 'Alta com plano de 90 dias'],
    observar: 'Quantos alimentos entraram desde a sessão 1, e o que ela mesma diz que mudou.',
    casa: 'A regra do primo',
  },
];

function capaDoPacote(pdf) {
  const page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
  page.drawRectangle({ x: 0, y: H - 300, width: W, height: 300, color: GREEN });
  page.drawRectangle({ x: 0, y: H - 304, width: W, height: 4, color: GREEN_DARK, opacity: 0.25 });

  centered(page, 'BÔNUS DA EDIÇÃO PROFISSIONAL', H - 108, { size: 9, font: bold, color: MINT });
  centered(page, 'Pacote de 8 sessões', H - 156, { size: 30, font: bold, color: WHITE });
  centered(page, 'O que fazer em cada consulta, da avaliação à alta', H - 184, { size: 11.5, color: WHITE });
  centered(page, 'Sem montar atividade do zero para cada paciente', H - 202, { size: 11.5, color: WHITE });

  let y = H - 350;
  y = paragrafo(page,
    'Este é um roteiro de partida, não uma regra. Cada sessão traz a ficha que você aplica na consulta, '
    + 'o que olhar enquanto a criança brinca e a ficha que a família leva pra casa até a próxima.',
    M, y, W - M * 2, { size: 11, passo: 16 });

  y -= 18;
  y = paragrafo(page,
    'A ordem segue a lógica das 12 etapas do kit: primeiro você mede o repertório real, depois arruma o adulto '
    + 'e a rotina, e só então caminha do olhar para o toque, do toque para a boca, e da boca para a prova. '
    + 'Pular etapa é o erro mais comum, e é o que faz a criança travar na sessão quatro.',
    M, y, W - M * 2, { size: 11, passo: 16 });

  y -= 26;
  page.drawRectangle({ x: M, y: y - 78, width: W - M * 2, height: 88, color: ORANGE_SOFT });
  page.drawRectangle({ x: M, y: y - 78, width: 5, height: 88, color: ORANGE });
  text(page, 'Quando fugir do roteiro', M + 18, y - 6, { size: 11, font: bold, color: INK });
  paragrafo(page,
    'Criança com repertório mínimo, só triturado, engasgo recente ou náusea antes de comer não entra neste '
    + 'caminho direto: comece pela etapa J, Casos difíceis, e volte pra sessão 1 quando o quadro estabilizar.',
    M + 18, y - 24, W - M * 2 - 34, { size: 9.5, passo: 13 });

  rodape(page, 'Pacote de 8 sessões  |  capa');
}

function paginaDaSessao(pdf, s) {
  const page = pdf.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });

  let y = cabecalho(page, { titulo: 'Sessão ' + s.n + ': ' + s.nome, subtitulo: 'Pacote de 8 sessões', altura: 92 });

  // Por que esta sessao existe
  page.drawRectangle({ x: M, y: y - 44, width: W - M * 2, height: 58, color: MINT });
  page.drawRectangle({ x: M, y: y - 44, width: 4, height: 58, color: GREEN });
  text(page, 'POR QUE ESTA SESSÃO', M + 16, y + 0, { size: 8, font: bold, color: GREEN_DARK });
  paragrafo(page, s.porque, M + 16, y - 16, W - M * 2 - 32, { size: 9.5, passo: 12.5 });
  y -= 72;

  // Fichas que voce aplica na consulta
  text(page, 'O QUE VOCÊ APLICA NA CONSULTA', M, y, { size: 8.5, font: bold, color: MUTED });
  y -= 18;
  for (const nome of s.aplicar) {
    const f = ficha(nome);
    page.drawRectangle({ x: M, y: y - 26, width: W - M * 2, height: 42, color: WHITE, borderColor: BORDER, borderWidth: 1 });
    page.drawCircle({ x: M + 24, y: y + 2, size: 11, color: MINT });
    centered(page, f.code, y - 2, { size: 10, font: bold, color: GREEN_DARK, cx: M + 24 });
    text(page, f.titulo, M + 44, y + 2, { size: 11, font: bold, color: INK });
    text(page, 'Etapa ' + f.code + ' - ' + f.etapa, M + 44, y - 12, { size: 8, color: MUTED });
    y -= 52;
  }

  // O que observar
  y -= 4;
  text(page, 'O QUE OBSERVAR', M, y, { size: 8.5, font: bold, color: MUTED });
  y = paragrafo(page, s.observar, M, y - 16, W - M * 2, { size: 10, passo: 13.5 });

  // A ficha que a familia leva
  y -= 20;
  const fc = ficha(s.casa);
  page.drawRectangle({ x: M, y: y - 34, width: W - M * 2, height: 52, color: ORANGE_SOFT });
  page.drawRectangle({ x: M, y: y - 34, width: 4, height: 52, color: ORANGE });
  text(page, 'A FAMÍLIA LEVA PRA CASA', M + 16, y + 6, { size: 8, font: bold, color: CORAL });
  text(page, fc.titulo, M + 16, y - 10, { size: 11.5, font: bold, color: INK });
  text(page, 'Etapa ' + fc.code + ' - ' + fc.etapa, M + 16, y - 24, { size: 8, color: MUTED });
  y -= 52;

  if (s.nota) {
    y -= 6;
    text(page, 'SE A SESSÃO VIRAR CRISE', M, y, { size: 8.5, font: bold, color: MUTED });
    y = paragrafo(page, s.nota, M, y - 15, W - M * 2, { size: 9.5, passo: 13 });
  }

  // Espaco pra escrever: a folha e de trabalho, nao de leitura.
  y -= 24;
  text(page, 'ANOTAÇÕES DA SESSÃO', M, y, { size: 8.5, font: bold, color: MUTED });
  y -= 16;
  for (let i = 0; i < 7; i++) {
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: BORDER });
    marca(y);
    y -= 24;
  }

  rodape(page, 'Sessão ' + s.n + ' de 8  |  Pacote de 8 sessões');
}

/* =========================================================
   BUILD
   ========================================================= */
async function gera(nomeBase, chave, montar) {
  const pdf = await PDFDocument.create();
  bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  regular = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setTitle(nomeBase);
  pdf.setAuthor('Kit Prato Limpo');

  minY = H;
  montar(pdf);
  const ok = minY > 48;
  console.log((ok ? '  ok      ' : '  ESTOUROU') + ' ' + nomeBase.padEnd(22) + ' y mais baixo = ' + minY.toFixed(0));
  if (!ok) process.exitCode = 1;

  const bytes = await pdf.save();
  const hash = crypto.createHash('md5').update(bytes).digest('hex');
  const fileName = `${chave === 'mapa' ? 'mapa-12-etapas' : 'pacote-8-sessoes'}-${hash}.pdf`;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const prefixo = new RegExp('^' + (chave === 'mapa' ? 'mapa-12-etapas' : 'pacote-8-sessoes') + '-[0-9a-f]+\\.pdf$', 'i');
  for (const old of fs.readdirSync(OUTPUT_DIR)) {
    if (prefixo.test(old) && old !== fileName) fs.unlinkSync(path.join(OUTPUT_DIR, old));
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), bytes);

  const manifesto = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  manifesto[chave] = fileName;
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifesto, null, 2) + '\n');
  console.log(`OK: ${pdf.getPageCount()} paginas -> entrega/${fileName} (${(bytes.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  await gera('Mapa das 12 etapas', 'mapa', (pdf) => mapaDasEtapas(pdf));
  await gera('Pacote de 8 sessões', 'pacote', (pdf) => {
    capaDoPacote(pdf);
    for (const s of SESSOES) paginaDaSessao(pdf, s);
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
