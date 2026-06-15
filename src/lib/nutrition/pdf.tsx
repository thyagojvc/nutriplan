// =============================================================================
// NutriPlan — Geração de PDF complementar (Fase C, Decisão 16)
// Renderiza plan_json em PDF com @react-pdf/renderer (JS puro, sem Chromium —
// compatível com Vercel serverless). Documento complementar; o dashboard HTML
// continua sendo a entrega primária.
// =============================================================================

import {
  Document,
  Page,
  Text,
  View,
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

const c = {
  primary: '#16a34a',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  amberBg: '#fffbeb',
  amberText: '#92400e',
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: c.text, fontFamily: 'Helvetica' },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: c.primary, marginBottom: 2 },
  subtitle: { fontSize: 10, color: c.muted, marginBottom: 16 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 6 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 4, padding: 6, alignItems: 'center' },
  metricLabel: { fontSize: 7, color: c.muted },
  metricValue: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 9, color: c.muted, marginBottom: 2 },
  mealBox: { borderWidth: 1, borderColor: c.border, borderRadius: 4, padding: 8, marginBottom: 6 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  mealName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  mealKcal: { fontSize: 9, color: c.muted },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  itemFood: { fontSize: 9 },
  itemMacros: { fontSize: 8, color: c.muted },
  dayTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.primary, marginTop: 10, marginBottom: 4 },
  listItem: { fontSize: 9, marginBottom: 2 },
  disclaimerBox: { backgroundColor: c.amberBg, borderRadius: 4, padding: 8, marginTop: 12 },
  disclaimerText: { fontSize: 8, color: c.amberText, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7, color: c.muted, textAlign: 'center' },
})

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value}
        <Text style={{ fontSize: 8 }}> {unit}</Text>
      </Text>
    </View>
  )
}

function NutritionDocument({ plan, name }: { plan: NutritionPlanJson; name: string }) {
  const { summary } = plan
  return (
    <Document>
      {/* Página 1: resumo + lista de compras + guia */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Tu plan nutricional</Text>
        <Text style={styles.subtitle}>
          {name ? `${name} · ` : ''}
          {GOAL_LABEL[summary.goal] ?? summary.goal} · ciclo de {summary.cycleDays} días repetible{' '}
          {summary.cycleWeeks} semanas
        </Text>

        <View style={styles.metricsRow}>
          <Metric label="Calorías/día" value={`${summary.targetCalories}`} unit="kcal" />
          <Metric label="Proteína" value={`${summary.macros.proteinG}`} unit="g" />
          <Metric label="Carbohidratos" value={`${summary.macros.carbsG}`} unit="g" />
          <Metric label="Grasas" value={`${summary.macros.fatG}`} unit="g" />
        </View>

        {summary.notes.map((n, i) => (
          <Text key={i} style={styles.note}>
            • {n}
          </Text>
        ))}

        <Text style={styles.h2}>Lista de compras</Text>
        {plan.shoppingList.map((cat, i) => (
          <View key={i} style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{cat.category}</Text>
            <Text style={styles.listItem}>{cat.items.map((it) => it.name).join(' · ')}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Guía de implementación</Text>
        {plan.implementationGuide.map((step, i) => (
          <Text key={i} style={styles.listItem}>
            {i + 1}. {step}
          </Text>
        ))}

        {plan.substitutions.length > 0 && (
          <>
            <Text style={styles.h2}>Sustituciones</Text>
            {plan.substitutions.map((s, i) => (
              <Text key={i} style={styles.listItem}>
                {s.food} → {s.alternatives.join(', ')}
              </Text>
            ))}
          </>
        )}

        {plan.disclaimers.length > 0 && (
          <View style={styles.disclaimerBox}>
            {plan.disclaimers.map((d, i) => (
              <Text key={i} style={styles.disclaimerText}>
                {d}
              </Text>
            ))}
          </View>
        )}
        <Text style={styles.footer} fixed>
          NutriPlan · Plan generado de forma personalizada · No sustituye consejo médico profesional
        </Text>
      </Page>

      {/* Página 2+: os 7 días */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Tu menú de 7 días</Text>
        <Text style={styles.subtitle}>Repite este ciclo durante {summary.cycleWeeks} semanas</Text>
        {plan.days.map((day) => (
          <View key={day.day} wrap={false}>
            <Text style={styles.dayTitle}>
              {day.label} — {day.totals.kcal} kcal
            </Text>
            {day.meals.map((meal, i) => (
              <View key={i} style={styles.mealBox}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  <Text style={styles.mealKcal}>{meal.totals.kcal} kcal</Text>
                </View>
                {meal.items.map((item, j) => (
                  <View key={j} style={styles.itemRow}>
                    <Text style={styles.itemFood}>
                      {item.food} · {item.quantity}
                    </Text>
                    <Text style={styles.itemMacros}>
                      {item.proteinG}P · {item.carbsG}C · {item.fatG}G
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.footer} fixed>
          NutriPlan · Plan generado de forma personalizada · No sustituye consejo médico profesional
        </Text>
      </Page>
    </Document>
  )
}

function TrainingDocument({ plan, name }: { plan: TrainingPlanJson; name: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Tu plan de entrenamiento</Text>
        <Text style={styles.subtitle}>
          {name ? `${name} · ` : ''}
          {plan.summary.experience} · {plan.summary.location} · {plan.summary.frequency}
        </Text>

        {plan.summary.notes.map((n, i) => (
          <Text key={i} style={styles.note}>
            • {n}
          </Text>
        ))}

        {plan.days.map((session, i) => (
          <View key={i} wrap={false}>
            <Text style={styles.dayTitle}>
              {session.label} — {session.focus}
            </Text>
            {session.exercises.map((ex, j) => (
              <View key={j} style={styles.itemRow}>
                <Text style={styles.itemFood}>{ex.name}</Text>
                <Text style={styles.itemMacros}>{ex.sets}</Text>
              </View>
            ))}
          </View>
        ))}

        {plan.disclaimers.length > 0 && (
          <View style={styles.disclaimerBox}>
            {plan.disclaimers.map((d, i) => (
              <Text key={i} style={styles.disclaimerText}>
                {d}
              </Text>
            ))}
          </View>
        )}
        <Text style={styles.footer} fixed>
          NutriPlan · Plan de entrenamiento · Consulta a un profesional antes de iniciar
        </Text>
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
