import { supabase } from './supabase'
import type { Profile } from '../types'

export const emptyProfile = (): Profile => ({
  height: null,
  birth_date: null,
  gender: null,
  goals: [],
  schedule: {}
})

/** Web版と同じく、未登録時はnull（プロフィール画面側でデフォルト値を出す）。 */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    height: data.height as number | null,
    birth_date: data.birth_date as string | null,
    gender: data.gender as 'male' | 'female' | null,
    goals: (data.goals ?? []) as string[],
    schedule: (data.schedule ?? {}) as Profile['schedule']
  }
}

export async function upsertProfile(userId: string, profile: Profile): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId,
    height: profile.height,
    birth_date: profile.birth_date,
    gender: profile.gender,
    goals: profile.goals,
    schedule: profile.schedule
  })
  if (error) throw error
}
