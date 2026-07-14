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
}

export interface WorkoutPlan {
  day: string
  category: string
  exercises: Exercise[]
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

export interface WorkoutRecord {
  id: number
  date: string
  fullDate: string
  day: string
  category?: string
  type: RecordType
  exercises: SessionExercise[]
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
}

export interface SessionData {
  date: string
  fullDate: string
  day: string
  category: string
  exercises: SessionExercise[]
}

export interface Profile {
  height: number | null
  birth_date: string | null    // YYYY-MM-DD
  gender: 'male' | 'female' | null
  goals: string[]
  schedule: Record<string, { enabled: boolean; minutes: number }>
}

export interface BodyLog {
  id: string
  date: string    // YYYY-MM-DD
  weight: number | null
  body_fat: number | null
}
