// Gera o PDF do bump "Fichas de devolutiva" da Edição Profissional (R$ 10).
//
// POR QUE E UM PDF SEPARADO, e nao mais uma variante do kit:
// o PDF profissional tem ~65 MB e o armazenamento da Vercel ja esta estourado.
// Gerar uma segunda copia dele so pra anexar 4 folhas custaria 65 MB por build.
// Aqui saem ~30 KB, com link proprio no e-mail.
//
// ONDE CAI: entrega/devolutiva-familia-<hash>.pdf, e o nome vai pro
// api/_kit-file.json na chave "devolutiva". A pasta entrega/ e gitignorada mas
// sobe no deploy (mesma regra dos outros PDFs).
//
// Desenhado com primitivas do pdf-lib (linha, retangulo, texto) em vez de PNG:
// sao formularios, nao fichas ilustradas. Assim imprime nitido em qualquer
// impressora e o arquivo fica leve.
//
// Rodar:  node scripts/build-devolutiva-pdf.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const OUTPUT_DIR = path.join(__dirname, '..', 'entrega');
const MANIFEST_PATH = path.join(__dirname, '..', 'api', '_kit-file.json');

// A4 em pontos.
const W = 595.28;
const H = 841.89;
const M = 46; // margem

// Paleta do kit.
const GREEN = rgb(0.361, 0.655, 0.255);      // #5CA741
const GREEN_DARK = rgb(0.235, 0.478, 0.173); // #3C7A2C
const INK = rgb(0.149, 0.188, 0.165);        // #26302A
const TEXT = rgb(0.294, 0.337, 0.306);       // #4B564E
const MUTED = rgb(0.486, 0.522, 0.490);      // #7C857D
const BORDER = rgb(0.914, 0.890, 0.835);     // #E9E3D5
const CREAM = rgb(0.957, 0.937, 0.890);      // #F4EFE3
const WHITE = rgb(1, 1, 1);

let bold, regular;

// Guarda o ponto mais baixo desenhado em cada folha. Sem poppler pra rasterizar
// aqui, esta e a conferencia de que nenhum campo passou por cima do rodape.
let minY = H;
const marca = (y) => { if (y < minY) minY = y; };

// pdf-lib com fonte padrao so aceita WinAnsi. Acento portugues cabe; o que
// quebra e emoji e alguns tracos tipograficos, entao troca antes de desenhar.
function ansi(s) {
  return String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–|—/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x00-\xFF]/g, '');
}

function text(page, s, x, y, { size = 10, font = regular, color = TEXT } = {}) {
  marca(y);
  page.drawText(ansi(s), { x, y, size, font, color });
}

function centered(page, s, y, { size = 10, font = regular, color = TEXT } = {}) {
  const t = ansi(s);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: (W - w) / 2, y, size, font, color });
}

// Cabecalho e rodape iguais em todas as folhas, pra parecer um bloco so.
function chrome(page, titulo, subtitulo) {
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: GREEN });
  centered(page, titulo, H - 44, { size: 17, font: bold, color: WHITE });
  centered(page, subtitulo, H - 62, { size: 9, font: regular, color: WHITE });

  page.drawLine({
    start: { x: M, y: 52 }, end: { x: W - M, y: 52 },
    thickness: 0.8, color: BORDER,
  });
  centered(page, 'Kit Prato Limpo - Edicao Profissional', 38, { size: 8, font: regular, color: MUTED });
  return H - 78 - 26; // y onde o conteudo comeca
}

// Campo de preencher: rotulo pequeno e linha.
function campo(page, rotulo, x, y, largura) {
  text(page, rotulo, x, y + 12, { size: 8, font: bold, color: GREEN_DARK });
  page.drawLine({
    start: { x, y }, end: { x: x + largura, y },
    thickness: 0.8, color: BORDER,
  });
}

function caixinha(page, x, y, lado = 9) {
  marca(y);
  page.drawRectangle({
    x, y, width: lado, height: lado,
    borderColor: GREEN, borderWidth: 1, color: WHITE,
  });
}

// Linhas pautadas pra escrever a mao.
function pauta(page, x, y, largura, linhas, passo = 22) {
  for (let i = 0; i < linhas; i++) {
    const ly = y - i * passo;
    marca(ly);
    page.drawLine({
      start: { x, y: ly }, end: { x: x + largura, y: ly },
      thickness: 0.6, color: BORDER,
    });
  }
  return y - (linhas - 1) * passo;
}

function secao(page, titulo, y) {
  page.drawRectangle({ x: M, y: y - 4, width: W - M * 2, height: 20, color: CREAM });
  text(page, titulo, M + 8, y + 1, { size: 9.5, font: bold, color: INK });
  return y - 18;
}

function nota(page, s, y) {
  text(page, s, M, y, { size: 8, font: regular, color: MUTED });
  return y - 14;
}

/* =========================================================
   Folha 1 - Devolutiva da familia
   A mae leva pra casa com a atividade e traz preenchida.
   Tudo em caixinha de propósito: pedir redacao pra mae cansada
   garante folha em branco na consulta seguinte.
   ========================================================= */
function folhaFamilia(pdf) {
  const p = pdf.addPage([W, H]);
  let y = chrome(p, 'Como foi em casa', 'A familia preenche e traz na proxima consulta');

  y -= 6;
  campo(p, 'NOME DA CRIANCA', M, y, 300);
  campo(p, 'PERIODO', M + 316, y, W - M * 2 - 316);
  y -= 34;
  campo(p, 'ATIVIDADE APLICADA', M, y, 300);
  campo(p, 'ALIMENTO TRABALHADO', M + 316, y, W - M * 2 - 316);
  y -= 30;

  y = secao(p, '1. Em quais dias voces fizeram a atividade?', y);
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  let dx = M;
  dias.forEach((d) => {
    caixinha(p, dx, y - 10);
    text(p, d, dx + 14, y - 9, { size: 9 });
    dx += 74;
  });
  y -= 34;

  y = secao(p, '2. Ate onde a crianca chegou? Marque o ponto mais longe que ela foi.', y);
  const degraus = [
    'Nem quis chegar perto',
    'Ficou perto, olhando',
    'Encostou o dedo no alimento',
    'Cheirou',
    'Encostou na boca ou lambeu',
    'Provou e cuspiu',
    'Provou e engoliu',
  ];
  degraus.forEach((d) => {
    caixinha(p, M, y - 10);
    text(p, d, M + 15, y - 9, { size: 9.5 });
    y -= 17;
  });
  y -= 10;

  y = secao(p, '3. Como foi o clima na hora?', y);
  const clima = ['Tranquilo', 'Comecou bem e cansou', 'Resistiu o tempo todo', 'Teve choro ou briga'];
  clima.forEach((c, i) => {
    const cx = M + (i % 2) * 250;
    if (i % 2 === 0 && i > 0) y -= 17;
    caixinha(p, cx, y - 10);
    text(p, c, cx + 15, y - 9, { size: 9.5 });
  });
  y -= 32;

  y = secao(p, '4. O que atrapalhou?', y);
  const atrapalhou = ['Falta de tempo', 'Crianca cansada ou com sono', 'Nao entendi o que fazer',
    'Faltou o alimento em casa', 'Outra pessoa insistiu pra ela comer', 'Nao atrapalhou nada'];
  atrapalhou.forEach((a, i) => {
    const ax = M + (i % 2) * 250;
    if (i % 2 === 0 && i > 0) y -= 17;
    caixinha(p, ax, y - 10);
    text(p, a, ax + 15, y - 9, { size: 9.5 });
  });
  y -= 36;

  y = secao(p, '5. Quer contar mais alguma coisa? (opcional)', y);
  y = pauta(p, M, y - 12, W - M * 2, 3);
  y -= 14;

  nota(p, 'Nao existe resposta errada aqui. Marcar "nem quis chegar perto" ajuda tanto quanto marcar "provou".', y);
}

/* =========================================================
   Folha 2 - Evolucao entre consultas
   Uma linha por semana, pra nutri bater o olho sem reler tudo.
   ========================================================= */
function folhaEvolucao(pdf) {
  const p = pdf.addPage([W, H]);
  let y = chrome(p, 'Evolucao entre consultas', 'Uma linha por semana. Preenchido pela nutricionista.');

  y -= 6;
  campo(p, 'PACIENTE', M, y, 300);
  campo(p, 'INICIO DO ACOMPANHAMENTO', M + 316, y, W - M * 2 - 316);
  y -= 34;

  const cols = [
    { t: 'SEMANA', w: 54 },
    { t: 'ALIMENTO', w: 108 },
    { t: 'FICHA', w: 54 },
    { t: 'ATE ONDE CHEGOU', w: 140 },
    { t: 'OBSERVACAO', w: W - M * 2 - 54 - 108 - 54 - 140 },
  ];

  // Cabecalho da tabela
  p.drawRectangle({ x: M, y: y - 4, width: W - M * 2, height: 20, color: GREEN });
  let cx = M;
  cols.forEach((c) => {
    text(p, c.t, cx + 5, y + 1, { size: 7.5, font: bold, color: WHITE });
    cx += c.w;
  });
  y -= 4;

  const LINHA = 30;
  for (let i = 0; i < 20; i++) {
    const top = y - i * LINHA;
    // Zebra pra olho nao se perder na linha.
    if (i % 2 === 1) {
      p.drawRectangle({ x: M, y: top - LINHA, width: W - M * 2, height: LINHA, color: CREAM });
    }
    p.drawLine({ start: { x: M, y: top - LINHA }, end: { x: W - M, y: top - LINHA }, thickness: 0.6, color: BORDER });
  }
  // Colunas verticais
  cx = M;
  const topo = y;
  const base = y - 20 * LINHA;
  cols.forEach((c) => {
    p.drawLine({ start: { x: cx, y: topo }, end: { x: cx, y: base }, thickness: 0.6, color: BORDER });
    cx += c.w;
  });
  p.drawLine({ start: { x: W - M, y: topo }, end: { x: W - M, y: base }, thickness: 0.6, color: BORDER });

  nota(p, 'Sugestao: registre o ponto MAIS LONGE que a crianca chegou na semana, nao a media. Retrocesso pontual e esperado.', base - 18);
}

/* =========================================================
   Folha 3 - Devolutiva da nutricionista para os pais
   O papel tangivel que ela entrega no fim do ciclo.
   ========================================================= */
function folhaDevolutivaPais(pdf) {
  const p = pdf.addPage([W, H]);
  let y = chrome(p, 'Devolutiva para a familia', 'A nutricionista preenche e entrega aos pais');

  y -= 6;
  campo(p, 'CRIANCA', M, y, 300);
  campo(p, 'DATA', M + 316, y, W - M * 2 - 316);
  y -= 34;
  campo(p, 'PERIODO ACOMPANHADO', M, y, 300);
  campo(p, 'CONSULTAS REALIZADAS', M + 316, y, W - M * 2 - 316);
  y -= 30;

  y = secao(p, 'O que trabalhamos neste periodo', y);
  y = pauta(p, M, y - 12, W - M * 2, 4);
  y -= 24;

  y = secao(p, 'O que avancou', y);
  y = pauta(p, M, y - 12, W - M * 2, 4);
  y -= 24;

  y = secao(p, 'O que seguimos trabalhando', y);
  y = pauta(p, M, y - 12, W - M * 2, 4);
  y -= 24;

  y = secao(p, 'Combinados para casa ate a proxima consulta', y);
  for (let i = 0; i < 4; i++) {
    caixinha(p, M, y - 13);
    p.drawLine({
      start: { x: M + 16, y: y - 16 }, end: { x: W - M, y: y - 16 },
      thickness: 0.6, color: BORDER,
    });
    y -= 24;
  }
  y -= 16;

  campo(p, 'ASSINATURA DA NUTRICIONISTA', M, y, 260);
  campo(p, 'PROXIMO RETORNO', M + 290, y, W - M * 2 - 290);
  y -= 30;

  nota(p, 'Seletividade melhora por degrau, nao por prato limpo. Vale registrar avanco sensorial mesmo sem a crianca ter comido.', y);
}

/* =========================================================
   Folha 4 - Anotacao clinica
   Segue o campo "O que observar" que ja existe nas 60 fichas de
   consultorio, pra anotacao cair pronta no prontuario.
   ========================================================= */
function folhaClinica(pdf) {
  const p = pdf.addPage([W, H]);
  let y = chrome(p, 'Anotacao clinica da sessao', 'Uso interno. Acompanha a ficha de consultorio aplicada.');

  y -= 6;
  campo(p, 'PACIENTE', M, y, 230);
  campo(p, 'DATA', M + 246, y, 120);
  campo(p, 'FICHA APLICADA', M + 382, y, W - M - (M + 382));
  y -= 34;
  campo(p, 'ETAPA DO PROTOCOLO', M, y, 230);
  campo(p, 'ALIMENTO', M + 246, y, 120);
  campo(p, 'TEMPO DE APLICACAO', M + 382, y, W - M - (M + 382));
  y -= 30;

  y = secao(p, 'O que observei durante a atividade', y);
  const obs = [
    'Aceitou o alimento na mesa sem reagir',
    'Tolerou o cheiro de perto',
    'Tocou com a mao',
    'Levou a boca',
    'Provou',
    'Evitou olhar para o alimento',
    'Pediu para encerrar antes do tempo',
  ];
  obs.forEach((o, i) => {
    const ox = M + (i % 2) * 250;
    if (i % 2 === 0 && i > 0) y -= 17;
    caixinha(p, ox, y - 10);
    text(p, o, ox + 15, y - 9, { size: 9.5 });
  });
  y -= 36;

  y = secao(p, 'Postura da familia na sessao', y);
  const fam = ['Acompanhou sem interferir', 'Insistiu para a crianca comer',
    'Antecipou a resposta da crianca', 'Nao estava presente'];
  fam.forEach((f, i) => {
    const fx = M + (i % 2) * 250;
    if (i % 2 === 0 && i > 0) y -= 17;
    caixinha(p, fx, y - 10);
    text(p, f, fx + 15, y - 9, { size: 9.5 });
  });
  y -= 32;

  y = secao(p, 'Conduta e registro', y);
  y = pauta(p, M, y - 12, W - M * 2, 6);
  y -= 24;

  y = secao(p, 'Encaminhado para casa', y);
  campo(p, 'FICHA ENTREGUE', M, y - 14, 260);
  campo(p, 'DEVOLUTIVA DA FAMILIA ENTREGUE', M + 290, y - 14, W - M * 2 - 290);
  y -= 46;

  nota(p, 'Os campos acima seguem a secao "O que observar" das fichas de consultorio, entao a anotacao ja sai pronta pro prontuario.', y);
}

async function main() {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Kit Prato Limpo - Fichas de devolutiva');
  pdf.setAuthor('Kit Prato Limpo');
  pdf.setSubject('Fichas de devolutiva e registro clinico - Edicao Profissional');

  bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  regular = await pdf.embedFont(StandardFonts.Helvetica);

  const folhas = { 1:folhaFamilia, 2:folhaEvolucao, 3:folhaDevolutivaPais, 4:folhaClinica };
  for (const [n, fn] of Object.entries(folhas)) {
    minY = H; fn(pdf);
    const ok = minY > 60;
    console.log((ok ? "  ok" : "  ESTOUROU") + " folha " + n + ": ponto mais baixo y=" + minY.toFixed(0) + " (rodape em 52)");
    if (!ok) process.exitCode = 1;
  }

  const bytes = await pdf.save();
  const hash = crypto.createHash('md5').update(bytes).digest('hex');
  const fileName = `devolutiva-familia-${hash}.pdf`;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Tira edicoes antigas: link velho no ar continuaria servindo PDF desatualizado.
  for (const old of fs.readdirSync(OUTPUT_DIR)) {
    if (/^devolutiva-familia-[0-9a-f]+\.pdf$/i.test(old) && old !== fileName) {
      fs.unlinkSync(path.join(OUTPUT_DIR, old));
    }
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), bytes);

  const manifesto = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  manifesto.devolutiva = fileName;
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifesto, null, 2) + '\n');

  console.log(`OK devolutiva: ${pdf.getPageCount()} paginas -> entrega/${fileName} (${(bytes.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
