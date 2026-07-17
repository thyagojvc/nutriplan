// =============================================================================
// NutriPlan — Geração de PDF complementar (Fase C, Decisão 16)
// Renderiza plan_json em PDF com @react-pdf/renderer (JS puro, sem Chromium —
// compatível com Vercel serverless). Documento complementar; o dashboard HTML
// continua sendo a entrega primária.
// Layout repaginado com a identidade da marca (capa verde + folha + cards).
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
import type { NutritionPlanJson } from './types'
import type { TrainingPlanJson } from './generate'

const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar masa muscular',
  maintain: 'Mantenimiento',
  health_energy: 'Salud y energía',
}

// ── Paleta de marca ──────────────────────────────────────────────────────────
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
  amberBg: '#FFF8E6',
  amberText: '#8A6D1A',
  protein: '#D86A78',
  carb: '#D79A33',
  fat: '#4F90C6',
}

// ── Folha (logo) em SVG ──────────────────────────────────────────────────────
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

function Wordmark({ color = c.white, size = 13 }: { color?: string; size?: number }) {
  return (
    <Text style={{ fontSize: size, color }}>
      <Text style={{ fontFamily: 'Helvetica' }}>Nutri</Text>
      <Text style={{ fontFamily: 'Helvetica-Bold' }}>Plan</Text>
    </Text>
  )
}

const styles = StyleSheet.create({
  // Páginas
  page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 40, fontSize: 10, color: c.text, fontFamily: 'Helvetica', backgroundColor: c.white },
  heroCard: { backgroundColor: c.greenDeep, borderRadius: 16, paddingVertical: 46, paddingHorizontal: 32, alignItems: 'center', marginTop: 24 },

  // Capa
  coverBadge: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  coverTitle: { fontSize: 30, fontFamily: 'Helvetica-Bold', color: c.white, textAlign: 'center', marginBottom: 6 },
  coverDivider: { width: 54, height: 3, backgroundColor: c.mint, borderRadius: 2, marginVertical: 12 },
  coverGoal: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: c.white, marginTop: 4 },
  coverName: { fontSize: 13, color: c.mint, marginBottom: 14 },
  goalPill: { borderWidth: 1, borderColor: c.mint, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 16, marginBottom: 30 },
  goalPillText: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.white },
  coverCard: { backgroundColor: c.white, borderRadius: 12, flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 10, width: '100%' },
  coverMetric: { flex: 1, alignItems: 'center' },
  coverMetricValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: c.greenDeep },
  coverMetricUnit: { fontSize: 8, fontFamily: 'Helvetica', color: c.muted },
  coverMetricLabel: { fontSize: 8, color: c.muted, marginTop: 3 },
  coverDivV: { width: 1, backgroundColor: c.border },
  coverTagline: { fontSize: 10, color: c.mint, marginTop: 28, fontFamily: 'Helvetica-Oblique' },

  // Cabeçalho de página de conteúdo
  pageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: c.border },
  pageHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageHeadTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: c.ink },

  // Section header com barra de destaque
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  accentBar: { width: 4, height: 15, backgroundColor: c.primary, borderRadius: 2, marginRight: 7 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: c.ink },

  // Métricas (página de resumo)
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  metric: { flex: 1, backgroundColor: c.softBg, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  metricValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: c.greenDeep },
  metricUnit: { fontSize: 8, fontFamily: 'Helvetica', color: c.muted },
  metricLabel: { fontSize: 8, color: c.muted, marginTop: 2 },

  // Notas
  noteRow: { flexDirection: 'row', marginBottom: 3, paddingRight: 6 },
  noteDot: { color: c.primary, fontFamily: 'Helvetica-Bold', marginRight: 5 },
  note: { fontSize: 9, color: c.text, flex: 1, lineHeight: 1.4 },

  // Cards genéricos
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 9, marginBottom: 6 },
  catTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.primary, marginBottom: 3 },
  catItems: { fontSize: 9, color: c.text, lineHeight: 1.4 },
  listItem: { fontSize: 9, color: c.text, marginBottom: 3, lineHeight: 1.4 },

  // Guia numerada
  stepRow: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  stepNum: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.primary, color: c.white, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 3.5, marginRight: 7 },
  stepText: { fontSize: 9, color: c.text, flex: 1, lineHeight: 1.4, paddingTop: 1 },

  // Dia
  dayCard: { borderWidth: 1, borderColor: c.border, borderRadius: 8, marginBottom: 10, overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.primary, paddingVertical: 7, paddingHorizontal: 12 },
  dayTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.white },
  dayKcal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.mint },
  dayBody: { padding: 10 },

  // Refeição dentro do dia
  meal: { marginBottom: 8 },
  mealHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  mealName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.greenDeep },
  mealKcal: { fontSize: 8, color: c.muted },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: c.cream },
  itemFood: { fontSize: 9, color: c.text, flex: 1 },
  itemQty: { color: c.muted },
  macroChips: { flexDirection: 'row', gap: 4 },
  chip: { fontSize: 7, color: c.white, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },

  // Disclaimer
  disclaimerBox: { backgroundColor: c.amberBg, borderRadius: 8, padding: 10, marginTop: 14 },
  disclaimerHead: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.amberText, marginBottom: 3 },
  disclaimerText: { fontSize: 8, color: c.amberText, marginBottom: 2, lineHeight: 1.4 },

  // Footer
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6 },
  footerText: { fontSize: 7, color: c.muted },

  // Calendario de 28 días
  calWeekTag: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: c.primary, marginBottom: 2 },
  calWeekCaption: { fontSize: 7.5, color: c.muted, marginBottom: 6, lineHeight: 1.3 },
  calWeekRow: { flexDirection: 'row', gap: 6 },
  calDayCell: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', backgroundColor: c.cream },
  calDayNum: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.greenDeep, marginBottom: 4 },
  calMealRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2, alignSelf: 'flex-start' },
  calMealBox: { width: 7, height: 7, borderWidth: 1, borderColor: c.primary, borderRadius: 2 },
  calMealLetter: { fontSize: 6.5, color: c.muted },
  checkinRow: { flexDirection: 'row', gap: 12, marginTop: 6, backgroundColor: c.softBg, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  checkinItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkinBox: { width: 9, height: 9, borderWidth: 1.2, borderColor: c.primary, borderRadius: 2 },
  checkinLabel: { fontSize: 7.5, color: c.text },
  weekWeight: { fontSize: 7.5, color: c.text, marginTop: 4, marginLeft: 2 },
  milestoneBox: { borderWidth: 1, borderColor: c.primary, borderRadius: 8, padding: 10, marginBottom: 12 },
  milestoneLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: c.greenDeep, marginBottom: 4 },
  milestoneLine: { fontSize: 8.5, color: c.text, marginBottom: 3 },
})

const CAL_WEEK_CAPTIONS = [
  'Tu cuerpo empieza a adaptarse. Es normal notar cambios pequeños todavía.',
  'Acá es donde la mayoría abandona una dieta. Vos ya llevás 14 días marcados.',
  'Empezás a notar la ropa distinta.',
  'Mirá para atrás: 28 días marcados. Esa constancia es tuya.',
]

const CHECKIN_LABELS = ['Menos hinchazón', 'Más energía', 'La ropa cae mejor']

// Iniciais das refeições pra marcação por comida no calendário (crédito
// parcial: perder 1 refeição não zera o dia inteiro).
const MEAL_INITIALS: Record<string, string> = {
  Desayuno: 'D', Almuerzo: 'A', Cena: 'C', Snack: 'S', Merienda: 'M',
}

function SectionHead({ title }: { title: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.accentBar} />
      <Text style={styles.h2}>{title}</Text>
    </View>
  )
}

function Footer({ subtitle }: { subtitle: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>NutriPlan · {subtitle}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function MacroChips({ p, ca, f }: { p: number; ca: number; f: number }) {
  return (
    <View style={styles.macroChips}>
      <Text style={[styles.chip, { backgroundColor: c.protein }]}>{p}P</Text>
      <Text style={[styles.chip, { backgroundColor: c.carb }]}>{ca}C</Text>
      <Text style={[styles.chip, { backgroundColor: c.fat }]}>{f}G</Text>
    </View>
  )
}

// Objetivo do reto como META que ela busca (não promessa). Adapta ao goal dela.
const RETO_GOAL: Record<string, string> = {
  lose_fat: 'para bajar de peso',
  perder_peso: 'para bajar de peso',
  gain_muscle: 'para ganar músculo',
  ganar_masa: 'para ganar músculo',
  maintain: 'para mantener tu peso',
  mantener: 'para mantener tu peso',
  health_energy: 'para más energía',
}

function NutritionDocument({ plan, name }: { plan: NutritionPlanJson; name: string }) {
  const { summary } = plan
  const goal = GOAL_LABEL[summary.goal] ?? summary.goal
  const retoGoal = RETO_GOAL[summary.goal] ?? ''

  return (
    <Document title="Tu Reto de 28 días — NutriPlan" author="NutriPlan">
      {/* ── Capa (card verde em página normal — padrão confiável) ── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.heroCard}>
          <View style={styles.coverBadge}>
            <Leaf size={56} leaf={c.greenDeep} vein={c.white} />
          </View>
          <Wordmark color={c.white} size={16} />
          <Text style={[styles.coverTitle, { marginTop: 24 }]}>Tu Reto de 28 días</Text>
          {!!retoGoal && <Text style={styles.coverGoal}>{retoGoal}</Text>}
          <View style={styles.coverDivider} />
          {!!name && <Text style={styles.coverName}>Preparado para {name}</Text>}
          <View style={styles.goalPill}>
            <Text style={styles.goalPillText}>{goal}</Text>
          </View>

          <View style={styles.coverCard}>
            <View style={styles.coverMetric}>
              <Text style={styles.coverMetricValue}>{summary.targetCalories}</Text>
              <Text style={styles.coverMetricUnit}>kcal/día</Text>
              <Text style={styles.coverMetricLabel}>Meta</Text>
            </View>
            <View style={styles.coverDivV} />
            <View style={styles.coverMetric}>
              <Text style={styles.coverMetricValue}>{summary.macros.proteinG}</Text>
              <Text style={styles.coverMetricUnit}>g</Text>
              <Text style={styles.coverMetricLabel}>Proteína</Text>
            </View>
            <View style={styles.coverDivV} />
            <View style={styles.coverMetric}>
              <Text style={styles.coverMetricValue}>{summary.macros.carbsG}</Text>
              <Text style={styles.coverMetricUnit}>g</Text>
              <Text style={styles.coverMetricLabel}>Carbos</Text>
            </View>
            <View style={styles.coverDivV} />
            <View style={styles.coverMetric}>
              <Text style={styles.coverMetricValue}>{summary.macros.fatG}</Text>
              <Text style={styles.coverMetricUnit}>g</Text>
              <Text style={styles.coverMetricLabel}>Grasas</Text>
            </View>
          </View>

          <Text style={styles.coverTagline}>28 días. Un paso a la vez.</Text>
        </View>
      </Page>

      {/* ── Página: manual de uso — orienta no 1º minuto e reduz reembolso ── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHead}>
          <View style={styles.pageHeadLeft}>
            <Leaf size={20} leaf={c.primary} vein={c.white} />
            <Text style={styles.pageHeadTitle}>Cómo usar tu Reto</Text>
          </View>
          <Wordmark color={c.primary} size={11} />
        </View>

        <Text style={{ fontSize: 9, color: c.text, marginBottom: 12, lineHeight: 1.4 }}>
          Leé esto primero. Te toma 2 minutos y te evita dudas. Tu Reto es un sistema simple que repetís durante 28 días.
        </Text>

        <SectionHead title="Los 5 pasos, cada semana" />
        {[
          ['Ya calibraste tu metabolismo', 'Tus números exactos están en la página de resumen. No tenés que calcular nada.'],
          ['Revisá tu lista de compras', 'Comprá una vez por semana lo que aparece en tu lista. Ya está optimizada para tu súper.'],
          ['Comé tu plan, ya decidido', 'Cada día tiene su desayuno, almuerzo y cena con tus alimentos. No tenés que pensar qué cocinar.'],
          ['Marcá cada comida que seguís', 'En tu calendario, comida por comida. No es todo o nada: si fallás una, las demás siguen contando.'],
          ['Al terminar la semana, anotá tu avance', 'Tu peso, tu cintura y cómo te sentís. Así ves el progreso real, no solo la balanza.'],
        ].map(([t, d], i) => (
          <View key={t} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: c.ink }}>{t}. </Text>{d}
            </Text>
          </View>
        ))}

        <SectionHead title="Qué hacer si…" />
        <View style={styles.card}>
          {[
            ['No te gusta un alimento', 'Usá las sustituciones de tu plan. Siempre hay una opción equivalente.'],
            ['Comés fuera un día', 'Elegí lo más parecido a tu plan y seguí. Un día no arruina el reto.'],
            ['La balanza no se mueve una semana', 'Mirá tu cintura y cómo te sentís. El cuerpo cambia aunque el número tarde.'],
          ].map(([t, d], i, arr) => (
            <Text key={t} style={[styles.listItem, { marginBottom: i < arr.length - 1 ? 4 : 0 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: c.primary }}>{t}: </Text>{d}
            </Text>
          ))}
        </View>

        <View style={[styles.milestoneBox, { marginTop: 12 }]}>
          <Text style={styles.milestoneLabel}>El objetivo del reto</Text>
          <Text style={[styles.milestoneLine, { marginBottom: 0 }]}>
            Llegar al día 28 con constancia. No buscamos perfección, buscamos que no lo abandones. Esa es la diferencia con las dietas de antes.
          </Text>
        </View>

        <Footer subtitle="Cómo usar tu Reto · NutriPlan" />
      </Page>

      {/* ── Página: calendario de 28 días — el objeto tangible del Reto ── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHead}>
          <View style={styles.pageHeadLeft}>
            <Leaf size={20} leaf={c.primary} vein={c.white} />
            <Text style={styles.pageHeadTitle}>Tu Reto de 28 días</Text>
          </View>
          <Wordmark color={c.primary} size={11} />
        </View>

        <Text style={{ fontSize: 9, color: c.text, marginBottom: 12, lineHeight: 1.4 }}>
          Hoy es tu Día 1. Marca cada comida que sigas (no todo o nada: si fallas una, las demás siguen contando). Al terminar la semana, anota tu peso y cómo te sentís. En 28 días vas a tener la prueba de tu avance, hecha por vos misma.
        </Text>

        <View style={styles.milestoneBox}>
          <Text style={styles.milestoneLabel}>Tu punto de partida (Día 1)</Text>
          <Text style={styles.milestoneLine}>Mi peso hoy: __________ kg     ·     Mi cintura: __________ cm</Text>
          <Text style={styles.milestoneLine}>Cómo me siento hoy: _____________________________________________</Text>
        </View>

        {Array.from({ length: summary.cycleWeeks }).map((_, weekIdx) => (
          <View key={weekIdx} style={{ marginBottom: 10 }}>
            <Text style={styles.calWeekTag}>Semana {weekIdx + 1}</Text>
            <Text style={styles.calWeekCaption}>{CAL_WEEK_CAPTIONS[weekIdx]}</Text>
            <View style={styles.calWeekRow}>
              {plan.days.map((day, dayIdx) => (
                <View key={dayIdx} style={styles.calDayCell}>
                  <Text style={styles.calDayNum}>{weekIdx * summary.cycleDays + dayIdx + 1}</Text>
                  {day.meals.map((meal, mi) => (
                    <View key={mi} style={styles.calMealRow}>
                      <View style={styles.calMealBox} />
                      <Text style={styles.calMealLetter}>{MEAL_INITIALS[meal.name] ?? meal.name.charAt(0)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
            <View style={styles.checkinRow}>
              {CHECKIN_LABELS.map((label) => (
                <View key={label} style={styles.checkinItem}>
                  <View style={styles.checkinBox} />
                  <Text style={styles.checkinLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.weekWeight}>Mi peso al terminar la semana: __________ kg     ·     Mi cintura: __________ cm</Text>
          </View>
        ))}

        <View style={styles.milestoneBox}>
          <Text style={styles.milestoneLabel}>Tu resultado (Día 28)</Text>
          <Text style={styles.milestoneLine}>Mi peso ahora: __________ kg     ·     Mi cintura: __________ cm</Text>
          <Text style={styles.milestoneLine}>Cómo me siento ahora: ____________________________________________</Text>
        </View>

        <Footer subtitle="Reto de 28 días · NutriPlan" />
      </Page>

      {/* ── Página: resumo + compras + guia ────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHead}>
          <View style={styles.pageHeadLeft}>
            <Leaf size={20} leaf={c.primary} vein={c.white} />
            <Text style={styles.pageHeadTitle}>Resumen de tu plan</Text>
          </View>
          <Wordmark color={c.primary} size={11} />
        </View>

        <Text style={{ fontSize: 9, color: c.muted, marginBottom: 8 }}>
          {goal} · ciclo de {summary.cycleDays} días repetible durante {summary.cycleWeeks} semanas
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metric}><Text style={styles.metricValue}>{summary.bmr}<Text style={styles.metricUnit}> kcal</Text></Text><Text style={styles.metricLabel}>Metabolismo (TMB)</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{summary.tdee}<Text style={styles.metricUnit}> kcal</Text></Text><Text style={styles.metricLabel}>Gasto diario (TDEE)</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{summary.targetCalories}<Text style={styles.metricUnit}> kcal</Text></Text><Text style={styles.metricLabel}>Tu meta diaria</Text></View>
        </View>

        {summary.notes.length > 0 && <SectionHead title="Lo que debes saber" />}
        {summary.notes.map((n, i) => (
          <View key={i} style={styles.noteRow}>
            <Text style={styles.noteDot}>•</Text>
            <Text style={styles.note}>{n}</Text>
          </View>
        ))}

        <SectionHead title="Lista de compras" />
        <View style={styles.card}>
          {plan.shoppingList.map((cat, i) => (
            <View key={i} style={{ marginBottom: i < plan.shoppingList.length - 1 ? 6 : 0 }}>
              <Text style={styles.catTitle}>{cat.category}</Text>
              <Text style={styles.catItems}>{cat.items.map((it) => it.name).join('  ·  ')}</Text>
            </View>
          ))}
        </View>

        <SectionHead title="Guía de implementación" />
        {plan.implementationGuide.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        {plan.substitutions.length > 0 && (
          <>
            <SectionHead title="Sustituciones" />
            <View style={styles.card}>
              {plan.substitutions.map((s, i) => (
                <Text key={i} style={[styles.listItem, { marginBottom: i < plan.substitutions.length - 1 ? 3 : 0 }]}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: c.primary }}>{s.food}</Text> → {s.alternatives.join(', ')}
                </Text>
              ))}
            </View>
          </>
        )}

        {plan.disclaimers.length > 0 && (
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerHead}>Aviso importante</Text>
            {plan.disclaimers.map((d, i) => (
              <Text key={i} style={styles.disclaimerText}>{d}</Text>
            ))}
          </View>
        )}

        <Footer subtitle="Plan personalizado · No sustituye consejo médico" />
      </Page>

      {/* ── Página: menú de 7 días ─────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHead}>
          <View style={styles.pageHeadLeft}>
            <Leaf size={20} leaf={c.primary} vein={c.white} />
            <Text style={styles.pageHeadTitle}>Tu menú de 7 días</Text>
          </View>
          <Wordmark color={c.primary} size={11} />
        </View>

        {plan.days.map((day) => (
          <View key={day.day} style={styles.dayCard} wrap={false}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{day.label}</Text>
              <Text style={styles.dayKcal}>{day.totals.kcal} kcal</Text>
            </View>
            <View style={styles.dayBody}>
              {day.meals.map((meal, i) => (
                <View key={i} style={[styles.meal, { marginBottom: i < day.meals.length - 1 ? 8 : 0 }]}>
                  <View style={styles.mealHead}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealKcal}>{meal.totals.kcal} kcal</Text>
                  </View>
                  {meal.items.map((item, j) => (
                    <View key={j} style={styles.itemRow}>
                      <Text style={styles.itemFood}>
                        {item.food}  <Text style={styles.itemQty}>· {item.quantity}</Text>
                      </Text>
                      <MacroChips p={item.proteinG} ca={item.carbsG} f={item.fatG} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        ))}

        <Footer subtitle="Plan personalizado · No sustituye consejo médico" />
      </Page>
    </Document>
  )
}

function TrainingDocument({ plan, name }: { plan: TrainingPlanJson; name: string }) {
  return (
    <Document title="Tu Plan de Entrenamiento — NutriPlan" author="NutriPlan">
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHead}>
          <View style={styles.pageHeadLeft}>
            <Leaf size={20} leaf={c.primary} vein={c.white} />
            <Text style={styles.pageHeadTitle}>Tu Plan de Entrenamiento</Text>
          </View>
          <Wordmark color={c.primary} size={11} />
        </View>

        <Text style={{ fontSize: 9, color: c.muted, marginBottom: 8 }}>
          {name ? `${name} · ` : ''}
          {plan.summary.experience} · {plan.summary.location} · {plan.summary.frequency}
        </Text>

        {plan.summary.notes.map((n, i) => (
          <View key={i} style={styles.noteRow}>
            <Text style={styles.noteDot}>•</Text>
            <Text style={styles.note}>{n}</Text>
          </View>
        ))}

        {plan.days.map((session, i) => (
          <View key={i} style={styles.dayCard} wrap={false}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{session.label}</Text>
              <Text style={styles.dayKcal}>{session.focus}</Text>
            </View>
            <View style={styles.dayBody}>
              {session.exercises.map((ex, j) => (
                <View key={j} style={styles.itemRow}>
                  <Text style={styles.itemFood}>{ex.name}</Text>
                  <Text style={[styles.itemQty, { fontSize: 9 }]}>{ex.sets}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {plan.disclaimers.length > 0 && (
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerHead}>Aviso importante</Text>
            {plan.disclaimers.map((d, i) => (
              <Text key={i} style={styles.disclaimerText}>{d}</Text>
            ))}
          </View>
        )}

        <Footer subtitle="Plan de entrenamiento · Consulta a un profesional antes de iniciar" />
      </Page>
    </Document>
  )
}

export async function renderNutritionPdf(
  plan: NutritionPlanJson,
  name: string,
): Promise<Buffer> {
  return renderToBuffer(<NutritionDocument plan={plan} name={name} />)
}

export async function renderTrainingPdf(
  plan: TrainingPlanJson,
  name: string,
): Promise<Buffer> {
  return renderToBuffer(<TrainingDocument plan={plan} name={name} />)
}
