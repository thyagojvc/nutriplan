// Resultados reais de pacientes (fotos com consentimento por escrito).
//
// Cópia deliberada da lista que vive na /preview: o /mi-plan roda como teste
// paralelo e não pode obrigar a página que converte hoje a mudar junto. Se um
// dia os dois convergirem, isto vira um módulo compartilhado.
//
// A ordem aqui é diferente da /preview de propósito. Lá a lista aparece no meio
// de uma leitura longa; aqui ela é a SEGUNDA aba, tocada logo depois de ver o
// próprio plano. Então abre pela Fernanda: a fala dela é a única que responde à
// dúvida exata de quem acabou de ver o plano e não pagou ("pensé que tal vez no
// iba a funcionar para mí"). Camila, que tem o maior número, vem em segundo.

export interface ResultCase {
  photo: string
  name: string
  country: string
  age: number
  result: string
  w: number
  h: number
  quote: string
}

export const RESULTS: ResultCase[] = [
  {
    photo: '/resultados/caso-3.png', name: 'Fernanda', country: '🇨🇱', age: 29,
    result: '−7 kg en 3 meses', w: 402, h: 430,
    quote: 'Lo pensé mucho antes de comprar porque creía que tal vez no iba a funcionar para mí. Pero cuando empecé a usarlo descubrí que no hacía falta ningún milagro para bajar de peso, solo seguir una dieta armada especialmente para mi rutina y para mi cuerpo. Cuando entendí eso, el resultado llegó rápido y de forma natural.',
  },
  {
    photo: '/resultados/caso-1.png', name: 'Camila', country: '🇲🇽', age: 38,
    result: '−17 kg en 8 meses', w: 414, h: 444,
    quote: 'Pagar un nutricionista y un entrenador por separado no me alcanzaba. Aquí tuve las dos cosas juntas y hechas para mí. En el primer mes ya había bajado 3 kilos, y lo mejor fue dejar de sentirme culpable cada vez que comía algo.',
  },
  {
    photo: '/resultados/caso-4.png', name: 'Carolina', country: '🇪🇸', age: 42,
    result: '−10 kg en 4 meses', w: 407, h: 436,
    quote: 'Lo que más me gustó de la Calibración Metabólica fue que la dieta está basada en cosas que me gustan y que ya compro en el día a día. No tuve que buscar alimentos ni suplementos difíciles de conseguir, y me sentí mucho más joven.',
  },
  {
    photo: '/resultados/caso-5.png', name: 'Yuliana R.', country: '🇨🇴', age: 27,
    result: '−11 kg en 9 meses', w: 640, h: 842,
    quote: 'Nunca imaginé que en 9 meses iba a conseguir el cuerpo de mis sueños. Hoy estoy en mi mejor etapa. No sabía los secretos para quemar grasa más rápido y acelerar el metabolismo, y por eso no tenía motivación ni para alimentarme bien ni para entrenar. Después de conocer a la doctora María Fernanda mi vida cambió completamente y estoy muy agradecida por todo.',
  },
  {
    photo: '/resultados/caso-2.png', name: 'Noelia', country: '🇵🇾', age: 42,
    result: '−8 kg en 3 meses', w: 1080, h: 1350,
    quote: 'Me quedé asombrada cuando empecé mi Calibración Metabólica. Además de bajar el peso en la balanza, estos secretos ayudan a moldear el cuerpo, y eso hizo que mi cara y mi cuello se afinaran, que eran áreas que me incomodaban y de las que tenía vergüenza. Solo tengo que agradecer a todo el equipo del método y, especialmente, a la doctora María Fernanda.',
  },
]
