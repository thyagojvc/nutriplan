// node scripts/build-gallery-manifest.js
//
// Gera as imagens web (leves) das 86 fichas + 4 bônus e o manifesto que
// mi-kit.html usa pra desenhar a galeria dentro do app (comprador vê as
// fichas sem sair do app, além de continuar podendo baixar o PDF pra
// imprimir tudo de uma vez). Roda localmente, igual ao build-kit-pdf.js —
// reexecute e reimplante sempre que adicionar ficha nova.
//
// Uma imagem só por ficha (não thumb + full separados): 800px de largura,
// JPEG qualidade 82. Serve tanto de miniatura na grade (CSS encolhe) quanto
// de visualização em tela cheia no toque. ~90 arquivos, uns 80-150KB cada;
// carregam sob demanda (loading="lazy") então o peso total não bate de uma vez.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { BLOCKS, BONUSES, titleFromFile } = require('./kit-data');

const FICHAS_DIR = path.join(__dirname, '..', 'assets', 'fichas-geradas');
const BONUS_DIR = path.join(__dirname, '..', 'assets', 'bonus');
const WEB_DIR = path.join(__dirname, '..', 'assets', 'fichas-web');
const MANIFEST_PATH = path.join(__dirname, '..', 'assets', 'gallery-manifest.json');

async function toWebJpg(srcPath, destPath) {
  await sharp(srcPath).resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(destPath);
}

async function main() {
  fs.mkdirSync(WEB_DIR, { recursive: true });

  const allFiles = fs
    .readdirSync(FICHAS_DIR)
    // \d+ nos dois números: com o Bloco 9 as fichas passaram de 2 pra 3
    // dígitos (F100+), \d{2} fixo as excluía em silêncio da galeria.
    .filter((f) => /^B\d+-F\d+-.+\.png$/i.test(f))
    // .sort() puro é lexicográfico: "F100" vem ANTES de "F99" (compara
    // caractere a caractere, "1" < "9"). Ordena pelos números de verdade.
    .sort((a, b) => {
      const na = a.match(/^B(\d+)-F(\d+)-/);
      const nb = b.match(/^B(\d+)-F(\d+)-/);
      return Number(na[1]) - Number(nb[1]) || Number(na[2]) - Number(nb[2]);
    });

  if (!allFiles.length) {
    console.error('Nenhuma ficha encontrada em ' + FICHAS_DIR);
    process.exit(1);
  }

  const blocksOut = [];
  for (const b of BLOCKS) {
    const files = allFiles.filter((f) => f.startsWith(`B${b.n}-F`));
    if (!files.length) continue;

    const fichas = [];
    for (const file of files) {
      const webName = file.replace(/\.png$/i, '.jpg');
      await toWebJpg(path.join(FICHAS_DIR, file), path.join(WEB_DIR, webName));
      fichas.push({ file: webName, title: titleFromFile(file) });
    }
    // n = o número que aparece no app, pela posição. `arquivo` guarda a chave
    // de arquivo (o B<n> do PNG) pra quem precisar cruzar com as missões.
    blocksOut.push({ n: blocksOut.length + 1, arquivo: b.n, title: b.title, desc: b.desc, fichas });
  }

  const bonusFiles = fs.existsSync(BONUS_DIR) ? fs.readdirSync(BONUS_DIR) : [];
  const bonusesOut = [];
  for (const b of BONUSES) {
    const file = bonusFiles.find((f) => f.startsWith(b.id) && /\.png$/i.test(f));
    if (!file) continue;
    const webName = file.replace(/\.png$/i, '.jpg');
    await toWebJpg(path.join(BONUS_DIR, file), path.join(WEB_DIR, webName));
    bonusesOut.push({ file: webName, title: b.title, desc: b.desc });
  }

  // Limpa imagens web de fichas que não existem mais (renomeadas/removidas).
  const keep = new Set([...blocksOut.flatMap((b) => b.fichas.map((f) => f.file)), ...bonusesOut.map((b) => b.file)]);
  for (const old of fs.readdirSync(WEB_DIR)) {
    if (!keep.has(old)) fs.unlinkSync(path.join(WEB_DIR, old));
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ blocks: blocksOut, bonuses: bonusesOut }, null, 2));

  const totalFichas = blocksOut.reduce((n, b) => n + b.fichas.length, 0);
  console.log(`OK galeria: ${totalFichas} ficha(s) em ${blocksOut.length} bloco(s) + ${bonusesOut.length} bônus -> ${WEB_DIR}`);

  conferePagina(blocksOut, totalFichas);
}

// A página de vendas tem a própria cópia dos blocos (o array BLOCOS dentro do
// index.html, que não passa por build nenhum). Se ela sair de sincronia com o
// kit, a mãe lê "Bloco 4 · Aproximação sensorial" na página e abre um PDF em
// que aquilo é outro número. Isso quebra em silêncio, então o build avisa.
function conferePagina(blocksOut, totalFichas) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const trecho = html.match(/const BLOCOS = \[[\s\S]*?\n\];/);
  if (!trecho) { console.warn('AVISO: não achei o array BLOCOS no index.html'); return; }

  const nomes = [...trecho[0].matchAll(/nome:'([^']+)'/g)].map((m) => m[1]);
  const qtds = [...trecho[0].matchAll(/qtd:(\d+)/g)].map((m) => Number(m[1]));
  const problemas = [];

  blocksOut.forEach((b, i) => {
    if (nomes[i] !== b.title) problemas.push(`posição ${i + 1}: página diz "${nomes[i] || '(vazio)'}", kit diz "${b.title}"`);
    if (qtds[i] !== b.fichas.length) problemas.push(`"${b.title}": página diz ${qtds[i]} fichas, kit tem ${b.fichas.length}`);
  });
  if (nomes.length !== blocksOut.length) problemas.push(`página lista ${nomes.length} blocos, kit tem ${blocksOut.length}`);

  const totalNaPagina = qtds.reduce((a, n) => a + n, 0);
  if (totalNaPagina !== totalFichas) problemas.push(`total: página soma ${totalNaPagina}, kit tem ${totalFichas}`);

  if (!problemas.length) { console.log('OK index.html: mesma ordem, mesmos números do kit.'); return; }
  console.warn('\nAVISO: index.html está fora de sincronia com o kit:');
  problemas.forEach((p) => console.warn('  - ' + p));
}

main();
