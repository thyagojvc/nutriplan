// node scripts/build-previa-imgs.js
//
// Gera as imagens da seção "Prévia real do kit" (index.html) a partir das
// fichas e dos bônus DE VERDADE que vão dentro do PDF entregue. Antes essa
// seção mostrava mockups antigos que não eram o material entregue — o texto
// dela promete "páginas de verdade do material", então tem que ser o arquivo
// real mesmo.
//
// Por que converter e não usar o PNG direto: cada ficha tem ~1,3MB. Seis delas
// na página seriam 8MB numa landing que é vista quase toda no celular. Aqui
// elas viram JPEG de ~600px de largura (o dobro dos ~260px em que aparecem, pra
// ficar nítido em tela retina), na casa das dezenas de KB, que é a mesma faixa
// das imagens antigas da seção.
//
// Rode de novo se trocar quais fichas aparecem na prévia.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets');

// De onde sai cada prévia. A ordem aqui é a ordem que aparece no carrossel.
const ITEMS = [
  { src: 'assets/fichas-geradas/B1-F01-o-sino-do-jantar.png', out: 'previa-real-01.jpg' },
  { src: 'assets/fichas-geradas/B2-F13-a-lancheira-que-volta-vazia.png', out: 'previa-real-02.jpg' },
  { src: 'assets/fichas-geradas/B1-F04-o-garfo-magico.png', out: 'previa-real-03.jpg' },
];

const WIDTH = 600;

async function main() {
  for (const item of ITEMS) {
    const srcPath = path.join(ROOT, item.src);
    if (!fs.existsSync(srcPath)) {
      console.error(`FALTANDO: ${item.src}`);
      process.exitCode = 1;
      continue;
    }
    const outPath = path.join(OUT_DIR, item.out);
    await sharp(srcPath)
      .resize({ width: WIDTH })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(outPath);
    const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`${item.out.padEnd(20)} ${kb} KB  <- ${path.basename(item.src)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
