// node scripts/build-kit-pdf.js
//
// Monta DOIS PDFs a partir de assets/fichas-geradas/*.png e assets/bonus/*.png,
// com capa, página "como usar" e sumário/divisórias por bloco (identidade
// visual da página de vendas: cores e tom do index.html). Roda localmente
// (não em serverless — juntar dezenas de imagens é pesado demais pra rodar a
// cada request).
//
// DOIS PDFS, NÃO UM: o plano Essencial promete "86 atividades em 8 blocos"
// só; os 4 bônus (calendário, cartelas do sorteio, quadro de progresso, guia
// rápido de mesa) são exclusivos do Completo — ver a lista de cada plano em
// index.html (#checkout). Até 15/08 os dois planos recebiam o MESMO PDF com
// tudo dentro, o que dava pro Essencial mais do que ele pagou. Por isso este
// script gera:
//   entrega/kit-prato-limpo-essencial-<hash>.pdf  → só as fichas
//   entrega/kit-prato-limpo-completo-<hash>.pdf   → fichas + bônus
// api/download.js olha o tierId gravado no token da compra (dl:<token> no
// Redis, gravado por api/deliver-kit.js) e decide qual dos dois mandar.
//
// ONDE O ARQUIVO CAI (importante): entrega/kit-prato-limpo-<variante>-<hash>.pdf,
// e NÃO num nome fixo e adivinhável na raiz. O cliente nunca recebe esse
// caminho: o e-mail manda /api/download?t=<token> ou /mi-kit?t=<token>, que
// conferem o token da compra no Redis antes de redirecionar. O nome com hash
// existe pra que ninguém chegue no entregável chutando URL. O hash muda a
// cada build, então links vazados de edições antigas morrem sozinhos no
// próximo deploy.
//
// O nome dos arquivos da vez fica em api/_kit-file.json (dentro de api/, vai
// junto no bundle da função, não é servido como estático).
//
// Só entram na capa/sumário/divisórias os blocos que já têm pelo menos 1 ficha
// pronta em fichas-geradas/ — um bloco sem nenhuma ficha simplesmente não
// aparece, em vez de mostrar "0 fichas" pro cliente. Reexecute e reimplante
// sempre que adicionar fichas novas.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Fichas geradas por IA saem como PNG de ~1-1.5MB cada; com 86+4 delas o PDF
// passa dos 100MB que a Vercel aceita como arquivo estático. Reconvertidas
// pra JPEG aqui (em memória, o PNG original em disco não muda), ficam ~90%
// menores sem perda visível — são ilustrações de cor chapada, não fotos.
async function embedFicha(pdf, filePath) {
  const jpg = await sharp(filePath).jpeg({ quality: 90 }).toBuffer();
  return pdf.embedJpg(jpg);
}

const FICHAS_DIR = path.join(__dirname, '..', 'assets', 'fichas-geradas');
const BONUS_DIR = path.join(__dirname, '..', 'assets', 'bonus');
const OUTPUT_DIR = path.join(__dirname, '..', 'entrega');
const MANIFEST_PATH = path.join(__dirname, '..', 'api', '_kit-file.json');

// Página do PDF no mesmo 2:3 das fichas geradas (1024x1536), sem distorcer nem
// deixar barra sobrando. Quem imprimir escolhe "tamanho real", como as fichas
// de medida (ex: a régua) já pedem no próprio texto.
const PAGE_WIDTH = 432; // 6in
const PAGE_HEIGHT = 648; // 9in
const MARGIN = 44;

// Mesma paleta do index.html (:root do site de vendas).
const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const COLOR = {
  cream: hex('#FBF8F1'),
  mint: hex('#E8F1DD'),
  green: hex('#5CA741'),
  greenDark: hex('#3C7A2C'),
  orange: hex('#F2911F'),
  coral: hex('#F0673A'),
  ink: hex('#26302A'),
  text: hex('#4B564E'),
  muted: hex('#7C857D'),
  border: hex('#E9E3D5'),
  white: rgb(1, 1, 1),
};
const ACCENTS = [COLOR.green, COLOR.coral, COLOR.orange, COLOR.greenDark];

// Blocos e bônus vêm de kit-data.js — fonte única, compartilhada com
// build-gallery-manifest.js (a galeria dentro do app usa os mesmos nomes e
// descrições que aparecem no PDF).
const { BLOCKS, BONUSES } = require('./kit-data');

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// variant: 'essencial' (só fichas) ou 'completo' (fichas + bônus).
async function buildPdf(variant, allFiles, blocksWithFiles, bonusesReady) {
  const includeBonuses = variant === 'completo';

  const pdf = await PDFDocument.create();
  pdf.setTitle('Kit Prato Limpo');
  pdf.setAuthor('Kit Prato Limpo');

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const drawCentered = (page, text, { font, size, color, y }) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (PAGE_WIDTH - w) / 2, y, size, font, color });
  };

  const drawCenteredParagraph = (page, text, { font, size, color, y, lineHeight, maxWidth }) => {
    const lines = wrapText(text, font, size, maxWidth);
    let cy = y;
    for (const line of lines) {
      drawCentered(page, line, { font, size, color, y: cy });
      cy -= lineHeight;
    }
    return cy;
  };

  const drawPill = (page, text, { font, size, x, y, padX, padY, bg, color }) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawRectangle({ x: x - w / 2 - padX, y: y - padY, width: w + padX * 2, height: size + padY * 2, color: bg });
    page.drawText(text, { x: x - w / 2, y, size, font, color });
  };

  // ---- capa ----------------------------------------------------------
  {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });

    const bandHeight = 210;
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bandHeight, width: PAGE_WIDTH, height: bandHeight, color: COLOR.green });

    drawPill(page, 'PARA A ALIMENTAÇÃO INFANTIL', {
      font: bold, size: 9, x: PAGE_WIDTH / 2, y: PAGE_HEIGHT - 55, padX: 10, padY: 5,
      bg: COLOR.greenDark, color: COLOR.white,
    });

    drawCenteredParagraph(page, 'Kit Prato Limpo', {
      font: bold, size: 32, color: COLOR.white, y: PAGE_HEIGHT - 120, lineHeight: 36, maxWidth: PAGE_WIDTH - MARGIN * 2,
    });

    drawCenteredParagraph(page,
      'Fichas prontas pra imprimir e aplicar hoje, sem precisar inventar atividade nem virar a refeição uma batalha.',
      { font: regular, size: 12.5, color: COLOR.ink, y: PAGE_HEIGHT - bandHeight - 55, lineHeight: 18, maxWidth: PAGE_WIDTH - MARGIN * 2 - 20 }
    );

    drawPill(page, 'ATIVIDADES PRONTAS PRA IMPRIMIR', {
      font: bold, size: 10, x: PAGE_WIDTH / 2, y: 210, padX: 14, padY: 8,
      bg: COLOR.mint, color: COLOR.greenDark,
    });

    page.drawLine({ start: { x: MARGIN, y: 90 }, end: { x: PAGE_WIDTH - MARGIN, y: 90 }, thickness: 1, color: COLOR.border });
    drawCentered(page, 'kitpratolimpo.com.br', { font: bold, size: 10, color: COLOR.muted, y: 66 });
    drawCentered(page, 'Dúvidas: kitpratolimpo@gmail.com', { font: regular, size: 9, color: COLOR.muted, y: 48 });
  }

  // ---- como usar -------------------------------------------------------
  {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });

    page.drawText('Como usar este kit', { x: MARGIN, y: PAGE_HEIGHT - 70, size: 22, font: bold, color: COLOR.ink });
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 84, width: 46, height: 4, color: COLOR.orange });

    const steps = [
      { title: 'Imprima em tamanho real', text: 'Na hora de imprimir, escolha "tamanho real" ou "100%" — nunca "ajustar à página". Algumas fichas (como as de medir) só funcionam nesse tamanho.' },
      { title: 'Sem ordem obrigatória', text: 'Comece pelo bloco que fizer mais sentido pra fase que vocês estão vivendo agora. Os blocos não precisam seguir a numeração.' },
      { title: 'Uma ficha por vez', text: 'Escolha uma atividade, aplique, e só passe pra próxima quando sentir que fez sentido pra criança. Não é uma corrida.' },
      { title: 'Guarde numa pasta', text: 'Um fichário ou uma pasta simples mantém as fichas organizadas pra reusar quantas vezes quiser.' },
    ];

    let y = PAGE_HEIGHT - 140;
    const circleR = 14;
    const textX = MARGIN + circleR * 2 + 14;
    const textWidth = PAGE_WIDTH - textX - MARGIN;

    steps.forEach((step, i) => {
      const cy = y - circleR + 5;
      page.drawEllipse({ x: MARGIN + circleR, y: cy, xScale: circleR, yScale: circleR, color: ACCENTS[i % ACCENTS.length] });
      const numText = String(i + 1);
      const numW = bold.widthOfTextAtSize(numText, 13);
      page.drawText(numText, { x: MARGIN + circleR - numW / 2, y: cy - 5, size: 13, font: bold, color: COLOR.white });

      page.drawText(step.title, { x: textX, y, size: 13, font: bold, color: COLOR.ink });
      const lines = wrapText(step.text, regular, 10.5, textWidth);
      let ly = y - 18;
      for (const line of lines) {
        page.drawText(line, { x: textX, y: ly, size: 10.5, font: regular, color: COLOR.text });
        ly -= 14;
      }
      y = Math.min(ly - 26, y - 90);
    });

    page.drawLine({ start: { x: MARGIN, y: 90 }, end: { x: PAGE_WIDTH - MARGIN, y: 90 }, thickness: 1, color: COLOR.border });
    drawCentered(page, 'Dúvidas ou problema pra abrir alguma ficha?', { font: regular, size: 9.5, color: COLOR.muted, y: 68 });
    drawCentered(page, 'escreva pra kitpratolimpo@gmail.com', { font: bold, size: 9.5, color: COLOR.greenDark, y: 52 });
  }

  // ---- sumário -----------------------------------------------------------
  {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });

    page.drawText('O que tem neste kit', { x: MARGIN, y: PAGE_HEIGHT - 70, size: 22, font: bold, color: COLOR.ink });
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 84, width: 46, height: 4, color: COLOR.orange });

    // páginas: capa(1) + como usar(1) + sumário(1) = 3 antes do 1º divisor.
    let pageCursor = 4;
    let y = PAGE_HEIGHT - 120;
    // Compacto de propósito: com 8 blocos + 4 bônus tudo precisa caber numa
    // página só (o resto do cálculo de página assume sumário = 1 pág). Rows
    // maiores (64pt) eram ok com poucos blocos mas passavam do rodapé (y:90)
    // assim que o kit cresceu — foi o que quebrou o layout em produção.
    const rowGap = 42;

    blocksWithFiles.forEach((b, i) => {
      const accent = ACCENTS[i % ACCENTS.length];
      page.drawText(`BLOCO ${b.n}`, { x: MARGIN, y, size: 9, font: bold, color: accent });
      page.drawText(b.title, { x: MARGIN, y: y - 14, size: 12, font: bold, color: COLOR.ink });
      const descLines = wrapText(b.desc, regular, 9, PAGE_WIDTH - MARGIN * 2 - 90);
      page.drawText(descLines[0] || '', { x: MARGIN, y: y - 26, size: 9, font: regular, color: COLOR.muted });

      // Alinhado na mesma baseline do título do bloco (y - 14).
      const pageText = `pág. ${pageCursor + 1}`;
      const pageW = bold.widthOfTextAtSize(pageText, 10);
      page.drawText(pageText, { x: PAGE_WIDTH - MARGIN - pageW, y: y - 14, size: 10, font: bold, color: COLOR.greenDark });

      page.drawLine({ start: { x: MARGIN, y: y - 34 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 34 }, thickness: 1, color: COLOR.border });

      pageCursor += 1 + b.files.length; // divisória + fichas do bloco
      y -= rowGap;
    });

    // Bônus: uma linha por bônus, na sequência dos blocos. pageCursor já está
    // apontando pra divisória de bônus, que vem logo depois da última ficha.
    // No PDF do Essencial isso tudo fica de fora (includeBonuses = false).
    if (includeBonuses && bonusesReady.length) {
      page.drawText('DE BÔNUS, VOCÊ AINDA LEVA', { x: MARGIN, y: y + 4, size: 9, font: bold, color: COLOR.orange });
      y -= 18;
      pageCursor += 1; // a divisória "Bônus"

      bonusesReady.forEach((b) => {
        page.drawText(b.title, { x: MARGIN, y, size: 11, font: bold, color: COLOR.ink });
        // Aqui é `pageCursor` puro, não `+1` como nos blocos: lá o cursor ainda
        // aponta pra divisória e o número tem que cair na 1ª ficha; aqui a
        // divisória já foi somada acima, então o cursor já É a página do bônus.
        const pageText = `pág. ${pageCursor}`;
        const pageW = bold.widthOfTextAtSize(pageText, 10);
        page.drawText(pageText, { x: PAGE_WIDTH - MARGIN - pageW, y, size: 10, font: bold, color: COLOR.greenDark });
        pageCursor += 1;
        y -= 20;
      });
    }

    page.drawLine({ start: { x: MARGIN, y: 90 }, end: { x: PAGE_WIDTH - MARGIN, y: 90 }, thickness: 1, color: COLOR.border });
    drawCentered(page, 'Comece pelo bloco que fizer mais sentido pra vocês agora.', { font: bold, size: 10.5, color: COLOR.ink, y: 68 });
  }

  // ---- blocos: divisória + fichas ----------------------------------------
  for (let i = 0; i < blocksWithFiles.length; i++) {
    const b = blocksWithFiles[i];
    const accent = ACCENTS[i % ACCENTS.length];

    const divider = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    divider.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });

    // Barras só nas bordas de cima e de baixo: qualquer coisa na altura do
    // título passa por cima do texto e vira um risco no meio do nome do bloco.
    divider.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: accent });
    divider.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 8, color: accent });

    drawPill(divider, `BLOCO ${b.n}`, {
      font: bold, size: 11, x: PAGE_WIDTH / 2, y: PAGE_HEIGHT / 2 + 70, padX: 12, padY: 6,
      bg: accent, color: COLOR.white,
    });

    const afterTitle = drawCenteredParagraph(divider, b.title, {
      font: bold, size: 24, color: COLOR.ink, y: PAGE_HEIGHT / 2 + 20, lineHeight: 28, maxWidth: PAGE_WIDTH - MARGIN * 2,
    });

    divider.drawRectangle({ x: PAGE_WIDTH / 2 - 24, y: afterTitle + 6, width: 48, height: 4, color: accent });

    drawCenteredParagraph(divider, b.desc, {
      font: regular, size: 11.5, color: COLOR.text, y: afterTitle - 22, lineHeight: 16, maxWidth: PAGE_WIDTH - MARGIN * 2 - 30,
    });

    for (const file of b.files) {
      const image = await embedFicha(pdf, path.join(FICHAS_DIR, file));
      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    }
  }

  // ---- bônus: uma divisória só, depois as páginas (só no Completo) -------
  if (includeBonuses && bonusesReady.length) {
    const accent = COLOR.orange;
    const divider = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    divider.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });
    divider.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: accent });
    divider.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 8, color: accent });

    drawPill(divider, 'BÔNUS', {
      font: bold, size: 11, x: PAGE_WIDTH / 2, y: PAGE_HEIGHT / 2 + 70, padX: 12, padY: 6,
      bg: accent, color: COLOR.white,
    });

    const afterTitle = drawCenteredParagraph(divider, 'Materiais de apoio', {
      font: bold, size: 24, color: COLOR.ink, y: PAGE_HEIGHT / 2 + 20, lineHeight: 28, maxWidth: PAGE_WIDTH - MARGIN * 2,
    });

    divider.drawRectangle({ x: PAGE_WIDTH / 2 - 24, y: afterTitle + 6, width: 48, height: 4, color: accent });

    drawCenteredParagraph(divider, 'Pra organizar a rotina e enxergar a evolução sem virar planilha.', {
      font: regular, size: 11.5, color: COLOR.text, y: afterTitle - 22, lineHeight: 16, maxWidth: PAGE_WIDTH - MARGIN * 2 - 30,
    });

    for (const b of bonusesReady) {
      const image = await embedFicha(pdf, path.join(BONUS_DIR, b.file));
      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    }
  }

  const pdfBytes = await pdf.save();
  const hash = crypto.createHash('sha256').update(pdfBytes).digest('hex').slice(0, 32);
  const fileName = `kit-prato-limpo-${variant}-${hash}.pdf`;
  return { pdfBytes, fileName };
}

async function main() {
  const allFiles = fs
    .readdirSync(FICHAS_DIR)
    // \d+ nos dois números: com o Bloco 9 as fichas passaram de 2 pra 3
    // dígitos (F100+), \d{2} fixo as excluía em silêncio do PDF.
    .filter((f) => /^B\d+-F\d+-.+\.png$/i.test(f))
    // .sort() puro é lexicográfico: "F100" vem ANTES de "F99". Ordena pelos
    // números de verdade, senão a ordem impressa sai errada a partir daqui.
    .sort((a, b) => {
      const na = a.match(/^B(\d+)-F(\d+)-/);
      const nb = b.match(/^B(\d+)-F(\d+)-/);
      return Number(na[1]) - Number(nb[1]) || Number(na[2]) - Number(nb[2]);
    });

  if (!allFiles.length) {
    console.error('Nenhuma ficha encontrada em ' + FICHAS_DIR);
    process.exit(1);
  }

  const blocksWithFiles = BLOCKS.map((b) => ({
    ...b,
    files: allFiles.filter((f) => f.startsWith(`B${b.n}-F`)),
  })).filter((b) => b.files.length > 0);

  // Mesma regra dos blocos: bônus sem arquivo pronto não aparece em lugar nenhum.
  const bonusFiles = fs.existsSync(BONUS_DIR) ? fs.readdirSync(BONUS_DIR) : [];
  const bonusesReady = BONUSES.map((b) => ({
    ...b,
    file: bonusFiles.find((f) => f.startsWith(b.id) && /\.png$/i.test(f)),
  })).filter((b) => b.file);

  const essencial = await buildPdf('essencial', allFiles, blocksWithFiles, bonusesReady);
  const completo = await buildPdf('completo', allFiles, blocksWithFiles, bonusesReady);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Limpa edições antigas de QUALQUER variante: se ficarem no ar, links
  // vazados de builds passados continuariam funcionando pra sempre.
  const keep = new Set([essencial.fileName, completo.fileName]);
  for (const old of fs.readdirSync(OUTPUT_DIR)) {
    if (/^kit-prato-limpo-(essencial|completo)-[0-9a-f]+\.pdf$/i.test(old) && !keep.has(old)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, old));
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, essencial.fileName), essencial.pdfBytes);
  fs.writeFileSync(path.join(OUTPUT_DIR, completo.fileName), completo.pdfBytes);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ essencial: essencial.fileName, completo: completo.fileName }, null, 2) + '\n');

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(`OK essencial: ${allFiles.length} ficha(s), sem bônus -> entrega/${essencial.fileName} (${mb(essencial.pdfBytes.length)} MB)`);
  console.log(`OK completo:  ${allFiles.length} ficha(s) + ${bonusesReady.length} bônus -> entrega/${completo.fileName} (${mb(completo.pdfBytes.length)} MB)`);
  console.log('   manifesto -> api/_kit-file.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
