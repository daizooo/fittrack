export type ExerciseType = 'normal' | 'duration' | 'tabata' | 'circuit'
export type RecordType = 'workout' | 'rest'
export type TimerType = 'work' | 'rest' | 'tabata_work' | 'tabata_rest'

/** 種目の主な部位 */
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs' | 'glutes' | 'cardio' | 'upper' | 'lower' | 'other'
/** 種目の入力タイプ: 回数 / 秒数 / HIIT（ラウンド） */
export type ExerciseKind = 'reps' | 'duration' | 'hiit'

/**
 * 種目マスタ。プラン・記録は exerciseId でこれを参照する（名前の表記ゆれで履歴が分かれない）。
 * 過去のトレーニング記録は持たず、records から exerciseId で集計する。
 * 標準の種目は id が 'sys:' で始まりアプリ内の固定カタログ、自作の種目は DB(exercises) の uuid。
 */
export interface ExerciseDef {
  id: string
  name: string
  muscle: MuscleGroup
  kind: ExerciseKind
  equipmentType: string           // 標準の負荷器具（EquipmentItem.id）。プランに入れるときの初期値
  note: string
  builtin: boolean
  aliases?: string[]              // 標準種目の別名（検索・旧データの名前照合用）
}

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
  exerciseId?: string             // 種目マスタ(ExerciseDef.id)への参照。name は表示用のスナップショット
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
  /**
   * type === 'circuit' のときの種目リスト。サーキット自体が運動・休憩・周回数を1つだけ持つ:
   *   defaultReps = 運動秒数 / interval = 休憩秒数 / targetSets = 周回数（種目ごとには持たない）
   */
  stations?: CircuitStation[]
}

/** サーキットの1種目。セット数・回数・休憩は持たず、機材と負荷だけを持つ */
export interface CircuitStation {
  id: string
  exerciseId?: string
  name: string
  equipmentType: string
  defaultWeight: number
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
  /** サーキットの種目。実施時は種目ごとの記録に展開し、supersetGroup にサーキットの ID を入れる */
  circuit?: boolean
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
