// Monta os estaticos de anuncio da Edicao Profissional, em 4:5 (1080x1350).
//
// POR QUE AQUI E NAO NO CHATGPT: as fichas sao os PNGs REAIS de
// PROFISSIONAL/fichas-consultorio/. Gerador de imagem redesenharia elas, e o criativo
// passaria a mostrar um material diferente do que a pessoa recebe. Em anuncio
// pra profissional isso e fatal: ela avalia material tecnico com olho critico,
// e a peca inteira existe pra provar que a ficha e clinica.
//
// ESTRUTURA DAS TRES PECAS (metodo demonstrativo):
//   1. filtro de publico na primeira linha  ("pra nutricionista que atende...")
//   2. o material aparecendo por dentro
//   3. preco visivel
//
// Saida: PROFISSIONAL/criativos/*.jpg
//
// Rodar:  node scripts/build-criativos-profissional.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const FICHAS = path.join(RAIZ, 'PROFISSIONAL', 'fichas-consultorio');
const OUT = path.join(RAIZ, 'PROFISSIONAL', 'criativos');

const W = 1080;
const H = 1350;

const CREAM = '#FBF8F1';
const GREEN = '#5CA741';
const GREEN_DARK = '#3C7A2C';
const MINT = '#E8F1DD';
const ORANGE = '#F2911F';
const INK = '#26302A';
const TEXT = '#4B564E';
const MUTED = '#7C857D';

// Arial Black existe no Windows e e o que mais se aproxima do peso da Baloo 2
// usada no site. Fallback declarado porque o render acontece no librsvg.
const DISPLAY = 'Arial Black, Arial Bold, Arial, sans-serif';
const BODY = 'Arial, Helvetica, sans-serif';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function txt(s, x, y, { size = 30, font = BODY, weight = 'normal', fill = TEXT, anchor = 'start', spacing = 0 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}"
    fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(s)}</text>`;
}

// Cabecalho das tres pecas.
//
// A PERGUNTA e o maior elemento da peca, de proposito. Em video o filtro de
// publico vem primeiro porque a pessoa ouve na ordem; em estatico ela ve tudo
// de uma vez, entao quem filtra e o TAMANHO, nao a posicao. Com a promessa
// maior que a pergunta, quem nao e nutricionista parava do mesmo jeito.
//
// A pergunta tambem e mais segura que afirmacao na politica da Meta. Profissao
// nao e atributo pessoal protegido, entao aqui os dois passariam, mas o habito
// evita reprovacao quando a linha encosta em rotina ou dificuldade.
function cabecalho(linha1, linha2, claim) {
  return `
    ${txt(linha1, W / 2, 132, { size: 64, font: DISPLAY, weight: '900', fill: GREEN_DARK, anchor: 'middle' })}
    ${txt(linha2, W / 2, 206, { size: 64, font: DISPLAY, weight: '900', fill: GREEN_DARK, anchor: 'middle' })}
    <rect x="70" y="246" width="${W - 140}" height="70" rx="35" fill="${ORANGE}"/>
    ${txt(claim, W / 2, 292, { size: 33, font: DISPLAY, weight: '900', fill: '#fff', anchor: 'middle' })}`;
}

// Selo de preco, sempre no mesmo lugar nas tres pecas.
function selo(y) {
  const largura = 560;
  const x = (W - largura) / 2;
  return `
    <rect x="${x}" y="${y}" width="${largura}" height="104" rx="52" fill="${GREEN}"/>
    ${txt('R$ 47', W / 2 - 96, y + 70, { size: 58, font: DISPLAY, weight: '900', fill: '#fff', anchor: 'middle' })}
    ${txt('pagamento único', W / 2 + 108, y + 52, { size: 25, font: BODY, weight: 'bold', fill: '#fff', anchor: 'middle' })}
    ${txt('sem mensalidade', W / 2 + 108, y + 82, { size: 25, font: BODY, weight: 'bold', fill: '#D9EDC9', anchor: 'middle' })}`;
}

async function ficha(nome, largura, altura) {
  const origem = nome.startsWith('@') ? path.join(RAIZ, 'assets', nome.slice(1)) : path.join(FICHAS, nome);
  return sharp(origem)
    .resize(largura, altura, { fit: 'cover', position: 'top' })
    .toBuffer();
}

// As fichas entram DEPOIS do fundo, entao tudo que precisa aparecer por cima
// delas (selo de preco, rotulos) vai num SVG separado, composto por ultimo.
// Sem isso o selo desenhado no fundo some atras da ficha.
async function salvar(nome, svg, camadas, svgTopo = '') {
  const base = sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="${CREAM}"/>${svg}</svg>`
  ));
  const todas = camadas.slice();
  if (svgTopo) {
    todas.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgTopo}</svg>`),
      left: 0, top: 0,
    });
  }
  const out = path.join(OUT, nome);
  await base.composite(todas).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
  const m = await sharp(out).metadata();
  console.log('  ' + nome.padEnd(34) + m.width + 'x' + m.height + '  ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}

/* =========================================================
   1 - A GRADE. Prova de volume e de que existe protocolo.
   ========================================================= */
async function grade() {
  const escolhidas = [
    ['C01-o-mapa-do-prato.png', 'Avaliação'],
    ['C11-carimbo-de-pimentao.png', 'Toque'],
    ['C24-a-lambida-secreta.png', 'Boca'],
    ['C27-o-juri-do-sabor.png', 'Prova'],
    ['C48-depois-do-engasgo.png', 'Pós-engasgo'],
    ['C60-alta-com-plano-de-90-dias.png', 'Alta'],
  ];

  // Duas fileiras + rotulo + selo tem que caber nos 1350: a fileira de baixo
  // termina em 1136 e o selo comeca em 1200.
  const LW = 266, LH = 360, GAP = 20;
  const gridW = LW * 3 + GAP * 2;
  const x0 = (W - gridW) / 2;
  const y0 = 360;
  const PASSO = LH + 56;

  // Segmento 1: a nutricionista que ja atende seletividade (o nucleo).
  let svg = cabecalho('Você é nutricionista', 'e atende criança seletiva?',
    '60 fichas prontas pra aplicar na sessão');

  const camadas = [];
  let topo = '';
  for (let i = 0; i < escolhidas.length; i++) {
    const cx = x0 + (i % 3) * (LW + GAP);
    const cy = y0 + Math.floor(i / 3) * PASSO;
    svg += `<rect x="${cx - 4}" y="${cy - 4}" width="${LW + 8}" height="${LH + 8}" rx="12" fill="#fff" stroke="#E9E3D5" stroke-width="2"/>`;
    topo += txt(escolhidas[i][1], cx + LW / 2, cy + LH + 36, { size: 26, weight: 'bold', fill: GREEN_DARK, anchor: 'middle' });
    camadas.push({ input: await ficha(escolhidas[i][0], LW, LH), left: Math.round(cx), top: Math.round(cy) });
  }

  topo += selo(1200);
  await salvar('pro-01-grade-60-fichas.jpg', svg, camadas, topo);
}

/* =========================================================
   2 - A ANATOMIA. E a peca que separa material clinico de
   folha de atividade pra pais. Os 6 campos sao o argumento.
   ========================================================= */
async function anatomia() {
  const FW = 520, FH = 704;
  const fx = 62, fy = 400;

  // Segmento 2: recebe o caso mas seletividade nao e a area principal dela.
  let svg = cabecalho('Chega criança que', 'não come no seu consultório?',
    'Você bate o olho na ficha e já sabe o que fazer');

  svg += `<rect x="${fx - 5}" y="${fy - 5}" width="${FW + 10}" height="${FH + 10}" rx="14" fill="#fff" stroke="#E9E3D5" stroke-width="3"/>`;

  const campos = [
    ['1', 'Por que funciona', 'o racional em duas linhas'],
    ['2', 'Material', 'o que separar antes'],
    ['3', 'Como fazer', 'passo a passo numerado'],
    ['4', 'O que observar', 'leitura clínica pro prontuário'],
    ['5', 'O que dizer', 'a fala pronta, e a que estraga'],
    ['6', 'Leva para casa', 'a tarefa até a próxima consulta'],
  ];
  const lx = fx + FW + 46;
  let ly = fy + 26;
  campos.forEach(([n, titulo, desc], i) => {
    // Os tres ultimos sao o que NAO existe em material feito pros pais.
    const cor = i >= 3 ? ORANGE : GREEN;
    svg += `<circle cx="${lx + 24}" cy="${ly - 10}" r="24" fill="${cor}"/>`;
    svg += txt(n, lx + 24, ly + 1, { size: 27, font: DISPLAY, weight: '900', fill: '#fff', anchor: 'middle' });
    svg += txt(titulo, lx + 62, ly - 6, { size: 32, weight: 'bold', fill: INK });
    svg += txt(desc, lx + 62, ly + 28, { size: 24, fill: MUTED });
    ly += 112;
  });

  const camadas = [{ input: await ficha('C01-o-mapa-do-prato.png', FW, FH), left: fx, top: fy }];
  await salvar('pro-02-anatomia-da-ficha.jpg', svg, camadas, selo(1200));
}

/* =========================================================
   3 - O QUE VEM JUNTO. Responde "o que eu levo por R$ 47".
   ========================================================= */
async function pacote() {
  // Segmento 3: atendimento em escola e oficina em grupo (a licenca cobre).
  let svg = cabecalho('Você atende em escola', 'ou faz oficina em grupo?',
    '189 atividades prontas pro seu consultório');

  const CW = 306, CH = 414, GAP = 24;
  const x0 = (W - (CW * 3 + GAP * 2)) / 2;
  const y0 = 420;

  const cols = [
    ['C01-o-mapa-do-prato.png', '60', 'fichas de consultório', 'em 12 etapas'],
    ['C27-o-juri-do-sabor.png', '129', 'fichas pra família', 'em 11 blocos'],
    ['@pintar-poster.jpg', 'App', 'no celular da família', '20 personagens'],
  ];

  const camadas = [];
  for (let i = 0; i < cols.length; i++) {
    const cx = x0 + i * (CW + GAP);
    svg += `<rect x="${cx - 4}" y="${y0 - 4}" width="${CW + 8}" height="${CH + 8}" rx="12" fill="#fff" stroke="#E9E3D5" stroke-width="2"/>`;
    const by = y0 + CH + 26;
    svg += `<rect x="${cx}" y="${by}" width="${CW}" height="150" rx="14" fill="${MINT}"/>`;
    svg += txt(cols[i][1], cx + CW / 2, by + 62, { size: 52, font: DISPLAY, weight: '900', fill: GREEN_DARK, anchor: 'middle' });
    svg += txt(cols[i][2], cx + CW / 2, by + 100, { size: 24, weight: 'bold', fill: INK, anchor: 'middle' });
    svg += txt(cols[i][3], cx + CW / 2, by + 130, { size: 22, fill: MUTED, anchor: 'middle' });
    camadas.push({ input: await ficha(cols[i][0], CW, CH), left: Math.round(cx), top: y0 });
  }

  const topo = txt('Licença de uso com seus pacientes, sem limite e sem validade.', W / 2, 1180, { size: 26, weight: 'bold', fill: GREEN_DARK, anchor: 'middle' }) + selo(1216);
  await salvar('pro-03-o-que-vem-junto.jpg', svg, camadas, topo);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('Criativos 4:5 da Edição Profissional:');
  await grade();
  await anatomia();
  await pacote();
  console.log('-> PROFISSIONAL/criativos/');
}

main().catch((e) => { console.error(e); process.exit(1); });
