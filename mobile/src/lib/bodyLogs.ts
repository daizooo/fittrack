import { supabase } from './supabase'
import type { BodyLog } from '../types'

export async function fetchBodyLogs(userId: string): Promise<BodyLog[]> {
  const { data, error } = await supabase
    .from('body_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error

  return (data ?? []).map(b => ({
    id: b.id as string,
    date: b.date as string,
    weight: b.weight as number | null,
    body_fat: b.body_fat as number | null
  }))
}

export async function addBodyLog(
  userId: string, log: { date: string; weight: number | null; body_fat: number | null }
): Promise<BodyLog> {
  const { data, error } = await supabase.from('body_logs').insert({
    user_id: userId,
    date: log.date,
    weight: log.weight,
    body_fat: log.body_fat
  }).select().single()
  if (error) throw error

  return {
    id: data.id as string,
    date: data.date as string,
    weight: data.weight as number | null,
    body_fat: data.body_fat as number | null
  }
}

export async function deleteBodyLog(id: string): Promise<void> {
  const { error } = await supabase.from('body_logs').delete().eq('id', id)
  if (error) throw error
}
