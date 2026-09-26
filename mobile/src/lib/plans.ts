import { supabase } from './supabase'
import { initialWorkoutPlans } from './workoutPlans'
import type { Exercise, WorkoutPlan } from '../types'

const dayOrder = ['月', '火', '水', '木', '金', '土', '日']

/** Web版と同じ「初回ログイン時にデフォルトプランをシードする」挙動をmobileでも踏襲。 */
export async function fetchOrSeedPlans(userId: string): Promise<WorkoutPlan[]> {
  const { data, error } = await supabase.from('plans').select('*').eq('user_id', userId)
  if (error) throw error

  if (data && data.length > 0) {
    const sorted = [...data].sort(
      (a, b) => dayOrder.indexOf(a.day as string) - dayOrder.indexOf(b.day as string)
    )
    return sorted.map(p => ({
      day: p.day as string,
      category: p.category as string,
      exercises: p.exercises as Exercise[]
    }))
  }

  const { error: insertError } = await supabase.from('plans').insert(
    initialWorkoutPlans.map(p => ({
      user_id: userId,
      day: p.day,
      category: p.category,
      exercises: p.exercises
    }))
  )
  if (insertError) throw insertError
  return initialWorkoutPlans
}

export async function upsertPlan(userId: string, plan: WorkoutPlan): Promise<void> {
  const { error } = await supabase.from('plans').upsert({
    user_id: userId,
    day: plan.day,
    category: plan.category,
    exercises: plan.exercises
  }, { onConflict: 'user_id,day' })
  if (error) throw error
}
