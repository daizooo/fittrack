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

export function buildWorkoutRecord(session: SessionData): WorkoutRecord {
  return { ...session, id: Date.now(), type: 'workout' }
}

export function buildRestRecord(day: string): WorkoutRecord {
  const d = new Date()
  return {
    id: Date.now(),
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    fullDate: d.toISOString(),
    day,
    type: 'rest',
    exercises: []
  }
}

/**
 * すでに組み立て済みのWorkoutRecord（idも含む）をそのままSupabaseへ書き込む。
 * オフライン時に一時保存したレコードを後から再送信する場合、id/fullDateを保ったまま
 * 挿入するためにbuild関数と分離してある。
 */
export async function insertRecord(userId: string, record: WorkoutRecord): Promise<void> {
  const { error } = await supabase.from('records').insert({
    id: record.id,
    user_id: userId,
    full_date: record.fullDate,
    date: record.date,
    day: record.day,
    type: record.type,
    category: record.category ?? null,
    exercises: record.exercises
  })
  if (error) throw error
}

export async function saveWorkoutRecord(userId: string, session: SessionData): Promise<WorkoutRecord> {
  const record = buildWorkoutRecord(session)
  await insertRecord(userId, record)
  return record
}

export async function saveRestRecord(userId: string, day: string): Promise<WorkoutRecord> {
  const record = buildRestRecord(day)
  await insertRecord(userId, record)
  return record
}
