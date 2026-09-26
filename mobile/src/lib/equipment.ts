import { supabase } from './supabase'
import { DEFAULT_LOAD_EQUIPMENT } from './equipmentUtils'
import type { EquipmentItem, EquipmentWeightConfig } from '../types'

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

export async function addLoadEquipment(
  userId: string, name: string, direction: '+' | '-' | null, weight: EquipmentWeightConfig
): Promise<EquipmentItem> {
  const { data, error } = await supabase.from('equipment').insert({
    user_id: userId, name, category: 'load', direction, weight
  }).select().single()
  if (error) throw error

  return {
    id: data.id as string,
    name: data.name as string,
    category: 'load',
    direction: data.direction as '+' | '-' | null,
    weight: data.weight as EquipmentWeightConfig
  }
}

export async function addDataEquipment(userId: string, name: string): Promise<EquipmentItem> {
  const { data, error } = await supabase.from('equipment').insert({
    user_id: userId, name, category: 'data', direction: null, weight: null
  }).select().single()
  if (error) throw error

  return {
    id: data.id as string,
    name: data.name as string,
    category: 'data',
    direction: null,
    weight: null
  }
}

export async function deleteEquipment(userId: string, equipId: string): Promise<void> {
  const { error } = await supabase.from('equipment').delete().eq('id', equipId).eq('user_id', userId)
  if (error) throw error
}
