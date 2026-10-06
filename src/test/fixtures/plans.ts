import type { WorkoutPlan } from '../../types'
import { defaultPlanSeeds } from '../../lib/defaultPlans'

/** 新規アカウントに用意されるサンプルプラン（テスト用に固定IDを付与） */
export const initialWorkoutPlans: WorkoutPlan[] = defaultPlanSeeds.map((p, i) => ({
  ...p,
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  sortOrder: i + 1
}))

export const LOWER_PLAN_NAME = '下半身＋VO₂MAX＋体幹'
export const lowerBodyPlan = initialWorkoutPlans.find(p => p.name === LOWER_PLAN_NAME)!
export const ssExerciseLeft = lowerBodyPlan.exercises.find(e => e.name === 'ブルガリアンSS（左）')!
export const ssExerciseRight = lowerBodyPlan.exercises.find(e => e.name === 'ブルガリアンSS（右）')!
