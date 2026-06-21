// =============================================================================
// NutriPlan — PDF de boas-vindas do order bump (Plan de Entrenamiento)
// Documento curto entregue na Hotmart. A entrega real do treino é pelo app;
// este PDF só dá as boas-vindas e explica como acessar.
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
}

function Leaf({ size, leaf = c.greenDeep, vein = c.mint }: { size: number; leaf?: string; vein?: string }) {
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
  page: { paddingTop: 0, paddingBottom: 48, paddingHorizontal: 0, fontSize: 11, color: c.text, fontFamily: 'Helvetica', backgroundColor: c.white },
  hero: { backgroundColor: c.greenDeep, paddingTop: 54, paddingBottom: 46, paddingHorizontal: 44, alignItems: 'center' },
  badge: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  wordmark: { fontSize: 13, color: c.mint, marginBottom: 14, letterSpacing: 1 },
  heroTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: c.white, textAlign: 'center', lineHeight: 1.25 },
  body: { paddingHorizontal: 48, paddingTop: 34 },
  lead: { fontSize: 12, lineHeight: 1.6, color: c.text, marginBottom: 22 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: c.greenDeep, marginBottom: 12 },
  step: { flexDirection: 'row', marginBottom: 11, alignItems: 'flex-start' },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, color: c.white, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 4, marginRight: 10 },
  stepText: { flex: 1, fontSize: 11, lineHeight: 1.5, color: c.text, paddingTop: 2 },
  tip: { backgroundColor: c.softBg, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: c.primary, padding: 14, marginTop: 26 },
  tipLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: c.greenDeep, marginBottom: 4 },
  tipText: { fontSize: 11, lineHeight: 1.5, color: c.text },
  footer: { position: 'absolute', bottom: 26, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
  footerText: { fontSize: 9, color: c.muted },
})

function WelcomeDoc() {
  return (
    <Document title="Bienvenida — Plan de Entrenamiento" author="NutriPlan">
      <Page size="A4" style={s.page}>
        <View style={s.hero}>
          <View style={s.badge}>
            <Leaf size={40} />
          </View>
          <Text style={s.wordmark}>NutriPlan</Text>
          <Text style={s.heroTitle}>¡Bienvenida a tu{'\n'}Plan de Entrenamiento!</Text>
        </View>

        <View style={s.body}>
          <Text style={s.lead}>
            Gracias por sumar el Plan de Entrenamiento Personalizado a tu plan nutricional.
            Tu rutina se prepara según tu objetivo, tu nivel y el lugar donde entrenas, para
            que avances más rápido junto a tu alimentación.
          </Text>

          <Text style={s.sectionTitle}>Cómo acceder a tu plan</Text>

          <View style={s.step}>
            <Text style={s.stepNum}>1</Text>
            <Text style={s.stepText}>Abre el enlace de acceso que te enviamos a tu correo justo después de la compra.</Text>
          </View>
          <View style={s.step}>
            <Text style={s.stepNum}>2</Text>
            <Text style={s.stepText}>Entra a tu panel de NutriPlan. Tu plan de entrenamiento aparece junto a tu plan nutricional.</Text>
          </View>
          <View style={s.step}>
            <Text style={s.stepNum}>3</Text>
            <Text style={s.stepText}>Descárgalo o consúltalo desde el celular y empieza hoy mismo.</Text>
          </View>

          <View style={s.tip}>
            <Text style={s.tipLabel}>CONSEJO</Text>
            <Text style={s.tipText}>
              Combina tu entrenamiento con tu plan de alimentación. Juntos, los resultados
              llegan antes y se mantienen en el tiempo.
            </Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>NutriPlan · Tu plan, calibrado para ti</Text>
          <Text style={s.footerText}>¿Dudas? Responde al correo de acceso.</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderWelcomePdf(): Promise<Buffer> {
  return renderToBuffer(<WelcomeDoc />)
}
