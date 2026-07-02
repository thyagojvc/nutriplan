// =============================================================================
// NutriPlan — Catálogo de exercícios para o gerador de plano de treino
// Cada exercício é etiquetado por local, foco muscular, nível e contraindicações.
// O gerador usa exercisesFor() para filtrar dinamicamente por perfil do usuário.
// =============================================================================

import type { PhysicalLimitation } from './types'

export type ExLocation = 'casa' | 'gimnasio' | 'aire_libre'
export type DayFocus = 'full_body' | 'upper' | 'lower' | 'push' | 'pull' | 'core'
export type ExLevel = 'principiante' | 'intermedio' | 'avanzado'

export interface Exercise {
  name: string
  locations: ExLocation[]
  focus: DayFocus[]
  level: ExLevel
  isCompound: boolean
  contraindications: PhysicalLimitation[]
  isUnilateral?: boolean
  isTimed?: boolean
}

export const LEVEL_RANK: Record<ExLevel, number> = {
  principiante: 0,
  intermedio: 1,
  avanzado: 2,
}

const ALL: ExLocation[] = ['casa', 'gimnasio', 'aire_libre']
const GYM: ExLocation[] = ['gimnasio']
const HOME: ExLocation[] = ['casa']
const HOME_OUT: ExLocation[] = ['casa', 'aire_libre']
const GYM_OUT: ExLocation[] = ['gimnasio', 'aire_libre']

export const EXERCISE_CATALOG: Exercise[] = [
  // ─── Compuestos multi-articulares (disponibles en múltiples ubicaciones) ───────
  { name: 'Sentadilla con peso corporal', locations: ALL, focus: ['full_body', 'lower'], level: 'principiante', isCompound: true, contraindications: [] },
  { name: 'Sentadilla sumo', locations: ALL, focus: ['lower', 'full_body'], level: 'principiante', isCompound: true, contraindications: [] },
  { name: 'Hip thrust en suelo', locations: HOME_OUT, focus: ['lower', 'full_body'], level: 'principiante', isCompound: true, contraindications: [] },
  { name: 'Zancada alternada', locations: ALL, focus: ['lower'], level: 'principiante', isCompound: true, contraindications: ['knee'], isUnilateral: true },
  { name: 'Step-up en silla o banca', locations: ALL, focus: ['lower', 'full_body'], level: 'principiante', isCompound: true, contraindications: ['knee'], isUnilateral: true },
  { name: 'Burpee sin salto', locations: ALL, focus: ['full_body'], level: 'principiante', isCompound: true, contraindications: ['lower_back', 'shoulder', 'wrist_elbow'] },
  { name: 'Burpee completo', locations: ALL, focus: ['full_body'], level: 'intermedio', isCompound: true, contraindications: ['knee', 'lower_back', 'shoulder', 'wrist_elbow'] },

  // ─── Push – Casa / Aire libre ────────────────────────────────────────────────
  { name: 'Flexión de brazos (rodillas)', locations: HOME_OUT, focus: ['push', 'upper', 'full_body'], level: 'principiante', isCompound: true, contraindications: ['wrist_elbow'] },
  { name: 'Flexión de brazos', locations: ALL, focus: ['push', 'upper', 'full_body'], level: 'principiante', isCompound: true, contraindications: ['shoulder', 'wrist_elbow'] },
  { name: 'Flexión declinada (pies en silla)', locations: HOME_OUT, focus: ['push', 'upper'], level: 'intermedio', isCompound: true, contraindications: ['shoulder', 'wrist_elbow'] },
  { name: 'Fondos en silla', locations: HOME_OUT, focus: ['push', 'upper'], level: 'principiante', isCompound: false, contraindications: ['shoulder', 'wrist_elbow'] },
  { name: 'Extensión de tríceps con botella', locations: HOME, focus: ['push', 'upper'], level: 'principiante', isCompound: false, contraindications: ['shoulder'] },
  { name: 'Elevación lateral con botellas', locations: HOME, focus: ['push', 'upper'], level: 'principiante', isCompound: false, contraindications: ['shoulder'] },

  // ─── Push – Gimnasio ─────────────────────────────────────────────────────────
  { name: 'Press de banca con mancuernas', locations: GYM, focus: ['push', 'upper'], level: 'principiante', isCompound: true, contraindications: ['shoulder'] },
  { name: 'Press inclinado con mancuernas', locations: GYM, focus: ['push', 'upper'], level: 'principiante', isCompound: true, contraindications: ['shoulder'] },
  { name: 'Press militar con mancuernas', locations: GYM, focus: ['push', 'upper'], level: 'principiante', isCompound: true, contraindications: ['shoulder'] },
  { name: 'Fondos en paralelas', locations: GYM_OUT, focus: ['push', 'upper'], level: 'intermedio', isCompound: true, contraindications: ['shoulder', 'wrist_elbow'] },
  { name: 'Extensión de tríceps en polea', locations: GYM, focus: ['push', 'upper'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Elevación lateral con mancuernas', locations: GYM, focus: ['push', 'upper'], level: 'principiante', isCompound: false, contraindications: ['shoulder'] },
  { name: 'Apertura con mancuernas en banco', locations: GYM, focus: ['push', 'upper'], level: 'principiante', isCompound: false, contraindications: ['shoulder'] },
  { name: 'Face pull en polea', locations: GYM, focus: ['push', 'pull', 'upper'], level: 'principiante', isCompound: false, contraindications: [] },

  // ─── Pull – Casa / Aire libre ────────────────────────────────────────────────
  { name: 'Remo invertido bajo mesa', locations: HOME, focus: ['pull', 'upper'], level: 'principiante', isCompound: true, contraindications: ['lower_back'] },
  { name: 'Remo con mochila cargada', locations: HOME_OUT, focus: ['pull', 'upper'], level: 'principiante', isCompound: true, contraindications: ['lower_back'] },
  { name: 'Extensión de espalda en suelo (Superman)', locations: ALL, focus: ['pull', 'upper', 'core'], level: 'principiante', isCompound: false, contraindications: [], isTimed: true },
  { name: 'Curl de bíceps con botellas', locations: HOME, focus: ['pull', 'upper'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Dominada en barra de parque', locations: ['aire_libre'], focus: ['pull', 'upper'], level: 'intermedio', isCompound: true, contraindications: ['shoulder'] },

  // ─── Pull – Gimnasio ─────────────────────────────────────────────────────────
  { name: 'Jalón al pecho en polea', locations: GYM, focus: ['pull', 'upper'], level: 'principiante', isCompound: true, contraindications: ['shoulder'] },
  { name: 'Remo en polea baja sentado', locations: GYM, focus: ['pull', 'upper'], level: 'principiante', isCompound: true, contraindications: ['lower_back'] },
  { name: 'Remo con mancuerna a un brazo', locations: GYM, focus: ['pull', 'upper'], level: 'principiante', isCompound: true, contraindications: ['lower_back'], isUnilateral: true },
  { name: 'Dominada asistida en máquina', locations: GYM, focus: ['pull', 'upper'], level: 'principiante', isCompound: true, contraindications: ['shoulder'] },
  { name: 'Curl de bíceps con mancuernas', locations: GYM, focus: ['pull', 'upper'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Curl martillo', locations: GYM, focus: ['pull', 'upper'], level: 'principiante', isCompound: false, contraindications: [] },

  // ─── Lower / Glúteos – Casa / Aire libre ─────────────────────────────────────
  { name: 'Hip thrust en suelo con carga', locations: HOME_OUT, focus: ['lower'], level: 'intermedio', isCompound: true, contraindications: [] },
  { name: 'Puente de glúteo con banda', locations: ALL, focus: ['lower'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Sentadilla búlgara', locations: ALL, focus: ['lower'], level: 'intermedio', isCompound: true, contraindications: ['knee'], isUnilateral: true },
  { name: 'Peso muerto rumano con botellas', locations: HOME, focus: ['lower', 'full_body'], level: 'intermedio', isCompound: true, contraindications: ['lower_back'] },
  { name: 'Peso muerto a una pierna', locations: ALL, focus: ['lower'], level: 'intermedio', isCompound: true, contraindications: ['lower_back'], isUnilateral: true },
  { name: 'Patada trasera en cuadrupedia', locations: ALL, focus: ['lower'], level: 'principiante', isCompound: false, contraindications: [], isUnilateral: true },
  { name: 'Abducción lateral acostada', locations: ALL, focus: ['lower'], level: 'principiante', isCompound: false, contraindications: [], isUnilateral: true },
  { name: 'Clamshell con banda', locations: ALL, focus: ['lower'], level: 'principiante', isCompound: false, contraindications: [], isUnilateral: true },
  { name: 'Elevación de talones (gemelos)', locations: ALL, focus: ['lower'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Zancada caminando', locations: ['aire_libre', 'gimnasio'], focus: ['lower'], level: 'principiante', isCompound: true, contraindications: ['knee'], isUnilateral: true },

  // ─── Lower – Gimnasio ────────────────────────────────────────────────────────
  { name: 'Prensa de piernas', locations: GYM, focus: ['lower'], level: 'principiante', isCompound: true, contraindications: ['lower_back'] },
  { name: 'Hip thrust en banco con barra', locations: GYM, focus: ['lower', 'full_body'], level: 'principiante', isCompound: true, contraindications: [] },
  { name: 'Peso muerto rumano con barra', locations: GYM, focus: ['lower', 'full_body'], level: 'principiante', isCompound: true, contraindications: ['lower_back'] },
  { name: 'Peso muerto convencional', locations: GYM, focus: ['full_body', 'lower'], level: 'intermedio', isCompound: true, contraindications: ['lower_back'] },
  { name: 'Sentadilla con barra', locations: GYM, focus: ['full_body', 'lower'], level: 'intermedio', isCompound: true, contraindications: ['knee', 'lower_back'] },
  { name: 'Sentadilla goblet', locations: GYM, focus: ['lower', 'full_body'], level: 'principiante', isCompound: true, contraindications: [] },
  { name: 'Curl femoral en máquina', locations: GYM, focus: ['lower'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Abducción de cadera en máquina', locations: GYM, focus: ['lower'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Extensión de cuádriceps en máquina', locations: GYM, focus: ['lower'], level: 'principiante', isCompound: false, contraindications: ['knee'] },

  // ─── Core ────────────────────────────────────────────────────────────────────
  { name: 'Plancha frontal', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: ['wrist_elbow'], isTimed: true },
  { name: 'Plancha lateral', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: ['shoulder', 'wrist_elbow'], isTimed: true, isUnilateral: true },
  { name: 'Crunch abdominal', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: ['lower_back'] },
  { name: 'Crunch de bicicleta', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: ['lower_back'] },
  { name: 'Bird dog', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: [], isUnilateral: true },
  { name: 'Dead bug', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Mountain climber', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: ['wrist_elbow'], isTimed: true },
  { name: 'Elevación de piernas acostada', locations: ALL, focus: ['core'], level: 'intermedio', isCompound: false, contraindications: ['lower_back'] },
  { name: 'Rotación con botella o disco', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: ['lower_back'] },
  { name: 'Pallof press con banda', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: [], isTimed: true },
  { name: 'Crunch en polea alta', locations: GYM, focus: ['core'], level: 'principiante', isCompound: false, contraindications: [] },
  { name: 'Elevación de piernas en barra', locations: GYM_OUT, focus: ['core'], level: 'intermedio', isCompound: false, contraindications: [] },
  { name: 'Rueda abdominal', locations: ['casa', 'gimnasio'], focus: ['core'], level: 'avanzado', isCompound: false, contraindications: ['lower_back', 'shoulder', 'wrist_elbow'] },
]

// Fallback core exercises sem nenhuma contraindicação — usados quando o pool está vazio
const CORE_FALLBACKS: Exercise[] = [
  { name: 'Bird dog', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: [], isUnilateral: true },
  { name: 'Dead bug', locations: ALL, focus: ['core'], level: 'principiante', isCompound: false, contraindications: [] },
]

const COMPOUND_FALLBACK: Exercise = {
  name: 'Sentadilla con peso corporal',
  locations: ALL,
  focus: ['full_body', 'lower'],
  level: 'principiante',
  isCompound: true,
  contraindications: [],
}

/**
 * Retorna exercícios filtrados por local, foco do dia, nível do usuário e contraindicações.
 * `useFallbacks` acrescenta opções sem contraindicações quando o pool está vazio.
 */
export function exercisesFor(
  location: ExLocation,
  focus: DayFocus,
  userLevel: ExLevel,
  limitations: PhysicalLimitation[],
): Exercise[] {
  const userRank = LEVEL_RANK[userLevel]
  const activeLims = limitations.filter((l) => l !== 'none') as PhysicalLimitation[]
  return EXERCISE_CATALOG.filter(
    (ex) =>
      ex.locations.includes(location) &&
      ex.focus.includes(focus) &&
      LEVEL_RANK[ex.level] <= userRank &&
      !ex.contraindications.some((c) => activeLims.includes(c)),
  )
}

export { CORE_FALLBACKS, COMPOUND_FALLBACK }
