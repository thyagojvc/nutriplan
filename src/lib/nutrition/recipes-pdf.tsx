// =============================================================================
// NutriPlan — PDF de 28 Recetas Fitness
// Documento estático entregue em tiers $9.90+.
// Layout: capa + 14 páginas com 2 receitas por página.
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
import { RECIPES, CATEGORY_LABEL, type Recipe } from './recipes'

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
  categoryColors: {
    desayuno: '#FFF8E6',
    almuerzo: '#EEF6EA',
    cena: '#EEF0FA',
    snack: '#FFF0EB',
  } as Record<string, string>,
  categoryText: {
    desayuno: '#8A6D1A',
    almuerzo: '#226D45',
    cena: '#3A4E8A',
    snack: '#8A3A1A',
  } as Record<string, string>,
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
  // Páginas base
  coverPage: { fontSize: 10, color: c.text, fontFamily: 'Helvetica', backgroundColor: c.white },
  page: { paddingTop: 28, paddingBottom: 44, paddingHorizontal: 36, fontSize: 10, color: c.text, fontFamily: 'Helvetica', backgroundColor: c.white },

  // Capa
  coverHero: { backgroundColor: c.greenDeep, paddingTop: 60, paddingBottom: 52, paddingHorizontal: 44, alignItems: 'center' },
  coverBadge: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  coverWordmark: { fontSize: 11, color: c.mint, marginBottom: 10, letterSpacing: 1 },
  coverTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: c.white, textAlign: 'center', lineHeight: 1.2, marginBottom: 8 },
  coverSubtitle: { fontSize: 13, color: c.mint, textAlign: 'center', lineHeight: 1.4 },
  coverDivider: { width: 48, height: 3, backgroundColor: c.mint, borderRadius: 2, marginVertical: 18 },
  coverBody: { paddingHorizontal: 44, paddingTop: 36 },
  coverIntro: { fontSize: 12, lineHeight: 1.65, color: c.text, marginBottom: 24 },
  coverGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  coverGridItem: { flex: 1, backgroundColor: c.softBg, borderRadius: 8, padding: 12, alignItems: 'center' },
  coverGridNum: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: c.greenDeep, marginBottom: 2 },
  coverGridLabel: { fontSize: 9, color: c.muted, textAlign: 'center' },
  coverNote: { backgroundColor: c.softBg, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: c.primary, padding: 12, marginTop: 22 },
  coverNoteText: { fontSize: 10, lineHeight: 1.5, color: c.text },

  // Cabeçalho de página de receitas
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageHeaderTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.ink },

  // Card de receita
  recipeCard: { borderWidth: 1, borderColor: c.border, borderRadius: 10, marginBottom: 14, overflow: 'hidden' },
  cardHeader: { backgroundColor: c.softBg, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.ink, flex: 1, paddingRight: 8 },
  categoryBadge: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 },
  categoryText: { fontSize: 8, fontFamily: 'Helvetica-Bold' },

  cardBody: { padding: 12 },

  // Metadados (tempo + macros)
  metaRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  timePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.cream, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 },
  timePillText: { fontSize: 8.5, color: c.muted },
  macroPill: { flex: 1, alignItems: 'center', backgroundColor: c.cream, borderRadius: 6, paddingVertical: 4 },
  macroPillValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.greenDeep },
  macroPillLabel: { fontSize: 7, color: c.muted },

  // Ingredientes e passos
  col2: { flexDirection: 'row', gap: 14 },
  colLeft: { flex: 1 },
  colRight: { flex: 1.2 },

  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: c.primary, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 },
  ingredientRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'flex-start' },
  bullet: { color: c.primary, fontFamily: 'Helvetica-Bold', marginRight: 4, fontSize: 9 },
  ingredientText: { fontSize: 9, color: c.text, flex: 1, lineHeight: 1.4 },

  stepRow: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  stepNum: { width: 14, height: 14, borderRadius: 7, backgroundColor: c.primary, color: c.white, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 2.5, marginRight: 5, flexShrink: 0 },
  stepText: { fontSize: 9, color: c.text, flex: 1, lineHeight: 1.4, paddingTop: 1.5 },

  tipBox: { backgroundColor: '#FFFBEA', borderRadius: 6, borderLeftWidth: 2.5, borderLeftColor: '#D79A33', paddingVertical: 6, paddingHorizontal: 8, marginTop: 8 },
  tipLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#8A6D1A', marginBottom: 2 },
  tipText: { fontSize: 8.5, color: c.text, lineHeight: 1.4 },

  // Footer
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: c.border, paddingTop: 8 },
  footerText: { fontSize: 8, color: c.muted },
})

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const totalMin = recipe.prepMin + recipe.cookMin
  const catBg = c.categoryColors[recipe.category] ?? c.cream
  const catColor = c.categoryText[recipe.category] ?? c.primary

  return (
    <View style={s.recipeCard}>
      <View style={s.cardHeader}>
        <Text style={s.cardName}>{recipe.name}</Text>
        <View style={[s.categoryBadge, { backgroundColor: catBg }]}>
          <Text style={[s.categoryText, { color: catColor }]}>{CATEGORY_LABEL[recipe.category]}</Text>
        </View>
      </View>

      <View style={s.cardBody}>
        {/* Metadados */}
        <View style={s.metaRow}>
          <View style={s.timePill}>
            <Text style={s.timePillText}>{totalMin === 0 ? 'Sin cocción' : `${totalMin} min`}</Text>
          </View>
          {[
            { label: 'kcal', value: String(recipe.kcal) },
            { label: 'Proteína', value: `${recipe.protein}g` },
            { label: 'Carbs', value: `${recipe.carbs}g` },
            { label: 'Grasa', value: `${recipe.fat}g` },
          ].map((m) => (
            <View key={m.label} style={s.macroPill}>
              <Text style={s.macroPillValue}>{m.value}</Text>
              <Text style={s.macroPillLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Ingredientes + Pasos en 2 columnas */}
        <View style={s.col2}>
          <View style={s.colLeft}>
            <Text style={s.sectionLabel}>Ingredientes</Text>
            {recipe.ingredients.map((ing, i) => (
              <View key={i} style={s.ingredientRow}>
                <Text style={s.bullet}>·</Text>
                <Text style={s.ingredientText}>{ing}</Text>
              </View>
            ))}
          </View>

          <View style={s.colRight}>
            <Text style={s.sectionLabel}>Preparación</Text>
            {recipe.steps.map((step, i) => (
              <View key={i} style={s.stepRow}>
                <Text style={s.stepNum}>{i + 1}</Text>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        {recipe.tip && (
          <View style={s.tipBox}>
            <Text style={s.tipLabel}>Tip del nutricionista</Text>
            <Text style={s.tipText}>{recipe.tip}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function PageFooter({ pageNum, total }: { pageNum: number; total: number }) {
  return (
    <View style={s.footer} fixed>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Leaf size={10} leaf={c.primary} vein={c.mint} />
        <Text style={s.footerText}>NutriPlan · 28 Recetas Fitness</Text>
      </View>
      <Text style={s.footerText}>{pageNum} / {total}</Text>
    </View>
  )
}

function CoverPage() {
  const categories = [
    { label: '7 Desayunos', n: '7' },
    { label: '7 Almuerzos', n: '7' },
    { label: '7 Cenas', n: '7' },
    { label: '7 Snacks', n: '7' },
  ]

  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverHero}>
        <View style={s.coverBadge}>
          <Leaf size={44} leaf={c.primary} vein={c.mint} />
        </View>
        <Text style={s.coverWordmark}>NutriPlan</Text>
        <Text style={s.coverTitle}>28 Recetas{'\n'}Fitness</Text>
        <View style={s.coverDivider} />
        <Text style={s.coverSubtitle}>Altas en proteína · Fáciles de preparar{'\n'}Adaptadas a tu plan nutricional</Text>
      </View>

      <View style={s.coverBody}>
        <Text style={s.coverIntro}>
          Estas 28 recetas fueron seleccionadas para complementar tu plan nutricional personalizado.
          Todas son altas en proteína, prácticas para el día a día y compatibles con los macros
          calculados en tu Calibración Metabólica. Úsalas como guía, sustitúyelas entre sí y
          adáptalas a los ingredientes que tengas disponibles.
        </Text>

        <View style={s.coverGrid}>
          {categories.map((cat) => (
            <View key={cat.label} style={s.coverGridItem}>
              <Text style={s.coverGridNum}>{cat.n}</Text>
              <Text style={s.coverGridLabel}>{cat.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.coverNote}>
          <Text style={s.coverNoteText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Recuerda: </Text>
            ninguna receta sustituye a tu plan personalizado. Estas preparaciones son una guía
            práctica para que comer saludable sea más fácil y variado, sin que tengas que inventar
            todos los días.
          </Text>
        </View>
      </View>

      <PageFooter pageNum={1} total={15} />
    </Page>
  )
}

function RecipesPage({ recipes, pageNum }: { recipes: Recipe[]; pageNum: number }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.pageHeader}>
        <View style={s.pageHeaderLeft}>
          <Leaf size={14} leaf={c.primary} vein={c.mint} />
          <Text style={s.pageHeaderTitle}>NutriPlan · 28 Recetas Fitness</Text>
        </View>
        <Text style={{ fontSize: 9, color: c.muted }}>nutriplan.app</Text>
      </View>

      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}

      <PageFooter pageNum={pageNum} total={15} />
    </Page>
  )
}

function RecipesPdfDocument() {
  // Divide as 28 receitas em pares para 14 páginas
  const pages: Recipe[][] = []
  for (let i = 0; i < RECIPES.length; i += 2) {
    pages.push(RECIPES.slice(i, i + 2))
  }

  return (
    <Document
      title="NutriPlan — 28 Recetas Fitness"
      author="NutriPlan"
      subject="Recetas fitness altas en proteína"
      creator="NutriPlan"
    >
      <CoverPage />
      {pages.map((pair, idx) => (
        <RecipesPage key={idx} recipes={pair} pageNum={idx + 2} />
      ))}
    </Document>
  )
}

export async function renderRecipesPdf(): Promise<Buffer> {
  return renderToBuffer(<RecipesPdfDocument />)
}
