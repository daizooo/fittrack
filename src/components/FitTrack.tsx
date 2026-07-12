import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Dumbbell, CalendarDays, History, BarChart3, Plus, Minus, CheckCircle,
  Flame, Trophy, Zap, Target, Moon, Play, ChevronLeft, ChevronRight,
  Timer, X, Edit3, Trash2, Save, LogOut
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  WorkoutPlan, WorkoutRecord, TimerState, SessionData,
  SessionExercise, Exercise, SetData, EquipmentOption
} from '../types'

// ─── Audio ───────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

const getAudioCtx = (): AudioContext => {
  if (!audioCtx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

const playBeep = (freq = 440, duration = 0.1, vol = 0.1) => {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch (e) {
    console.error('Audio play failed:', e)
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EQUIPMENT_TYPES = {
  bodyweight: { name: '自重のみ', options: [{ label: 'ー', weight: 0 }] },
  tube: {
    name: 'チューブ', options: [
      { label: 'ー', weight: 0 }, { label: '赤 (+9kg)', weight: 9 },
      { label: '黒 (+28kg)', weight: 28 }, { label: '紫 (+49.5kg)', weight: 49.5 },
      { label: '緑 (+66.5kg)', weight: 66.5 }
    ]
  },
  assist: {
    name: '補助チューブ', options: [
      { label: 'ー', weight: 0 }, { label: '1本 (-24kg)', weight: -24 },
      { label: '2本 (-47kg)', weight: -47 }, { label: '3本 (-70kg)', weight: -70 }
    ]
  },
  vest: {
    name: 'ウェイトベスト', options: [
      { label: 'ー', weight: 0 }, { label: '1 (+5.25kg)', weight: 5.25 },
      { label: '2 (+8kg)', weight: 8 }, { label: '3 (+10.75kg)', weight: 10.75 },
      { label: '4 (+13.5kg)', weight: 13.5 }, { label: '5 (+16.25kg)', weight: 16.25 },
      { label: '6 (+19kg)', weight: 19 }, { label: '7 (+21.75kg)', weight: 21.75 },
      { label: '8 (+24.5kg)', weight: 24.5 }, { label: '9 (+27.25kg)', weight: 27.25 },
      { label: '10 (+30kg)', weight: 30 }
    ]
  }
} as const

const initialWorkoutPlans: WorkoutPlan[] = [
  { day: '月', category: '完全休養', exercises: [] },
  {
    day: '火', category: '上半身・引く', exercises: [
      { id: 'tue-1', name: 'チンニング', type: 'normal', targetSets: 5, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'tue-2', name: 'チューブ・ベントオーバーロウ', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'tue-3', name: 'チューブ・アームカール', type: 'normal', targetSets: 4, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' },
      { id: 'tue-4', name: 'ハンギングニーレイズ', type: 'normal', targetSets: 3, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' }
    ]
  },
  {
    day: '水', category: '上半身・押す', exercises: [
      { id: 'wed-1', name: 'プッシュアップ', type: 'normal', targetSets: 5, defaultReps: 12, defaultWeight: 0, interval: 90, equipmentType: 'bodyweight' },
      { id: 'wed-2', name: 'アシスト・ディップス', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'wed-3', name: 'チューブ・トライセプスPD', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'wed-4', name: 'パイクプッシュアップ', type: 'normal', targetSets: 3, defaultReps: 8, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' }
    ]
  },
  {
    day: '木', category: 'VO₂MAX＋体幹', exercises: [
      { id: 'thu-1', name: 'HIIT（バーピー）', type: 'tabata', targetSets: 2, defaultReps: 0, defaultWeight: 0, interval: 120, tabataWork: 20, tabataRest: 10, tabataCycles: 8, equipmentType: 'bodyweight' },
      { id: 'thu-2', name: 'ハンギングニーレイズ', type: 'normal', targetSets: 5, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' },
      { id: 'thu-3', name: 'プランク', type: 'duration', targetSets: 5, defaultReps: 45, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' }
    ]
  },
  {
    day: '金', category: '上半身・肩', exercises: [
      { id: 'fri-1', name: 'チューブ・オーバーヘッドプレス', type: 'normal', targetSets: 5, defaultReps: 12, defaultWeight: 28, interval: 90, equipmentType: 'tube' },
      { id: 'fri-2', name: 'チューブ・サイドレイズ', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' },
      { id: 'fri-3', name: 'チューブ・フェイスプル', type: 'normal', targetSets: 4, defaultReps: 12, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'fri-4', name: 'チューブ・フロントレイズ', type: 'normal', targetSets: 3, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' }
    ]
  },
  {
    day: '土', category: '上半身（押す・引く・肩）＋体幹', exercises: [
      { id: 'sat-1', name: 'チンニング', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'sat-2', name: 'プッシュアップ', type: 'normal', targetSets: 4, defaultReps: 12, defaultWeight: 0, interval: 90, equipmentType: 'bodyweight' },
      { id: 'sat-3', name: 'チューブ・ベントオーバーロウ', type: 'normal', targetSets: 4, defaultReps: 15, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'sat-4', name: 'アシスト・ディップス', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'sat-5', name: 'チューブ・オーバーヘッドプレス', type: 'normal', targetSets: 4, defaultReps: 12, defaultWeight: 28, interval: 90, equipmentType: 'tube' },
      { id: 'sat-6', name: 'ハンギングニーレイズ', type: 'normal', targetSets: 4, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' }
    ]
  },
  {
    day: '日', category: '下半身＋VO₂MAX＋体幹', exercises: [
      { id: 'sun-1', name: 'ブルガリアンSS（左）', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: 5.25, interval: 180, equipmentType: 'vest' },
      { id: 'sun-2', name: 'ブルガリアンSS（右）', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: 5.25, interval: 180, equipmentType: 'vest' },
      { id: 'sun-3', name: 'チューブ・ルーマニアンDL', type: 'normal', targetSets: 4, defaultReps: 15, defaultWeight: 66.5, interval: 120, equipmentType: 'tube' },
      { id: 'sun-4', name: 'HIIT（バーピー）', type: 'tabata', targetSets: 2, defaultReps: 0, defaultWeight: 5.25, interval: 120, tabataWork: 20, tabataRest: 10, tabataCycles: 8, equipmentType: 'vest' },
      { id: 'sun-5', name: 'ウエイトプランク', type: 'duration', targetSets: 4, defaultReps: 45, defaultWeight: 5.25, interval: 60, equipmentType: 'vest' }
    ]
  }
]

const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土']
const displayDaysOfWeek = ['月', '火', '水', '木', '金', '土', '日']

const defaultTimerState: TimerState = {
  isActive: false, type: null, endTime: 0, remaining: 0,
  exIdx: null, setIdx: null, interval: 0,
  tabataWork: 0, tabataRest: 0, tabataCycles: 0, currentCycle: 0
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const NumberInputStepper = ({ value, onChange, min, max, step, label }: {
  value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; label: string
}) => (
  <div className="flex flex-col items-center flex-1">
    <span className="text-[10px] text-gray-500 mb-1">{label}</span>
    <div className="flex items-center bg-gray-100 rounded-lg p-1 shadow-inner h-[40px] border border-gray-200 w-full max-w-[100px]">
      <button
        onClick={() => onChange(Math.max(min, Number(value) - step))}
        className="w-8 h-full flex items-center justify-center text-gray-500 active:bg-gray-200 rounded-md transition-colors"
      >
        <Minus size={16} />
      </button>
      <input
        type="number" value={value}
        onChange={(e) => onChange(e.target.value === '' ? min : Number(e.target.value))}
        onBlur={(e) => {
          let val = Number(e.target.value)
          if (isNaN(val)) val = min
          onChange(Math.max(min, Math.min(max, val)))
        }}
        className="w-full h-full bg-transparent text-center font-bold text-gray-800 text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none min-w-0"
      />
      <button
        onClick={() => onChange(Math.min(max, Number(value) + step))}
        className="w-8 h-full flex items-center justify-center text-gray-500 active:bg-gray-200 rounded-md transition-colors"
      >
        <Plus size={16} />
      </button>
    </div>
  </div>
)

const EquipmentSelector = ({ value, options, onChange, label }: {
  value: number; options: EquipmentOption[];
  onChange: (v: number) => void; label: string
}) => (
  <div className="flex flex-col items-center flex-1 min-w-[90px]">
    <span className="text-[10px] text-gray-500 mb-1">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-[40px] px-1 bg-gray-100 border border-gray-200 rounded-lg text-[10px] sm:text-[11px] font-bold text-gray-800 outline-none shadow-inner cursor-pointer appearance-none text-center w-full max-w-[110px]"
    >
      {options.map((opt, i) => (
        <option key={i} value={opt.weight}>{opt.label}</option>
      ))}
    </select>
  </div>
)

// ─── Main Component ──────────────────────────────────────────────────────────

interface FitTrackProps { userId: string }

export default function FitTrack({ userId }: FitTrackProps) {
  const [activeTab, setActiveTab] = useState('plan')
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<'month' | 'year'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

  const todayIndex = new Date().getDay()
  const todayDayStr = daysOfWeek[todayIndex]
  const todayDateStr = new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })

  const [selectedDayPlan, setSelectedDayPlan] = useState(todayDayStr)
  const [selectedRecordDay, setSelectedRecordDay] = useState(todayDayStr)

  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active'>('idle')
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [editingPlanData, setEditingPlanData] = useState<WorkoutPlan | null>(null)

  const [activeTimer, setActiveTimer] = useState<TimerState>(defaultTimerState)
  const activeTimerRef = useRef(activeTimer)
  useEffect(() => { activeTimerRef.current = activeTimer }, [activeTimer])

  const [selectedRecordDetail, setSelectedRecordDetail] = useState<WorkoutRecord | null>(null)

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadUserData = async () => {
      setDataLoading(true)
      try {
        // Load plans
        const { data: plansData } = await supabase
          .from('plans')
          .select('*')
          .eq('user_id', userId)

        if (plansData && plansData.length > 0) {
          const dayOrder = ['月', '火', '水', '木', '金', '土', '日']
          const sorted = [...plansData].sort(
            (a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
          )
          setPlans(sorted.map(p => ({
            day: p.day as string,
            category: p.category as string,
            exercises: p.exercises as Exercise[]
          })))
        } else {
          // First login — seed defaults
          setPlans(initialWorkoutPlans)
          await supabase.from('plans').insert(
            initialWorkoutPlans.map(p => ({
              user_id: userId,
              day: p.day,
              category: p.category,
              exercises: p.exercises
            }))
          )
        }

        // Load records
        const { data: recordsData } = await supabase
          .from('records')
          .select('*')
          .eq('user_id', userId)
          .order('full_date', { ascending: false })

        if (recordsData) {
          setRecords(recordsData.map(r => ({
            id: r.id as number,
            date: r.date as string,
            fullDate: r.full_date as string,
            day: r.day as string,
            category: r.category as string | undefined,
            type: r.type as 'workout' | 'rest',
            exercises: (r.exercises ?? []) as SessionExercise[]
          })))
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setDataLoading(false)
      }
    }
    loadUserData()
  }, [userId])

  // ── Timer ───────────────────────────────────────────────────────────────────

  const startTimer = (
    type: 'work' | 'rest', seconds: number,
    exIdx: number | null = null, setIdx: number | null = null, interval = 0
  ) => {
    if (!seconds || seconds <= 0) return
    getAudioCtx()
    const end = Date.now() + seconds * 1000
    setActiveTimer({ isActive: true, type, endTime: end, remaining: seconds, exIdx, setIdx, interval, tabataWork: 0, tabataRest: 0, tabataCycles: 0, currentCycle: 0 })
  }

  const startTabataTimer = (
    exIdx: number, setIdx: number, work: number, rest: number, cycles: number, interval: number
  ) => {
    if (!work || work <= 0) return
    getAudioCtx()
    const end = Date.now() + work * 1000
    setActiveTimer({ isActive: true, type: 'tabata_work', endTime: end, remaining: work, exIdx, setIdx, interval, tabataWork: work, tabataRest: rest, tabataCycles: cycles, currentCycle: 1 })
  }

  const finishSetAndRest = (timerState: TimerState) => {
    setCurrentSession(prev => {
      if (!prev || timerState.exIdx === null || timerState.setIdx === null) return prev
      const newExercises = prev.exercises.map((ex, ei) => {
        if (ei !== timerState.exIdx) return ex
        return {
          ...ex,
          sets: ex.sets.map((s, si) =>
            si === timerState.setIdx ? { ...s, completed: true } : s
          )
        }
      })
      return { ...prev, exercises: newExercises }
    })
    if (timerState.interval > 0) {
      setTimeout(() => { startTimer('rest', timerState.interval) }, 1000)
    } else {
      setActiveTimer(defaultTimerState)
    }
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
            if (timerState.type === 'work') finishSetAndRest(timerState)
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
  }, [activeTimer.isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered records ────────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const recordDate = new Date(record.fullDate)
      if (filterMode === 'month') return recordDate.getMonth() === currentDate.getMonth() && recordDate.getFullYear() === currentDate.getFullYear()
      if (filterMode === 'year') return recordDate.getFullYear() === currentDate.getFullYear()
      return true
    })
  }, [records, filterMode, currentDate])

  const shiftDate = (direction: number) => {
    const newDate = new Date(currentDate)
    if (filterMode === 'month') newDate.setMonth(newDate.getMonth() + direction)
    else if (filterMode === 'year') newDate.setFullYear(newDate.getFullYear() + direction)
    setCurrentDate(newDate)
  }

  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 34)
    const startDayIndex = startDate.getDay()
    for (let i = 0; i < startDayIndex; i++) days.push(null)
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      days.push(d)
    }
    const lastDay = days[days.length - 1] as Date
    const lastDayIndex = lastDay.getDay()
    for (let i = lastDayIndex + 1; i <= 6; i++) days.push(null)
    return days
  }, [])

  const getRecordForDate = (dateObj: Date): WorkoutRecord | undefined => {
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
    return records.find(r => r.date === dateStr)
  }

  // ── Sign out ────────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // ── Tab: Plan ───────────────────────────────────────────────────────────────

  const TabPlan = () => {
    const currentPlan = plans.find(p => p.day === selectedDayPlan) || { exercises: [] as Exercise[], day: selectedDayPlan, category: '' }

    const handleStartEdit = () => {
      setEditingPlanData(JSON.parse(JSON.stringify(currentPlan)))
      setIsEditingPlan(true)
    }

    const handleSaveEdit = async () => {
      if (!editingPlanData) return
      setPlans(prev => prev.map(p => p.day === editingPlanData.day ? editingPlanData : p))
      setIsEditingPlan(false)

      const { error } = await supabase.from('plans').upsert({
        user_id: userId,
        day: editingPlanData.day,
        category: editingPlanData.category,
        exercises: editingPlanData.exercises
      }, { onConflict: 'user_id,day' })
      if (error) console.error('Failed to save plan:', error)
    }

    const updateEditingPlan = (field: keyof WorkoutPlan, value: string) => {
      setEditingPlanData(prev => prev ? { ...prev, [field]: value } : null)
    }

    const updateEditingExercise = (exId: string, field: keyof Exercise, value: string | number) => {
      setEditingPlanData(prev => prev ? ({
        ...prev,
        exercises: prev.exercises.map(ex => ex.id === exId ? { ...ex, [field]: value } : ex)
      }) : null)
    }

    const removeExercise = (exId: string) => {
      setEditingPlanData(prev => prev ? ({
        ...prev,
        exercises: prev.exercises.filter(ex => ex.id !== exId)
      }) : null)
    }

    const addExercise = () => {
      const newEx: Exercise = {
        id: `ex-${Date.now()}`,
        name: '新しい種目', type: 'normal', targetSets: 3,
        defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight'
      }
      setEditingPlanData(prev => prev ? ({ ...prev, exercises: [...prev.exercises, newEx] }) : null)
    }

    if (isEditingPlan && editingPlanData) {
      return (
        <div className="pb-28 max-w-2xl mx-auto p-5 bg-gray-50 min-h-screen">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-gray-800">{selectedDayPlan}曜日の編集</h2>
            <div className="flex gap-2">
              <button onClick={() => setIsEditingPlan(false)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-bold rounded-lg active:scale-95">キャンセル</button>
              <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg flex items-center gap-1 shadow-md active:scale-95"><Save size={16} />保存</button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <label className="text-xs font-bold text-gray-500 mb-1 block">メニューのカテゴリ（部位など）</label>
            <input
              type="text" value={editingPlanData.category || ''}
              onChange={e => updateEditingPlan('category', e.target.value)}
              className="w-full font-bold text-lg border-b border-gray-300 pb-1 outline-none focus:border-blue-500 transition-colors"
              placeholder="例：上半身・引く"
            />
          </div>

          <div className="space-y-4">
            {editingPlanData.exercises.map((ex) => (
              <div key={ex.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 relative">
                <button onClick={() => removeExercise(ex.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>

                <div className="mb-4 pr-8">
                  <input
                    type="text" value={ex.name}
                    onChange={e => updateEditingExercise(ex.id, 'name', e.target.value)}
                    className="w-full font-bold text-gray-800 text-lg border-b border-gray-200 pb-1 outline-none focus:border-blue-500"
                    placeholder="種目名"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">種目タイプ</label>
                    <select
                      value={ex.type}
                      onChange={e => updateEditingExercise(ex.id, 'type', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none"
                    >
                      <option value="normal">通常（回数）</option>
                      <option value="duration">秒数（デュレーション）</option>
                      <option value="tabata">ラウンド（HIIT等）</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">使用する機材 (初期負荷)</label>
                    <select
                      value={ex.equipmentType}
                      onChange={e => updateEditingExercise(ex.id, 'equipmentType', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none"
                    >
                      {Object.keys(EQUIPMENT_TYPES).map(key => (
                        <option key={key} value={key}>{EQUIPMENT_TYPES[key as keyof typeof EQUIPMENT_TYPES].name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">初期セット数</label>
                    <input type="number" value={ex.targetSets} onChange={e => updateEditingExercise(ex.id, 'targetSets', Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none text-center" />
                  </div>
                  {ex.type !== 'tabata' && (
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">{ex.type === 'duration' ? '初期設定 (秒)' : '初期設定 (回)'}</label>
                      <input type="number" value={ex.defaultReps} onChange={e => updateEditingExercise(ex.id, 'defaultReps', Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none text-center" />
                    </div>
                  )}
                </div>

                {ex.type === 'tabata' && (
                  <div className="grid grid-cols-3 gap-3 mb-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <div>
                      <label className="text-[10px] font-bold text-orange-600 block mb-1">稼働 (秒)</label>
                      <input type="number" value={ex.tabataWork || 20} onChange={e => updateEditingExercise(ex.id, 'tabataWork', Number(e.target.value))} className="w-full bg-white border border-orange-200 rounded-lg p-2 text-sm font-bold outline-none text-center text-orange-600" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-blue-600 block mb-1">休憩 (秒)</label>
                      <input type="number" value={ex.tabataRest || 10} onChange={e => updateEditingExercise(ex.id, 'tabataRest', Number(e.target.value))} className="w-full bg-white border border-blue-200 rounded-lg p-2 text-sm font-bold outline-none text-center text-blue-600" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 block mb-1">サイクル数</label>
                      <input type="number" value={ex.tabataCycles || 8} onChange={e => updateEditingExercise(ex.id, 'tabataCycles', Number(e.target.value))} className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm font-bold outline-none text-center text-gray-700" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-1 flex items-center gap-1"><Timer size={10} />インターバル (秒)</label>
                  <input type="number" value={ex.interval} onChange={e => updateEditingExercise(ex.id, 'interval', Number(e.target.value))} className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none text-center" />
                </div>
              </div>
            ))}

            <button onClick={addExercise} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-bold flex items-center justify-center gap-2 hover:bg-gray-100 hover:border-gray-400 transition-colors active:scale-95">
              <Plus size={18} /> 新しい種目を追加
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="pb-28 max-w-2xl mx-auto p-5 bg-gray-50 min-h-screen">
        <div className="flex justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 mb-6">
          {displayDaysOfWeek.map(day => (
            <button key={day} onClick={() => setSelectedDayPlan(day)} className={`flex-1 py-2 text-center text-sm font-bold rounded-xl transition-colors ${selectedDayPlan === day ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>{day}</button>
          ))}
        </div>
        <div className="mb-6 flex justify-between items-end border-l-4 border-blue-500 pl-2">
          <div>
            <h2 className="text-2xl font-black text-gray-800 leading-tight">{selectedDayPlan}曜日のメニュー</h2>
            <p className="text-gray-500 font-medium mt-1">{currentPlan.category || '完全休養'}</p>
          </div>
          <button onClick={handleStartEdit} className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors active:scale-95">
            <Edit3 size={16} /> 編集
          </button>
        </div>
        <div className="space-y-4">
          {currentPlan.exercises.map((ex, idx) => (
            <div key={ex.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="font-bold text-gray-800 mb-3 flex gap-2 text-lg"><span className="text-blue-500 opacity-50">{idx + 1}.</span> {ex.name}</div>
              <div className="flex flex-wrap gap-2">
                <span className="bg-gray-100 text-gray-600 text-xs font-bold rounded-lg px-3 py-1.5">🎯 {ex.targetSets} Sets × {ex.type !== 'tabata' ? (ex.type === 'duration' ? `${ex.defaultReps}秒` : `${ex.defaultReps}回`) : 'HIIT'}</span>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold rounded-lg px-3 py-1.5 flex items-center gap-1"><Timer size={12} /> {ex.interval}s</span>
                {ex.type === 'tabata' && <span className="bg-orange-50 text-orange-600 text-xs font-bold rounded-lg px-3 py-1.5 flex items-center gap-1"><Flame size={12} /> {ex.tabataWork}s / {ex.tabataRest}s × {ex.tabataCycles}回</span>}
              </div>
            </div>
          ))}
          {currentPlan.exercises.length === 0 && (
            <div className="text-center text-gray-400 py-10 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">この日は休養日です</div>
          )}
        </div>
      </div>
    )
  }

  // ── Tab: Record ─────────────────────────────────────────────────────────────

  const TabRecord = () => {
    const targetPlan = plans.find(p => p.day === selectedRecordDay) || { exercises: [] as Exercise[], day: selectedRecordDay, category: '' }

    const startRealSession = () => {
      const sessionRecords: SessionExercise[] = targetPlan.exercises.map(ex => {
        const lastWorkout = records.find(r => r.type === 'workout' && r.exercises.some(e => e.name === ex.name))
        const lastEx = lastWorkout ? lastWorkout.exercises.find(e => e.name === ex.name) : null
        const inherited = !!lastEx

        let sets: SetData[]
        if (inherited && lastEx) {
          sets = lastEx.sets.map(s => ({ ...s, completed: false }))
        } else {
          sets = Array.from({ length: ex.targetSets }, (_, i) => ({
            setNumber: i + 1,
            reps: ex.type === 'tabata' ? 0 : ex.defaultReps,
            weight: ex.defaultWeight || 0,
            completed: false,
            tabataWork: ex.type === 'tabata' ? ex.tabataWork : 0,
            tabataRest: ex.type === 'tabata' ? ex.tabataRest : 0,
            tabataCycles: ex.type === 'tabata' ? ex.tabataCycles : 0
          }))
        }

        return {
          ...ex,
          inherited,
          options: [...(EQUIPMENT_TYPES[ex.equipmentType]?.options ?? EQUIPMENT_TYPES.bodyweight.options)],
          targetSets: inherited && lastEx ? lastEx.sets.length : ex.targetSets,
          sets
        }
      })

      setCurrentSession({
        date: `${new Date().getMonth() + 1}/${new Date().getDate()}`,
        fullDate: new Date().toISOString(),
        day: todayDayStr,
        category: targetPlan.category,
        exercises: sessionRecords
      })
      setSessionStatus('active')
    }

    const skipSession = async () => {
      const d = new Date()
      const newRecord: WorkoutRecord = {
        id: Date.now(),
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        fullDate: d.toISOString(),
        day: todayDayStr,
        type: 'rest',
        exercises: []
      }
      setRecords(prev => [newRecord, ...prev])
      setSessionStatus('idle')
      setActiveTab('history')

      const { error } = await supabase.from('records').insert({
        id: newRecord.id, user_id: userId, full_date: newRecord.fullDate,
        date: newRecord.date, day: newRecord.day, type: 'rest',
        category: null, exercises: []
      })
      if (error) console.error('Failed to save rest record:', error)
    }

    const handleSetUpdate = (exerciseIndex: number, setIndex: number, field: keyof SetData, value: number | string) => {
      setCurrentSession(prev => {
        if (!prev) return prev
        const newExercises = prev.exercises.map((ex, ei) => {
          if (ei !== exerciseIndex) return ex
          return {
            ...ex,
            sets: ex.sets.map((s, si) => {
              if (si !== setIndex) return s
              const numVal = typeof value === 'number' ? Math.round(value * 100) / 100 : Number(value)
              return { ...s, [field]: numVal }
            })
          }
        })
        return { ...prev, exercises: newExercises }
      })
    }

    const handleSetCountChange = (exerciseIndex: number, delta: number) => {
      setCurrentSession(prev => {
        if (!prev) return prev
        const currentSets = prev.exercises[exerciseIndex].sets
        const newCount = currentSets.length + delta
        if (newCount < 1) return prev

        const newSets = [...currentSets]
        if (delta > 0) {
          const last = currentSets[currentSets.length - 1] || { reps: 0, weight: 0, tabataWork: 0, tabataRest: 0, tabataCycles: 0 }
          newSets.push({ setNumber: newCount, reps: last.reps, weight: last.weight, completed: false, tabataWork: last.tabataWork, tabataRest: last.tabataRest, tabataCycles: last.tabataCycles })
        } else {
          newSets.pop()
        }
        const newExercises = prev.exercises.map((ex, ei) =>
          ei === exerciseIndex ? { ...ex, sets: newSets, targetSets: newCount } : ex
        )
        return { ...prev, exercises: newExercises }
      })
    }

    const handleExerciseUpdate = (exerciseIndex: number, field: keyof SessionExercise, value: number) => {
      setCurrentSession(prev => {
        if (!prev) return prev
        const newExercises = prev.exercises.map((ex, ei) =>
          ei === exerciseIndex ? { ...ex, [field]: value } : ex
        )
        return { ...prev, exercises: newExercises }
      })
    }

    const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
      if (!currentSession) return
      const isCompletedNow = !currentSession.exercises[exerciseIndex].sets[setIndex].completed
      setCurrentSession(prev => {
        if (!prev) return prev
        const newExercises = prev.exercises.map((ex, ei) => {
          if (ei !== exerciseIndex) return ex
          return { ...ex, sets: ex.sets.map((s, si) => si === setIndex ? { ...s, completed: isCompletedNow } : s) }
        })
        return { ...prev, exercises: newExercises }
      })

      if (isCompletedNow) {
        const intervalSeconds = currentSession.exercises[exerciseIndex].interval
        if (intervalSeconds > 0) startTimer('rest', intervalSeconds)
      }
    }

    const saveWorkoutSession = async () => {
      if (!currentSession) return
      const newRecord: WorkoutRecord = { ...currentSession, id: Date.now(), type: 'workout' }
      setRecords(prev => [newRecord, ...prev])
      setSessionStatus('idle')
      setCurrentSession(null)
      setActiveTimer(defaultTimerState)
      setActiveTab('history')

      const { error } = await supabase.from('records').insert({
        id: newRecord.id, user_id: userId, full_date: newRecord.fullDate,
        date: newRecord.date, day: newRecord.day, type: 'workout',
        category: newRecord.category, exercises: newRecord.exercises
      })
      if (error) console.error('Failed to save workout record:', error)
    }

    const cancelSession = () => { setShowCancelConfirm(true) }

    if (sessionStatus === 'idle') {
      return (
        <div className="pb-24 max-w-lg mx-auto p-5">
          <div className="mb-6 text-center mt-2">
            <p className="text-blue-500 font-bold text-xs tracking-wider mb-1">TODAY</p>
            <h2 className="text-3xl font-black text-gray-800 tracking-tight">{todayDateStr} <span className="text-xl text-gray-400 font-bold">({todayDayStr})</span></h2>
          </div>

          <div className="flex justify-between bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 mb-6">
            {displayDaysOfWeek.map(day => (
              <button key={day} onClick={() => setSelectedRecordDay(day)} className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-colors ${selectedRecordDay === day ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>{day}</button>
            ))}
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center mt-4">
            <h2 className="text-gray-500 font-medium mb-1">
              {selectedRecordDay === todayDayStr ? `今日 (${todayDayStr}) の予定` : `${selectedRecordDay}曜日のメニュー`}
            </h2>
            <h1 className="text-2xl font-extrabold text-gray-800 mb-6">{targetPlan.category || '完全休養'}</h1>

            {targetPlan.exercises.length > 0 ? (
              <div className="bg-gray-50 rounded-2xl p-4 mb-8 text-left space-y-2">
                {targetPlan.exercises.map((ex, i) => (
                  <div key={i} className="text-sm text-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>{ex.name}</div>
                    <span className="text-gray-400 text-xs">{ex.targetSets}セット</span>
                  </div>
                ))}
              </div>
            ) : <div className="mb-8 text-gray-400">休養日として設定されています。</div>}

            <div className="space-y-3">
              {targetPlan.exercises.length > 0 && (
                <button onClick={startRealSession} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/30 flex justify-center gap-2 active:scale-95 transition-transform">
                  <Play size={20} /> トレーニングを開始する
                </button>
              )}
              <button onClick={skipSession} className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl flex justify-center gap-2 active:scale-95 transition-transform">
                <Moon size={20} /> 今日は休養する
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (!currentSession) return null

    return (
      <div className="pb-36 max-w-2xl mx-auto p-3 relative">
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg flex justify-between items-center sticky top-16 z-30">
          <div className="flex items-center gap-2">
            <button onClick={cancelSession} className="p-1 hover:bg-white/20 rounded-lg transition-colors active:scale-95">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-lg font-bold leading-tight">{currentSession.category}</h2>
              <p className="text-blue-100 text-[10px] font-medium">{currentSession.date}</p>
            </div>
          </div>
          <button onClick={saveWorkoutSession} className="bg-white text-blue-600 px-3 py-2 rounded-xl font-bold shadow-sm active:scale-95 transition-transform text-sm">完了して保存</button>
        </div>

        {currentSession.exercises.map((ex, exIdx) => (
          <div key={exIdx} className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-bold text-[15px] text-gray-800 flex items-center gap-2 leading-tight">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 flex justify-center items-center rounded-full text-xs flex-shrink-0">{exIdx + 1}</span>
                {ex.name}
                {ex.inherited && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-black tracking-wider ml-1">前回引継</span>}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-md p-0.5 shadow-sm">
                  <button onClick={() => handleSetCountChange(exIdx, -1)} className="p-0.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"><Minus size={12} /></button>
                  <span className="text-[10px] font-bold text-gray-600 px-1">{ex.targetSets} Sets</span>
                  <button onClick={() => handleSetCountChange(exIdx, 1)} className="p-0.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"><Plus size={12} /></button>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-white border border-gray-200 pl-1.5 pr-0.5 py-0.5 rounded-md shadow-sm">
                  <Timer size={10} />
                  <select
                    value={ex.interval}
                    onChange={(e) => handleExerciseUpdate(exIdx, 'interval', Number(e.target.value))}
                    className="bg-transparent outline-none font-bold text-gray-700 cursor-pointer text-right appearance-none"
                  >
                    {[0, 30, 45, 60, 90, 120, 150, 180].map(sec => <option key={sec} value={sec}>{sec}s</option>)}
                  </select>
                  <span className="text-[8px] opacity-50">▼</span>
                </div>
              </div>
            </div>
            <div className="p-2 space-y-2">
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className={`flex items-center gap-2 p-2 rounded-xl transition-all ${set.completed ? 'bg-green-50' : ''}`}>
                  {ex.type === 'tabata' ? (
                    <>
                      <div className="w-8 font-black text-gray-400 text-[10px] flex-shrink-0 text-center tracking-widest leading-tight flex flex-col justify-center">
                        RND<br /><span className="text-sm">{set.setNumber}</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center mx-1 py-1 gap-1 bg-white border border-gray-200 rounded-xl shadow-inner">
                        <div className="flex justify-center items-center gap-1 text-[11px] font-bold tracking-tight">
                          <span className="flex items-center text-orange-500">
                            <input type="number" value={set.tabataWork} onChange={(e) => handleSetUpdate(exIdx, setIdx, 'tabataWork', Number(e.target.value))} onBlur={(e) => handleSetUpdate(exIdx, setIdx, 'tabataWork', Math.max(1, Number(e.target.value)))} className="w-7 bg-transparent border-b border-orange-200 text-center outline-none p-0 focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none" />s
                          </span>
                          <span className="text-gray-300">/</span>
                          <span className="flex items-center text-blue-500">
                            <input type="number" value={set.tabataRest} onChange={(e) => handleSetUpdate(exIdx, setIdx, 'tabataRest', Number(e.target.value))} onBlur={(e) => handleSetUpdate(exIdx, setIdx, 'tabataRest', Math.max(1, Number(e.target.value)))} className="w-7 bg-transparent border-b border-blue-200 text-center outline-none p-0 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none" />s
                          </span>
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 flex items-center">
                          <input type="number" value={set.tabataCycles} onChange={(e) => handleSetUpdate(exIdx, setIdx, 'tabataCycles', Number(e.target.value))} onBlur={(e) => handleSetUpdate(exIdx, setIdx, 'tabataCycles', Math.max(1, Number(e.target.value)))} className="w-6 bg-transparent border-b border-gray-300 text-center outline-none p-0 focus:border-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none" />
                          <span className="ml-1 opacity-70">Cycles</span>
                        </div>
                      </div>
                      <button
                        onClick={() => startTabataTimer(exIdx, setIdx, set.tabataWork ?? 20, set.tabataRest ?? 10, set.tabataCycles ?? 8, ex.interval)}
                        className={`w-10 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all shadow-sm mr-1 ${set.completed ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'}`}
                        disabled={set.completed}
                      >
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-6 text-center font-bold text-gray-400 text-sm flex-shrink-0">{set.setNumber}</div>
                      <div className="flex gap-2 flex-1 justify-end min-w-0 pr-1">
                        <EquipmentSelector label="負荷/機材" value={set.weight} options={ex.options} onChange={(v) => handleSetUpdate(exIdx, setIdx, 'weight', v)} />
                        <NumberInputStepper label={ex.type === 'duration' ? '秒数' : '回数'} value={set.reps} step={1} min={0} max={999} onChange={(v) => handleSetUpdate(exIdx, setIdx, 'reps', v)} />
                      </div>
                      {ex.type === 'duration' && (
                        <button
                          onClick={() => startTimer('work', set.reps, exIdx, setIdx, ex.interval)}
                          className={`w-10 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all shadow-sm mr-1 ${set.completed ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'}`}
                          disabled={set.completed}
                        >
                          <Play size={18} fill="currentColor" className="ml-0.5" />
                        </button>
                      )}
                    </>
                  )}
                  <button onClick={() => toggleSetComplete(exIdx, setIdx)} className={`w-12 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all ${set.completed ? 'text-white bg-green-500 shadow-md shadow-green-500/30' : 'text-gray-400 bg-gray-100 active:bg-gray-200'}`}>
                    <CheckCircle size={24} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

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
                    setSessionStatus('idle')
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

        {activeTimer.isActive && (
          <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5
            ${activeTimer.type === 'work' || activeTimer.type === 'tabata_work' ? 'bg-orange-600 text-white' :
              activeTimer.type === 'tabata_rest' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white'}`}>
            {activeTimer.type === 'work' || activeTimer.type === 'tabata_work'
              ? <Play size={20} className={`${activeTimer.remaining <= 5 ? 'animate-bounce' : 'animate-pulse'}`} fill="currentColor" />
              : <Timer size={20} className={`text-blue-400 ${activeTimer.remaining <= 5 ? 'animate-bounce text-red-400' : 'animate-pulse'}`} />}
            <span className={`font-mono text-3xl font-bold w-16 text-center tracking-tighter ${(activeTimer.type === 'rest' || activeTimer.type === 'tabata_rest') && activeTimer.remaining <= 5 ? 'text-red-400' : ''}`}>{activeTimer.remaining}</span>
            <div className="flex flex-col items-center justify-center min-w-[3rem]">
              <span className="text-[10px] font-black tracking-widest whitespace-nowrap opacity-80">
                {activeTimer.type === 'work' ? 'WORK' : activeTimer.type === 'rest' ? 'REST' : activeTimer.type === 'tabata_work' ? 'WORK' : 'REST'}
              </span>
              {(activeTimer.type === 'tabata_work' || activeTimer.type === 'tabata_rest') && (
                <span className="text-[9px] font-bold mt-0.5 bg-white/20 px-1.5 py-0.5 rounded text-white tracking-widest">
                  RND {activeTimer.currentCycle}/{activeTimer.tabataCycles}
                </span>
              )}
            </div>
            <button onClick={() => setActiveTimer(defaultTimerState)} className="p-1.5 rounded-full hover:bg-black/20 active:scale-95 transition-transform">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Analytics ──────────────────────────────────────────────────────────

  const TabAnalytics = () => {
    const workoutCount = filteredRecords.filter(r => r.type === 'workout').length
    const restCount = filteredRecords.filter(r => r.type === 'rest').length
    let totalCompletedSets = 0
    let totalRepsOrSeconds = 0
    const categoryCount: Record<string, number> = {}

    filteredRecords.filter(r => r.type === 'workout').forEach(record => {
      if (record.category) {
        if (!categoryCount[record.category]) categoryCount[record.category] = 0
        categoryCount[record.category]++
      }
      record.exercises.forEach(ex => {
        ex.sets.filter(s => s.completed).forEach(set => {
          totalCompletedSets++
          if (ex.type === 'tabata') {
            totalRepsOrSeconds += ((set.tabataWork ?? 0) * (set.tabataCycles ?? 0))
          } else {
            totalRepsOrSeconds += Number(set.reps) || 0
          }
        })
      })
    })

    const totalDays = filteredRecords.length
    const consistencyRate = totalDays > 0 ? Math.round((workoutCount / totalDays) * 100) : 0

    let motivationMsg = 'さあ、新しい記録を作りましょう！'
    if (consistencyRate >= 70) motivationMsg = 'トップアスリート級の継続力です！🔥'
    else if (consistencyRate >= 50) motivationMsg = '素晴らしいペース！完全に習慣化しています👏'
    else if (workoutCount > 0) motivationMsg = '自分のペースで着実に進んでいます！🌱'

    const categoryData = Object.keys(categoryCount).map(cat => ({
      name: cat, val: Math.round((categoryCount[cat] / workoutCount) * 100), count: categoryCount[cat]
    })).sort((a, b) => b.val - a.val)

    const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500']

    return (
      <div className="pb-28 max-w-2xl mx-auto bg-gray-50 min-h-screen">
        <div className="bg-white px-4 py-3 sticky top-14 z-30 shadow-sm border-b border-gray-100">
          <div className="flex bg-gray-100 p-1 rounded-xl mb-3">
            <button onClick={() => setFilterMode('month')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filterMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>月単位</button>
            <button onClick={() => setFilterMode('year')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filterMode === 'year' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>年単位</button>
          </div>
          <div className="flex items-center justify-between px-2">
            <button onClick={() => shiftDate(-1)} className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 text-blue-600"><ChevronLeft size={24} /></button>
            <div className="font-extrabold text-gray-800 text-lg">
              {filterMode === 'month' ? `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月` : `${currentDate.getFullYear()}年`}
            </div>
            <button onClick={() => shiftDate(1)} className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 text-blue-600"><ChevronRight size={24} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4"><Trophy size={120} /></div>
            <h2 className="text-sm font-medium text-gray-300 mb-1">{filterMode === 'month' ? '今月' : 'この年'}の頑張り</h2>
            <p className="text-lg font-bold text-yellow-400 mb-4">{motivationMsg}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Zap size={12} className="text-blue-400" />総レップ＆秒数</div>
                <div className="text-3xl font-black">{totalRepsOrSeconds.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Target size={12} className="text-green-400" />実行率 (トレ日数)</div>
                <div className="text-3xl font-black">{consistencyRate}<span className="text-lg font-medium text-gray-400">%</span></div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700/50 flex gap-4 text-sm text-gray-300">
              <div><span className="font-bold text-white">{totalCompletedSets}</span> Sets</div>
              <div><span className="font-bold text-white">{workoutCount}</span> Days</div>
              <div><span className="font-bold text-white">{restCount}</span> Rest</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
              <BarChart3 size={18} className="text-indigo-500" /> 最も強化された部位
            </h3>
            {categoryData.length === 0 ? (
              <div className="text-center text-gray-400 py-4 text-sm">データがありません</div>
            ) : (
              <div className="space-y-4">
                {categoryData.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1 font-medium text-gray-600">
                      <span className="flex items-center gap-1">{i === 0 && <Trophy size={12} className="text-yellow-500" />}{item.name}</span>
                      <span>{item.count}回 ({item.val}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className={`${colors[i % colors.length]} h-2.5 rounded-full`} style={{ width: `${item.val}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
              <CalendarDays size={18} className="text-blue-500" /> 活動カレンダー (直近5週)
            </h3>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                <div key={d} className="text-center text-[10px] text-gray-400 font-bold">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((dateObj, i) => {
                if (!dateObj) return <div key={i} className="aspect-square"></div>
                const record = getRecordForDate(dateObj)
                let bgClass = 'bg-gray-100'
                if (record && record.type === 'workout') bgClass = 'bg-blue-600 shadow-sm'
                else if (record && record.type === 'rest') bgClass = 'bg-gray-300'
                return (
                  <button
                    key={i}
                    onClick={() => record && setSelectedRecordDetail(record)}
                    disabled={!record}
                    className={`aspect-square rounded-md ${bgClass} ${record ? 'hover:opacity-80 active:scale-95 transition-all cursor-pointer' : 'opacity-50 cursor-default'} flex items-center justify-center`}
                    title={dateObj.toLocaleDateString('ja-JP')}
                  >
                    {record && <span className="text-[8px] text-white/80 font-bold">{dateObj.getDate()}</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-4 mt-4 text-[10px] text-gray-500 justify-end items-center">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div>トレ</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-300 rounded-sm"></div>休養</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: History ────────────────────────────────────────────────────────────

  const TabHistory = () => (
    <div className="pb-28 max-w-2xl mx-auto bg-gray-50 min-h-screen">
      <div className="bg-white px-4 py-3 sticky top-14 z-30 shadow-sm border-b border-gray-100">
        <div className="flex bg-gray-100 p-1 rounded-xl mb-3">
          <button onClick={() => setFilterMode('month')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filterMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>月単位</button>
          <button onClick={() => setFilterMode('year')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filterMode === 'year' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>年単位</button>
        </div>
        <div className="flex items-center justify-between px-2">
          <button onClick={() => shiftDate(-1)} className="p-2 rounded-full hover:bg-gray-100 text-blue-600"><ChevronLeft size={24} /></button>
          <div className="font-extrabold text-gray-800 text-lg">
            {filterMode === 'month' ? `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月` : `${currentDate.getFullYear()}年`}
          </div>
          <button onClick={() => shiftDate(1)} className="p-2 rounded-full hover:bg-gray-100 text-blue-600"><ChevronRight size={24} /></button>
        </div>
      </div>
      <div className="p-4 space-y-4 mt-2">
        {filteredRecords.length === 0
          ? <div className="text-center text-gray-400 py-12 bg-white rounded-3xl border border-dashed border-gray-200">記録はありません。</div>
          : filteredRecords.map(record => (
            <div key={record.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <div className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  {record.type === 'rest'
                    ? <div className="p-1.5 bg-gray-100 rounded-lg"><Moon size={18} className="text-gray-400" /></div>
                    : <div className="p-1.5 bg-blue-100 rounded-lg"><Flame size={18} className="text-blue-600" /></div>}
                  {record.date} ({record.day})
                </div>
                {record.type === 'workout' && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-bold">{record.category}</span>}
              </div>
              {record.type === 'rest' ? <div className="text-gray-400 text-sm ml-10">休養日💤</div> : (
                <div className="space-y-2 ml-10">
                  {record.exercises.map((ex, idx) => {
                    const completedSets = ex.sets.filter(s => s.completed).length
                    return (
                      <div key={idx} className="text-xs flex justify-between items-center border-b border-gray-50 pb-1 last:border-0">
                        <span className="font-medium text-gray-600">{ex.name}</span>
                        <span className={`font-bold px-2 py-0.5 rounded-md ${completedSets === ex.targetSets ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{completedSets} / {ex.targetSets}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )

  // ── Navigation ──────────────────────────────────────────────────────────────

  const Navigation = () => (
    <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-200 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-20 max-w-md mx-auto px-2">
        <button onClick={() => setActiveTab('plan')} className={`flex flex-col items-center justify-center w-1/4 h-full transition-all ${activeTab === 'plan' ? 'text-blue-600 -translate-y-1' : 'text-gray-400'}`}>
          <CalendarDays size={24} strokeWidth={activeTab === 'plan' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-bold">プラン</span>
        </button>
        <button onClick={() => setActiveTab('record')} className={`flex flex-col items-center justify-center w-1/4 h-full transition-all ${activeTab === 'record' ? 'text-blue-600 -translate-y-1' : 'text-gray-400'}`}>
          <Dumbbell size={24} strokeWidth={activeTab === 'record' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-bold">ワークアウト</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center w-1/4 h-full transition-all ${activeTab === 'history' ? 'text-blue-600 -translate-y-1' : 'text-gray-400'}`}>
          <History size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-bold">履歴</span>
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center justify-center w-1/4 h-full transition-all ${activeTab === 'analytics' ? 'text-blue-600 -translate-y-1' : 'text-gray-400'}`}>
          <BarChart3 size={24} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} /><span className="text-[10px] mt-1 font-bold">分析</span>
        </button>
      </div>
    </div>
  )

  // ── Loading state ───────────────────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-200 relative">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <h1 className="font-black text-lg tracking-wider text-gray-900 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-md text-xs">F</span>
            FITTRACK
          </h1>
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="ログアウト"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main>
        {activeTab === 'plan' && <TabPlan />}
        {activeTab === 'record' && <TabRecord />}
        {activeTab === 'history' && <TabHistory />}
        {activeTab === 'analytics' && <TabAnalytics />}
      </main>

      <Navigation />

      {selectedRecordDetail && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button onClick={() => setSelectedRecordDetail(null)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-600" /></button>
            <div className="flex items-center gap-2 mb-4 pr-8">
              {selectedRecordDetail.type === 'rest'
                ? <div className="p-2 bg-gray-100 rounded-xl"><Moon size={20} className="text-gray-400" /></div>
                : <div className="p-2 bg-blue-100 rounded-xl"><Flame size={20} className="text-blue-600" /></div>}
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{selectedRecordDetail.date} ({selectedRecordDetail.day})</h3>
                <p className="text-xs text-gray-500 font-bold">{selectedRecordDetail.category || '休養日'}</p>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              {selectedRecordDetail.type === 'rest' ? (
                <p className="text-gray-500 py-4 text-center">この日は休養日でした💤</p>
              ) : (
                <div className="space-y-3">
                  {selectedRecordDetail.exercises.map((ex, idx) => {
                    const completedSets = ex.sets.filter(s => s.completed).length
                    return (
                      <div key={idx} className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <div className="font-bold text-sm text-gray-800 mb-1">{ex.name}</div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">目標: {ex.targetSets}セット</span>
                          <span className={`font-bold px-2 py-1 rounded-lg ${completedSets === ex.targetSets ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-200 text-gray-600'}`}>{completedSets} / {ex.targetSets} 完了</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <button onClick={() => setSelectedRecordDetail(null)} className="mt-6 w-full py-3 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-transform">閉じる</button>
          </div>
        </div>
      )}
    </div>
  )
}
