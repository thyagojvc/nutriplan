// Gera as fichas de consultorio pra aba "Consultorio" do app (so Edicao
// Profissional).
//
// SEGURANCA: as 60 fichas sao o produto de R$ 67. Os PNGs originais nao sobem
// (estao no .vercelignore desde 23/08, quando dava pra baixar tudo sem pagar
// adivinhando o nome). Aqui saem versoes de tela (800px) com NOME IMPREVISIVEL:
// um hash do conteudo com um sal. A lista desses nomes fica em
// api/_consultorio.json, que NAO e servido como arquivo, e so e devolvida por
// api/kit-access.js pra token de compra profissional. Sem o token, nao ha como
// saber o nome de nenhuma ficha.
//
// Nao custa comando no Upstash: kit-access ja faz o GET do token de qualquer
// jeito.
//
// Rodar:  node scripts/build-consultorio-app.js   (e reimplantar)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { PRO_STAGES, titleFromProFile } = require('./kit-data');

const RAIZ = path.join(__dirname, '..');
const ORIGEM = path.join(RAIZ, 'assets', 'fichas-consultorio');
const DESTINO = path.join(RAIZ, 'assets', 'consultorio-app');
const MANIFESTO = path.join(RAIZ, 'api', '_consultorio.json');
const SAL = 'kpl-pro-consultorio-2026';

// O nome do arquivo perdeu os acentos na hora de salvar. Corrige as palavras
// que aparecem nos titulos, pra aba nao mostrar "Carimbo de pimentao".
const ACENTOS = {
  avaliacao: 'avaliação', pimentao: 'pimentão', macarrao: 'macarrão', cabeca: 'cabeça',
  magica: 'mágica', juri: 'júri', tres: 'três', maos: 'mãos', mao: 'mão', nao: 'não',
  familia: 'família', licao: 'lição', recaida: 'recaída', repertorio: 'repertório',
  termometro: 'termômetro', relogio: 'relógio', cardapio: 'cardápio', grafico: 'gráfico',
  diario: 'diário', nausea: 'náusea', ve: 'vê', avo: 'avó', agua: 'água', ansiedade: 'ansiedade',
  sabado: 'sábado', cha: 'chá', pao: 'pão', feijao: 'feijão', limao: 'limão', melao: 'melão',
  semaforo: 'semáforo', saida: 'saída', so: 'só',
  e: 'e', proximo: 'próximo', proxima: 'próxima', crianca: 'criança', lingua: 'língua',
};
const comAcento = (t) => t.split(' ').map((w) => {
  const k = w.toLowerCase();
  if (!ACENTOS[k]) return w;
  const r = ACENTOS[k];
  return w[0] === w[0].toUpperCase() ? r.charAt(0).toUpperCase() + r.slice(1) : r;
}).join(' ').replace(/Quebra cabeça/, 'Quebra-cabeça');

async function main() {
  const arquivos = fs.readdirSync(ORIGEM).filter((f) => /^C\d+-.+\.png$/i.test(f)).sort();
  fs.rmSync(DESTINO, { recursive: true, force: true });
  fs.mkdirSync(DESTINO, { recursive: true });

  const porArquivo = {};
  for (const f of arquivos) {
    const buf = await sharp(path.join(ORIGEM, f))
      .resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const hash = crypto.createHash('sha256').update(SAL).update(buf).digest('hex').slice(0, 20);
    const nome = `${hash}.jpg`;
    fs.writeFileSync(path.join(DESTINO, nome), buf);
    porArquivo[f] = { file: nome, title: comAcento(titleFromProFile(f)) };
  }

  const stages = PRO_STAGES.map((s) => ({
    code: s.code, title: s.title, desc: s.desc,
    fichas: arquivos
      .filter((f) => { const n = Number(f.match(/^C(\d+)-/)[1]); return n >= s.range[0] && n <= s.range[1]; })
      .map((f) => porArquivo[f]),
  })).filter((s) => s.fichas.length);

  const total = stages.reduce((a, s) => a + s.fichas.length, 0);
  if (total !== arquivos.length) {
    console.error(`ERRO: ${arquivos.length - total} ficha(s) fora de qualquer etapa (confira PRO_STAGES).`);
    process.exit(1);
  }

  fs.writeFileSync(MANIFESTO, JSON.stringify({ stages }, null, 1) + '\n');
  console.log(`OK: ${total} fichas em ${stages.length} etapas -> assets/consultorio-app/ + api/_consultorio.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
