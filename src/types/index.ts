export type ExerciseType = 'normal' | 'duration' | 'tabata'
export type RecordType = 'workout' | 'rest'
export type TimerType = 'work' | 'rest' | 'tabata_work' | 'tabata_rest'

export interface EquipmentOption {
  label: string
  weight: number
}

export interface EquipmentWeightConfig {
  type: 'fixed' | 'variable'
  options?: EquipmentOption[]  // fixed: explicit option list
  min?: number                 // variable: range
  max?: number
  step?: number
}

export interface EquipmentItem {
  id: string                      // 'bodyweight'|'tube'|'assist'|'vest' for defaults, uuid for custom
  name: string
  category: 'load' | 'data'
  direction: '+' | '-' | null     // null = bodyweight-like
  weight: EquipmentWeightConfig | null
}

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  targetSets: number
  defaultReps: number
  defaultWeight: number
  interval: number
  equipmentType: string           // references EquipmentItem.id
  tabataWork?: number
  tabataRest?: number
  tabataCycles?: number
  supersetGroup?: string          // exercises sharing the same non-empty value are performed as a superset
  circuit?: boolean               // true = サーキットの1ステーション（supersetGroup を共有する連続した種目が1つのサーキット）
}

/** ワークアウト前後のストレッチ1項目 */
export interface Stretch {
  id: string
  name: string
  seconds: number                 // 1回（片側）あたりの秒数
  bilateral?: boolean             // true = 左右それぞれ実施（セッションでは左・右の2行に展開）
}

/** ユーザーが自由に作成するワークアウトプラン（曜日には紐付かない） */
export interface WorkoutPlan {
  id: string
  name: string
  exercises: Exercise[]
  warmup: Stretch[]
  cooldown: Stretch[]
  sortOrder: number
}

export interface SetData {
  setNumber: number
  reps: number
  weight: number
  completed: boolean
  tabataWork?: number
  tabataRest?: number
  tabataCycles?: number
}

export interface SessionExercise extends Exercise {
  inherited: boolean
  options: EquipmentOption[]
  sets: SetData[]
}

export type StretchPhase = 'warmup' | 'cooldown'

export interface SessionStretch {
  id: string
  name: string                    // 左右展開済みの表示名（例: 「ハムストリング（左）」）
  seconds: number
  completed: boolean
}

export interface SessionStretches {
  warmup: SessionStretch[]
  cooldown: SessionStretch[]
}

export interface WorkoutRecord {
  id: number
  date: string
  fullDate: string
  day: string
  category?: string               // 実施したプラン名
  type: RecordType
  exercises: SessionExercise[]
  stretches?: SessionStretches | null
}

export interface TimerState {
  isActive: boolean
  type: TimerType | null
  endTime: number
  remaining: number
  exIdx: number | null
  setIdx: number | null
  interval: number
  tabataWork: number
  tabataRest: number
  tabataCycles: number
  currentCycle: number
  stretch: { phase: StretchPhase; idx: number; chain: boolean } | null
}

export interface SessionData {
  date: string
  fullDate: string
  day: string
  category: string
  exercises: SessionExercise[]
  stretches: SessionStretches
}

export interface Profile {
  height: number | null
  birth_date: string | null    // YYYY-MM-DD
  gender: 'male' | 'female' | null
}

export interface BodyLog {
  id: string
  date: string    // YYYY-MM-DD
  weight: number | null
  body_fat: number | null
}
