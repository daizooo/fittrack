import type { ExerciseType, SessionExercise, SetData, WorkoutRecord } from '../types'

// 記録・分析は種目単位で行う（プランは自由に作り替えられるため、集計の軸にしない）。
// 種目は名前で同一視する（別プランに同じ名前の種目があれば同じ種目として扱う。
// セッション開始時に前回値を引き継ぐ buildSession と同じ規則）。

export const exerciseKey = (name: string) => name.trim()

export const amountUnit = (type: ExerciseType) => (type === 'normal' ? '回' : '秒')

/** 1セットの量: 通常=回数、時間=秒数、Tabata=work秒×サイクル */
export const setAmount = (type: ExerciseType, s: SetData) =>
  type === 'tabata' ? (s.tabataWork ?? 0) * (s.tabataCycles ?? 0) : Number(s.reps) || 0

/** 負荷の表示名（器具の選択肢ラベルがあればそれを使う） */
export const loadLabel = (ex: Pick<SessionExercise, 'options'>, weight: number) =>
  ex.options?.find(o => o.weight === weight)?.label ?? `${weight > 0 ? '+' : ''}${weight}kg`

export const setLabel = (ex: SessionExercise, s: SetData) => {
  if (ex.type === 'tabata') return `${s.tabataWork}s/${s.tabataRest}s × ${s.tabataCycles}`
  const amount = `${s.reps}${amountUnit(ex.type)}`
  return s.weight ? `${loadLabel(ex, s.weight)} × ${amount}` : amount
}

/** ある種目の、1回のワークアウトでの実施内容 */
export interface ExerciseSession {
  recordId: number
  fullDate: string
  date: string
  day: string
  planName?: string
  exercise: SessionExercise
  completedSets: SetData[]
  totalSets: number
  amount: number                 // 完了セットの合計（回 or 秒）
  bestAmount: number             // 1セットの最大（回 or 秒）
  maxWeight: number | null       // 完了セットの最大負荷。補助は負値なので数値が大きいほど高負荷。負荷なしは null
  prWeight: boolean              // それまでの最大負荷を更新した
  prAmount: boolean              // それまでの1セット最大を更新した
}

const toSession = (record: WorkoutRecord, ex: SessionExercise): ExerciseSession | null => {
  const completedSets = ex.sets.filter(s => s.completed)
  if (completedSets.length === 0) return null
  const amounts = completedSets.map(s => setAmount(ex.type, s))
  const weights = ex.type === 'tabata' ? [] : completedSets.map(s => Number(s.weight) || 0)
  return {
    recordId: record.id,
    fullDate: record.fullDate,
    date: record.date,
    day: record.day,
    planName: record.category,
    exercise: ex,
    completedSets,
    totalSets: ex.sets.length,
    amount: amounts.reduce((a, b) => a + b, 0),
    bestAmount: Math.max(...amounts),
    maxWeight: weights.some(w => w !== 0) ? Math.max(...weights) : null,
    prWeight: false,
    prAmount: false
  }
}

/** 種目ごとの実施履歴（新しい順）。自己ベスト更新フラグつき */
export const exerciseHistory = (records: WorkoutRecord[], name: string): ExerciseSession[] => {
  const key = exerciseKey(name)
  const sessions = records
    .filter(r => r.type === 'workout')
    .flatMap(r => r.exercises
      .filter(ex => exerciseKey(ex.name) === key)
      .map(ex => toSession(r, ex))
      .filter((s): s is ExerciseSession => s !== null))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate))

  let bestW: number | null = null
  let bestA = 0
  sessions.forEach((s, i) => {
    if (i > 0) {
      s.prWeight = s.maxWeight !== null && (bestW === null || s.maxWeight > bestW)
      s.prAmount = s.bestAmount > bestA
    }
    if (s.maxWeight !== null && (bestW === null || s.maxWeight > bestW)) bestW = s.maxWeight
    bestA = Math.max(bestA, s.bestAmount)
  })
  return sessions.reverse()
}

/** 期間内の種目別サマリー */
export interface ExerciseSummary {
  name: string
  type: ExerciseType
  exercise: SessionExercise      // 最新の実施内容（負荷ラベルの参照用）
  sessions: number
  completedSets: number
  amount: number
  bestAmount: number
  maxWeight: number | null
  lastDate: string
}

export const summarizeExercises = (records: WorkoutRecord[]): ExerciseSummary[] => {
  const map = new Map<string, ExerciseSummary>()
  const sorted = [...records].sort((a, b) => b.fullDate.localeCompare(a.fullDate))
  sorted.filter(r => r.type === 'workout').forEach(r => {
    r.exercises.forEach(ex => {
      const s = toSession(r, ex)
      if (!s) return
      const key = exerciseKey(ex.name)
      const cur = map.get(key)
      if (!cur) {
        map.set(key, {
          name: key, type: ex.type, exercise: ex, sessions: 1,
          completedSets: s.completedSets.length, amount: s.amount, bestAmount: s.bestAmount,
          maxWeight: s.maxWeight, lastDate: r.fullDate
        })
        return
      }
      cur.sessions++
      cur.completedSets += s.completedSets.length
      cur.amount += s.amount
      cur.bestAmount = Math.max(cur.bestAmount, s.bestAmount)
      if (s.maxWeight !== null) cur.maxWeight = cur.maxWeight === null ? s.maxWeight : Math.max(cur.maxWeight, s.maxWeight)
    })
  })
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || b.lastDate.localeCompare(a.lastDate))
}
