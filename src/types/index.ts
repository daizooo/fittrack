export type EquipmentType = 'bodyweight' | 'tube' | 'assist' | 'vest'
export type ExerciseType = 'normal' | 'duration' | 'tabata'
export type RecordType = 'workout' | 'rest'
export type TimerType = 'work' | 'rest' | 'tabata_work' | 'tabata_rest'

export interface EquipmentOption {
  label: string
  weight: number
}

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  targetSets: number
  defaultReps: number
  defaultWeight: number
  interval: number
  equipmentType: EquipmentType
  tabataWork?: number
  tabataRest?: number
  tabataCycles?: number
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
