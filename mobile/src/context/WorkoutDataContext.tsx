import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren
} from 'react'
import { fetchOrSeedPlans, upsertPlan } from '../lib/plans'
import { fetchOrSeedEquipment } from '../lib/equipment'
import { fetchRecords, saveRestRecord, saveWorkoutRecord } from '../lib/records'
import { generateEquipmentOptions } from '../lib/equipmentUtils'
import type {
  EquipmentItem, EquipmentOption, SessionData, WorkoutPlan, WorkoutRecord
} from '../types'

interface WorkoutDataContextValue {
  userId: string
  plans: WorkoutPlan[]
  equipment: EquipmentItem[]
  records: WorkoutRecord[]
  equipmentOptionsMap: Map<string, EquipmentOption[]>
  dataLoading: boolean
  loadError: string | null
  savePlan: (plan: WorkoutPlan) => Promise<void>
  recordWorkout: (session: SessionData) => Promise<WorkoutRecord>
  recordRest: (day: string) => Promise<WorkoutRecord>
}

const WorkoutDataContext = createContext<WorkoutDataContextValue | null>(null)

interface WorkoutDataProviderProps { userId: string }

export function WorkoutDataProvider({ userId, children }: PropsWithChildren<WorkoutDataProviderProps>) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setDataLoading(true)
      setLoadError(null)
      try {
        const [plansData, equipmentData, recordsData] = await Promise.all([
          fetchOrSeedPlans(userId),
          fetchOrSeedEquipment(userId),
          fetchRecords(userId)
        ])
        if (cancelled) return
        setPlans(plansData)
        setEquipment(equipmentData)
        setRecords(recordsData)
      } catch (err) {
        console.error('Failed to load data:', err)
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  const equipmentOptionsMap = useMemo(() => {
    const map = new Map<string, EquipmentOption[]>()
    equipment.filter(e => e.category === 'load').forEach(item => {
      map.set(item.id, generateEquipmentOptions(item))
    })
    return map
  }, [equipment])

  const savePlan = useCallback(async (plan: WorkoutPlan) => {
    await upsertPlan(userId, plan)
    setPlans(prev => prev.map(p => p.day === plan.day ? plan : p))
  }, [userId])

  const recordWorkout = useCallback(async (session: SessionData) => {
    const record = await saveWorkoutRecord(userId, session)
    setRecords(prev => [record, ...prev])
    return record
  }, [userId])

  const recordRest = useCallback(async (day: string) => {
    const record = await saveRestRecord(userId, day)
    setRecords(prev => [record, ...prev])
    return record
  }, [userId])

  const value = useMemo<WorkoutDataContextValue>(() => ({
    userId, plans, equipment, records, equipmentOptionsMap, dataLoading, loadError,
    savePlan, recordWorkout, recordRest
  }), [userId, plans, equipment, records, equipmentOptionsMap, dataLoading, loadError, savePlan, recordWorkout, recordRest])

  return <WorkoutDataContext.Provider value={value}>{children}</WorkoutDataContext.Provider>
}

export function useWorkoutData() {
  const value = useContext(WorkoutDataContext)
  if (!value) throw new Error('useWorkoutData must be used within a WorkoutDataProvider')
  return value
}
