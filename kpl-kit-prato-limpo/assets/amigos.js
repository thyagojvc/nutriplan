/* Amigos do Prato — os 20 personagens colecionáveis do app.
 *
 * São SVG desenhado à mão (não imagem) de propósito:
 *   - pesa ~8KB no total em vez de 20 arquivos PNG;
 *   - escala sem borrar em qualquer tela;
 *   - a versão "bloqueada" é o MESMO desenho pintado de cinza, então a criança
 *     reconhece a silhueta e sabe qual amigo está faltando (é isso que faz ela
 *     querer provar o alimento).
 *
 * O estilo copia o das fichas impressas (PROMPTS-86-ATIVIDADES.md, seção 3):
 * vetorial flat, contorno preto arredondado grosso, cor chapada, carinha
 * simples de olhos redondos e sorriso pequeno. Ficar parecido com o material
 * impresso é intencional: é o mesmo universo, não um app à parte.
 *
 * Paleta travada na da marca. `dif` é a dificuldade percebida pela criança
 * seletiva, usada só pra ordenar a grade: os fáceis primeiro, pra ela ganhar
 * os primeiros amigos rápido e entender o jogo antes de encarar o brócolis.
 */
(function (global) {
  var INK = '#26302A';

  // Carinha padrão. Todo personagem usa a mesma, só muda onde fica —
  // é o que faz os 20 parecerem da mesma turma.
  function face(cx, cy, s) {
    s = s || 1;
    var eye = 3.4 * s;
    var dx = 10 * s;
    var mw = 7 * s;
    var md = 6 * s;
    return ''
      + '<circle cx="' + (cx - dx) + '" cy="' + cy + '" r="' + eye + '" fill="' + INK + '"/>'
      + '<circle cx="' + (cx + dx) + '" cy="' + cy + '" r="' + eye + '" fill="' + INK + '"/>'
      + '<path d="M' + (cx - mw) + ' ' + (cy + 7 * s)
        + ' Q' + cx + ' ' + (cy + 7 * s + md) + ' ' + (cx + mw) + ' ' + (cy + 7 * s) + '"'
        + ' fill="none" stroke="' + INK + '" stroke-width="' + (3.4 * s) + '" stroke-linecap="round"/>';
  }

  // Bochechinhas: só nos personagens onde sobra espaço claro, senão suja o desenho.
  function blush(cx, cy, s) {
    s = s || 1;
    var dx = 19 * s;
    return ''
      + '<ellipse cx="' + (cx - dx) + '" cy="' + (cy + 6 * s) + '" rx="' + (4.5 * s) + '" ry="' + (3 * s) + '" fill="#F0673A" opacity=".35"/>'
      + '<ellipse cx="' + (cx + dx) + '" cy="' + (cy + 6 * s) + '" rx="' + (4.5 * s) + '" ry="' + (3 * s) + '" fill="#F0673A" opacity=".35"/>';
  }

  // Folhinha verde reaproveitada por vários (tomate, maçã, pera...).
  function leaf(x, y, flip) {
    var d = flip
      ? 'M' + x + ' ' + y + ' c-10 -8 -20 -6 -24 2 8 6 18 5 24 -2 z'
      : 'M' + x + ' ' + y + ' c10 -8 20 -6 24 2 -8 6 -18 5 -24 -2 z';
    return '<path d="' + d + '" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>';
  }

  function stem(x, yTop, yBottom) {
    return '<path d="M' + x + ' ' + yBottom + ' V' + yTop + '" stroke="#3C7A2C" stroke-width="6" stroke-linecap="round" fill="none"/>';
  }

  var AMIGOS = [
    {
      id: 'banana', nome: 'Bruno Banana', alimento: 'Banana', dif: 1,
      // Forma fechada, não traço grosso. A versão antiga era um traço de
      // espessura constante com outro por baixo fazendo de contorno: rendia as
      // duas pontas arredondadas (parecia feijão) e o cabinho, desenhado por
      // cima, virava um risco preto dentro do corpo.
      // Agora é um "C" vertical com as duas pontas em BICO, como banana de
      // verdade. Vertical de propósito: deitada, a silhueta cinza do estado
      // bloqueado ficava igual à do feijão, e a criança precisa reconhecer
      // qual amigo está faltando só pelo contorno.
      art:
        // Contorno calculado (espinha em arco + espessura que afina nas duas
        // pontas), não desenhado no olho: à mão saía fina em cima e gorda
        // embaixo, o que lê como lua e não como banana.
        '<path d="M70.3 14.4 Q58.7 12.6 53.5 14.7 Q48.2 16.8 43.8 20.6 Q39.3 24.3 36.1 29.3 Q32.8 34.3 31.1 40.1'
        + ' Q29.4 45.9 29.4 52 Q29.4 58.1 31.1 63.9 Q32.8 69.7 36.1 74.7 Q39.3 79.7 43.8 83.5 Q48.2 87.2 53.5 89.3'
        + ' Q58.7 91.4 64.5 90.5 L70.3 89.6 Q66.1 79.9 64.4 76.4 Q62.8 72.9 61.8 69.7 Q60.7 66.4 60.2 63.5'
        + ' Q59.6 60.5 59.4 57.7 Q59.1 54.8 59.1 52 Q59.1 49.2 59.4 46.4 Q59.6 43.5 60.2 40.6 Q60.7 37.6 61.8 34.4'
        + ' Q62.8 31.1 64.4 27.6 Q66.1 24.1 68.2 19.3 L70.3 14.4 Z"'
        + ' fill="#F4C430" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + face(44, 52, 0.78),
    },
    {
      id: 'maca', nome: 'Marina Maçã', alimento: 'Maçã', dif: 1,
      art:
        stem(50, 18, 32)
        + leaf(52, 24, false)
        + '<path d="M50 32 C36 24 22 34 22 52 C22 72 34 88 50 88 C66 88 78 72 78 52 C78 34 64 24 50 32 Z"'
        + ' fill="#E8503A" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + face(50, 56) + blush(50, 56),
    },
    {
      id: 'melancia', nome: 'Melissa Melancia', alimento: 'Melancia', dif: 1,
      art:
        '<path d="M14 38 A36 36 0 0 0 86 38 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + '<path d="M22 42 A28 28 0 0 0 78 42 Z" fill="#E8503A" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        // Sementes só na barriga da fatia, abaixo do sorriso — na altura do
        // rosto elas viravam "olhos" extras e embaralhavam a carinha.
        + '<g fill="' + INK + '"><circle cx="41" cy="65" r="2.8"/><circle cx="59" cy="65" r="2.8"/><circle cx="50" cy="69" r="2.8"/></g>'
        + face(50, 51, 0.78),
    },
    {
      id: 'uva', nome: 'Uriel Uva', alimento: 'Uva', dif: 1,
      art:
        stem(50, 12, 24) + leaf(52, 18, false)
        + '<g fill="#7B4E9E" stroke="' + INK + '" stroke-width="4.5">'
        + '<circle cx="50" cy="34" r="12"/><circle cx="34" cy="48" r="12"/><circle cx="66" cy="48" r="12"/>'
        + '<circle cx="42" cy="64" r="12"/><circle cx="58" cy="64" r="12"/><circle cx="50" cy="79" r="12"/>'
        + '</g>'
        + face(50, 50, 0.8),
    },
    {
      id: 'morango', nome: 'Manu Morango', alimento: 'Morango', dif: 1,
      art:
        stem(50, 14, 26)
        + '<path d="M50 26 L30 32 L44 38 L26 42 L46 48 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M50 26 L70 32 L56 38 L74 42 L54 48 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M26 46 C26 40 36 36 50 36 C64 36 74 40 74 46 C74 66 62 88 50 88 C38 88 26 66 26 46 Z"'
        + ' fill="#E8503A" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + '<g fill="#FBF8F1"><ellipse cx="35" cy="58" rx="2.4" ry="3.4"/><ellipse cx="65" cy="58" rx="2.4" ry="3.4"/>'
        + '<ellipse cx="50" cy="74" rx="2.4" ry="3.4"/><ellipse cx="40" cy="70" rx="2.4" ry="3.4"/><ellipse cx="60" cy="70" rx="2.4" ry="3.4"/></g>'
        + face(50, 54, 0.85),
    },
    {
      id: 'laranja', nome: 'Otávio Laranja', alimento: 'Laranja', dif: 1,
      art:
        stem(50, 18, 30) + leaf(52, 24, false)
        + '<circle cx="50" cy="58" r="30" fill="#F2911F" stroke="' + INK + '" stroke-width="5"/>'
        // Gomos só na base, fora da área do rosto.
        + '<path d="M50 76 V88 M36 74 L31 83 M64 74 L69 83" stroke="' + INK + '" stroke-width="2.5" opacity=".28" fill="none" stroke-linecap="round"/>'
        + face(50, 54) + blush(50, 54),
    },
    {
      id: 'abacaxi', nome: 'Alice Abacaxi', alimento: 'Abacaxi', dif: 2,
      art:
        '<path d="M50 34 L38 8 L44 32 L28 18 L36 34 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M50 34 L62 8 L56 32 L72 18 L64 34 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<ellipse cx="50" cy="62" rx="25" ry="29" fill="#F4C430" stroke="' + INK + '" stroke-width="5"/>'
        // Losangos só na parte de baixo: cruzando o rosto viravam rabisco.
        + '<path d="M34 74 L50 86 L66 74 M40 68 L50 78 L60 68" stroke="' + INK + '" stroke-width="2.4" opacity=".3" fill="none" stroke-linejoin="round"/>'
        + face(50, 56, 0.92),
    },
    {
      id: 'pera', nome: 'Pedro Pera', alimento: 'Pera', dif: 2,
      art:
        stem(50, 14, 28) + leaf(52, 20, false)
        + '<path d="M50 28 C58 28 61 36 58 43 C70 49 75 60 73 70 C71 82 62 90 50 90 C38 90 29 82 27 70 C25 60 30 49 42 43 C39 36 42 28 50 28 Z"'
        + ' fill="#A8CE96" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + face(50, 64) + blush(50, 64),
    },
    {
      id: 'cenoura', nome: 'Cadu Cenoura', alimento: 'Cenoura', dif: 2,
      art:
        '<path d="M50 30 C46 18 38 12 30 12 C34 20 40 26 46 30 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M50 30 C54 18 62 12 70 12 C66 20 60 26 54 30 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M50 30 V16" stroke="#3C7A2C" stroke-width="5" stroke-linecap="round"/>'
        + '<path d="M32 34 H68 L54 86 C52 90 48 90 46 86 Z" fill="#F2911F" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + '<path d="M37 50 H63 M41 64 H59" stroke="' + INK + '" stroke-width="2.6" opacity=".3" stroke-linecap="round"/>'
        + face(50, 50, 0.86),
    },
    {
      id: 'milho', nome: 'Miguel Milho', alimento: 'Milho', dif: 2,
      art:
        // Palha nas laterais bem coladas na espiga (soltas, pareciam asas) e
        // grãos só no terço de baixo, longe do rosto.
        '<path d="M30 54 C18 60 16 76 24 86 C34 80 34 64 34 56 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4.5" stroke-linejoin="round"/>'
        + '<path d="M70 54 C82 60 84 76 76 86 C66 80 66 64 66 56 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4.5" stroke-linejoin="round"/>'
        + '<ellipse cx="50" cy="54" rx="21" ry="32" fill="#F4C430" stroke="' + INK + '" stroke-width="5"/>'
        + '<g fill="' + INK + '" opacity=".22"><circle cx="42" cy="70" r="2.6"/><circle cx="58" cy="70" r="2.6"/>'
        + '<circle cx="50" cy="76" r="2.6"/><circle cx="42" cy="81" r="2.6"/><circle cx="58" cy="81" r="2.6"/></g>'
        + face(50, 50, 0.88),
    },
    {
      id: 'batata', nome: 'Bento Batata', alimento: 'Batata', dif: 2,
      art:
        '<path d="M24 56 C24 40 38 30 55 31 C72 32 80 44 78 59 C76 74 62 82 46 80 C32 78 24 68 24 56 Z"'
        + ' fill="#E0B978" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + '<g fill="' + INK + '" opacity=".26"><ellipse cx="34" cy="44" rx="3" ry="2.2"/><ellipse cx="68" cy="70" rx="3" ry="2.2"/>'
        + '<ellipse cx="70" cy="42" rx="2.6" ry="2"/></g>'
        + face(50, 56, 0.94) + blush(50, 56, 0.94),
    },
    {
      id: 'tomate', nome: 'Téo Tomate', alimento: 'Tomate', dif: 3,
      art:
        stem(50, 16, 26)
        + '<path d="M50 36 C44 30 36 28 28 28 C32 34 38 38 46 40 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M50 36 C56 30 64 28 72 28 C68 34 62 38 54 40 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<circle cx="50" cy="60" r="30" fill="#E8503A" stroke="' + INK + '" stroke-width="5"/>'
        + face(50, 58) + blush(50, 58),
    },
    {
      id: 'brocolis', nome: 'Bia Brócolis', alimento: 'Brócolis', dif: 3,
      art:
        // Copa em peça ÚNICA recortada, não círculos sobrepostos. Sobrepostos
        // funcionavam só preenchidos (um tampava o outro); na folha de colorir
        // o miolo é vazado e todos os cruzamentos apareciam, virando emaranhado.
        '<path d="M42 56 H58 V80 C58 86 54 90 50 90 C46 90 42 86 42 80 Z" fill="#A8CE96" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + '<path d="M24 58 Q14 50 20 40 Q16 28 30 26 Q34 14 46 20 Q52 12 60 20 Q72 15 76 27'
        + ' Q88 30 82 42 Q88 52 76 58 Z"'
        + ' fill="#5CA741" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + face(50, 42, 0.86),
    },
    {
      id: 'alface', nome: 'Aninha Alface', alimento: 'Alface', dif: 3,
      art:
        // Borda de cima ondulada (era um blob liso, não lia como folha) e
        // nervura só embaixo.
        '<path d="M20 56 C16 44 24 34 34 34 C36 26 48 24 50 32 C54 24 66 26 66 34 C78 34 84 44 80 56'
        + ' C84 72 68 86 50 86 C32 86 16 72 20 56 Z"'
        + ' fill="#5CA741" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        // Duas folhas de fora envolvendo o miolo, uma de cada lado, mais a
        // dobra de baixo. Sem isso sobra uma bolha redonda que, sem cor, vira
        // nuvem. São traço (não mancha), então sobrevivem à folha de colorir
        // de propósito: é o que faz a criança reconhecer que é alface.
        + '<path d="M30 38 C25 54 29 70 37 80" fill="none" stroke="' + INK + '" stroke-width="3" opacity=".3" stroke-linecap="round"/>'
        + '<path d="M70 38 C75 54 71 70 63 80" fill="none" stroke="' + INK + '" stroke-width="3" opacity=".3" stroke-linecap="round"/>'
        + '<path d="M32 72 C38 68 44 70 50 74 C56 70 62 68 68 72" fill="none" stroke="' + INK + '" stroke-width="3" opacity=".3" stroke-linecap="round"/>'
        + face(50, 54, 0.88) + blush(50, 54, 0.88),
    },
    {
      id: 'abobrinha', nome: 'Aldo Abobrinha', alimento: 'Abobrinha', dif: 3,
      art:
        '<path d="M70 20 C74 22 74 28 70 30" fill="none" stroke="#3C7A2C" stroke-width="6" stroke-linecap="round"/>'
        + '<path d="M30 74 C20 64 26 44 42 34 C58 24 76 26 80 36 C84 46 76 62 60 72 C46 80 36 80 30 74 Z"'
        + ' fill="#5CA741" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + '<path d="M40 62 C46 54 56 46 68 42" fill="none" stroke="' + INK + '" stroke-width="3" opacity=".3" stroke-linecap="round"/>'
        + face(52, 52, 0.86),
    },
    {
      id: 'ervilha', nome: 'Edu Ervilha', alimento: 'Ervilha', dif: 3,
      art:
        // Vagem na horizontal (era diagonal, e as ervilhas subiam em cima do
        // rosto). Rosto na parte de cima, ervilhas enfileiradas embaixo.
        // Vagem com as duas pontas em bico. Era um oval de cantos redondos, que
        // sem cor lia como pãozinho; vagem é pontuda nas pontas.
        '<path d="M10 52 C20 34 36 28 50 28 C64 28 80 34 90 52 C80 70 64 76 50 76 C36 76 20 70 10 52 Z"'
        + ' fill="#A8CE96" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + '<g fill="#5CA741" stroke="' + INK + '" stroke-width="4">'
        + '<circle cx="34" cy="62" r="8"/><circle cx="50" cy="63" r="8"/><circle cx="66" cy="62" r="8"/>'
        + '</g>'
        + face(50, 43, 0.78),
    },
    {
      id: 'pimentao', nome: 'Pilar Pimentão', alimento: 'Pimentão', dif: 4,
      art:
        stem(50, 16, 30) + leaf(52, 22, false)
        + '<path d="M50 32 C36 32 24 44 24 60 C24 78 34 88 42 88 C46 88 48 84 50 84 C52 84 54 88 58 88 C66 88 76 78 76 60 C76 44 64 32 50 32 Z"'
        + ' fill="#E8503A" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + face(50, 58) + blush(50, 58),
    },
    {
      id: 'beterraba', nome: 'Bruna Beterraba', alimento: 'Beterraba', dif: 4,
      art:
        '<path d="M50 38 C46 26 38 18 28 16 C30 28 38 36 46 40 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M50 38 C54 26 62 18 72 16 C70 28 62 36 54 40 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M50 38 C64 38 74 48 74 62 C74 78 62 90 50 90 C38 90 26 78 26 62 C26 48 36 38 50 38 Z"'
        + ' fill="#9C4372" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + face(50, 62, 0.9),
    },
    {
      id: 'berinjela', nome: 'Bernardo Berinjela', alimento: 'Berinjela', dif: 4,
      art:
        stem(50, 14, 26)
        + '<path d="M50 34 C42 28 34 26 26 28 C30 36 38 40 46 40 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<path d="M50 34 C58 28 66 26 74 28 C70 36 62 40 54 40 Z" fill="#5CA741" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>'
        + '<ellipse cx="50" cy="64" rx="25" ry="27" fill="#6B4E8C" stroke="' + INK + '" stroke-width="5"/>'
        + face(50, 62, 0.92),
    },
    {
      id: 'feijao', nome: 'Fabi Feijão', alimento: 'Feijão', dif: 4,
      art:
        '<path d="M62 24 C76 30 82 48 74 62 C66 78 46 82 36 72 C28 64 32 54 40 52 C48 50 50 44 46 38 C42 30 52 20 62 24 Z"'
        + ' fill="#C98B5E" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>'
        + face(58, 50, 0.82) + blush(58, 50, 0.82),
    },
  ];

  // Silhueta do bloqueado: mesmo desenho, só que sem cor. Mantém o contorno
  // (a criança reconhece a forma) mas deixa claro que ainda não é dela.
  function svgFor(amigo, locked) {
    var art = amigo.art;
    if (locked) {
      // Apaga a cor de fill E de stroke numa passada só. Tem que cobrir os
      // dois porque nem todo personagem tem a cor no `fill`: uma regra que só
      // olhasse fill deixaria um desenho feito de traço colorido aceso no meio
      // dos bloqueados.
      // Contorno e traço escuro viram cinza médio (a silhueta continua
      // legível); qualquer cor de alimento vira cinza claro (o "vazio").
      art = art.replace(/(fill|stroke)="(#[0-9A-Fa-f]{3,8})"/g, function (_, attr, hex) {
        var up = hex.toUpperCase();
        var escuro = up === '#26302A' || up === '#3C7A2C';
        if (attr === 'stroke') return 'stroke="' + (escuro ? '#B4BAB1' : '#DCE0D8') + '"';
        return 'fill="' + (escuro ? '#C9CEC6' : '#DCE0D8') + '"';
      });
    }
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + art + '</svg>';
  }

  /* ---------- MODO PINTAR (colorir na tela) ----------
   * A mesma arte virada folha de colorir em branco, pra criança pintar com o
   * dedo por cima. Existe porque as folhas impressas do Bloco 10 só servem
   * com impressora, e boa parte das mães não tem uma em casa.
   *
   * São três peças empilhadas pelo mi-kit.html, nesta ordem:
   *   paintSvgFor   -> a folha em branco (miolo branco), lá embaixo;
   *   [canvas]      -> a tinta do dedo, recortada por maskSvgFor;
   *   lineArtSvgFor -> só o traço preto, com o miolo VAZADO, por cima de tudo.
   *
   * A tinta passar por BAIXO do traço é o que mantém o contorno intacto. A
   * primeira versão fazia o contrário (canvas por cima em multiply) e o preto
   * do desenho encardia: contorno aqui é #26302A, não preto puro, então
   * multiply tingia ele da cor da tinta (verde deixava a linha esverdeada).
   *
   * maskSvgFor recorta a tinta na silhueta, então rabisco nenhum escapa pro
   * fundo da página. Pintar de branco continua funcionando como borracha,
   * porque branco é a cor da própria folha.
   */

  // Traço fino colorido (o cabinho) é linha de desenho e vira preto. Traço
  // GROSSO seria a própria silhueta (corpo desenhado como traço, não como
  // forma preenchida), e aí o branco tem que ir pro stroke.
  //
  // Hoje NENHUM dos 20 é assim: a banana era, e virou forma preenchida quando
  // ganhou pontas em bico. O tratamento continua aqui como rede de segurança
  // — sem ele, um personagem novo desenhado a traço grosso viraria uma mancha
  // preta sólida na folha de colorir, em silêncio.
  var TRACO_SILHUETA = 20;

  // Enfeite que já vem pintado de fábrica (bochecha, grãos do milho,
  // marquinhas da batata) não existe em folha de colorir e sai antes de tudo.
  //
  // Tem que sair o GRUPO INTEIRO quando o opacity está num <g>: apagar só a
  // tag de abertura deixa os filhos soltos e um </g> órfão. SVG dentro de data
  // URI é XML de verdade, e uma tag sobrando invalida o arquivo inteiro — foi
  // assim que a máscara do Miguel Milho e do Bento Batata parou de carregar,
  // o canvas ficou recortado a nada e os dois ficaram impossíveis de pintar.
  //
  // Sai só o que é PINTADO. Linha translúcida fica: na alface é a textura que
  // faz ela parecer alface, e sem ela sobra uma bolha sem identidade nenhuma.
  function semEnfeites(art) {
    // Translúcido em COR (a bochecha) é enfeite de rosto e sai.
    // Translúcido em tom de traço é textura do próprio alimento (grãos do
    // milho, marquinhas da batata) e FICA: sem eles o milho vira um ovo com
    // folhas e a batata vira uma bolha, nenhum dos dois reconhecível.
    // Traço puro (fill="none") também fica: gomos da laranja, riscos do
    // abacaxi e da abobrinha, folhas da alface.
    var grupoEnfeite = new RegExp('<g\\b(?![^>]*fill="' + INK + '")[^>]*\\bopacity=[^>]*>[\\s\\S]*?</g>', 'gi');
    var soltoEnfeite = new RegExp('<[a-z]+\\b(?![^>]*fill="none")(?![^>]*fill="' + INK + '")[^>]*\\bopacity=[^>]*?>', 'gi');
    return art.replace(grupoEnfeite, '').replace(soltoEnfeite, '');
  }

  function paraFolha(tag) {
    var fill = (tag.match(/fill="(#[0-9A-Fa-f]{3,8})"/) || [])[1];
    var stroke = (tag.match(/stroke="(#[0-9A-Fa-f]{3,8})"/) || [])[1];
    var largura = Number((tag.match(/stroke-width="([\d.]+)"/) || [])[1] || 0);
    var fillColorido = !!fill && fill.toUpperCase() !== INK;
    var strokeColorido = !!stroke && stroke.toUpperCase() !== INK;
    var alvo = fillColorido ? 'fill' : (strokeColorido && largura >= TRACO_SILHUETA ? 'stroke' : null);

    var out = tag;
    if (strokeColorido && alvo !== 'stroke') {
      out = out.replace(/stroke="#[0-9A-Fa-f]{3,8}"/, 'stroke="' + INK + '"');
    }
    if (!alvo) return out;
    return out.replace(new RegExp(alvo + '="#[0-9A-Fa-f]{3,8}"'), alvo + '="#FFFFFF"');
  }

  function paintSvgFor(amigo) {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      + semEnfeites(amigo.art).replace(/<[a-z]+[^>]*>/gi, paraFolha) + '</svg>';
  }

  // Silhueta cheia (tudo preto opaco, fundo transparente). Vira máscara do
  // canvas: onde é preto a tinta aparece, fora dali some. `fill="none"` fica
  // como está de propósito, senão um corpo desenhado a traço grosso sumiria
  // da máscara e não daria pra pintar.
  function maskSvgFor(amigo) {
    var art = semEnfeites(amigo.art).replace(/(fill|stroke)="#[0-9A-Fa-f]{3,8}"/g, '$1="#000000"');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">' + art + '</svg>';
  }

  function atributos(tag) {
    return {
      fill: (tag.match(/fill="(#[0-9A-Fa-f]{3,8})"/) || [])[1],
      stroke: (tag.match(/stroke="(#[0-9A-Fa-f]{3,8})"/) || [])[1],
      largura: Number((tag.match(/stroke-width="([\d.]+)"/) || [])[1] || 0),
      d: (tag.match(/\sd="([^"]+)"/) || [])[1],
    };
  }

  // É silhueta feita de traço (e não de forma preenchida)? Nenhum dos 20 é
  // assim hoje; ver a nota em TRACO_SILHUETA.
  function ehTracoSilhueta(a) {
    return !a.fill && !!a.stroke && a.stroke.toUpperCase() !== INK && a.largura >= TRACO_SILHUETA;
  }

  // Contador global das máscaras. Cada chamada gera ids novos porque o mesmo
  // amigo aparece mais de uma vez na tela (miniatura + palco): com id repetido
  // o navegador resolve pela PRIMEIRA ocorrência, que pode estar dentro de um
  // container display:none, e aí a máscara não aplica e o desenho vira uma
  // mancha preta sólida.
  var seqMascara = 0;

  // Só as linhas pretas, com todo miolo colorido vazado, pra tinta de baixo
  // aparecer pelos buracos. Fica POR CIMA do canvas.
  function lineArtSvgFor(amigo) {
    var base = semEnfeites(amigo.art);
    var vazados = {};
    base.replace(/<[a-z]+[^>]*>/gi, function (tag) {
      var a = atributos(tag);
      if (a.d && ehTracoSilhueta(a)) {
        vazados[a.d] = { largura: a.largura, id: 'kplm' + (seqMascara++) };
      }
      return tag;
    });

    var defs = '';
    var art = base.replace(/<[a-z]+[^>]*>/gi, function (tag) {
      // A textura translúcida existe pra dar sombreado no desenho colorido, e
      // nessa opacidade quase some no branco da folha. Aqui ela é justamente o
      // que identifica o alimento (grão do milho, gomo da laranja), então
      // aparece mais forte.
      tag = tag.replace(/opacity="0?\.[0-3]\d*"/, 'opacity=".45"');
      var a = atributos(tag);
      // O traço colorido grosso É o corpo: some daqui, quem preenche é a tinta.
      if (ehTracoSilhueta(a)) return '';

      var out = tag;
      if (a.stroke && a.stroke.toUpperCase() !== INK) {
        out = out.replace(/stroke="#[0-9A-Fa-f]{3,8}"/, 'stroke="' + INK + '"');
      }
      if (a.fill && a.fill.toUpperCase() !== INK) {
        out = out.replace(/fill="#[0-9A-Fa-f]{3,8}"/, 'fill="none"');
        // Detalhe pintado que não tinha contorno próprio sumiria ao ser
        // vazado: as sementinhas do morango eram da cor do fundo, então
        // viravam nada. Ganham traço pra criança pintar ou deixar em branco.
        if (!a.stroke) {
          out = out.replace(/^<([a-z]+)/i, '<$1 stroke="' + INK + '" stroke-width="3"');
        }
      }

      // Corpo feito de traço vem em dupla: um traço preto mais grosso por
      // baixo fazendo de contorno, o colorido por cima. Sem o colorido, o
      // preto sozinho vira mancha sólida, então vaza-se o meio dele pra
      // sobrar só a borda.
      var vazado = a.d && vazados[a.d];
      if (vazado && a.stroke && a.stroke.toUpperCase() === INK) {
        defs += '<mask id="' + vazado.id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">'
          + '<rect x="0" y="0" width="100" height="100" fill="#FFFFFF"/>'
          + '<path d="' + a.d + '" fill="none" stroke="#000000" stroke-width="' + vazado.largura + '" stroke-linecap="round"/>'
          + '</mask>';
        out = out.replace(/^<([a-z]+)/i, '<$1 mask="url(#' + vazado.id + ')"');
      }
      return out;
    });

    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      + (defs ? '<defs>' + defs + '</defs>' : '') + art + '</svg>';
  }

  global.KPL_AMIGOS = {
    list: AMIGOS, svgFor: svgFor,
    paintSvgFor: paintSvgFor, maskSvgFor: maskSvgFor, lineArtSvgFor: lineArtSvgFor,
  };
})(window);
