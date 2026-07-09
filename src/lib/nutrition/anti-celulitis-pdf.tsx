// =============================================================================
// NutriPlan — Guía Anti-Celulitis
// Documento estático, incluido en todos los tiers (bônus del plan base).
// Contenido basado en hábitos reales (hidratación, alimentación, movimiento),
// sin prometer "cura": celulitis es estructural, la dieta ayuda su apariencia.
// Escrito con voz de nutricionista real, expectativas honestas (evita claims
// prohibidos de Meta Ads: nada de "elimina", "cura", "desaparece").
// =============================================================================

import {
  Document,
  Page,
  Text,
  View,
  Svg,
  Path,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

const TOTAL_PAGES = 6

const c = {
  greenDeep: '#1E6340',
  primary: '#226D45',
  mint: '#A7E8C4',
  cream: '#F5FAF2',
  softBg: '#EEF6EA',
  ink: '#1A2E22',
  text: '#2B3A30',
  muted: '#6B7B70',
  border: '#D8E8D4',
  white: '#FFFFFF',
  coral: '#D85A30',
  coralLight: '#FFF0EB',
}

function Leaf({ size, leaf = c.white, vein = c.greenDeep }: { size: number; leaf?: string; vein?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5C7.5 2.5 3.5 6.8 3.5 12C3.5 16.4 6.2 20 10 21.8L12 22.5L14 21.8C17.8 20 20.5 16.4 20.5 12C20.5 6.8 16.5 2.5 12 2.5Z"
        fill={leaf}
      />
      <Path d="M12 21.5V11.5" stroke={vein} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M12 17.5L9 14.5" stroke={vein} strokeWidth={1.1} strokeLinecap="round" />
      <Path d="M12 14.5L15 11.5" stroke={vein} strokeWidth={1.1} strokeLinecap="round" />
    </Svg>
  )
}

const s = StyleSheet.create({
  coverPage: { fontSize: 10, color: c.text, fontFamily: 'Helvetica', backgroundColor: c.white },
  page: { paddingTop: 30, paddingBottom: 46, paddingHorizontal: 40, fontSize: 10, color: c.text, fontFamily: 'Helvetica', backgroundColor: c.white },

  // Capa
  coverHero: { backgroundColor: c.greenDeep, paddingTop: 64, paddingBottom: 54, paddingHorizontal: 44, alignItems: 'center' },
  coverBadge: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  coverWordmark: { fontSize: 11, color: c.mint, marginBottom: 10, letterSpacing: 1 },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: c.white, textAlign: 'center', lineHeight: 1.2, marginBottom: 8 },
  coverSubtitle: { fontSize: 13, color: c.mint, textAlign: 'center', lineHeight: 1.4 },
  coverDivider: { width: 48, height: 3, backgroundColor: c.mint, borderRadius: 2, marginVertical: 18 },
  coverBody: { paddingHorizontal: 44, paddingTop: 34 },
  coverIntro: { fontSize: 12, lineHeight: 1.65, color: c.text, marginBottom: 18 },
  coverNote: { backgroundColor: c.softBg, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: c.primary, padding: 12, marginTop: 4 },
  coverNoteText: { fontSize: 10, lineHeight: 1.5, color: c.text },
  coverToc: { marginTop: 22 },
  coverTocTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  coverTocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  coverTocNum: { width: 18, height: 18, borderRadius: 9, backgroundColor: c.softBg, color: c.primary, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 4.5, marginRight: 8 },
  coverTocText: { fontSize: 10.5, color: c.text },

  // Cabeçalho de página
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageHeaderTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.ink },

  // Título grande de cada página
  chapterKicker: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  chapterTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: c.ink, lineHeight: 1.2, marginBottom: 12 },
  lead: { fontSize: 11, lineHeight: 1.6, color: c.text, marginBottom: 14 },
  paragraph: { fontSize: 10, lineHeight: 1.6, color: c.text, marginBottom: 10 },

  // Card de seção
  sectionCard: { borderWidth: 1, borderColor: c.border, borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  sectionHeader: { backgroundColor: c.softBg, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeaderCoral: { backgroundColor: c.coralLight, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.ink },
  sectionBody: { padding: 12 },

  itemRow: { flexDirection: 'row', marginBottom: 7, alignItems: 'flex-start' },
  bullet: { color: c.primary, fontFamily: 'Helvetica-Bold', marginRight: 6, fontSize: 10 },
  avoidBullet: { color: c.coral, fontFamily: 'Helvetica-Bold', marginRight: 6, fontSize: 10 },
  itemBold: { fontFamily: 'Helvetica-Bold', color: c.ink },
  itemText: { fontSize: 9.5, color: c.text, flex: 1, lineHeight: 1.5 },
  shopLine: { fontSize: 9.5, color: c.text, lineHeight: 1.5, marginBottom: 5 },

  // Numerada (hábitos)
  numRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start' },
  numBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, color: c.white, fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 5, marginRight: 8, flexShrink: 0 },
  numBody: { flex: 1 },
  numTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: c.ink, marginBottom: 2 },
  numText: { fontSize: 9.5, color: c.text, lineHeight: 1.5 },

  // Mito vs realidad
  mythCard: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  mythCol: { flex: 1, borderRadius: 8, padding: 10 },
  mythColBad: { backgroundColor: c.coralLight, borderWidth: 1, borderColor: '#F2D4C8' },
  mythColGood: { backgroundColor: c.softBg, borderWidth: 1, borderColor: c.border },
  mythLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  mythText: { fontSize: 9, lineHeight: 1.5, color: c.text },

  // Checklist (plano 4 semanas)
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  checkBox: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.4, borderColor: c.primary, marginRight: 8, marginTop: 1, flexShrink: 0 },
  checkText: { fontSize: 10, color: c.text, flex: 1, lineHeight: 1.45 },

  // Destaque de dado / estatística
  statBand: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: c.softBg, borderRadius: 8, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: c.greenDeep, marginBottom: 2 },
  statLabel: { fontSize: 8.5, color: c.muted, textAlign: 'center', lineHeight: 1.3 },

  tipBox: { backgroundColor: '#FFFBEA', borderRadius: 6, borderLeftWidth: 2.5, borderLeftColor: '#D79A33', paddingVertical: 8, paddingHorizontal: 10, marginTop: 4 },
  tipLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#8A6D1A', marginBottom: 2 },
  tipText: { fontSize: 9, color: c.text, lineHeight: 1.5 },

  disclaimerBox: { backgroundColor: '#FFF7F3', borderRadius: 8, borderWidth: 1, borderColor: '#F2D4C8', padding: 12, marginTop: 12 },
  disclaimerText: { fontSize: 8.5, color: '#7A5A48', lineHeight: 1.5 },

  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: c.border, paddingTop: 8 },
  footerText: { fontSize: 8, color: c.muted },
})

// ---------------------------------------------------------------------------
// Sub-componentes reutilizáveis
// ---------------------------------------------------------------------------

function PageFooter({ pageNum }: { pageNum: number }) {
  return (
    <View style={s.footer} fixed>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Leaf size={10} leaf={c.primary} vein={c.mint} />
        <Text style={s.footerText}>NutriPlan · Guía Anti-Celulitis</Text>
      </View>
      <Text style={s.footerText}>{pageNum} / {TOTAL_PAGES}</Text>
    </View>
  )
}

function PageHead() {
  return (
    <View style={s.pageHeader}>
      <View style={s.pageHeaderLeft}>
        <Leaf size={14} leaf={c.primary} vein={c.mint} />
        <Text style={s.pageHeaderTitle}>NutriPlan · Guía Anti-Celulitis</Text>
      </View>
      <Text style={{ fontSize: 9, color: c.muted }}>nutriplan.app</Text>
    </View>
  )
}

function Chapter({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View>
      <Text style={s.chapterKicker}>{kicker}</Text>
      <Text style={s.chapterTitle}>{title}</Text>
    </View>
  )
}

function GoodItem({ b, t }: { b: string; t: string }) {
  return (
    <View style={s.itemRow}>
      <Text style={s.bullet}>✓</Text>
      <Text style={s.itemText}><Text style={s.itemBold}>{b}</Text>{t}</Text>
    </View>
  )
}

function BadItem({ b, t }: { b: string; t: string }) {
  return (
    <View style={s.itemRow}>
      <Text style={s.avoidBullet}>✕</Text>
      <Text style={s.itemText}><Text style={s.itemBold}>{b}</Text>{t}</Text>
    </View>
  )
}

function NumberedHabit({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <View style={s.numRow}>
      <Text style={s.numBadge}>{n}</Text>
      <View style={s.numBody}>
        <Text style={s.numTitle}>{title}</Text>
        <Text style={s.numText}>{text}</Text>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------

function CoverPage() {
  const toc = [
    'Entiende tu celulitis (sin culpas)',
    'Alimentación que mejora tu piel',
    'Lo que empeora su apariencia',
    'Movimiento y circulación en casa',
    'Tu plan de 4 semanas',
  ]
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverHero}>
        <View style={s.coverBadge}>
          <Leaf size={44} leaf={c.primary} vein={c.mint} />
        </View>
        <Text style={s.coverWordmark}>NutriPlan</Text>
        <Text style={s.coverTitle}>Guía{'\n'}Anti-Celulitis</Text>
        <View style={s.coverDivider} />
        <Text style={s.coverSubtitle}>Hábitos reales de alimentación, hidratación{'\n'}y movimiento para mejorar tu piel</Text>
      </View>

      <View style={s.coverBody}>
        <Text style={s.coverIntro}>
          La celulitis es un rasgo estructural de la piel que tienen la mayoría de las mujeres,
          no una enfermedad ni un fracaso tuyo, y no desaparece por completo solo con dieta.
          Pero hay tres cosas que sí puedes influir con tus hábitos: la retención de líquidos,
          la inflamación y la circulación. Esta guía reúne, en un lenguaje claro, lo que de
          verdad se nota con el tiempo.
        </Text>

        <View style={s.coverToc}>
          <Text style={s.coverTocTitle}>Lo que vas a encontrar</Text>
          {toc.map((item, i) => (
            <View key={i} style={s.coverTocRow}>
              <Text style={s.coverTocNum}>{i + 1}</Text>
              <Text style={s.coverTocText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={s.coverNote}>
          <Text style={s.coverNoteText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Importante: </Text>
            esta guía es un complemento a tu plan nutricional. No sustituye la evaluación de un
            profesional de la salud si tienes una condición específica de piel o circulación.
          </Text>
        </View>
      </View>

      <PageFooter pageNum={1} />
    </Page>
  )
}

function Page2Understand() {
  return (
    <Page size="A4" style={s.page}>
      <PageHead />
      <Chapter kicker="Capítulo 1" title="Entiende tu celulitis (sin culpas)" />

      <Text style={s.lead}>
        Antes de cambiar cualquier hábito, vale la pena entender qué estás viendo cuando aparece
        el famoso &quot;efecto piel de naranja&quot;. Cuando lo entiendes, dejas de perseguir promesas
        imposibles y te enfocas en lo que de verdad mueve la aguja.
      </Text>

      <View style={s.statBand}>
        <View style={s.statBox}>
          <Text style={s.statNum}>8–9</Text>
          <Text style={s.statLabel}>de cada 10 mujeres{'\n'}tienen celulitis</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>3</Text>
          <Text style={s.statLabel}>factores que{'\n'}SÍ controlas</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>0</Text>
          <Text style={s.statLabel}>relación con tu{'\n'}fuerza de voluntad</Text>
        </View>
      </View>

      <Text style={s.paragraph}>
        La celulitis aparece cuando las células de grasa que están debajo de la piel empujan
        contra las bandas de tejido conectivo que las sostienen. Esas bandas jalan hacia adentro
        y la grasa se abulta hacia afuera, creando los hoyuelos. En las mujeres, esas bandas se
        organizan en columnas verticales, por eso se marca más que en los hombres. Es anatomía,
        y en buena parte, genética y hormonas (sobre todo el estrógeno). Nada de eso es culpa tuya.
      </Text>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.sectionTitle}>Los 3 factores que sí puedes influir</Text>
        </View>
        <View style={s.sectionBody}>
          <GoodItem b="Retención de líquidos: " t="cuando tu cuerpo retiene agua bajo la piel, los abultamientos se ven más marcados. Es el factor que cambia más rápido con hidratación y menos sodio." />
          <GoodItem b="Inflamación: " t="una alimentación alta en ultraprocesados y azúcar mantiene una inflamación baja pero constante que empeora el aspecto de la piel." />
          <GoodItem b="Circulación y firmeza: " t="mejor circulación en piernas y glúteos, más colágeno y algo de tono muscular hacen que la piel se vea más lisa y firme." />
        </View>
      </View>

      <View style={s.mythCard}>
        <View style={[s.mythCol, s.mythColBad]}>
          <Text style={[s.mythLabel, { color: c.coral }]}>El mito</Text>
          <Text style={s.mythText}>
            &quot;Si me esfuerzo lo suficiente, la celulitis desaparece por completo.&quot;
          </Text>
        </View>
        <View style={[s.mythCol, s.mythColGood]}>
          <Text style={[s.mythLabel, { color: c.primary }]}>La realidad</Text>
          <Text style={s.mythText}>
            Con buenos hábitos su apariencia mejora de forma real y sostenible. Buscar que
            &quot;desaparezca&quot; solo lleva a frustración y a gastar en promesas falsas.
          </Text>
        </View>
      </View>

      <View style={s.tipBox}>
        <Text style={s.tipLabel}>La mirada de tu nutricionista</Text>
        <Text style={s.tipText}>
          El objetivo no es un cuerpo &quot;perfecto&quot;, es una piel más firme, menos retención y
          sentirte mejor con la que tienes. Eso sí es alcanzable, y lo construyes con los
          capítulos que siguen.
        </Text>
      </View>

      <PageFooter pageNum={2} />
    </Page>
  )
}

function Page3Food() {
  return (
    <Page size="A4" style={s.page}>
      <PageHead />
      <Chapter kicker="Capítulo 2" title="Alimentación que mejora tu piel" />

      <Text style={s.lead}>
        No existe un alimento mágico, pero sí un patrón de alimentación que reduce retención,
        baja inflamación y le da a tu piel el material para verse más firme. Estos son los pilares.
      </Text>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.sectionTitle}>Prioriza cada día</Text>
        </View>
        <View style={s.sectionBody}>
          <GoodItem b="Agua, entre 2 y 2.5 L: " t="parece contradictorio, pero cuanto mejor hidratada estás, menos líquido retiene tu cuerpo. Es el hábito con efecto más rápido y visible." />
          <GoodItem b="Potasio: " t="plátano, aguacate, espinaca, tomate y agua de coco ayudan a equilibrar el sodio y a soltar la retención de líquidos." />
          <GoodItem b="Proteína en cada comida: " t="huevo, pollo, pescado, lácteos y legumbres aportan los aminoácidos con los que tu cuerpo fabrica el colágeno que da firmeza a la piel." />
          <GoodItem b="Vitamina C: " t="cítricos, kiwi, fresas y pimiento potencian esa producción de colágeno. Combínalos con tu proteína del día." />
          <GoodItem b="Fibra: " t="verduras, frutas con cáscara y granos enteros mejoran la digestión y reducen la inflamación de fondo." />
          <GoodItem b="Antioxidantes y omega-3: " t="frutos rojos, té verde, salmón y nueces protegen el colágeno del daño y ayudan a controlar la inflamación." />
        </View>
      </View>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.sectionTitle}>Tu lista de compras &quot;piel firme&quot;</Text>
        </View>
        <View style={s.sectionBody}>
          <Text style={s.shopLine}>
            <Text style={s.itemBold}>Proteínas: </Text>huevo, pechuga de pollo, pescado blanco, salmón, yogur griego, lentejas.
          </Text>
          <Text style={s.shopLine}>
            <Text style={s.itemBold}>Vegetales: </Text>espinaca, brócoli, pimiento, tomate, pepino, apio.
          </Text>
          <Text style={s.shopLine}>
            <Text style={s.itemBold}>Frutas: </Text>fresas y frutos rojos, kiwi, naranja, plátano, piña.
          </Text>
          <Text style={[s.shopLine, { marginBottom: 0 }]}>
            <Text style={s.itemBold}>Grasas buenas: </Text>aguacate, aceite de oliva, nueces y almendras.
          </Text>
        </View>
      </View>

      <View style={s.tipBox}>
        <Text style={s.tipLabel}>La mirada de tu nutricionista</Text>
        <Text style={s.tipText}>
          Empieza el día con un vaso de agua antes que con café, y suma una fuente de proteína
          y una de vitamina C en el desayuno. Es un cambio pequeño que activa los dos pilares
          más importantes desde temprano.
        </Text>
      </View>

      <PageFooter pageNum={3} />
    </Page>
  )
}

function Page4Avoid() {
  return (
    <Page size="A4" style={s.page}>
      <PageHead />
      <Chapter kicker="Capítulo 3" title="Lo que empeora su apariencia" />

      <Text style={s.lead}>
        Tan importante como sumar buenos hábitos es reducir los que trabajan en tu contra. No se
        trata de prohibir, sino de bajar la frecuencia de lo que retiene líquido e inflama.
      </Text>

      <View style={s.sectionCard}>
        <View style={s.sectionHeaderCoral}>
          <Leaf size={14} leaf={c.coral} vein={c.mint} />
          <Text style={s.sectionTitle}>Reduce la frecuencia</Text>
        </View>
        <View style={s.sectionBody}>
          <BadItem b="Exceso de sodio: " t="ultraprocesados, embutidos, sopas de sobre y snacks salados retienen líquido bajo la piel. Cocinar en casa baja el sodio a la mitad casi sin darte cuenta." />
          <BadItem b="Azúcar y harinas refinadas: " t="el exceso de azúcar daña el colágeno mediante un proceso llamado glicación, restándole firmeza a la piel con el tiempo." />
          <BadItem b="Alcohol frecuente: " t="deshidrata e inflama, revirtiendo justo el efecto de toda tu hidratación del día." />
          <BadItem b="Tabaco: " t="reduce la circulación y degrada el colágeno; es uno de los factores que más empeora la calidad de la piel." />
          <BadItem b="Muchas horas sentada: " t="estar sentada sin moverte reduce la circulación en piernas y glúteos, justo las zonas donde más se marca." />
        </View>
      </View>

      <Text style={s.paragraph}>
        No necesitas eliminar nada por completo. La regla realista es la del 80/20: si el 80 % de
        la semana comes según tu plan y cuidas estos puntos, el 20 % restante no arruina tu progreso.
        La constancia le gana a la perfección siempre.
      </Text>

      <View style={s.tipBox}>
        <Text style={s.tipLabel}>La mirada de tu nutricionista</Text>
        <Text style={s.tipText}>
          Revisa las etiquetas por el sodio, no solo por las calorías. Un producto puede ser
          &quot;light&quot; y aun así tener una carga de sal enorme. Menos de 400 mg de sodio por
          porción es una buena referencia.
        </Text>
      </View>

      <PageFooter pageNum={4} />
    </Page>
  )
}

function Page5Movement() {
  return (
    <Page size="A4" style={s.page}>
      <PageHead />
      <Chapter kicker="Capítulo 4" title="Movimiento y circulación en casa" />

      <Text style={s.lead}>
        No necesitas gimnasio ni horas libres. Estos hábitos de movimiento mejoran la circulación
        de piernas y glúteos, y con el tiempo aportan algo de tono muscular que hace que la piel
        se vea más lisa. Elige dos o tres para empezar.
      </Text>

      <NumberedHabit
        n={1}
        title="Camina 20–30 minutos al día"
        text="Es el ejercicio más subestimado para la circulación de las piernas. Sirve caminar al trabajo, con música o mientras hablas por teléfono."
      />
      <NumberedHabit
        n={2}
        title="Sube escaleras siempre que puedas"
        text="Cambiar el ascensor por las escaleras activa glúteos y muslos varias veces al día, sin robarte tiempo extra."
      />
      <NumberedHabit
        n={3}
        title="Fuerza de piernas 2–3 veces por semana"
        text="Sentadillas, puentes de glúteo y zancadas en casa, sin peso, 3 series de 12. El tono muscular es lo que da soporte a la piel desde adentro."
      />
      <NumberedHabit
        n={4}
        title="Levántate cada hora"
        text="Si trabajas sentada, pon una alarma cada 60 minutos y camina 2 minutos. Rompe el estancamiento de la circulación en las piernas."
      />
      <NumberedHabit
        n={5}
        title="Eleva las piernas al final del día"
        text="10 minutos con las piernas apoyadas contra la pared ayudan al retorno venoso y a desinflamar después de un día de pie o sentada."
      />
      <NumberedHabit
        n={6}
        title="Cepillado en seco y agua fría"
        text="Cepillar la piel en seco hacia el corazón antes de la ducha, y terminar con agua fría en las piernas, estimula la microcirculación. Es un extra, no un milagro."
      />

      <View style={s.tipBox}>
        <Text style={s.tipLabel}>La mirada de tu nutricionista</Text>
        <Text style={s.tipText}>
          El movimiento y la alimentación trabajan juntos: la comida baja la retención y la
          inflamación, el movimiento mejora la circulación y el tono. Ninguno funciona tan bien
          por separado como los dos combinados.
        </Text>
      </View>

      <PageFooter pageNum={5} />
    </Page>
  )
}

function Page6Plan() {
  const week1 = [
    'Tomo entre 2 y 2.5 L de agua al día',
    'Incluyo proteína en cada comida principal',
    'Sumo una fuente de vitamina C al desayuno',
    'Camino al menos 20 minutos, la mayoría de los días',
  ]
  const week2 = [
    'Reviso el sodio en las etiquetas antes de comprar',
    'Cocino en casa al menos 5 días de la semana',
    'Hago fuerza de piernas 2 veces por semana',
    'Me levanto y me muevo cada hora si estoy sentada',
  ]
  const week34 = [
    'Reduje el alcohol a ocasiones puntuales',
    'Como frutos rojos o antioxidantes casi a diario',
    'Elevo las piernas 10 minutos al terminar el día',
    'Mantengo la regla 80/20 sin culpa el fin de semana',
  ]

  return (
    <Page size="A4" style={s.page}>
      <PageHead />
      <Chapter kicker="Capítulo 5" title="Tu plan de 4 semanas" />

      <Text style={s.lead}>
        No intentes cambiarlo todo el lunes. Suma hábitos por bloques: cuando los primeros ya son
        automáticos, agregas los siguientes. Marca cada casilla cuando el hábito ya sea parte de
        tu rutina.
      </Text>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.sectionTitle}>Semana 1 — Base</Text>
        </View>
        <View style={s.sectionBody}>
          {week1.map((t, i) => (
            <View key={i} style={s.checkRow}>
              <View style={s.checkBox} />
              <Text style={s.checkText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.sectionTitle}>Semana 2 — Ajuste</Text>
        </View>
        <View style={s.sectionBody}>
          {week2.map((t, i) => (
            <View key={i} style={s.checkRow}>
              <View style={s.checkBox} />
              <Text style={s.checkText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.sectionTitle}>Semanas 3 y 4 — Consolidación</Text>
        </View>
        <View style={s.sectionBody}>
          {week34.map((t, i) => (
            <View key={i} style={s.checkRow}>
              <View style={s.checkBox} />
              <Text style={s.checkText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.disclaimerBox}>
        <Text style={s.disclaimerText}>
          Esta guía tiene fines informativos y de educación en hábitos, y complementa tu plan
          nutricional NutriPlan. No promete eliminar la celulitis ni sustituye la orientación de
          un médico o dermatólogo ante condiciones específicas de piel, circulación o salud.
        </Text>
      </View>

      <PageFooter pageNum={6} />
    </Page>
  )
}

function AntiCelulitisPdfDocument() {
  return (
    <Document
      title="NutriPlan — Guía Anti-Celulitis"
      author="NutriPlan"
      subject="Hábitos de alimentación, hidratación y movimiento para la apariencia de la piel"
      creator="NutriPlan"
    >
      <CoverPage />
      <Page2Understand />
      <Page3Food />
      <Page4Avoid />
      <Page5Movement />
      <Page6Plan />
    </Document>
  )
}

export async function renderAntiCelulitisPdf(): Promise<Buffer> {
  return renderToBuffer(<AntiCelulitisPdfDocument />)
}
