import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native'
import { CheckCircle, ChevronLeft, Minus, Moon, Play, Plus, Timer } from 'lucide-react-native'
import { fetchOrSeedPlans } from '../lib/plans'
import { fetchOrSeedEquipment } from '../lib/equipment'
import { fetchRecords, saveRestRecord, saveWorkoutRecord } from '../lib/records'
import { generateEquipmentOptions } from '../lib/equipmentUtils'
import { daysOfWeek, displayDaysOfWeek } from '../lib/workoutPlans'
import { useWorkoutTimer } from '../hooks/useWorkoutTimer'
import TimerBar from './TimerBar'
import type {
  EquipmentItem, EquipmentOption, Exercise, SessionData,
  SessionExercise, SetData, TimerState, WorkoutPlan, WorkoutRecord
} from '../types'

// ─── Small pickers (defined outside the screen so they don't remount on timer ticks) ──

const NumberStepper = ({ label, value, onChange, min = 0, max = 999, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number
}) => (
  <View style={styles.pickerCol}>
    <Text style={styles.pickerLabel}>{label}</Text>
    <View style={styles.pickerBox}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={styles.pickerArrow} hitSlop={6}>
        <Minus size={14} color="#6b7280" />
      </TouchableOpacity>
      <TextInput
        style={styles.pickerInput}
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => {
          if (t === '') return onChange(min)
          const n = Number(t)
          if (!Number.isNaN(n)) onChange(n)
        }}
        onBlur={() => onChange(Math.max(min, Math.min(max, value)))}
      />
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={styles.pickerArrow} hitSlop={6}>
        <Plus size={14} color="#6b7280" />
      </TouchableOpacity>
    </View>
  </View>
)

const EquipmentPicker = ({ label, value, options, onChange }: {
  label: string; value: number; options: EquipmentOption[]; onChange: (v: number) => void
}) => {
  const idx = Math.max(0, options.findIndex(o => o.weight === value))
  const cycle = (dir: number) => {
    const nextIdx = (idx + dir + options.length) % options.length
    onChange(options[nextIdx].weight)
  }
  return (
    <View style={styles.pickerCol}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerBox}>
        <TouchableOpacity onPress={() => cycle(-1)} style={styles.pickerArrow} hitSlop={6}>
          <Minus size={14} color="#6b7280" />
        </TouchableOpacity>
        <Text style={styles.pickerValue} numberOfLines={1}>{options[idx]?.label ?? 'ー'}</Text>
        <TouchableOpacity onPress={() => cycle(1)} style={styles.pickerArrow} hitSlop={6}>
          <Plus size={14} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface WorkoutRecordScreenProps { userId: string }

export default function WorkoutRecordScreen({ userId }: WorkoutRecordScreenProps) {
  const todayDayStr = daysOfWeek[new Date().getDay()]
  const todayDateStr = new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })

  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [records, setRecords] = useState<WorkoutRecord[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedRecordDay, setSelectedRecordDay] = useState(todayDayStr)
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active'>('idle')
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

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

  const handleWorkTimerComplete = (timerState: TimerState) => {
    setCurrentSession(prev => {
      if (!prev || timerState.exIdx === null || timerState.setIdx === null) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((ex, ei) => ei !== timerState.exIdx ? ex : {
          ...ex,
          sets: ex.sets.map((s, si) => si === timerState.setIdx ? { ...s, completed: true } : s)
        })
      }
    })
    if (timerState.interval > 0) {
      setTimeout(() => startTimer('rest', timerState.interval), 1000)
    }
  }

  const { activeTimer, startTimer, startTabataTimer, cancelTimer } = useWorkoutTimer({
    onWorkComplete: handleWorkTimerComplete
  })

  const targetPlan = plans.find(p => p.day === selectedRecordDay) || { exercises: [] as Exercise[], day: selectedRecordDay, category: '' }

  const startRealSession = () => {
    const sessionExercises: SessionExercise[] = targetPlan.exercises.map(ex => {
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
        options: equipmentOptionsMap.get(ex.equipmentType) ?? [{ label: 'ー', weight: 0 }],
        targetSets: inherited && lastEx ? lastEx.sets.length : ex.targetSets,
        sets
      }
    })

    setCurrentSession({
      date: `${new Date().getMonth() + 1}/${new Date().getDate()}`,
      fullDate: new Date().toISOString(),
      day: todayDayStr,
      category: targetPlan.category,
      exercises: sessionExercises
    })
    setSessionStatus('active')
  }

  const skipSession = async () => {
    try {
      const record = await saveRestRecord(userId, todayDayStr)
      setRecords(prev => [record, ...prev])
      setSessionStatus('idle')
    } catch (err) {
      console.error('Failed to save rest record:', err)
      Alert.alert('保存に失敗しました', err instanceof Error ? err.message : String(err))
    }
  }

  const handleSetUpdate = (exerciseIndex: number, setIndex: number, field: keyof SetData, value: number) => {
    setCurrentSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((ex, ei) => ei !== exerciseIndex ? ex : {
          ...ex,
          sets: ex.sets.map((s, si) => si !== setIndex ? s : { ...s, [field]: value })
        })
      }
    })
  }

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    if (!currentSession) return
    const isCompletedNow = !currentSession.exercises[exerciseIndex].sets[setIndex].completed
    setCurrentSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((ex, ei) => ei !== exerciseIndex ? ex : {
          ...ex,
          sets: ex.sets.map((s, si) => si === setIndex ? { ...s, completed: isCompletedNow } : s)
        })
      }
    })

    if (isCompletedNow) {
      const ex = currentSession.exercises[exerciseIndex]
      const supersetGroup = ex.supersetGroup
      let shouldRest = true
      if (supersetGroup) {
        const lastGroupIdx = currentSession.exercises.reduce(
          (last, e, i) => (e.supersetGroup === supersetGroup ? i : last), -1
        )
        shouldRest = exerciseIndex === lastGroupIdx
      }
      if (shouldRest && ex.interval > 0) startTimer('rest', ex.interval)
    }
  }

  const saveWorkoutSession = async () => {
    if (!currentSession) return
    try {
      const record = await saveWorkoutRecord(userId, currentSession)
      setRecords(prev => [record, ...prev])
      setSessionStatus('idle')
      setCurrentSession(null)
      cancelTimer()
    } catch (err) {
      console.error('Failed to save workout record:', err)
      Alert.alert('保存に失敗しました', err instanceof Error ? err.message : String(err))
    }
  }

  if (dataLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>データを読み込み中...</Text>
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>読み込みに失敗しました: {loadError}</Text>
      </View>
    )
  }

  if (sessionStatus === 'idle') {
    return (
      <View style={styles.fill}>
        <ScrollView contentContainerStyle={styles.idleContent}>
          <View style={styles.idleHeader}>
            <Text style={styles.todayLabel}>TODAY</Text>
            <Text style={styles.todayDate}>{todayDateStr} <Text style={styles.todayDay}>({todayDayStr})</Text></Text>
          </View>

          <View style={styles.dayTabs}>
            {displayDaysOfWeek.map(day => (
              <TouchableOpacity
                key={day}
                onPress={() => setSelectedRecordDay(day)}
                style={[styles.dayTab, selectedRecordDay === day && styles.dayTabActive]}
              >
                <Text style={[styles.dayTabText, selectedRecordDay === day && styles.dayTabTextActive]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.planCard}>
            <Text style={styles.planCardLabel}>
              {selectedRecordDay === todayDayStr ? `今日 (${todayDayStr}) の予定` : `${selectedRecordDay}曜日のメニュー`}
            </Text>
            <Text style={styles.planCardCategory}>{targetPlan.category || '完全休養'}</Text>

            {targetPlan.exercises.length > 0 ? (
              <View style={styles.exerciseList}>
                {targetPlan.exercises.map((ex, i) => (
                  <View key={ex.id ?? i} style={styles.exerciseListRow}>
                    <View style={styles.exerciseListLeft}>
                      <View style={styles.exerciseDot} />
                      <Text style={styles.exerciseListName}>{ex.name}</Text>
                    </View>
                    <Text style={styles.exerciseListSets}>{ex.targetSets}セット</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.restDayText}>休養日として設定されています。</Text>
            )}

            {targetPlan.exercises.length > 0 && (
              <TouchableOpacity style={styles.primaryButton} onPress={startRealSession}>
                <Play size={20} color="#fff" fill="#fff" />
                <Text style={styles.primaryButtonText}>トレーニングを開始する</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.secondaryButton} onPress={skipSession}>
              <Moon size={20} color="#374151" />
              <Text style={styles.secondaryButtonText}>今日は休養する</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    )
  }

  if (!currentSession) return null

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.sessionContent}>
        <View style={styles.sessionHeader}>
          <TouchableOpacity onPress={() => setShowCancelConfirm(true)} hitSlop={8}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.sessionHeaderTitles}>
            <Text style={styles.sessionCategory}>{currentSession.category}</Text>
            <Text style={styles.sessionDate}>{currentSession.date}</Text>
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={saveWorkoutSession}>
            <Text style={styles.saveButtonText}>完了して保存</Text>
          </TouchableOpacity>
        </View>

        {currentSession.exercises.map((ex, exIdx) => (
          <View key={exIdx} style={styles.exerciseCard}>
            <View style={styles.exerciseCardHeader}>
              <View style={styles.exerciseCardHeaderLeft}>
                <View style={styles.exerciseIndexBadge}>
                  <Text style={styles.exerciseIndexBadgeText}>{exIdx + 1}</Text>
                </View>
                <Text style={styles.exerciseCardName}>{ex.name}</Text>
                {ex.inherited && <Text style={styles.inheritedBadge}>前回引継</Text>}
              </View>
              <View style={styles.intervalBadge}>
                <Timer size={12} color="#6b7280" />
                <Text style={styles.intervalBadgeText}>{ex.interval}s</Text>
              </View>
            </View>

            {ex.sets.map((set, setIdx) => (
              <View key={setIdx} style={[styles.setRow, set.completed && styles.setRowCompleted]}>
                {ex.type === 'tabata' ? (
                  <>
                    <Text style={styles.setNumber}>{set.setNumber}</Text>
                    <View style={styles.tabataInfo}>
                      <Text style={styles.tabataInfoText}>
                        {set.tabataWork}s / {set.tabataRest}s × {set.tabataCycles}
                      </Text>
                    </View>
                    <TouchableOpacity
                      disabled={set.completed}
                      onPress={() => startTabataTimer(exIdx, setIdx, set.tabataWork ?? 20, set.tabataRest ?? 10, set.tabataCycles ?? 8, ex.interval)}
                      style={[styles.playButton, set.completed && styles.playButtonDisabled]}
                    >
                      <Play size={18} color="#fff" fill="#fff" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.setNumber}>{set.setNumber}</Text>
                    <View style={styles.setInputs}>
                      <EquipmentPicker
                        label="負荷/機材"
                        value={set.weight}
                        options={ex.options}
                        onChange={(v) => handleSetUpdate(exIdx, setIdx, 'weight', v)}
                      />
                      <NumberStepper
                        label={ex.type === 'duration' ? '秒数' : '回数'}
                        value={set.reps}
                        onChange={(v) => handleSetUpdate(exIdx, setIdx, 'reps', v)}
                      />
                    </View>
                    {ex.type === 'duration' && (
                      <TouchableOpacity
                        disabled={set.completed}
                        onPress={() => startTimer('work', set.reps, exIdx, setIdx, ex.interval)}
                        style={[styles.playButton, set.completed && styles.playButtonDisabled]}
                      >
                        <Play size={18} color="#fff" fill="#fff" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
                <TouchableOpacity
                  onPress={() => toggleSetComplete(exIdx, setIdx)}
                  style={[styles.completeButton, set.completed && styles.completeButtonDone]}
                >
                  <CheckCircle size={24} color={set.completed ? '#fff' : '#9ca3af'} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {showCancelConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>トレーニングを中止しますか？</Text>
            <Text style={styles.modalBody}>入力した内容は保存されずにリセットされます。</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowCancelConfirm(false)}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  setShowCancelConfirm(false)
                  setSessionStatus('idle')
                  setCurrentSession(null)
                  cancelTimer()
                }}
              >
                <Text style={styles.modalConfirmText}>中止する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <TimerBar timer={activeTimer} onCancel={cancelTimer} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#f9fafb' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  loadingText: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },
  errorText: { color: '#dc2626', fontSize: 13, textAlign: 'center' },

  idleContent: { padding: 20, paddingBottom: 48 },
  idleHeader: { alignItems: 'center', marginBottom: 20 },
  todayLabel: { color: '#3b82f6', fontWeight: '800', fontSize: 11, letterSpacing: 1.5 },
  todayDate: { fontSize: 28, fontWeight: '900', color: '#1f2937' },
  todayDay: { fontSize: 18, color: '#9ca3af', fontWeight: '700' },

  dayTabs: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 6, marginBottom: 20, borderWidth: 1, borderColor: '#f3f4f6' },
  dayTab: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  dayTabActive: { backgroundColor: '#111827' },
  dayTabText: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  dayTabTextActive: { color: '#fff' },

  planCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center' },
  planCardLabel: { color: '#6b7280', fontWeight: '500', marginBottom: 4 },
  planCardCategory: { fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 20 },

  exerciseList: { width: '100%', backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, marginBottom: 28, gap: 6 },
  exerciseListRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseListLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6' },
  exerciseListName: { fontSize: 13, color: '#374151' },
  exerciseListSets: { fontSize: 12, color: '#9ca3af' },
  restDayText: { color: '#9ca3af', marginBottom: 28 },

  primaryButton: { width: '100%', flexDirection: 'row', gap: 8, backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: { width: '100%', flexDirection: 'row', gap: 8, backgroundColor: '#f3f4f6', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#374151', fontWeight: '800', fontSize: 15 },

  sessionContent: { padding: 12, paddingBottom: 120 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#4f46e5', borderRadius: 16, padding: 16, marginBottom: 20 },
  sessionHeaderTitles: { flex: 1, marginLeft: 8 },
  sessionCategory: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sessionDate: { color: '#c7d2fe', fontSize: 10, fontWeight: '600' },
  saveButton: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  saveButtonText: { color: '#4338ca', fontWeight: '800', fontSize: 13 },

  exerciseCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 20, overflow: 'hidden' },
  exerciseCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  exerciseCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  exerciseIndexBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  exerciseIndexBadgeText: { color: '#2563eb', fontSize: 11, fontWeight: '800' },
  exerciseCardName: { fontWeight: '700', fontSize: 14, color: '#1f2937', flexShrink: 1 },
  inheritedBadge: { fontSize: 9, fontWeight: '800', color: '#4338ca', backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  intervalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  intervalBadgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  setRowCompleted: { backgroundColor: '#f0fdf4' },
  setNumber: { width: 20, textAlign: 'center', fontWeight: '700', color: '#9ca3af' },
  setInputs: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  tabataInfo: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingVertical: 8 },
  tabataInfoText: { fontSize: 11, fontWeight: '700', color: '#ea580c' },

  playButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' },
  playButtonDisabled: { backgroundColor: '#e5e7eb' },
  completeButton: { width: 48, height: 40, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  completeButtonDone: { backgroundColor: '#22c55e' },

  pickerCol: { alignItems: 'center' },
  pickerLabel: { fontSize: 9, color: '#9ca3af', marginBottom: 4 },
  pickerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, height: 36, minWidth: 96, paddingHorizontal: 4 },
  pickerArrow: { width: 24, height: '100%', alignItems: 'center', justifyContent: 'center' },
  pickerValue: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#1f2937' },
  pickerInput: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#1f2937', padding: 0 },

  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,24,39,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937', marginBottom: 8, textAlign: 'center' },
  modalBody: { fontSize: 13, color: '#6b7280', marginBottom: 20, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelButton: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelText: { fontWeight: '700', color: '#374151' },
  modalConfirmButton: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#ef4444', alignItems: 'center' },
  modalConfirmText: { fontWeight: '700', color: '#fff' }
})
