import type { WorkoutRecord } from '../types'

export type PeriodMode = 'month' | 'year'

export const filterRecordsByPeriod = (records: WorkoutRecord[], mode: PeriodMode, anchor: Date) =>
  records.filter(r => {
    const d = new Date(r.fullDate)
    if (d.getFullYear() !== anchor.getFullYear()) return false
    return mode === 'year' || d.getMonth() === anchor.getMonth()
  })

export interface PeriodStats {
  workoutDays: number
  restDays: number
  completedSets: number
  totalRepsOrSeconds: number
  consistencyRate: number
  planBreakdown: { name: string; count: number; pct: number }[]
}

export const computeStats = (records: WorkoutRecord[]): PeriodStats => {
  const workouts = records.filter(r => r.type === 'workout')
  const restDays = records.length - workouts.length
  let completedSets = 0
  let totalRepsOrSeconds = 0
  const planCount: Record<string, number> = {}

  workouts.forEach(record => {
    if (record.category) planCount[record.category] = (planCount[record.category] ?? 0) + 1
    record.exercises.forEach(ex => {
      ex.sets.filter(s => s.completed).forEach(set => {
        completedSets++
        totalRepsOrSeconds += ex.type === 'tabata'
          ? (set.tabataWork ?? 0) * (set.tabataCycles ?? 0)
          : Number(set.reps) || 0
      })
    })
  })

  const planBreakdown = Object.entries(planCount)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / workouts.length) * 100) }))
    .sort((a, b) => b.count - a.count)

  return {
    workoutDays: workouts.length,
    restDays,
    completedSets,
    totalRepsOrSeconds,
    consistencyRate: records.length > 0 ? Math.round((workouts.length / records.length) * 100) : 0,
    planBreakdown
  }
}

/** 月カレンダー用のマス（先頭・末尾は null で埋める。日曜始まり） */
export const monthCalendarCells = (anchor: Date): (Date | null)[] => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** 年表示用: 月ごとのトレーニング日数 */
export const workoutDaysByMonth = (records: WorkoutRecord[]) => {
  const counts = Array.from({ length: 12 }, () => 0)
  records.forEach(r => { if (r.type === 'workout') counts[new Date(r.fullDate).getMonth()]++ })
  return counts
}
