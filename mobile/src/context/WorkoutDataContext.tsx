import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren
} from 'react'
import { fetchOrSeedPlans, upsertPlan } from '../lib/plans'
import { addDataEquipment, addLoadEquipment, deleteEquipment, fetchOrSeedEquipment } from '../lib/equipment'
import { addBodyLog as insertBodyLog, deleteBodyLog as removeBodyLog, fetchBodyLogs } from '../lib/bodyLogs'
import { fetchProfile, upsertProfile } from '../lib/profile'
import { fetchRecords, saveRestRecord, saveWorkoutRecord } from '../lib/records'
import { generateEquipmentOptions } from '../lib/equipmentUtils'
import { pendingRecordsFor, queueRestRecord, queueWorkoutRecord, usePendingRecordsFlush } from '../lib/offlineRecords'
import type {
  BodyLog, EquipmentItem, EquipmentOption, EquipmentWeightConfig, Profile,
  SessionData, WorkoutPlan, WorkoutRecord
} from '../types'

interface WorkoutDataContextValue {
  userId: string
  plans: WorkoutPlan[]
  equipment: EquipmentItem[]
  records: WorkoutRecord[]
  profile: Profile | null
  bodyLogs: BodyLog[]
  equipmentOptionsMap: Map<string, EquipmentOption[]>
  dataLoading: boolean
  loadError: string | null
  pendingRecordCount: number
  savePlan: (plan: WorkoutPlan) => Promise<void>
  recordWorkout: (session: SessionData) => Promise<WorkoutRecord>
  recordRest: (day: string) => Promise<WorkoutRecord>
  retryPendingRecords: () => Promise<void>
  saveProfile: (profile: Profile) => Promise<void>
  addBodyLog: (log: { date: string; weight: number | null; body_fat: number | null }) => Promise<void>
  deleteBodyLog: (id: string) => Promise<void>
  addLoadEquipmentItem: (name: string, direction: '+' | '-' | null, weight: EquipmentWeightConfig) => Promise<void>
  addDataEquipmentItem: (name: string) => Promise<void>
  removeEquipmentItem: (equipId: string) => Promise<void>
}

const WorkoutDataContext = createContext<WorkoutDataContextValue | null>(null)

interface WorkoutDataProviderProps { userId: string }

export function WorkoutDataProvider({ userId, children }: PropsWithChildren<WorkoutDataProviderProps>) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setDataLoading(true)
      setLoadError(null)
      try {
        const [plansData, equipmentData, recordsData, profileData, bodyLogsData, pendingRecords] = await Promise.all([
          fetchOrSeedPlans(userId),
          fetchOrSeedEquipment(userId),
          fetchRecords(userId),
          fetchProfile(userId),
          fetchBodyLogs(userId),
          pendingRecordsFor(userId)
        ])
        if (cancelled) return
        setPlans(plansData)
        setEquipment(equipmentData)
        // アプリ再起動をまたいで未送信のままだった記録も一覧に混ぜて表示する（再送信は下のフックが担う）
        const knownIds = new Set(recordsData.map(r => r.id))
        const mergedRecords = [...pendingRecords.filter(r => !knownIds.has(r.id)), ...recordsData]
        setRecords(mergedRecords)
        setProfile(profileData)
        setBodyLogs(bodyLogsData)
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
    let record: WorkoutRecord
    try {
      record = await saveWorkoutRecord(userId, session)
    } catch (err) {
      console.error('Failed to save workout record online, keeping it on-device instead:', err)
      record = await queueWorkoutRecord(userId, session)
    }
    setRecords(prev => [record, ...prev])
    return record
  }, [userId])

  const recordRest = useCallback(async (day: string) => {
    let record: WorkoutRecord
    try {
      record = await saveRestRecord(userId, day)
    } catch (err) {
      console.error('Failed to save rest record online, keeping it on-device instead:', err)
      record = await queueRestRecord(userId, day)
    }
    setRecords(prev => [record, ...prev])
    return record
  }, [userId])

  // 未送信レコードはキューへ入れた時点で既にrecordsへ表示済みなので、
  // 送信成功時にリストへ追加し直す必要はない（AsyncStorage側から消えるだけ）。
  const handleFlushed = useCallback((_flushed: WorkoutRecord[]) => {}, [])
  const { pendingCount: pendingRecordCount, retry: retryPendingRecords } = usePendingRecordsFlush(userId, handleFlushed)

  const saveProfile = useCallback(async (next: Profile) => {
    await upsertProfile(userId, next)
    setProfile(next)
  }, [userId])

  const addBodyLog = useCallback(async (log: { date: string; weight: number | null; body_fat: number | null }) => {
    const entry = await insertBodyLog(userId, log)
    setBodyLogs(prev => [entry, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
  }, [userId])

  const deleteBodyLog = useCallback(async (id: string) => {
    await removeBodyLog(id)
    setBodyLogs(prev => prev.filter(l => l.id !== id))
  }, [])

  const addLoadEquipmentItem = useCallback(async (name: string, direction: '+' | '-' | null, weight: EquipmentWeightConfig) => {
    const item = await addLoadEquipment(userId, name, direction, weight)
    setEquipment(prev => [...prev, item])
  }, [userId])

  const addDataEquipmentItem = useCallback(async (name: string) => {
    const item = await addDataEquipment(userId, name)
    setEquipment(prev => [...prev, item])
  }, [userId])

  const removeEquipmentItem = useCallback(async (equipId: string) => {
    await deleteEquipment(userId, equipId)
    setEquipment(prev => prev.filter(e => e.id !== equipId))
  }, [userId])

  const value = useMemo<WorkoutDataContextValue>(() => ({
    userId, plans, equipment, records, profile, bodyLogs, equipmentOptionsMap, dataLoading, loadError,
    pendingRecordCount, savePlan, recordWorkout, recordRest, retryPendingRecords, saveProfile,
    addBodyLog, deleteBodyLog, addLoadEquipmentItem, addDataEquipmentItem, removeEquipmentItem
  }), [
    userId, plans, equipment, records, profile, bodyLogs, equipmentOptionsMap, dataLoading, loadError,
    pendingRecordCount, savePlan, recordWorkout, recordRest, retryPendingRecords, saveProfile,
    addBodyLog, deleteBodyLog, addLoadEquipmentItem, addDataEquipmentItem, removeEquipmentItem
  ])

  return <WorkoutDataContext.Provider value={value}>{children}</WorkoutDataContext.Provider>
}

export function useWorkoutData() {
  const value = useContext(WorkoutDataContext)
  if (!value) throw new Error('useWorkoutData must be used within a WorkoutDataProvider')
  return value
}
