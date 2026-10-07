import type {
  WorkoutPlan, WorkoutRecord, Exercise, CircuitStation, Stretch, SessionExercise, SessionStretch,
  SessionData, SetData, EquipmentOption
} from '../types'
import { daysOfWeek } from './dates'
import { sameExercise } from './exerciseLibrary'

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
  exercises: migrateLegacyCircuits(r.exercises ?? []),
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

export const createStation = (over: Partial<CircuitStation> = {}): CircuitStation => ({
  id: newId('st'), name: '', equipmentType: 'bodyweight', defaultWeight: 0, ...over
})

/** サーキット。運動秒数・休憩・周回数はサーキットが1つだけ持ち、種目は名前と機材・負荷だけ */
export const createCircuit = (): Exercise => ({
  id: newId('ci'), name: 'サーキット', type: 'circuit',
  targetSets: CIRCUIT_DEFAULTS.rounds, defaultReps: CIRCUIT_DEFAULTS.work, interval: CIRCUIT_DEFAULTS.rest,
  defaultWeight: 0, equipmentType: 'bodyweight',
  stations: []
})

/**
 * 旧形式（種目ごとにセット数・秒数・休憩を持つ circuit フラグ付きの種目の連なり）を
 * 現行形式（1つのサーキット＋種目リスト）へ変換する。現行形式のデータはそのまま返す。
 */
type LegacyExercise = Exercise & { circuit?: boolean }
export const migrateLegacyCircuits = (list: Exercise[]): Exercise[] => {
  if (!list.some(e => (e as LegacyExercise).circuit)) return list
  const out: Exercise[] = []
  const byGroup = new Map<string, Exercise>()
  list.forEach(raw => {
    const e = raw as LegacyExercise
    if (!e.circuit || !e.supersetGroup) { out.push(raw); return }
    let c = byGroup.get(e.supersetGroup)
    if (!c) {
      c = {
        id: e.supersetGroup, name: 'サーキット', type: 'circuit', targetSets: e.targetSets, defaultReps: e.defaultReps,
        interval: e.interval, defaultWeight: 0, equipmentType: 'bodyweight', stations: []
      }
      byGroup.set(e.supersetGroup, c)
      out.push(c)
    }
    c.stations!.push({ id: e.id, name: e.name, equipmentType: e.equipmentType, defaultWeight: e.defaultWeight })
  })
  return out
}

/** セッション中の種目リストを「単独の種目」と「サーキット（連続する種目の塊）」に分ける */
export type ExerciseSegment<T> =
  | { kind: 'single'; start: number; items: [T] }
  | { kind: 'circuit'; group: string; start: number; items: T[] }

export const segmentExercises = <T extends { circuit?: boolean; supersetGroup?: string }>(exercises: T[]): ExerciseSegment<T>[] => {
  const segs: ExerciseSegment<T>[] = []
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
    if (ex.type === 'circuit') {
      sec += (ex.stations?.length ?? 0) * ex.targetSets * (ex.defaultReps + ex.interval)
      return
    }
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
  const exercises: SessionExercise[] = plan.exercises.flatMap((ex): SessionExercise[] => {
    // サーキットは種目ごとの記録に展開する（記録・分析は通常の種目と同じ扱い）。
    // 周回数＝セット数、運動秒数＝回数(秒)、休憩は共通。前回の記録からは負荷だけを引き継ぐ
    if (ex.type === 'circuit') {
      return (ex.stations ?? []).map(st => {
        const lastWorkout = records.find(r => r.type === 'workout' && r.exercises.some(e => sameExercise(e, st)))
        const lastEx = lastWorkout?.exercises.find(e => sameExercise(e, st))
        const weightAt = (i: number) => lastEx ? (lastEx.sets[i] ?? lastEx.sets[lastEx.sets.length - 1])?.weight ?? st.defaultWeight : st.defaultWeight
        return {
          id: st.id, exerciseId: st.exerciseId, name: st.name, type: 'duration', targetSets: ex.targetSets, defaultReps: ex.defaultReps,
          defaultWeight: st.defaultWeight, interval: ex.interval, equipmentType: st.equipmentType,
          supersetGroup: ex.id, circuit: true, inherited: !!lastEx,
          options: equipmentOptionsMap.get(st.equipmentType) ?? [{ label: 'ー', weight: 0 }],
          sets: Array.from({ length: ex.targetSets }, (_, i) => ({
            setNumber: i + 1, reps: ex.defaultReps, weight: weightAt(i), completed: false,
            tabataWork: 0, tabataRest: 0, tabataCycles: 0
          }))
        }
      })
    }
    const lastWorkout = records.find(r => r.type === 'workout' && r.exercises.some(e => sameExercise(e, ex)))
    const lastEx = lastWorkout ? lastWorkout.exercises.find(e => sameExercise(e, ex)) : null
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

    return [{
      ...ex,
      inherited,
      options: equipmentOptionsMap.get(ex.equipmentType) ?? [{ label: 'ー', weight: 0 }],
      targetSets: inherited && lastEx ? lastEx.sets.length : ex.targetSets,
      sets
    }]
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
