import { Fragment, useState } from 'react'
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native'
import { Edit3, Link2, Plus, Save, Timer, Trash2, Unlink2, X } from 'lucide-react-native'
import { useWorkoutData } from '../context/WorkoutDataContext'
import { daysOfWeek } from '../lib/workoutPlans'
import DayTabs from './shared/DayTabs'
import { CyclePicker, NumberStepper } from './shared/pickers'
import type { Exercise, ExerciseType, WorkoutPlan } from '../types'

const EXERCISE_TYPE_OPTIONS: { label: string; value: ExerciseType }[] = [
  { label: '通常（回数）', value: 'normal' },
  { label: '秒数（デュレーション）', value: 'duration' },
  { label: 'ラウンド（HIIT等）', value: 'tabata' }
]

const INTERVAL_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180].map(sec => ({ label: `${sec}s`, value: sec }))

const cloneExercises = (exercises: Exercise[]): Exercise[] => exercises.map(ex => ({ ...ex }))

export default function PlanScreen() {
  const todayDayStr = daysOfWeek[new Date().getDay()]
  const { plans, equipment, dataLoading, loadError, savePlan } = useWorkoutData()

  const [selectedDay, setSelectedDay] = useState(todayDayStr)
  const [isEditing, setIsEditing] = useState(false)
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null)
  const [saving, setSaving] = useState(false)

  const equipmentOptions = equipment
    .filter(e => e.category === 'load')
    .map(item => ({ label: item.name, value: item.id }))

  const currentPlan = plans.find(p => p.day === selectedDay) || { day: selectedDay, category: '', exercises: [] as Exercise[] }

  const startEdit = () => {
    setEditingPlan({ day: currentPlan.day, category: currentPlan.category, exercises: cloneExercises(currentPlan.exercises) })
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditingPlan(null)
  }

  const saveEdit = async () => {
    if (!editingPlan) return
    setSaving(true)
    try {
      await savePlan(editingPlan)
      setIsEditing(false)
      setEditingPlan(null)
    } catch (err) {
      console.error('Failed to save plan:', err)
      Alert.alert('保存に失敗しました', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const updateCategory = (value: string) => {
    setEditingPlan(prev => prev ? { ...prev, category: value } : null)
  }

  const updateExercise = (exId: string, field: keyof Exercise, value: string | number) => {
    setEditingPlan(prev => prev ? {
      ...prev,
      exercises: prev.exercises.map(ex => ex.id === exId ? { ...ex, [field]: value } : ex)
    } : null)
  }

  const removeExercise = (exId: string) => {
    setEditingPlan(prev => prev ? { ...prev, exercises: prev.exercises.filter(ex => ex.id !== exId) } : null)
  }

  const addExercise = () => {
    const newEx: Exercise = {
      id: `ex-${Date.now()}`,
      name: '新しい種目',
      type: 'normal',
      targetSets: 3,
      defaultReps: 10,
      defaultWeight: 0,
      interval: 60,
      equipmentType: equipmentOptions[0]?.value ?? 'bodyweight'
    }
    setEditingPlan(prev => prev ? { ...prev, exercises: [...prev.exercises, newEx] } : null)
  }

  const linkSuperset = (exId1: string, exId2: string) => {
    setEditingPlan(prev => {
      if (!prev) return null
      const ex1 = prev.exercises.find(e => e.id === exId1)
      const ex2 = prev.exercises.find(e => e.id === exId2)
      if (!ex1 || !ex2) return prev
      const groupId = ex1.supersetGroup || ex2.supersetGroup || `ss-${Date.now()}`
      return {
        ...prev,
        exercises: prev.exercises.map(e => e.id === exId1 || e.id === exId2 ? { ...e, supersetGroup: groupId } : e)
      }
    })
  }

  const unlinkSuperset = (exId1: string, exId2: string) => {
    setEditingPlan(prev => {
      if (!prev) return null
      const exercises = prev.exercises
      const idx1 = exercises.findIndex(e => e.id === exId1)
      const idx2 = exercises.findIndex(e => e.id === exId2)
      const groupId = exercises[idx1]?.supersetGroup
      if (!groupId) return prev
      const groupIdxs = exercises.reduce<number[]>((acc, e, i) => {
        if (e.supersetGroup === groupId) acc.push(i)
        return acc
      }, [])
      const beforeIdxs = groupIdxs.filter(i => i <= idx1)
      const afterIdxs = groupIdxs.filter(i => i >= idx2)
      const newGroupBefore = beforeIdxs.length >= 2 ? groupId : undefined
      const newGroupAfter = afterIdxs.length >= 2 ? `ss-${Date.now()}` : undefined
      return {
        ...prev,
        exercises: exercises.map((e, i) => {
          if (beforeIdxs.includes(i)) return { ...e, supersetGroup: newGroupBefore }
          if (afterIdxs.includes(i)) return { ...e, supersetGroup: newGroupAfter }
          return e
        })
      }
    })
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

  if (isEditing && editingPlan) {
    return (
      <View style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.editHeader}>
            <Text style={styles.editTitle}>{selectedDay}曜日の編集</Text>
            <View style={styles.editHeaderActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit} disabled={saving}>
                <X size={16} color="#374151" />
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveEdit} disabled={saving}>
                <Save size={16} color="#fff" />
                <Text style={styles.saveButtonText}>{saving ? '保存中...' : '保存'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.categoryCard}>
            <Text style={styles.fieldLabel}>メニューのカテゴリ（部位など）</Text>
            <TextInput
              style={styles.categoryInput}
              value={editingPlan.category}
              onChangeText={updateCategory}
              placeholder="例：上半身・引く"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {editingPlan.exercises.map((ex, idx) => {
            const nextEx = editingPlan.exercises[idx + 1]
            const isLinkedToNext = !!ex.supersetGroup && ex.supersetGroup === nextEx?.supersetGroup
            const isInSuperset = !!ex.supersetGroup
            return (
              <Fragment key={ex.id}>
                <View style={[styles.exerciseEditCard, isInSuperset && styles.exerciseEditCardSuperset]}>
                  {isInSuperset && <Text style={styles.ssBadge}>SS</Text>}
                  <TouchableOpacity style={styles.removeButton} onPress={() => removeExercise(ex.id)} hitSlop={8}>
                    <Trash2 size={18} color="#9ca3af" />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.exerciseNameInput}
                    value={ex.name}
                    onChangeText={(v) => updateExercise(ex.id, 'name', v)}
                    placeholder="種目名"
                    placeholderTextColor="#9ca3af"
                  />

                  <View style={styles.pickerRow}>
                    <CyclePicker
                      label="種目タイプ"
                      value={ex.type}
                      options={EXERCISE_TYPE_OPTIONS}
                      onChange={(v) => updateExercise(ex.id, 'type', v)}
                    />
                    <CyclePicker
                      label="使用する機材"
                      value={ex.equipmentType}
                      options={equipmentOptions.length > 0 ? equipmentOptions : [{ label: 'ー', value: ex.equipmentType }]}
                      onChange={(v) => updateExercise(ex.id, 'equipmentType', v)}
                    />
                  </View>

                  <View style={styles.pickerRow}>
                    <NumberStepper
                      label="セット数"
                      value={ex.targetSets}
                      min={1}
                      max={20}
                      onChange={(v) => updateExercise(ex.id, 'targetSets', v)}
                    />
                    {ex.type !== 'tabata' && (
                      <NumberStepper
                        label={ex.type === 'duration' ? '初期設定（秒）' : '初期設定（回）'}
                        value={ex.defaultReps}
                        onChange={(v) => updateExercise(ex.id, 'defaultReps', v)}
                      />
                    )}
                    <CyclePicker
                      label="インターバル"
                      value={ex.interval}
                      options={INTERVAL_OPTIONS}
                      onChange={(v) => updateExercise(ex.id, 'interval', v)}
                    />
                  </View>

                  {ex.type === 'tabata' && (
                    <View style={styles.tabataRow}>
                      <NumberStepper label="稼働(秒)" value={ex.tabataWork ?? 20} min={1} onChange={(v) => updateExercise(ex.id, 'tabataWork', v)} />
                      <NumberStepper label="休憩(秒)" value={ex.tabataRest ?? 10} min={1} onChange={(v) => updateExercise(ex.id, 'tabataRest', v)} />
                      <NumberStepper label="サイクル数" value={ex.tabataCycles ?? 8} min={1} onChange={(v) => updateExercise(ex.id, 'tabataCycles', v)} />
                    </View>
                  )}
                </View>

                {nextEx && (
                  <View style={styles.linkRow}>
                    {isLinkedToNext ? (
                      <TouchableOpacity style={styles.linkedPill} onPress={() => unlinkSuperset(ex.id, nextEx.id)}>
                        <Text style={styles.linkedPillText}>⚡ スーパーセット接続中</Text>
                        <Unlink2 size={12} color="#a855f7" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.linkPill} onPress={() => linkSuperset(ex.id, nextEx.id)}>
                        <Link2 size={12} color="#9ca3af" />
                        <Text style={styles.linkPillText}>スーパーセット接続</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Fragment>
            )
          })}

          <TouchableOpacity style={styles.addButton} onPress={addExercise}>
            <Plus size={18} color="#6b7280" />
            <Text style={styles.addButtonText}>新しい種目を追加</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.dayTabsWrap}>
          <DayTabs selectedDay={selectedDay} onSelect={setSelectedDay} />
        </View>

        <View style={styles.viewHeader}>
          <View style={styles.viewHeaderTitles}>
            <Text style={styles.viewTitle}>{selectedDay}曜日のメニュー</Text>
            <Text style={styles.viewCategory}>{currentPlan.category || '完全休養'}</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={startEdit}>
            <Edit3 size={16} color="#2563eb" />
            <Text style={styles.editButtonText}>編集</Text>
          </TouchableOpacity>
        </View>

        {currentPlan.exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>この日は休養日です</Text>
          </View>
        ) : (
          currentPlan.exercises.map((ex, idx) => {
            const nextEx = currentPlan.exercises[idx + 1]
            const isInSuperset = !!ex.supersetGroup
            const isLinkedToNext = isInSuperset && nextEx?.supersetGroup === ex.supersetGroup
            return (
              <Fragment key={ex.id}>
                <View style={[styles.viewCard, isInSuperset && styles.viewCardSuperset]}>
                  <View style={styles.viewCardHeader}>
                    <Text style={styles.viewCardIndex}>{idx + 1}.</Text>
                    <Text style={styles.viewCardName}>{ex.name}</Text>
                    {isInSuperset && <Text style={styles.ssBadge}>SS</Text>}
                  </View>
                  <View style={styles.viewCardTags}>
                    <Text style={styles.tag}>
                      🎯 {ex.targetSets} Sets × {ex.type === 'tabata' ? 'HIIT' : ex.type === 'duration' ? `${ex.defaultReps}秒` : `${ex.defaultReps}回`}
                    </Text>
                    <View style={styles.tagWithIcon}>
                      <Timer size={12} color="#4b5563" />
                      <Text style={styles.tag}>{ex.interval}s</Text>
                    </View>
                    {ex.type === 'tabata' && (
                      <Text style={styles.tagOrange}>{ex.tabataWork}s / {ex.tabataRest}s × {ex.tabataCycles}回</Text>
                    )}
                  </View>
                </View>
                {isLinkedToNext && (
                  <View style={styles.linkDivider}>
                    <Text style={styles.linkDividerText}>⚡ 続けて実施（スーパーセット）</Text>
                  </View>
                )}
              </Fragment>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#f9fafb' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  loadingText: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },
  errorText: { color: '#dc2626', fontSize: 13, textAlign: 'center' },

  content: { padding: 16, paddingBottom: 48 },
  dayTabsWrap: { marginBottom: 20 },

  viewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3b82f6', paddingLeft: 10 },
  viewHeaderTitles: { flexShrink: 1 },
  viewTitle: { fontSize: 20, fontWeight: '900', color: '#1f2937' },
  viewCategory: { color: '#6b7280', fontWeight: '500', marginTop: 2 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  editButtonText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5e7eb', padding: 32, alignItems: 'center' },
  emptyText: { color: '#9ca3af' },

  viewCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f3f4f6', padding: 16, marginBottom: 12 },
  viewCardSuperset: { borderColor: '#e9d5ff' },
  viewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  viewCardIndex: { color: '#93c5fd', fontWeight: '700' },
  viewCardName: { fontWeight: '700', fontSize: 16, color: '#1f2937', flexShrink: 1 },
  viewCardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#f3f4f6', color: '#4b5563', fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  tagOrange: { backgroundColor: '#fff7ed', color: '#ea580c', fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  tagWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },

  linkDivider: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, marginTop: -12, marginBottom: 12 },
  linkDividerText: { fontSize: 9, fontWeight: '700', color: '#a855f7' },

  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editTitle: { fontSize: 18, fontWeight: '900', color: '#1f2937' },
  editHeaderActions: { flexDirection: 'row', gap: 8 },
  cancelButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  cancelButtonText: { color: '#374151', fontWeight: '700', fontSize: 12 },
  saveButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  categoryCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', padding: 16, marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 6 },
  categoryInput: { fontSize: 16, fontWeight: '700', color: '#1f2937', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 6 },

  exerciseEditCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 16, gap: 12 },
  exerciseEditCardSuperset: { borderColor: '#e9d5ff' },
  ssBadge: { position: 'absolute', top: 12, left: 12, fontSize: 9, fontWeight: '900', color: '#a855f7', backgroundColor: '#f3e8ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, letterSpacing: 1 },
  removeButton: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  exerciseNameInput: { fontSize: 16, fontWeight: '700', color: '#1f2937', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 6, paddingRight: 32 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tabataRow: { flexDirection: 'row', gap: 10, backgroundColor: '#fff7ed', borderRadius: 12, borderWidth: 1, borderColor: '#fed7aa', padding: 10 },

  linkRow: { alignItems: 'center', paddingVertical: 8 },
  linkedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#faf5ff', borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  linkedPillText: { fontSize: 10, fontWeight: '700', color: '#a855f7' },
  linkPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  linkPillText: { fontSize: 10, fontWeight: '600', color: '#9ca3af' },

  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  addButtonText: { color: '#6b7280', fontWeight: '700' }
})
