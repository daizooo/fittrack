import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Dumbbell, CalendarDays, BarChart3, BookOpen, LogOut, User, Play, Timer, X, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { generateEquipmentOptions, DEFAULT_LOAD_EQUIPMENT } from '../lib/equipmentUtils'
import { getAudioCtx, playBeep } from '../lib/audio'
import { daysOfWeek, localISODate } from '../lib/dates'
import { defaultPlanSeeds } from '../lib/defaultPlans'
import { planFromRow, planToRow, uuid, type WorkoutPlanRow } from '../lib/plans'
import { UnsavedGuardContext, type UnsavedGuard } from '../lib/unsavedGuard'
import { APP_SCROLL_ID, DiscardDialog } from './ui'
import {
  applyLibraryToPlans, applyLibraryToRecords, buildLibrary, buildNameIndex, defFromRow, defToRow, isNameTaken,
  unresolvedPlanNames, unresolvedRecordNames, type ExerciseRow
} from '../lib/exerciseLibrary'
import { summarizeExercises } from '../lib/exerciseStats'
import TabProfile from './TabProfile'
import ExercisesTab from './ExercisesTab'
import type { ExerciseActions, ExerciseInput, ExerciseUsage } from './ExercisePicker'
import PlanTab from './PlanTab'
import WorkoutTab, { type TimerControls } from './WorkoutTab'
import RecordsTab from './RecordsTab'
import Onboarding, { type OnboardingValues } from './Onboarding'
import type {
  WorkoutPlan, WorkoutRecord, TimerState, SessionData, SessionExercise, SessionStretches,
  EquipmentOption, EquipmentItem, Profile, BodyLog, StretchPhase, ExerciseDef
} from '../types'

const defaultTimerState: TimerState = {
  isActive: false, type: null, endTime: 0, remaining: 0,
  exIdx: null, setIdx: null, interval: 0,
  tabataWork: 0, tabataRest: 0, tabataCycles: 0, currentCycle: 0, stretch: null
}

type Tab = 'plan' | 'record' | 'history' | 'exercises' | 'profile'

// ─── Bottom Navigation (defined outside FitTrack to prevent remount on timer ticks) ──

const NAV_ITEMS: { tab: Tab; label: string; Icon: typeof Dumbbell }[] = [
  { tab: 'plan', label: 'プラン', Icon: CalendarDays },
  { tab: 'record', label: 'ワークアウト', Icon: Dumbbell },
  { tab: 'history', label: '記録', Icon: BarChart3 },
  { tab: 'exercises', label: '種目', Icon: BookOpen },
  { tab: 'profile', label: 'プロフィール', Icon: User }
]

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: Tab; setActiveTab: (tab: Tab) => void }) => (
  <div className="flex-shrink-0 w-full bg-white border-t border-gray-200 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
    <div className="flex justify-around items-center h-20 max-w-md mx-auto px-1">
      {NAV_ITEMS.map(({ tab, label, Icon }) => (
        <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center justify-center w-1/5 h-full transition-all ${activeTab === tab ? 'text-blue-600 -translate-y-1' : 'text-gray-400'}`}>
          <Icon size={24} strokeWidth={activeTab === tab ? 2.5 : 2} /><span className="text-[10px] mt-1 font-bold">{label}</span>
        </button>
      ))}
    </div>
  </div>
)

const isProfileComplete = (p: Profile | null) => !!p && p.height != null && !!p.birth_date && !!p.gender

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FitTrack({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('record')
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // 種目マスタ: 標準の種目（アプリ内カタログ）＋自作の種目（DB）
  const [customExercises, setCustomExercises] = useState<ExerciseDef[]>([])
  const customRef = useRef(customExercises)
  useEffect(() => { customRef.current = customExercises }, [customExercises])
  const exercisesAvailable = useRef(true)

  const [currentSession, setCurrentSession] = useState<SessionData | null>(null)
  const sessionRef = useRef(currentSession)
  useEffect(() => { sessionRef.current = currentSession }, [currentSession])
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // ── 編集中のタブ移動ガード ───────────────────────────────────────────────────
  const dirtyKeys = useRef(new Set<string>())
  const [pendingTab, setPendingTab] = useState<Tab | null>(null)
  const guard = useMemo<UnsavedGuard>(() => ({
    setDirty: (key, dirty) => { if (dirty) dirtyKeys.current.add(key); else dirtyKeys.current.delete(key) }
  }), [])
  const requestTab = useCallback((tab: Tab) => {
    if (tab === activeTab) return
    if (dirtyKeys.current.size > 0) setPendingTab(tab)
    else setActiveTab(tab)
  }, [activeTab])
  const discardAndGo = () => {
    if (!pendingTab) return
    dirtyKeys.current.clear()
    setActiveTab(pendingTab)
    setPendingTab(null)
  }
  // ブラウザのタブを閉じる／再読み込みするときも、編集中なら確認する
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyKeys.current.size === 0) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // タブを切り替えたらスクロール位置を先頭へ戻す（スクロールするのは <main> だけ）
  useEffect(() => { document.getElementById(APP_SCROLL_ID)?.scrollTo?.(0, 0) }, [activeTab])

  const [activeTimer, setActiveTimer] = useState<TimerState>(defaultTimerState)
  const activeTimerRef = useRef(activeTimer)
  useEffect(() => { activeTimerRef.current = activeTimer }, [activeTimer])

  const equipmentOptionsMap = useMemo(() => {
    const map = new Map<string, EquipmentOption[]>()
    equipment.filter(e => e.category === 'load').forEach(item => {
      map.set(item.id, generateEquipmentOptions(item))
    })
    return map
  }, [equipment])

  const library = useMemo(() => buildLibrary(customExercises), [customExercises])
  // プラン・記録の種目に exerciseId を付け、表示名を種目マスタの名前に揃える（DB の中身は書き換えない）
  const planList = useMemo(() => applyLibraryToPlans(plans, library), [plans, library])
  const recordList = useMemo(() => applyLibraryToRecords(records, library), [records, library])
  const usage = useMemo<ExerciseUsage>(() => {
    const map: ExerciseUsage = new Map()
    summarizeExercises(recordList).forEach(s => map.set(s.key, { sessions: s.sessions, lastDate: s.lastDate }))
    return map
  }, [recordList])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  // ── 種目マスタ ──────────────────────────────────────────────────────────────

  /** ID の無い旧データの種目名を、自作の種目として登録する（標準の種目と名前が一致するものは登録しない） */
  const registerLegacyExercises = async (
    planSrc: WorkoutPlan[], recordSrc: WorkoutRecord[], current: ExerciseDef[], equipmentIds: string[]
  ): Promise<ExerciseDef[]> => {
    const index = buildNameIndex(buildLibrary(current))
    const names = new Map<string, ReturnType<typeof unresolvedPlanNames>[number]>()
    ;[...unresolvedPlanNames(planSrc, index), ...unresolvedRecordNames(recordSrc, index)].forEach(n => {
      if (!names.has(n.name)) names.set(n.name, n)
    })
    if (names.size === 0 || !exercisesAvailable.current) return current
    const created: ExerciseDef[] = [...names.values()].map(n => ({
      id: uuid(), name: n.name, muscle: 'other', kind: n.kind, note: '', builtin: false,
      equipmentType: equipmentIds.includes(n.equipmentType) ? n.equipmentType : 'bodyweight'
    }))
    const { error } = await supabase.from('exercises').insert(created.map(d => defToRow(d, userId)))
    if (error) {
      console.error('Failed to register exercises:', error)
      return current
    }
    return [...current, ...created]
  }

  const equipmentIdsRef = useRef<string[]>([])
  useEffect(() => { equipmentIdsRef.current = equipment.filter(e => e.category === 'load').map(e => e.id) }, [equipment])

  const sessionRefForUsage = useRef(usage)
  useEffect(() => { sessionRefForUsage.current = usage }, [usage])
  const plansRefForUsage = useRef(planList)
  useEffect(() => { plansRefForUsage.current = planList }, [planList])

  const exerciseActions = useMemo<ExerciseActions>(() => ({
    create: async (input: ExerciseInput) => {
      const name = input.name.trim()
      if (!name) return '種目名を入力してください'
      if (isNameTaken(buildLibrary(customRef.current), name)) return '同じ名前の種目が既にあります'
      if (!exercisesAvailable.current) return '種目テーブルがありません。Supabase に migration 004（exercises）を適用してください'
      const def: ExerciseDef = { id: uuid(), builtin: false, ...input, name }
      const { error } = await supabase.from('exercises').insert(defToRow(def, userId))
      if (error) { console.error('Failed to create exercise:', error); return `作成に失敗しました: ${error.message}` }
      setCustomExercises(prev => [...prev, def])
      return def
    },
    update: async (id, input) => {
      const name = input.name.trim()
      if (!name) return '種目名を入力してください'
      if (isNameTaken(buildLibrary(customRef.current), name, id)) return '同じ名前の種目が既にあります'
      const { error } = await supabase.from('exercises')
        .update({ name, muscle: input.muscle, kind: input.kind, equipment_type: input.equipmentType, note: input.note })
        .eq('id', id).eq('user_id', userId)
      if (error) { console.error('Failed to update exercise:', error); return `保存に失敗しました: ${error.message}` }
      setCustomExercises(prev => prev.map(d => (d.id === id ? { ...d, ...input, name } : d)))
      return null
    },
    remove: async id => {
      // 記録は種目ごとに蓄積するため、記録のある種目・プランで使用中の種目は削除させない
      if (sessionRefForUsage.current.has(id)) return '実施記録があるため削除できません'
      if (plansRefForUsage.current.some(p => p.exercises.some(ex => ex.exerciseId === id || (ex.stations ?? []).some(st => st.exerciseId === id)))) {
        return 'プランで使われているため削除できません。先にプランから外してください'
      }
      const { error } = await supabase.from('exercises').delete().eq('id', id).eq('user_id', userId)
      if (error) { console.error('Failed to delete exercise:', error); return `削除に失敗しました: ${error.message}` }
      setCustomExercises(prev => prev.filter(d => d.id !== id))
      return null
    }
  }), [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadUserData = async () => {
      setDataLoading(true)
      try {
        const { data: plansData, error: plansError } = await supabase
          .from('workout_plans')
          .select('*')
          .eq('user_id', userId)
          .order('sort_order', { ascending: true })
        if (plansError) {
          console.error('Failed to load workout_plans:', plansError)
          setLoadError('プランを読み込めませんでした。Supabase に migration 003（workout_plans）が適用されているか確認してください。')
          return
        }
        const loadedPlans = (plansData as WorkoutPlanRow[] ?? []).map(planFromRow)
        setPlans(loadedPlans)

        const { data: recordsData } = await supabase
          .from('records')
          .select('*')
          .eq('user_id', userId)
          .order('full_date', { ascending: false })

        let loadedRecords: WorkoutRecord[] = []
        if (recordsData) {
          loadedRecords = recordsData.map(r => ({
            id: r.id as number,
            date: r.date as string,
            fullDate: r.full_date as string,
            day: r.day as string,
            category: r.category as string | undefined,
            type: r.type as 'workout' | 'rest',
            exercises: (r.exercises ?? []) as SessionExercise[],
            stretches: (r.stretches ?? null) as SessionStretches | null
          }))
          setRecords(loadedRecords)
        }

        const { data: equipmentData } = await supabase
          .from('equipment')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        let loadedEquipment: EquipmentItem[] = DEFAULT_LOAD_EQUIPMENT
        if (equipmentData && equipmentData.length > 0) {
          loadedEquipment = equipmentData.map(e => ({
            id: e.id as string,
            name: e.name as string,
            category: e.category as 'load' | 'data',
            direction: e.direction as '+' | '-' | null,
            weight: e.weight as EquipmentItem['weight']
          }))
          setEquipment(loadedEquipment)
        } else {
          // First login — seed default load equipment
          setEquipment(DEFAULT_LOAD_EQUIPMENT)
          await supabase.from('equipment').insert(
            DEFAULT_LOAD_EQUIPMENT.map(item => ({
              id: item.id,
              user_id: userId,
              name: item.name,
              category: item.category,
              direction: item.direction,
              weight: item.weight
            }))
          )
        }

        // 種目マスタ（自作の種目）。旧データの種目名は初回に自作の種目として登録する
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('exercises')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
        if (exerciseError) {
          console.error('Failed to load exercises:', exerciseError)
          exercisesAvailable.current = false
          setToast('種目テーブルを読み込めませんでした。Supabase に migration 004（exercises）を適用してください。')
        } else {
          const custom = (exerciseData as ExerciseRow[] ?? []).map(defFromRow)
          const ids = loadedEquipment.filter(e => e.category === 'load').map(e => e.id)
          setCustomExercises(await registerLegacyExercises(loadedPlans, loadedRecords, custom, ids))
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
        if (profileError) console.error('Failed to load profile:', profileError)
        if (profileData) {
          setProfile({
            height: profileData.height as number | null,
            birth_date: profileData.birth_date as string | null,
            gender: profileData.gender as 'male' | 'female' | null
          })
        }

        const { data: bodyLogsData } = await supabase
          .from('body_logs')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })

        if (bodyLogsData) {
          setBodyLogs(bodyLogsData.map(b => ({
            id: b.id as string,
            date: b.date as string,
            weight: b.weight as number | null,
            body_fat: b.body_fat as number | null
          })))
        }
      } catch (err) {
        console.error('Failed to load data:', err)
        setLoadError('データの読み込みに失敗しました。通信状態を確認して再読み込みしてください。')
      } finally {
        setDataLoading(false)
      }
    }
    loadUserData()
  }, [userId])

  // ── Onboarding (account creation) ───────────────────────────────────────────

  const completeOnboarding = async (v: OnboardingValues): Promise<string | null> => {
    const newProfile: Profile = { height: v.height, birth_date: v.birth_date, gender: v.gender }
    const { error } = await supabase.from('profiles').upsert({ user_id: userId, ...newProfile })
    if (error) {
      console.error('Failed to save profile:', error)
      return `登録に失敗しました: ${error.message}`
    }

    if (v.weight != null || v.body_fat != null) {
      const { data, error: logError } = await supabase.from('body_logs').insert({
        user_id: userId, date: localISODate(), weight: v.weight, body_fat: v.body_fat
      }).select().single()
      if (logError) console.error('Failed to add initial body log:', logError)
      else if (data) setBodyLogs(prev => [{ id: data.id as string, date: data.date as string, weight: data.weight as number | null, body_fat: data.body_fat as number | null }, ...prev])
    }

    // 新規アカウントにはサンプルプランを用意する（既にプランがあれば何もしない）
    if (plans.length === 0) {
      const seeded = defaultPlanSeeds.map((p, i) => ({ ...p, id: uuid(), sortOrder: i + 1 }))
      const { error: seedError } = await supabase.from('workout_plans').insert(seeded.map(p => planToRow(p, userId)))
      if (seedError) console.error('Failed to seed plans:', seedError)
      else {
        setPlans(seeded)
        setCustomExercises(await registerLegacyExercises(seeded, [], customRef.current, equipmentIdsRef.current))
      }
    }

    setProfile(newProfile)
    return null
  }

  // ── Timer ───────────────────────────────────────────────────────────────────

  const startTimer = useCallback<TimerControls['startTimer']>((type, seconds, exIdx = null, setIdx = null, interval = 0) => {
    if (!seconds || seconds <= 0) return
    getAudioCtx()
    const end = Date.now() + seconds * 1000
    setActiveTimer({ ...defaultTimerState, isActive: true, type, endTime: end, remaining: seconds, exIdx, setIdx, interval })
  }, [])

  const startTabataTimer = useCallback<TimerControls['startTabataTimer']>((exIdx, setIdx, work, rest, cycles, interval) => {
    if (!work || work <= 0) return
    getAudioCtx()
    const end = Date.now() + work * 1000
    setActiveTimer({ ...defaultTimerState, isActive: true, type: 'tabata_work', endTime: end, remaining: work, exIdx, setIdx, interval, tabataWork: work, tabataRest: rest, tabataCycles: cycles, currentCycle: 1 })
  }, [])

  const startStretchTimer = useCallback((phase: StretchPhase, idx: number, chain: boolean) => {
    const item = sessionRef.current?.stretches[phase][idx]
    if (!item || item.seconds <= 0) return
    getAudioCtx()
    const end = Date.now() + item.seconds * 1000
    setActiveTimer({ ...defaultTimerState, isActive: true, type: 'work', endTime: end, remaining: item.seconds, stretch: { phase, idx, chain } })
  }, [])

  const stopTimer = useCallback(() => setActiveTimer(defaultTimerState), [])

  const finishSetAndRest = (timerState: TimerState) => {
    setCurrentSession(prev => {
      if (!prev || timerState.exIdx === null || timerState.setIdx === null) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((ex, ei) => ei !== timerState.exIdx ? ex : {
          ...ex, sets: ex.sets.map((s, si) => (si === timerState.setIdx ? { ...s, completed: true } : s))
        })
      }
    })
    if (timerState.interval > 0) {
      setTimeout(() => { startTimer('rest', timerState.interval) }, 1000)
    } else {
      setActiveTimer(defaultTimerState)
    }
  }

  const finishStretch = (stretch: NonNullable<TimerState['stretch']>) => {
    const { phase, idx, chain } = stretch
    setCurrentSession(prev => prev && ({
      ...prev,
      stretches: { ...prev.stretches, [phase]: prev.stretches[phase].map((s, i) => (i === idx ? { ...s, completed: true } : s)) }
    }))
    if (!chain) return
    const list = sessionRef.current?.stretches[phase] ?? []
    const next = list.findIndex((s, i) => i > idx && !s.completed)
    if (next >= 0) setTimeout(() => startStretchTimer(phase, next, true), 1500)
  }

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>
    if (activeTimer.isActive) {
      timerId = setInterval(() => {
        const now = Date.now()
        const timerState = activeTimerRef.current
        const timeLeft = Math.ceil((timerState.endTime - now) / 1000)

        if (timeLeft <= 0) {
          clearInterval(timerId)
          if (timerState.type === 'tabata_work') {
            if (timerState.currentCycle < timerState.tabataCycles) {
              playBeep(660, 0.4, 0.2)
              const end = Date.now() + timerState.tabataRest * 1000
              setActiveTimer(prev => ({ ...prev, type: 'tabata_rest', endTime: end, remaining: prev.tabataRest }))
            } else {
              playBeep(880, 0.5, 0.2)
              finishSetAndRest(timerState)
            }
          } else if (timerState.type === 'tabata_rest') {
            playBeep(1046, 0.5, 0.2)
            const end = Date.now() + timerState.tabataWork * 1000
            setActiveTimer(prev => ({ ...prev, type: 'tabata_work', endTime: end, remaining: prev.tabataWork, currentCycle: prev.currentCycle + 1 }))
          } else {
            playBeep(880, 0.5, 0.2)
            setActiveTimer(defaultTimerState)
            if (timerState.stretch) finishStretch(timerState.stretch)
            else if (timerState.type === 'work') finishSetAndRest(timerState)
          }
        } else {
          if (timeLeft !== timerState.remaining) {
            if (timeLeft <= 5 && timeLeft > 0) playBeep(880, 0.1, 0.15)
            setActiveTimer(prev => ({ ...prev, remaining: timeLeft }))
          }
        }
      }, 100)
    }
    return () => clearInterval(timerId)
  }, [activeTimer.isActive, activeTimer.endTime]) // eslint-disable-line react-hooks/exhaustive-deps

  const timerControls: TimerControls = useMemo(
    () => ({ activeTimer, startTimer, startTabataTimer, startStretchTimer, stopTimer }),
    [activeTimer, startTimer, startTabataTimer, startStretchTimer, stopTimer]
  )

  // ── Session save / rest ─────────────────────────────────────────────────────

  const saveWorkoutSession = async () => {
    if (!currentSession) return
    const { stretches, ...rest } = currentSession
    const hasStretches = stretches.warmup.length > 0 || stretches.cooldown.length > 0
    const newRecord: WorkoutRecord = { ...rest, id: Date.now(), type: 'workout', stretches: hasStretches ? stretches : null }
    setRecords(prev => [newRecord, ...prev])
    setCurrentSession(null)
    setActiveTimer(defaultTimerState)
    setActiveTab('history')

    const { error } = await supabase.from('records').insert({
      id: newRecord.id, user_id: userId, full_date: newRecord.fullDate,
      date: newRecord.date, day: newRecord.day, type: 'workout',
      category: newRecord.category, exercises: newRecord.exercises, stretches: newRecord.stretches
    })
    if (error) {
      console.error('Failed to save workout record:', error)
      setToast(`記録の保存に失敗しました: ${error.message}`)
    }
  }

  const saveRestDay = async () => {
    const d = new Date()
    const newRecord: WorkoutRecord = {
      id: Date.now(),
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      fullDate: d.toISOString(),
      day: daysOfWeek[d.getDay()],
      type: 'rest',
      exercises: []
    }
    setRecords(prev => [newRecord, ...prev])
    setActiveTab('history')

    const { error } = await supabase.from('records').insert({
      id: newRecord.id, user_id: userId, full_date: newRecord.fullDate,
      date: newRecord.date, day: newRecord.day, type: 'rest',
      category: null, exercises: []
    })
    if (error) {
      console.error('Failed to save rest record:', error)
      setToast(`記録の保存に失敗しました: ${error.message}`)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-blue-600 text-white w-14 h-14 flex items-center justify-center rounded-2xl text-2xl font-black mx-auto mb-4 animate-pulse">F</div>
          <p className="text-gray-400 text-sm font-medium">データを読み込み中...</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
        <div role="alert" className="bg-white rounded-3xl p-6 border border-red-100 max-w-sm w-full text-center">
          <AlertTriangle size={28} className="text-red-500 mx-auto mb-3" />
          <p className="text-sm text-gray-700 mb-4">{loadError}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2.5 bg-gray-900 text-white font-bold rounded-xl text-sm">再読み込み</button>
        </div>
      </div>
    )
  }

  if (!isProfileComplete(profile)) {
    return <Onboarding onSubmit={completeOnboarding} />
  }

  return (
    <UnsavedGuardContext.Provider value={guard}>
    {/* 画面全体は固定。ヘッダーと下部ナビは動かさず、<main> の中だけがスクロールする */}
    <div className="app-shell flex flex-col bg-gray-50 font-sans text-gray-900 selection:bg-blue-200 relative">
      <header className="flex-shrink-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <h1 className="font-black text-lg tracking-wider text-gray-900 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-md text-xs">F</span>
            FITTRACK
          </h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="ログアウト"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {toast && (
        <div role="alert" className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] max-w-sm w-[calc(100%-2rem)] p-3 bg-red-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2">
          <AlertTriangle size={14} className="flex-shrink-0" /><span className="flex-1">{toast}</span>
          <button onClick={() => setToast(null)} aria-label="閉じる"><X size={14} /></button>
        </div>
      )}

      <main id={APP_SCROLL_ID} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
        {activeTab === 'plan' && (
          <PlanTab
            userId={userId} plans={planList} setPlans={setPlans} equipment={equipment} records={recordList}
            library={library} usage={usage} exerciseActions={exerciseActions}
          />
        )}
        {activeTab === 'record' && (
          <WorkoutTab
            plans={planList}
            records={recordList}
            equipmentOptionsMap={equipmentOptionsMap}
            session={currentSession}
            setSession={setCurrentSession}
            timer={timerControls}
            onSaveWorkout={saveWorkoutSession}
            onRest={saveRestDay}
            onCancel={() => setShowCancelConfirm(true)}
            onGoToPlans={() => requestTab('plan')}
          />
        )}
        {activeTab === 'history' && <RecordsTab records={recordList} />}
        {activeTab === 'exercises' && (
          <ExercisesTab library={library} usage={usage} records={recordList} plans={planList} equipment={equipment} actions={exerciseActions} />
        )}
        {activeTab === 'profile' && (
          <TabProfile
            userId={userId}
            equipment={equipment}
            setEquipment={setEquipment}
            profile={profile}
            setProfile={setProfile}
            bodyLogs={bodyLogs}
            setBodyLogs={setBodyLogs}
            plans={planList}
            records={recordList}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={requestTab} />

      {activeTimer.isActive && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5
            ${activeTimer.type === 'work' || activeTimer.type === 'tabata_work' ? 'bg-orange-600 text-white' :
              activeTimer.type === 'tabata_rest' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'}`}
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          {activeTimer.type === 'work' || activeTimer.type === 'tabata_work'
            ? <Play size={20} className={`${activeTimer.remaining <= 5 ? 'animate-bounce' : 'animate-pulse'}`} fill="currentColor" />
            : <Timer size={20} className={`text-blue-400 ${activeTimer.remaining <= 5 ? 'animate-bounce text-red-400' : 'animate-pulse'}`} />}
          <span className={`font-mono text-3xl font-bold w-16 text-center tracking-tighter ${(activeTimer.type === 'rest' || activeTimer.type === 'tabata_rest') && activeTimer.remaining <= 5 ? 'text-red-400' : ''}`}>{activeTimer.remaining}</span>
          <div className="flex flex-col items-center justify-center min-w-[3rem]">
            <span className="text-[10px] font-black tracking-widest whitespace-nowrap opacity-80">
              {activeTimer.stretch ? 'STRETCH' : activeTimer.type === 'work' || activeTimer.type === 'tabata_work' ? 'WORK' : 'REST'}
            </span>
            {(activeTimer.type === 'tabata_work' || activeTimer.type === 'tabata_rest') && (
              <span className="text-[9px] font-bold mt-0.5 bg-white/20 px-1.5 py-0.5 rounded text-white tracking-widest">
                RND {activeTimer.currentCycle}/{activeTimer.tabataCycles}
              </span>
            )}
          </div>
          <button onClick={stopTimer} aria-label="タイマーを止める" className="p-1.5 rounded-full hover:bg-black/20 active:scale-95 transition-transform">
            <X size={16} />
          </button>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">トレーニングを中止しますか？</h3>
            <p className="text-sm text-gray-500 mb-6">入力した内容は保存されずにリセットされます。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold active:scale-95 transition-transform">キャンセル</button>
              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  setCurrentSession(null)
                  setActiveTimer(defaultTimerState)
                }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 active:scale-95 transition-transform"
              >
                中止する
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingTab && <DiscardDialog onKeep={() => setPendingTab(null)} onDiscard={discardAndGo} discardLabel="破棄して移動" />}
    </div>
    </UnsavedGuardContext.Provider>
  )
}
