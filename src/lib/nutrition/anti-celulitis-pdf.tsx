// =============================================================================
// NutriPlan — Guía Anti-Celulitis
// Documento estático, incluido en todos los tiers (bônus del plan base).
// Contenido basado en hábitos reales (hidratación, alimentación, movimiento),
// sin prometer "cura": celulitis es estructural, la dieta ayuda su apariencia.
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
  page: { paddingTop: 28, paddingBottom: 44, paddingHorizontal: 36, fontSize: 10, color: c.text, fontFamily: 'Helvetica', backgroundColor: c.white },

  coverHero: { backgroundColor: c.greenDeep, paddingTop: 60, paddingBottom: 52, paddingHorizontal: 44, alignItems: 'center' },
  coverBadge: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  coverWordmark: { fontSize: 11, color: c.mint, marginBottom: 10, letterSpacing: 1 },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: c.white, textAlign: 'center', lineHeight: 1.2, marginBottom: 8 },
  coverSubtitle: { fontSize: 13, color: c.mint, textAlign: 'center', lineHeight: 1.4 },
  coverDivider: { width: 48, height: 3, backgroundColor: c.mint, borderRadius: 2, marginVertical: 18 },
  coverBody: { paddingHorizontal: 44, paddingTop: 36 },
  coverIntro: { fontSize: 12, lineHeight: 1.65, color: c.text, marginBottom: 20 },
  coverNote: { backgroundColor: c.softBg, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: c.primary, padding: 12, marginTop: 8 },
  coverNoteText: { fontSize: 10, lineHeight: 1.5, color: c.text },

  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageHeaderTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.ink },

  sectionCard: { borderWidth: 1, borderColor: c.border, borderRadius: 10, marginBottom: 14, overflow: 'hidden' },
  sectionHeader: { backgroundColor: c.softBg, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.ink },
  sectionBody: { padding: 12 },

  itemRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-start' },
  bullet: { color: c.primary, fontFamily: 'Helvetica-Bold', marginRight: 6, fontSize: 10 },
  itemBold: { fontFamily: 'Helvetica-Bold', color: c.ink },
  itemText: { fontSize: 9.5, color: c.text, flex: 1, lineHeight: 1.5 },

  avoidBullet: { color: c.coral, fontFamily: 'Helvetica-Bold', marginRight: 6, fontSize: 10 },

  tipBox: { backgroundColor: '#FFFBEA', borderRadius: 6, borderLeftWidth: 2.5, borderLeftColor: '#D79A33', paddingVertical: 8, paddingHorizontal: 10, marginTop: 4 },
  tipLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#8A6D1A', marginBottom: 2 },
  tipText: { fontSize: 9, color: c.text, lineHeight: 1.5 },

  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: c.border, paddingTop: 8 },
  footerText: { fontSize: 8, color: c.muted },
})

function PageFooter({ pageNum, total }: { pageNum: number; total: number }) {
  return (
    <View style={s.footer} fixed>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Leaf size={10} leaf={c.primary} vein={c.mint} />
        <Text style={s.footerText}>NutriPlan · Guía Anti-Celulitis</Text>
      </View>
      <Text style={s.footerText}>{pageNum} / {total}</Text>
    </View>
  )
}

function CoverPage() {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverHero}>
        <View style={s.coverBadge}>
          <Leaf size={44} leaf={c.primary} vein={c.mint} />
        </View>
        <Text style={s.coverWordmark}>NutriPlan</Text>
        <Text style={s.coverTitle}>Guía{'\n'}Anti-Celulitis</Text>
        <View style={s.coverDivider} />
        <Text style={s.coverSubtitle}>Hábitos reales de alimentación e hidratación{'\n'}para mejorar la apariencia de tu piel</Text>
      </View>

      <View style={s.coverBody}>
        <Text style={s.coverIntro}>
          La celulitis es un rasgo estructural de la piel, no una enfermedad ni un fracaso tuyo,
          y no desaparece por completo solo con dieta. Lo que sí puedes controlar es lo que
          influye en su apariencia: retención de líquidos, inflamación y circulación. Esta guía
          reúne los hábitos con más respaldo para eso.
        </Text>

        <View style={s.coverNote}>
          <Text style={s.coverNoteText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Importante: </Text>
            esta guía es un complemento a tu plan nutricional. No sustituye una evaluación con
            un profesional de la salud si tienes una condición específica de piel o circulación.
          </Text>
        </View>
      </View>

      <PageFooter pageNum={1} total={2} />
    </Page>
  )
}

function ContentPage() {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.pageHeader}>
        <View style={s.pageHeaderLeft}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.pageHeaderTitle}>NutriPlan · Guía Anti-Celulitis</Text>
        </View>
        <Text style={{ fontSize: 9, color: c.muted }}>nutriplan.app</Text>
      </View>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.sectionTitle}>Lo que ayuda</Text>
        </View>
        <View style={s.sectionBody}>
          {[
            { b: 'Hidratación constante: ', t: 'entre 2 y 2.5 litros de agua al día ayudan a reducir la retención de líquidos, uno de los factores que más acentúa la apariencia de la celulitis.' },
            { b: 'Fibra en cada comida: ', t: 'verduras, frutas con cáscara y granos enteros mejoran la digestión y reducen la inflamación, otro factor que empeora su aspecto.' },
            { b: 'Vitamina C: ', t: 'cítricos, pimiento y kiwi ayudan a la producción de colágeno, que da firmeza a la piel.' },
            { b: 'Movimiento diario: ', t: 'caminar o subir escaleras mejora la circulación de las piernas, incluso sin ir al gimnasio.' },
          ].map((item, i) => (
            <View key={i} style={s.itemRow}>
              <Text style={s.bullet}>✓</Text>
              <Text style={s.itemText}><Text style={s.itemBold}>{item.b}</Text>{item.t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.sectionCard}>
        <View style={s.sectionHeader}>
          <Leaf size={14} leaf={c.coral} vein={c.mint} />
          <Text style={s.sectionTitle}>Lo que empeora la apariencia</Text>
        </View>
        <View style={s.sectionBody}>
          {[
            { b: 'Exceso de sodio: ', t: 'ultraprocesados, embutidos y snacks salados retienen líquido bajo la piel.' },
            { b: 'Alcohol frecuente: ', t: 'deshidrata e inflama, revirtiendo el efecto de la hidratación.' },
            { b: 'Pasar muchas horas sentada sin moverte: ', t: 'reduce la circulación en piernas y glúteos.' },
          ].map((item, i) => (
            <View key={i} style={s.itemRow}>
              <Text style={s.avoidBullet}>✕</Text>
              <Text style={s.itemText}><Text style={s.itemBold}>{item.b}</Text>{item.t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.tipBox}>
        <Text style={s.tipLabel}>Tip del nutricionista</Text>
        <Text style={s.tipText}>
          La constancia importa más que la perfección: aplicar estos hábitos junto con tu plan
          de 7 días, semana tras semana, es lo que realmente se nota con el tiempo.
        </Text>
      </View>

      <PageFooter pageNum={2} total={2} />
    </Page>
  )
}

function AntiCelulitisPdfDocument() {
  return (
    <Document
      title="NutriPlan — Guía Anti-Celulitis"
      author="NutriPlan"
      subject="Hábitos de alimentación e hidratación para la apariencia de la piel"
      creator="NutriPlan"
    >
      <CoverPage />
      <ContentPage />
    </Document>
  )
}

export async function renderAntiCelulitisPdf(): Promise<Buffer> {
  return renderToBuffer(<AntiCelulitisPdfDocument />)
}
