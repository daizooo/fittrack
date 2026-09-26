import { supabase } from './supabase'
import { DEFAULT_LOAD_EQUIPMENT } from './equipmentUtils'
import type { EquipmentItem } from '../types'

/** Web版と同じ「初回ログイン時にデフォルト機材をシードする」挙動をmobileでも踏襲。 */
export async function fetchOrSeedEquipment(userId: string): Promise<EquipmentItem[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error

  if (data && data.length > 0) {
    return data.map(e => ({
      id: e.id as string,
      name: e.name as string,
      category: e.category as 'load' | 'data',
      direction: e.direction as '+' | '-' | null,
      weight: e.weight as EquipmentItem['weight']
    }))
  }

  const { error: insertError } = await supabase.from('equipment').insert(
    DEFAULT_LOAD_EQUIPMENT.map(item => ({
      id: item.id,
      user_id: userId,
      name: item.name,
      category: item.category,
      direction: item.direction,
      weight: item.weight
    }))
  )
  if (insertError) throw insertError
  return DEFAULT_LOAD_EQUIPMENT
}
