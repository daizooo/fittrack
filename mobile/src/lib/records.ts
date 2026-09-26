import { supabase } from './supabase'
import type { SessionData, SessionExercise, WorkoutRecord } from '../types'

export async function fetchRecords(userId: string): Promise<WorkoutRecord[]> {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('user_id', userId)
    .order('full_date', { ascending: false })
  if (error) throw error

  return (data ?? []).map(r => ({
    id: r.id as number,
    date: r.date as string,
    fullDate: r.full_date as string,
    day: r.day as string,
    category: r.category as string | undefined,
    type: r.type as 'workout' | 'rest',
    exercises: (r.exercises ?? []) as SessionExercise[]
  }))
}

export async function saveWorkoutRecord(userId: string, session: SessionData): Promise<WorkoutRecord> {
  const record: WorkoutRecord = { ...session, id: Date.now(), type: 'workout' }
  const { error } = await supabase.from('records').insert({
    id: record.id,
    user_id: userId,
    full_date: record.fullDate,
    date: record.date,
    day: record.day,
    type: 'workout',
    category: record.category,
    exercises: record.exercises
  })
  if (error) throw error
  return record
}

export async function saveRestRecord(userId: string, day: string): Promise<WorkoutRecord> {
  const d = new Date()
  const record: WorkoutRecord = {
    id: Date.now(),
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    fullDate: d.toISOString(),
    day,
    type: 'rest',
    exercises: []
  }
  const { error } = await supabase.from('records').insert({
    id: record.id,
    user_id: userId,
    full_date: record.fullDate,
    date: record.date,
    day: record.day,
    type: 'rest',
    category: null,
    exercises: []
  })
  if (error) throw error
  return record
}
