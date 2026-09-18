// Gera o "Bloco de Evolução", o order bump da Edição Profissional (R$ 10).
//
// SUBSTITUI o antigo build-devolutiva-pdf.js. A primeira versao era formulario
// seco em preto e verde: fiel ao conteudo, mas nao parecia do mesmo produto que
// as 60 fichas de consultorio, que sao coloridas e ilustradas. Lado a lado,
// derrubava o valor percebido do kit inteiro.
//
// O QUE MUDOU: capa com nome proprio (bloco tem identidade, "4 folhas soltas"
// nao tem), uma cor por folha, barras de secao em verde claro, caixinhas
// maiores e icones de alimento desenhados em vetor.
//
// ID INTERNO CONTINUA 'devolutiva' de proposito: e o id do bump no _catalog, a
// chave do manifesto e o ?item= do download. Trocar isso quebraria link de
// compra ja feita sem ganho nenhum. Só o nome que a pessoa LE mudou.
//
// ONDE CAI: entrega/bloco-evolucao-<hash>.pdf, nome gravado em
// api/_kit-file.json na chave "devolutiva".
//
// Rodar:  node scripts/build-bloco-evolucao-pdf.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const OUTPUT_DIR = path.join(__dirname, '..', 'entrega');
const MANIFEST_PATH = path.join(__dirname, '..', 'api', '_kit-file.json');

const W = 595.28;
const H = 841.89;
const M = 44;

// Paleta do kit (mesma do index.html / profissional.html).
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
  page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y, size, font, color });
}

/* ---------------------------------------------------------
   Icones de alimento em vetor. Existem pra amarrar o bloco
   visualmente as fichas do kit, que sao ilustradas.
   --------------------------------------------------------- */
function cenoura(page, x, y, s = 1) {
  page.drawSvgPath('M 0 0 L 9 0 L 4.5 26 Z', { x: x, y: y + 26 * s, scale: s, color: ORANGE });
  [[-1, 4], [4, 7], [9, 4]].forEach(([dx, dy]) => {
    page.drawCircle({ x: x + dx * s + 2, y: y + 26 * s + dy * s, size: 3.4 * s, color: GREEN });
  });
}
function brocolis(page, x, y, s = 1) {
  page.drawRectangle({ x: x + 4 * s, y, width: 4 * s, height: 12 * s, color: GREEN_DARK });
  [[0, 13], [6, 17], [12, 13]].forEach(([dx, dy]) => {
    page.drawCircle({ x: x + dx * s, y: y + dy * s, size: 5.6 * s, color: GREEN });
  });
}
function maca(page, x, y, s = 1) {
  page.drawCircle({ x: x + 6 * s, y: y + 8 * s, size: 8 * s, color: CORAL });
  page.drawRectangle({ x: x + 5.4 * s, y: y + 15 * s, width: 1.6 * s, height: 5 * s, color: GREEN_DARK });
  page.drawCircle({ x: x + 10 * s, y: y + 18 * s, size: 3.2 * s, color: GREEN });
}
function tomate(page, x, y, s = 1) {
  page.drawCircle({ x: x + 7 * s, y: y + 7 * s, size: 7.5 * s, color: CORAL });
  [[3, 14], [7, 15.5], [11, 14]].forEach(([dx, dy]) => {
    page.drawCircle({ x: x + dx * s, y: y + dy * s, size: 2.6 * s, color: GREEN });
  });
}
const ICONES = [cenoura, brocolis, maca, tomate];

/* ---------------------------------------------------------
   Estrutura das folhas
   --------------------------------------------------------- */
function cabecalho(page, { titulo, subtitulo, cor, icone, folha }) {
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: cor });
  // Faixa mais escura embaixo do cabecalho: da profundidade sem imagem.
  page.drawRectangle({ x: 0, y: H - 100, width: W, height: 4, color: GREEN_DARK, opacity: 0.25 });

  text(page, titulo, M, H - 52, { size: 19, font: bold, color: WHITE });
  text(page, subtitulo, M, H - 70, { size: 9.5, font: regular, color: WHITE });
  if (icone) icone(page, W - M - 34, H - 74, 1.25);

  page.drawLine({ start: { x: M, y: 50 }, end: { x: W - M, y: 50 }, thickness: 0.8, color: BORDER });
  text(page, 'Folha ' + folha + ' de 4  |  Bloco de Evolução', M, 36, { size: 7.5, color: MUTED });
  const marca_ = 'Kit Prato Limpo - Edição Profissional';
  text(page, marca_, W - M - regular.widthOfTextAtSize(ansi(marca_), 7.5), 36, { size: 7.5, color: MUTED });

  // Zera o medidor: o rodape mora abaixo da linha de propósito, e contá-lo
  // faria a conferencia acusar estouro em toda folha.
  minY = H;
  return H - 96 - 28;
}

function campo(page, rotulo, x, y, largura) {
  text(page, rotulo, x, y + 13, { size: 7.5, font: bold, color: GREEN_DARK });
  page.drawLine({ start: { x, y }, end: { x: x + largura, y }, thickness: 1, color: BORDER });
}

// Barra de secao: verde claro com um tico da cor da folha na esquerda.
function secao(page, titulo, y, cor) {
  page.drawRectangle({ x: M, y: y - 5, width: W - M * 2, height: 22, color: MINT });
  page.drawRectangle({ x: M, y: y - 5, width: 4, height: 22, color: cor });
  text(page, titulo, M + 12, y + 1.5, { size: 9.5, font: bold, color: INK });
  return y - 20;
}

function caixinha(page, x, y, lado = 11) {
  marca(y);
  page.drawRectangle({ x, y, width: lado, height: lado, borderColor: GREEN, borderWidth: 1.2, color: WHITE });
}

// Lista de marcar. Uma ou duas colunas.
function opcoes(page, itens, y, { colunas = 1, passo = 19 } = {}) {
  const largura = (W - M * 2) / colunas;
  itens.forEach((t, i) => {
    const col = i % colunas;
    const linha = Math.floor(i / colunas);
    const x = M + col * largura;
    const ly = y - linha * passo;
    caixinha(page, x, ly - 9);
    text(page, t, x + 17, ly - 7, { size: 9.5 });
  });
  return y - (Math.ceil(itens.length / colunas) - 1) * passo - passo;
}

function pauta(page, y, linhas, passo = 23) {
  for (let i = 0; i < linhas; i++) {
    const ly = y - i * passo;
    marca(ly);
    page.drawLine({ start: { x: M, y: ly }, end: { x: W - M, y: ly }, thickness: 0.7, color: BORDER });
  }
  return y - (linhas - 1) * passo;
}

function nota(page, s, y) {
  page.drawRectangle({ x: M, y: y - 8, width: W - M * 2, height: 26, color: ORANGE_SOFT });
  text(page, s, M + 10, y + 1, { size: 7.8, color: rgb(0.643, 0.380, 0.039) });
}

/* =========================================================
   CAPA
   ========================================================= */
function capa(pdf) {
  const p = pdf.addPage([W, H]);
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
  p.drawRectangle({ x: 0, y: H - 300, width: W, height: 300, color: GREEN });

  centered(p, 'KIT PRATO LIMPO', H - 74, { size: 10, font: bold, color: WHITE });
  centered(p, 'EDIÇÃO PROFISSIONAL', H - 90, { size: 8, font: regular, color: rgb(0.85, 0.93, 0.80) });

  centered(p, 'Bloco de', H - 160, { size: 30, font: bold, color: WHITE });
  centered(p, 'Evolução', H - 200, { size: 38, font: bold, color: WHITE });

  centered(p, 'O que acontece entre uma consulta e outra,', H - 234, { size: 10.5, color: rgb(0.90, 0.96, 0.86) });
  centered(p, 'registrado no papel.', H - 250, { size: 10.5, color: rgb(0.90, 0.96, 0.86) });

  // Fileira de alimentos, montada na borda do bloco verde.
  const larguraIcone = 74;
  const x0 = (W - larguraIcone * ICONES.length) / 2;
  ICONES.forEach((ic, i) => ic(p, x0 + i * larguraIcone + 20, H - 340, 1.5));

  let y = H - 400;
  centered(p, 'O QUE TEM DENTRO', y, { size: 9, font: bold, color: GREEN_DARK });
  y -= 26;

  const dentro = [
    ['1', 'Como foi em casa', 'A família preenche e traz na consulta seguinte', GREEN],
    ['2', 'Linha do tempo', 'Uma semana por linha, pra ver o caminho de uma vez', ORANGE],
    ['3', 'Resumo para a família', 'O que trabalhou, o que avançou, o que segue', CORAL],
    ['4', 'Anotação clínica da sessão', 'Acompanha a ficha de consultório aplicada', GREEN_DARK],
  ];
  dentro.forEach(([n, titulo, desc, cor]) => {
    p.drawRectangle({ x: M + 20, y: y - 14, width: W - (M + 20) * 2, height: 52, color: WHITE, borderColor: BORDER, borderWidth: 1 });
    p.drawRectangle({ x: M + 20, y: y - 14, width: 5, height: 52, color: cor });
    p.drawCircle({ x: M + 48, y: y + 12, size: 12, color: cor });
    centered(p, n, y + 8, { size: 12, font: bold, color: WHITE, cx: M + 48 });
    text(p, titulo, M + 70, y + 14, { size: 11.5, font: bold, color: INK });
    text(p, desc, M + 70, y, { size: 8.5, color: MUTED });
    y -= 62;
  });

  y -= 4;
  p.drawRectangle({ x: M + 20, y: y - 22, width: W - (M + 20) * 2, height: 40, color: MINT });
  centered(p, 'Imprima quantas cópias precisar. Licença de uso com seus pacientes.', y - 2, { size: 8.8, font: bold, color: GREEN_DARK });
  marca(y - 22);

  centered(p, 'kitpratolimpo.com.br', 40, { size: 8, color: MUTED });
}

/* =========================================================
   1 - Como foi em casa (a familia preenche)
   Tudo em caixinha de proposito: pedir redacao pra mae cansada
   garante folha em branco na consulta seguinte.
   ========================================================= */
function folhaCasa(pdf) {
  const p = pdf.addPage([W, H]);
  let y = cabecalho(p, {
    titulo: 'Como foi em casa',
    subtitulo: 'A família preenche e traz na próxima consulta',
    cor: GREEN, icone: cenoura, folha: 1,
  });

  campo(p, 'NOME DA CRIANÇA', M, y, 300);
  campo(p, 'PERÍODO', M + 316, y, W - M * 2 - 316);
  y -= 36;
  campo(p, 'ATIVIDADE APLICADA', M, y, 300);
  campo(p, 'ALIMENTO TRABALHADO', M + 316, y, W - M * 2 - 316);
  y -= 32;

  y = secao(p, '1. Em quais dias vocês fizeram a atividade?', y, GREEN);
  let dx = M;
  ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].forEach((d) => {
    caixinha(p, dx, y - 13);
    text(p, d, dx + 16, y - 11, { size: 9 });
    dx += 72;
  });
  y -= 36;

  y = secao(p, '2. Até onde a criança chegou? Marque o ponto mais longe que ela foi.', y, GREEN);
  y = opcoes(p, [
    'Nem quis chegar perto', 'Ficou perto, olhando', 'Encostou o dedo no alimento',
    'Cheirou', 'Encostou na boca ou lambeu', 'Provou e cuspiu', 'Provou e engoliu',
  ], y - 2, { colunas: 1, passo: 18 });
  y -= 6;

  y = secao(p, '3. Como foi o clima na hora?', y, GREEN);
  y = opcoes(p, ['Tranquilo', 'Começou bem e cansou', 'Resistiu o tempo todo', 'Teve choro ou briga'],
    y - 2, { colunas: 2 });
  y -= 4;

  y = secao(p, '4. O que atrapalhou?', y, GREEN);
  y = opcoes(p, ['Falta de tempo', 'Criança cansada ou com sono', 'Não entendi o que fazer',
    'Faltou o alimento em casa', 'Alguém insistiu pra ela comer', 'Não atrapalhou nada'],
    y - 2, { colunas: 2 });
  y -= 4;

  y = secao(p, '5. Quer contar mais alguma coisa? (opcional)', y, GREEN);
  y = pauta(p, y - 14, 3);
  y -= 24;

  nota(p, 'Não existe resposta errada aqui. Marcar "nem quis chegar perto" ajuda tanto quanto marcar "provou".', y);
}

/* =========================================================
   2 - Linha do tempo (uma semana por linha)
   ========================================================= */
function folhaLinhaDoTempo(pdf) {
  const p = pdf.addPage([W, H]);
  let y = cabecalho(p, {
    titulo: 'Linha do tempo',
    subtitulo: 'Uma semana por linha. Preenchido pela nutricionista.',
    cor: ORANGE, icone: brocolis, folha: 2,
  });

  campo(p, 'PACIENTE', M, y, 300);
  campo(p, 'INÍCIO DO ACOMPANHAMENTO', M + 316, y, W - M * 2 - 316);
  y -= 36;

  const cols = [
    { t: 'SEM.', w: 44 },
    { t: 'ALIMENTO', w: 110 },
    { t: 'FICHA', w: 50 },
    { t: 'ATÉ ONDE CHEGOU', w: 142 },
    { t: 'OBSERVAÇÃO', w: W - M * 2 - 44 - 110 - 50 - 142 },
  ];

  p.drawRectangle({ x: M, y: y - 5, width: W - M * 2, height: 22, color: ORANGE });
  let cx = M;
  cols.forEach((c) => { text(p, c.t, cx + 6, y + 1.5, { size: 7.5, font: bold, color: WHITE }); cx += c.w; });
  y -= 5;

  const LINHA = 30;
  const N = 20;
  for (let i = 0; i < N; i++) {
    const top = y - i * LINHA;
    if (i % 2 === 1) p.drawRectangle({ x: M, y: top - LINHA, width: W - M * 2, height: LINHA, color: ORANGE_SOFT, opacity: 0.45 });
    p.drawLine({ start: { x: M, y: top - LINHA }, end: { x: W - M, y: top - LINHA }, thickness: 0.7, color: BORDER });
    // Numero da semana ja impresso: uma coisa a menos pra preencher.
    text(p, String(i + 1), M + 16, top - LINHA + 11, { size: 8.5, font: bold, color: MUTED });
  }
  const base = y - N * LINHA;
  cx = M;
  cols.forEach((c) => { p.drawLine({ start: { x: cx, y }, end: { x: cx, y: base }, thickness: 0.7, color: BORDER }); cx += c.w; });
  p.drawLine({ start: { x: W - M, y }, end: { x: W - M, y: base }, thickness: 0.7, color: BORDER });

  nota(p, 'Registre o ponto MAIS LONGE que a criança chegou na semana, não a média. Retrocesso pontual é esperado.', base - 26);
}

/* =========================================================
   3 - Resumo para a familia
   O papel tangivel que ela entrega no fim do ciclo.
   ========================================================= */
function folhaResumo(pdf) {
  const p = pdf.addPage([W, H]);
  let y = cabecalho(p, {
    titulo: 'Resumo para a família',
    subtitulo: 'A nutricionista preenche e entrega aos pais',
    cor: CORAL, icone: maca, folha: 3,
  });

  campo(p, 'CRIANÇA', M, y, 300);
  campo(p, 'DATA', M + 316, y, W - M * 2 - 316);
  y -= 36;
  campo(p, 'PERÍODO ACOMPANHADO', M, y, 300);
  campo(p, 'CONSULTAS REALIZADAS', M + 316, y, W - M * 2 - 316);
  y -= 32;

  y = secao(p, 'O que trabalhamos neste período', y, CORAL);
  y = pauta(p, y - 14, 4); y -= 26;

  y = secao(p, 'O que avançou', y, CORAL);
  y = pauta(p, y - 14, 4); y -= 26;

  y = secao(p, 'O que seguimos trabalhando', y, CORAL);
  y = pauta(p, y - 14, 4); y -= 26;

  y = secao(p, 'Combinados para casa até a próxima consulta', y, CORAL);
  y -= 6;
  for (let i = 0; i < 4; i++) {
    caixinha(p, M, y - 11);
    p.drawLine({ start: { x: M + 18, y: y - 14 }, end: { x: W - M, y: y - 14 }, thickness: 0.7, color: BORDER });
    y -= 25;
  }
  y -= 16;

  campo(p, 'ASSINATURA DA NUTRICIONISTA', M, y, 260);
  campo(p, 'PRÓXIMO RETORNO', M + 290, y, W - M * 2 - 290);
  y -= 34;

  nota(p, 'Seletividade melhora por degrau, não por prato limpo. Vale registrar avanço sensorial mesmo sem a criança ter comido.', y);
}

/* =========================================================
   4 - Anotacao clinica
   Segue o campo "O que observar" das 60 fichas de consultorio,
   pra anotacao cair pronta no prontuario.
   ========================================================= */
function folhaClinica(pdf) {
  const p = pdf.addPage([W, H]);
  let y = cabecalho(p, {
    titulo: 'Anotação clínica da sessão',
    subtitulo: 'Uso interno. Acompanha a ficha de consultório aplicada.',
    cor: GREEN_DARK, icone: tomate, folha: 4,
  });

  campo(p, 'PACIENTE', M, y, 226);
  campo(p, 'DATA', M + 242, y, 116);
  campo(p, 'FICHA APLICADA', M + 374, y, W - M - (M + 374));
  y -= 36;
  campo(p, 'ETAPA DO PROTOCOLO', M, y, 226);
  campo(p, 'ALIMENTO', M + 242, y, 116);
  campo(p, 'TEMPO DE APLICAÇÃO', M + 374, y, W - M - (M + 374));
  y -= 32;

  y = secao(p, 'O que observei durante a atividade', y, GREEN_DARK);
  y = opcoes(p, [
    'Aceitou o alimento na mesa sem reagir', 'Tolerou o cheiro de perto',
    'Tocou com a mão', 'Levou à boca',
    'Provou', 'Evitou olhar para o alimento',
    'Pediu para encerrar antes do tempo', 'Aceitou repetir a atividade',
  ], y - 2, { colunas: 2 });
  y -= 4;

  y = secao(p, 'Postura da família na sessão', y, GREEN_DARK);
  y = opcoes(p, ['Acompanhou sem interferir', 'Insistiu para a criança comer',
    'Antecipou a resposta da criança', 'Não estava presente'], y - 2, { colunas: 2 });
  y -= 4;

  y = secao(p, 'Conduta e registro', y, GREEN_DARK);
  y = pauta(p, y - 14, 6); y -= 28;

  y = secao(p, 'Encaminhado para casa', y, GREEN_DARK);
  campo(p, 'FICHA ENTREGUE', M, y - 18, 260);
  campo(p, 'BLOCO DE EVOLUÇÃO ENTREGUE', M + 290, y - 18, W - M * 2 - 290);
  y -= 50;

  nota(p, 'Os campos acima seguem a seção "O que observar" das fichas de consultório, então a anotação já sai pronta pro prontuário.', y);
}

async function main() {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Kit Prato Limpo - Bloco de Evolução');
  pdf.setAuthor('Kit Prato Limpo');
  pdf.setSubject('Bloco de Evolução - Edição Profissional');

  bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  regular = await pdf.embedFont(StandardFonts.Helvetica);

  const paginas = { capa, 1: folhaCasa, 2: folhaLinhaDoTempo, 3: folhaResumo, 4: folhaClinica };
  for (const [nome, fn] of Object.entries(paginas)) {
    minY = H;
    fn(pdf);
    const ok = minY > 48;
    console.log((ok ? '  ok      ' : '  ESTOUROU') + ' ' + String(nome).padEnd(6) + ' y mais baixo = ' + minY.toFixed(0));
    if (!ok) process.exitCode = 1;
  }

  const bytes = await pdf.save();
  const hash = crypto.createHash('md5').update(bytes).digest('hex');
  const fileName = `bloco-evolucao-${hash}.pdf`;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  // Limpa edicoes antigas (inclusive o nome velho): link vazado continuaria
  // servindo a versao feia.
  for (const old of fs.readdirSync(OUTPUT_DIR)) {
    if (/^(bloco-evolucao|devolutiva-familia)-[0-9a-f]+\.pdf$/i.test(old) && old !== fileName) {
      fs.unlinkSync(path.join(OUTPUT_DIR, old));
    }
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), bytes);

  const manifesto = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  manifesto.devolutiva = fileName; // chave interna mantida de proposito
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifesto, null, 2) + '\n');

  console.log(`OK: ${pdf.getPageCount()} paginas -> entrega/${fileName} (${(bytes.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
