import type {
  WorkoutPlan, WorkoutRecord, Exercise, Stretch, SessionExercise, SessionStretch,
  SessionData, SetData, EquipmentOption
} from '../types'
import { daysOfWeek } from './dates'

// ─── DB row mapping ──────────────────────────────────────────────────────────

export interface WorkoutPlanRow {
  id: string
  name: string
  exercises: Exercise[] | null
  warmup: Stretch[] | null
  cooldown: Stretch[] | null
  sort_order: number | null
}

export const planFromRow = (r: WorkoutPlanRow): WorkoutPlan => ({
  id: r.id,
  name: r.name,
  exercises: r.exercises ?? [],
  warmup: r.warmup ?? [],
  cooldown: r.cooldown ?? [],
  sortOrder: r.sort_order ?? 0
})

export const planToRow = (p: WorkoutPlan, userId: string) => ({
  id: p.id,
  user_id: userId,
  name: p.name,
  exercises: p.exercises,
  warmup: p.warmup,
  cooldown: p.cooldown,
  sort_order: p.sortOrder
})

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/** workout_plans.id は uuid 型。randomUUID が無い環境（非HTTPS等）向けにフォールバックする */
export const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export const createEmptyPlan = (sortOrder: number): WorkoutPlan => ({
  id: uuid(),
  name: '',
  exercises: [],
  warmup: [],
  cooldown: [],
  sortOrder
})

// ─── Circuit ─────────────────────────────────────────────────────────────────

export const CIRCUIT_DEFAULTS = { work: 40, rest: 20, rounds: 3 } as const

/** サーキットの1ステーション。運動秒数・休憩・周回数は同じサーキット内で共通 */
export const createCircuitStation = (group: string, over: Partial<Exercise> = {}): Exercise => ({
  id: newId('ex'), name: '', type: 'duration', targetSets: CIRCUIT_DEFAULTS.rounds,
  defaultReps: CIRCUIT_DEFAULTS.work, defaultWeight: 0, interval: CIRCUIT_DEFAULTS.rest,
  equipmentType: 'bodyweight', supersetGroup: group, circuit: true, ...over
})

export type ExerciseSegment =
  | { kind: 'single'; start: number; items: [Exercise] }
  | { kind: 'circuit'; group: string; start: number; items: Exercise[] }

/** 種目リストを「単独の種目」と「サーキット（連続するステーションの塊）」に分ける */
export const segmentExercises = (exercises: Exercise[]): ExerciseSegment[] => {
  const segs: ExerciseSegment[] = []
  exercises.forEach((ex, i) => {
    const last = segs[segs.length - 1]
    if (ex.circuit && ex.supersetGroup) {
      if (last?.kind === 'circuit' && last.group === ex.supersetGroup) last.items.push(ex)
      else segs.push({ kind: 'circuit', group: ex.supersetGroup, start: i, items: [ex] })
    } else {
      segs.push({ kind: 'single', start: i, items: [ex] })
    }
  })
  return segs
}

// ─── Plan summary ────────────────────────────────────────────────────────────

/** プランの所要時間の目安（分）。セット・インターバル・ストレッチから概算する */
export const estimatePlanMinutes = (plan: WorkoutPlan) => {
  let sec = 0
  plan.exercises.forEach(ex => {
    const perSet = ex.type === 'tabata'
      ? (ex.tabataWork ?? 20) * (ex.tabataCycles ?? 8) + (ex.tabataRest ?? 10) * Math.max(0, (ex.tabataCycles ?? 8) - 1)
      : ex.type === 'duration' ? ex.defaultReps : ex.defaultReps * 3
    sec += ex.targetSets * (perSet + ex.interval)
  })
  ;[...plan.warmup, ...plan.cooldown].forEach(s => { sec += s.seconds * (s.bilateral ? 2 : 1) + 5 })
  return Math.max(1, Math.round(sec / 60))
}

/** プラン名ごとの最終実施日時（records は新しい順を想定） */
export const lastPerformedMap = (records: WorkoutRecord[]) => {
  const map = new Map<string, string>()
  records.forEach(r => {
    if (r.type === 'workout' && r.category && !map.has(r.category)) map.set(r.category, r.fullDate)
  })
  return map
}

/** おすすめ: 一度も実施していないプラン → 最も前回から日が空いているプラン */
export const recommendPlanId = (plans: WorkoutPlan[], records: WorkoutRecord[]): string | null => {
  const candidates = plans.filter(p => p.exercises.length > 0)
  if (candidates.length === 0) return null
  const last = lastPerformedMap(records)
  const sorted = [...candidates].sort((a, b) => {
    const la = last.get(a.name)
    const lb = last.get(b.name)
    if (!la && !lb) return a.sortOrder - b.sortOrder
    if (!la) return -1
    if (!lb) return 1
    return la.localeCompare(lb)
  })
  return sorted[0].id
}

// ─── Session building ────────────────────────────────────────────────────────

export const expandStretches = (list: Stretch[]): SessionStretch[] =>
  list.flatMap(s => s.bilateral
    ? [
        { id: `${s.id}-L`, name: `${s.name}（左）`, seconds: s.seconds, completed: false },
        { id: `${s.id}-R`, name: `${s.name}（右）`, seconds: s.seconds, completed: false }
      ]
    : [{ id: s.id, name: s.name, seconds: s.seconds, completed: false }])

export const buildSession = (
  plan: WorkoutPlan,
  records: WorkoutRecord[],
  equipmentOptionsMap: Map<string, EquipmentOption[]>,
  now: Date = new Date()
): SessionData => {
  const exercises: SessionExercise[] = plan.exercises.map(ex => {
    const lastWorkout = records.find(r => r.type === 'workout' && r.exercises.some(e => e.name === ex.name))
    const lastEx = lastWorkout ? lastWorkout.exercises.find(e => e.name === ex.name) : null
    const inherited = !!lastEx

    let sets: SetData[]
    if (inherited && lastEx) {
      sets = lastEx.sets.map(s => ({ ...s, completed: false }))
    } else {
      sets = Array.from({ length: ex.targetSets }, (_, i) => ({
        setNumber: i + 1,
        reps: ex.type === 'tabata' ? 0 : ex.defaultReps,
        weight: ex.defaultWeight || 0,
        completed: false,
        tabataWork: ex.type === 'tabata' ? ex.tabataWork : 0,
        tabataRest: ex.type === 'tabata' ? ex.tabataRest : 0,
        tabataCycles: ex.type === 'tabata' ? ex.tabataCycles : 0
      }))
    }

    return {
      ...ex,
      inherited,
      options: equipmentOptionsMap.get(ex.equipmentType) ?? [{ label: 'ー', weight: 0 }],
      targetSets: inherited && lastEx ? lastEx.sets.length : ex.targetSets,
      sets
    }
  })

  return {
    date: `${now.getMonth() + 1}/${now.getDate()}`,
    fullDate: now.toISOString(),
    day: daysOfWeek[now.getDay()],
    category: plan.name,
    exercises,
    stretches: { warmup: expandStretches(plan.warmup), cooldown: expandStretches(plan.cooldown) }
  }
}
