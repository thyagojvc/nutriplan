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
// Fichas de consultório (edição profissional). Pasta separada de propósito: o
// filtro de fichas-geradas/ é /^B\d+-F\d+-/, então mesmo se caíssem lá elas não
// entrariam no kit das mães — mas separar deixa explícito que são produtos
// diferentes, e evita que um glob distraído misture os dois.
const CONSULTORIO_DIR = path.join(__dirname, '..', 'assets', 'fichas-consultorio');
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
const { BLOCKS, BONUSES, PRO_STAGES } = require('./kit-data');

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

// Helpers de desenho: ficavam dentro de buildPdf, subiram pro escopo do módulo
// em 22/08 pra buildPdfProfissional() reusar sem duplicar. São funções puras
// (só dependem de PAGE_WIDTH), então o desenho das variantes essencial e
// completo continua byte a byte igual — o hash do PDF é a prova disso.
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

// variant: 'essencial' (só fichas) ou 'completo' (fichas + bônus).
async function buildPdf(variant, allFiles, blocksWithFiles, bonusesReady) {
  const includeBonuses = variant === 'completo';

  const pdf = await PDFDocument.create();
  pdf.setTitle('Kit Prato Limpo');
  pdf.setAuthor('Kit Prato Limpo');

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

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
    // No Essencial entra MAIS UMA página logo depois do sumário (a oferta de
    // upgrade), então tudo desce uma casa. Sem esse ajuste todo "pág. X" do
    // sumário aponta uma página antes da certa.
    let pageCursor = includeBonuses ? 4 : 5;
    let y = PAGE_HEIGHT - 120;
    // Compacto de propósito: com 8 blocos + 4 bônus tudo precisa caber numa
    // página só (o resto do cálculo de página assume sumário = 1 pág). Rows
    // maiores (64pt) eram ok com poucos blocos mas passavam do rodapé (y:90)
    // assim que o kit cresceu — foi o que quebrou o layout em produção.
    const rowGap = 42;

    blocksWithFiles.forEach((b, i) => {
      const accent = ACCENTS[i % ACCENTS.length];
      page.drawText(`BLOCO ${b.ord}`, { x: MARGIN, y, size: 9, font: bold, color: accent });
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

  // ---- oferta de upgrade (SÓ no Essencial) --------------------------------
  // Quem comprou o Completo já tem tudo isso, mostrar seria só ruído. Fica
  // logo depois do sumário de propósito: kit de atividade não se lê até o fim,
  // se ficasse só na última página quase ninguém veria. A mesma página é
  // repetida no fim, pra pegar quem folheia até lá.
  const desenhaUpgrade = () => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.mint });
    page.drawRectangle({ x: MARGIN - 14, y: 120, width: PAGE_WIDTH - (MARGIN - 14) * 2, height: PAGE_HEIGHT - 240, color: COLOR.white });

    let y = PAGE_HEIGHT - 190;
    drawPill(page, 'SÓ PRA QUEM JÁ TEM O KIT', { font: bold, size: 9, x: PAGE_WIDTH / 2, y, padX: 12, padY: 7, bg: COLOR.orange, color: COLOR.white });

    y -= 52;
    drawCentered(page, 'Falta o aplicativo', { font: bold, size: 26, color: COLOR.ink, y });
    y -= 34;
    y = drawCenteredParagraph(page, 'Você tem todas as fichas para imprimir. No aplicativo, a criança pinta na tela com o dedo, sem impressora, e coleciona um personagem a cada alimento que prova.',
      { font: regular, size: 11.5, color: COLOR.text, y, lineHeight: 17, maxWidth: PAGE_WIDTH - MARGIN * 2 - 20 });

    y -= 26;
    const itens = [
      'O aplicativo, com as atividades na tela',
      '20 personagens pra pintar com o dedo',
      'O jogo do Prato Limpo',
      'Cardápio de 4 semanas antisseletividade',
      'Calendário, cartelas e quadro de progresso',
      'Atualizações semanais, sem pagar de novo',
    ];
    itens.forEach((t) => {
      page.drawCircle({ x: MARGIN + 6, y: y + 4, size: 3.5, color: COLOR.green });
      page.drawText(t, { x: MARGIN + 18, y, size: 11, font: regular, color: COLOR.text });
      y -= 20;
    });

    y -= 18;
    drawCentered(page, 'Você já pagou R$ 10,00. Complete por:', { font: regular, size: 11, color: COLOR.muted, y });
    y -= 40;
    drawCentered(page, 'R$ 17,90', { font: bold, size: 40, color: COLOR.greenDark, y });
    y -= 24;
    drawCentered(page, 'No site, o Completo sai por R$ 37,00.', { font: regular, size: 10, color: COLOR.muted, y });

    y -= 44;
    drawPill(page, 'kitpratolimpo.com.br/upgrade', { font: bold, size: 13, x: PAGE_WIDTH / 2, y, padX: 18, padY: 12, bg: COLOR.green, color: COLOR.white });
    y -= 34;
    drawCentered(page, 'Digite esse endereço no navegador do celular.', { font: regular, size: 9.5, color: COLOR.muted, y });
  };

  if (!includeBonuses) desenhaUpgrade();

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

    drawPill(divider, `BLOCO ${b.ord}`, {
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

  // Repete a oferta na última página: quem folheia o kit inteiro chega aqui.
  if (!includeBonuses) desenhaUpgrade();

  const pdfBytes = await pdf.save();
  const hash = crypto.createHash('sha256').update(pdfBytes).digest('hex').slice(0, 32);
  const fileName = `kit-prato-limpo-${variant}-${hash}.pdf`;
  return { pdfBytes, fileName };
}

// ---- EDIÇÃO PROFISSIONAL -------------------------------------------------
// Terceiro PDF, para nutricionistas que atendem público infantil. Ordem
// deliberada: as 30 fichas de CONSULTÓRIO vêm primeiro, os 129 blocos caseiros
// depois. A nutricionista abre o kit e a primeira coisa que vê é o que ela
// aplica na sessão de amanhã; a biblioteca de casa é o que ela ENTREGA pra mãe.
//
// Não mexe em nada das variantes essencial/completo: é função separada, pasta
// separada e nome de arquivo separado. O que o cliente que já comprou recebe
// hoje continua idêntico.
//
// NUMERAÇÃO DO SUMÁRIO: aqui não se usa o cursor manual do buildPdf (que
// assume sumário de 1 página e quebra em silêncio quando o kit cresce). O
// conteúdo é montado primeiro, guardando o índice real de cada divisória, e o
// sumário é INSERIDO depois na posição 3. Aí é só somar as páginas do sumário.
const SUMARIO_PAGINAS_PRO = 3;

async function buildPdfProfissional(blocksWithFiles, bonusesReady, proStages) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Kit Prato Limpo — Edição Profissional');
  pdf.setAuthor('Kit Prato Limpo');

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  // ---- capa ----
  {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });
    const bandHeight = 230;
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bandHeight, width: PAGE_WIDTH, height: bandHeight, color: COLOR.greenDark });

    drawPill(page, 'EDIÇÃO PROFISSIONAL', {
      font: bold, size: 9, x: PAGE_WIDTH / 2, y: PAGE_HEIGHT - 55, padX: 10, padY: 5,
      bg: COLOR.orange, color: COLOR.white,
    });
    drawCenteredParagraph(page, 'Kit Prato Limpo', {
      font: bold, size: 32, color: COLOR.white, y: PAGE_HEIGHT - 120, lineHeight: 36, maxWidth: PAGE_WIDTH - MARGIN * 2,
    });
    drawCenteredParagraph(page, 'Para nutricionistas que atendem seletividade alimentar infantil', {
      font: regular, size: 11.5, color: COLOR.mint, y: PAGE_HEIGHT - 165, lineHeight: 16, maxWidth: PAGE_WIDTH - MARGIN * 2 - 30,
    });

    drawCenteredParagraph(page,
      'Um protocolo em 6 etapas para aplicar na sessão, com alimento de verdade na mesa, e uma biblioteca de fichas para a família levar pra casa.',
      { font: regular, size: 12, color: COLOR.ink, y: PAGE_HEIGHT - bandHeight - 55, lineHeight: 18, maxWidth: PAGE_WIDTH - MARGIN * 2 - 20 }
    );

    drawPill(page, 'USO LIBERADO COM SEUS PACIENTES', {
      font: bold, size: 10, x: PAGE_WIDTH / 2, y: 210, padX: 14, padY: 8,
      bg: COLOR.mint, color: COLOR.greenDark,
    });

    page.drawLine({ start: { x: MARGIN, y: 90 }, end: { x: PAGE_WIDTH - MARGIN, y: 90 }, thickness: 1, color: COLOR.border });
    drawCentered(page, 'kitpratolimpo.com.br', { font: bold, size: 10, color: COLOR.muted, y: 66 });
    drawCentered(page, 'Suporte: kitpratolimpo@gmail.com', { font: regular, size: 9, color: COLOR.muted, y: 48 });
  }

  // ---- como usar em consultório ----
  {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });
    page.drawText('Como usar na sessão', { x: MARGIN, y: PAGE_HEIGHT - 70, size: 22, font: bold, color: COLOR.ink });
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 84, width: 46, height: 4, color: COLOR.orange });

    const steps = [
      { title: 'Comece pela etapa A', text: 'As cinco fichas de avaliação mapeiam o repertório real e o degrau de textura em que a criança trava. A escadinha do medo define a ordem do tratamento.' },
      { title: 'Uma etapa por vez', text: 'Só suba de etapa quando a anterior estiver tranquila. Pular direto para a prova costuma custar a confiança que você levou sessões para construir.' },
      { title: 'Use o "o que observar"', text: 'Cada ficha traz o que olhar enquanto a criança brinca. É registro clínico, não passatempo: anote no prontuário ao fim da sessão.' },
      { title: 'Mande o "leva para casa"', text: 'Toda ficha termina com a tarefa da família. É o que faz sua orientação sobreviver até a próxima consulta.' },
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
      y = Math.min(ly - 22, y - 90);
    });
  }

  // ---- licença de uso ----
  // A página que a nutricionista precisa ver escrita. Sem ela a dúvida "posso
  // imprimir isso pro meu paciente?" fica de pé, e é justamente o que separa
  // este material do kit doméstico.
  {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.mint });
    page.drawRectangle({ x: MARGIN - 14, y: 110, width: PAGE_WIDTH - (MARGIN - 14) * 2, height: PAGE_HEIGHT - 220, color: COLOR.white });

    let y = PAGE_HEIGHT - 165;
    drawPill(page, 'LICENÇA DE USO PROFISSIONAL', { font: bold, size: 9, x: PAGE_WIDTH / 2, y, padX: 12, padY: 7, bg: COLOR.greenDark, color: COLOR.white });

    y -= 46;
    drawCentered(page, 'Pode usar com seus pacientes', { font: bold, size: 19, color: COLOR.ink, y });

    y -= 34;
    const pode = [
      'Imprimir quantas cópias precisar',
      'Entregar as fichas impressas ao paciente',
      'Aplicar em atendimento individual ou em grupo',
      'Usar em oficinas e palestras que você conduzir',
      'Sem limite de pacientes e sem prazo de validade',
    ];
    pode.forEach((t) => {
      page.drawCircle({ x: MARGIN + 6, y: y + 4, size: 3.5, color: COLOR.green });
      const lines = wrapText(t, regular, 10.5, PAGE_WIDTH - MARGIN * 2 - 30);
      lines.forEach((line, li) => {
        page.drawText(line, { x: MARGIN + 18, y: y - li * 14, size: 10.5, font: regular, color: COLOR.text });
      });
      y -= 22 + (lines.length - 1) * 14;
    });

    y -= 14;
    drawCentered(page, 'O que não é permitido', { font: bold, size: 12, color: COLOR.coral, y });
    y -= 24;
    const naoPode = [
      'Revender, distribuir ou compartilhar o arquivo',
      'Publicar as fichas em redes sociais ou sites',
      'Incluir o material em cursos ou produtos à venda',
    ];
    naoPode.forEach((t) => {
      page.drawCircle({ x: MARGIN + 6, y: y + 4, size: 3.5, color: COLOR.coral });
      const lines = wrapText(t, regular, 10.5, PAGE_WIDTH - MARGIN * 2 - 30);
      lines.forEach((line, li) => {
        page.drawText(line, { x: MARGIN + 18, y: y - li * 14, size: 10.5, font: regular, color: COLOR.text });
      });
      y -= 20 + (lines.length - 1) * 14;
    });

    drawCentered(page, 'Licença individual, vinculada à sua compra.', { font: regular, size: 9, color: COLOR.muted, y: 130 });
  }

  // ---- conteúdo: etapas do protocolo, depois blocos de casa, depois bônus ----
  // marcadores guarda o índice REAL da divisória de cada seção, pra numerar o
  // sumário sem contas frágeis.
  const marcadores = [];

  const divisoria = (rotulo, titulo, desc, accent) => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: accent });
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 8, color: accent });
    drawPill(page, rotulo, { font: bold, size: 11, x: PAGE_WIDTH / 2, y: PAGE_HEIGHT / 2 + 70, padX: 12, padY: 6, bg: accent, color: COLOR.white });
    const afterTitle = drawCenteredParagraph(page, titulo, {
      font: bold, size: 24, color: COLOR.ink, y: PAGE_HEIGHT / 2 + 20, lineHeight: 28, maxWidth: PAGE_WIDTH - MARGIN * 2,
    });
    page.drawRectangle({ x: PAGE_WIDTH / 2 - 24, y: afterTitle + 6, width: 48, height: 4, color: accent });
    drawCenteredParagraph(page, desc, {
      font: regular, size: 11.5, color: COLOR.text, y: afterTitle - 22, lineHeight: 16, maxWidth: PAGE_WIDTH - MARGIN * 2 - 30,
    });
  };

  for (let i = 0; i < proStages.length; i++) {
    const s = proStages[i];
    marcadores.push({ grupo: 'etapa', rotulo: `ETAPA ${s.code}`, titulo: s.title, desc: s.desc, idx: pdf.getPageCount() });
    divisoria(`ETAPA ${s.code}`, s.title, s.desc, ACCENTS[i % ACCENTS.length]);
    for (const file of s.files) {
      const image = await embedFicha(pdf, path.join(CONSULTORIO_DIR, file));
      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    }
  }

  for (let i = 0; i < blocksWithFiles.length; i++) {
    const b = blocksWithFiles[i];
    marcadores.push({ grupo: 'bloco', rotulo: `BLOCO ${b.ord}`, titulo: b.title, desc: b.desc, idx: pdf.getPageCount() });
    divisoria(`BLOCO ${b.ord}`, b.title, b.desc, ACCENTS[i % ACCENTS.length]);
    for (const file of b.files) {
      const image = await embedFicha(pdf, path.join(FICHAS_DIR, file));
      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    }
  }

  if (bonusesReady.length) {
    marcadores.push({ grupo: 'bonus', rotulo: 'BÔNUS', titulo: 'Materiais de apoio', desc: 'Pra organizar a rotina da família e enxergar a evolução sem virar planilha.', idx: pdf.getPageCount() });
    divisoria('BÔNUS', 'Materiais de apoio', 'Pra organizar a rotina da família e enxergar a evolução sem virar planilha.', COLOR.orange);
    for (const b of bonusesReady) {
      marcadores.push({ grupo: 'bonusItem', titulo: b.title, idx: pdf.getPageCount() });
      const image = await embedFicha(pdf, path.join(BONUS_DIR, b.file));
      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    }
  }

  // ---- sumário: inserido na posição 3, depois de capa/como usar/licença ----
  // pág. impressa = idx (0-based, contado ANTES do sumário existir)
  //               + páginas do sumário + 1 (pra virar 1-based)
  const numeroDe = (m) => m.idx + SUMARIO_PAGINAS_PRO + 1;

  const sum1 = pdf.insertPage(3, [PAGE_WIDTH, PAGE_HEIGHT]);
  const sum2 = pdf.insertPage(4, [PAGE_WIDTH, PAGE_HEIGHT]);
  const sum3 = pdf.insertPage(5, [PAGE_WIDTH, PAGE_HEIGHT]);

  const linhaSumario = (page, { rotulo, titulo, desc, numero, accent, y }) => {
    page.drawText(rotulo, { x: MARGIN, y, size: 9, font: bold, color: accent });
    page.drawText(titulo, { x: MARGIN, y: y - 14, size: 12, font: bold, color: COLOR.ink });
    const descLines = wrapText(desc, regular, 9, PAGE_WIDTH - MARGIN * 2 - 90);
    page.drawText(descLines[0] || '', { x: MARGIN, y: y - 26, size: 9, font: regular, color: COLOR.muted });
    const pageText = `pág. ${numero}`;
    const pageW = bold.widthOfTextAtSize(pageText, 10);
    page.drawText(pageText, { x: PAGE_WIDTH - MARGIN - pageW, y: y - 14, size: 10, font: bold, color: COLOR.greenDark });
    page.drawLine({ start: { x: MARGIN, y: y - 34 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 34 }, thickness: 1, color: COLOR.border });
  };

  // As etapas ocupam DUAS páginas de sumário. Cada linha come 48pt e a página
  // tem 648: a partir de ~10 etapas a lista passava do rodapé e as últimas
  // saíam fora do papel, sem erro nenhum no build. Metade em cada página deixa
  // folga pra crescer de novo sem quebrar.
  const etapas = marcadores.filter((m) => m.grupo === 'etapa');
  const metade = Math.ceil(etapas.length / 2);
  const paginasEtapa = [
    { page: sum1, itens: etapas.slice(0, metade), titulo: 'O protocolo, etapa a etapa', sub: 'Fichas para aplicar na sessão, com alimento de verdade na mesa.', offset: 0 },
    { page: sum2, itens: etapas.slice(metade), titulo: 'O protocolo, continuação', sub: 'Da recusa difícil até a alta, com o plano de manutenção.', offset: metade },
  ];

  paginasEtapa.forEach(({ page, itens, titulo, sub, offset }) => {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });
    page.drawText(titulo, { x: MARGIN, y: PAGE_HEIGHT - 70, size: 20, font: bold, color: COLOR.ink });
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 84, width: 46, height: 4, color: COLOR.orange });
    drawCenteredParagraph(page, sub, {
      font: regular, size: 10, color: COLOR.muted, y: PAGE_HEIGHT - 104, lineHeight: 14, maxWidth: PAGE_WIDTH - MARGIN * 2,
    });

    let y = PAGE_HEIGHT - 140;
    itens.forEach((m, i) => {
      linhaSumario(page, { rotulo: m.rotulo, titulo: m.titulo, desc: m.desc, numero: numeroDe(m), accent: ACCENTS[(offset + i) % ACCENTS.length], y });
      y -= 48;
    });

    page.drawLine({ start: { x: MARGIN, y: 90 }, end: { x: PAGE_WIDTH - MARGIN, y: 90 }, thickness: 1, color: COLOR.border });
    drawCentered(page, 'Não pule etapas. A ordem é o tratamento.', { font: bold, size: 10.5, color: COLOR.ink, y: 68 });
  });

  {
    sum3.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLOR.cream });
    sum3.drawText('Para a família levar pra casa', { x: MARGIN, y: PAGE_HEIGHT - 70, size: 20, font: bold, color: COLOR.ink });
    sum3.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 84, width: 46, height: 4, color: COLOR.orange });
    drawCenteredParagraph(sum3, 'Imprima e entregue conforme a etapa em que a criança está.', {
      font: regular, size: 10, color: COLOR.muted, y: PAGE_HEIGHT - 104, lineHeight: 14, maxWidth: PAGE_WIDTH - MARGIN * 2,
    });

    // Lista compacta: com 11 blocos + bônus, o layout de 3 linhas do sumário
    // principal não cabe. Uma linha por bloco entra folgado.
    let y = PAGE_HEIGHT - 136;
    marcadores.filter((m) => m.grupo === 'bloco').forEach((m, i) => {
      const accent = ACCENTS[i % ACCENTS.length];
      sum3.drawCircle({ x: MARGIN + 4, y: y + 4, size: 3.5, color: accent });
      sum3.drawText(m.titulo, { x: MARGIN + 16, y, size: 11, font: bold, color: COLOR.ink });
      const pageText = `pág. ${numeroDe(m)}`;
      const pageW = bold.widthOfTextAtSize(pageText, 9.5);
      sum3.drawText(pageText, { x: PAGE_WIDTH - MARGIN - pageW, y, size: 9.5, font: bold, color: COLOR.greenDark });
      y -= 22;
    });

    const itensBonus = marcadores.filter((m) => m.grupo === 'bonusItem');
    if (itensBonus.length) {
      y -= 10;
      sum3.drawText('MATERIAIS DE APOIO', { x: MARGIN, y, size: 9, font: bold, color: COLOR.orange });
      y -= 20;
      itensBonus.forEach((m) => {
        sum3.drawCircle({ x: MARGIN + 4, y: y + 4, size: 3.5, color: COLOR.orange });
        sum3.drawText(m.titulo, { x: MARGIN + 16, y, size: 11, font: bold, color: COLOR.ink });
        const pageText = `pág. ${numeroDe(m)}`;
        const pageW = bold.widthOfTextAtSize(pageText, 9.5);
        sum3.drawText(pageText, { x: PAGE_WIDTH - MARGIN - pageW, y, size: 9.5, font: bold, color: COLOR.greenDark });
        y -= 22;
      });
    }
  }

  // Confere o sumario sem precisar abrir o PDF: KPL_DEBUG=1 lista cada
  // marcador com o numero de pagina que o sumario vai imprimir.
  if (process.env.KPL_DEBUG) console.log(marcadores.map((m) => m.rotulo + '=' + numeroDe(m)).join(' '));
  const pdfBytes = await pdf.save();
  const hash = crypto.createHash('sha256').update(pdfBytes).digest('hex').slice(0, 32);
  return { pdfBytes, fileName: `kit-prato-limpo-profissional-${hash}.pdf`, paginas: pdf.getPageCount() };
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

  // `n` é chave de arquivo (casa com B<n>-F*.png) e NÃO é o número que o
  // comprador vê. `ord` é a posição depois de descartar bloco sem ficha
  // pronta, e é isso que vai impresso, pra o kit numerar igual à página.
  const blocksWithFiles = BLOCKS.map((b) => ({
    ...b,
    files: allFiles.filter((f) => f.startsWith(`B${b.n}-F`)),
  })).filter((b) => b.files.length > 0).map((b, i) => ({ ...b, ord: i + 1 }));

  // Mesma regra dos blocos: bônus sem arquivo pronto não aparece em lugar nenhum.
  const bonusFiles = fs.existsSync(BONUS_DIR) ? fs.readdirSync(BONUS_DIR) : [];
  const bonusesReady = BONUSES.map((b) => ({
    ...b,
    file: bonusFiles.find((f) => f.startsWith(b.id) && /\.png$/i.test(f)),
  })).filter((b) => b.file);

  // Fichas de consultório: C<NN>-<slug>.png, agrupadas nas etapas pela faixa de
  // NN definida em kit-data. Etapa sem ficha pronta some do PDF, mesma regra
  // dos blocos.
  const proFiles = fs.existsSync(CONSULTORIO_DIR)
    ? fs
        .readdirSync(CONSULTORIO_DIR)
        .filter((f) => /^C\d+-.+\.png$/i.test(f))
        .sort((a, b) => Number(a.match(/^C(\d+)-/)[1]) - Number(b.match(/^C(\d+)-/)[1]))
    : [];

  const proStages = PRO_STAGES.map((s) => ({
    ...s,
    files: proFiles.filter((f) => {
      const n = Number(f.match(/^C(\d+)-/)[1]);
      return n >= s.range[0] && n <= s.range[1];
    }),
  })).filter((s) => s.files.length > 0);

  // Toda ficha C<NN> tem que cair em alguma etapa. Se sobrar alguma (faixa
  // errada em PRO_STAGES, ficha nova fora do range), ela sumiria do PDF em
  // silêncio — o mesmo tipo de perda que o filtro \d{2} já causou aqui.
  const emEtapa = new Set(proStages.flatMap((s) => s.files));
  const orfas = proFiles.filter((f) => !emEtapa.has(f));
  if (orfas.length) {
    console.error('Fichas de consultório fora de qualquer etapa: ' + orfas.join(', '));
    process.exit(1);
  }

  const essencial = await buildPdf('essencial', allFiles, blocksWithFiles, bonusesReady);
  const completo = await buildPdf('completo', allFiles, blocksWithFiles, bonusesReady);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Limpa edições antigas de QUALQUER variante: se ficarem no ar, links
  // vazados de builds passados continuariam funcionando pra sempre.
  const profissional = proStages.length
    ? await buildPdfProfissional(blocksWithFiles, bonusesReady, proStages)
    : null;

  const keep = new Set(
    [essencial.fileName, completo.fileName, profissional && profissional.fileName].filter(Boolean)
  );
  for (const old of fs.readdirSync(OUTPUT_DIR)) {
    if (/^kit-prato-limpo-(essencial|completo|profissional)-[0-9a-f]+\.pdf$/i.test(old) && !keep.has(old)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, old));
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, essencial.fileName), essencial.pdfBytes);
  fs.writeFileSync(path.join(OUTPUT_DIR, completo.fileName), completo.pdfBytes);
  const manifesto = { essencial: essencial.fileName, completo: completo.fileName };
  if (profissional) {
    fs.writeFileSync(path.join(OUTPUT_DIR, profissional.fileName), profissional.pdfBytes);
    manifesto.profissional = profissional.fileName;
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifesto, null, 2) + '\n');

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(`OK essencial: ${allFiles.length} ficha(s), sem bônus -> entrega/${essencial.fileName} (${mb(essencial.pdfBytes.length)} MB)`);
  console.log(`OK completo:  ${allFiles.length} ficha(s) + ${bonusesReady.length} bônus -> entrega/${completo.fileName} (${mb(completo.pdfBytes.length)} MB)`);
  if (profissional) {
    const totalPro = proStages.reduce((acc, s) => acc + s.files.length, 0);
    console.log(`OK profissional: ${totalPro} de consultorio + ${allFiles.length} de casa + ${bonusesReady.length} bonus -> entrega/${profissional.fileName} (${mb(profissional.pdfBytes.length)} MB, ${profissional.paginas} pags)`);
  }
  console.log('   manifesto -> api/_kit-file.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
