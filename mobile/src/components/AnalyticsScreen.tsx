import { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Moon, Target, Trophy, X, Zap } from 'lucide-react-native'
import { useWorkoutData } from '../context/WorkoutDataContext'
import type { WorkoutRecord } from '../types'

type FilterMode = 'month' | 'year'

const BAR_COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f97316', '#a855f7']

const buildCalendarDays = (): (Date | null)[] => {
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
}

export default function AnalyticsScreen() {
  const { records, dataLoading, loadError } = useWorkoutData()
  const [filterMode, setFilterMode] = useState<FilterMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedRecord, setSelectedRecord] = useState<WorkoutRecord | null>(null)

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const recordDate = new Date(record.fullDate)
      if (filterMode === 'month') {
        return recordDate.getMonth() === currentDate.getMonth() && recordDate.getFullYear() === currentDate.getFullYear()
      }
      return recordDate.getFullYear() === currentDate.getFullYear()
    })
  }, [records, filterMode, currentDate])

  const shiftDate = (direction: number) => {
    const newDate = new Date(currentDate)
    if (filterMode === 'month') newDate.setMonth(newDate.getMonth() + direction)
    else newDate.setFullYear(newDate.getFullYear() + direction)
    setCurrentDate(newDate)
  }

  const stats = useMemo(() => {
    const workoutRecords = filteredRecords.filter(r => r.type === 'workout')
    const workoutCount = workoutRecords.length
    const restCount = filteredRecords.filter(r => r.type === 'rest').length
    let totalCompletedSets = 0
    let totalRepsOrSeconds = 0
    const categoryCount: Record<string, number> = {}

    workoutRecords.forEach(record => {
      if (record.category) categoryCount[record.category] = (categoryCount[record.category] ?? 0) + 1
      record.exercises.forEach(ex => {
        ex.sets.filter(s => s.completed).forEach(set => {
          totalCompletedSets++
          if (ex.type === 'tabata') totalRepsOrSeconds += (set.tabataWork ?? 0) * (set.tabataCycles ?? 0)
          else totalRepsOrSeconds += Number(set.reps) || 0
        })
      })
    })

    const totalDays = filteredRecords.length
    const consistencyRate = totalDays > 0 ? Math.round((workoutCount / totalDays) * 100) : 0

    const categoryData = Object.keys(categoryCount).map(cat => ({
      name: cat,
      val: workoutCount > 0 ? Math.round((categoryCount[cat] / workoutCount) * 100) : 0,
      count: categoryCount[cat]
    })).sort((a, b) => b.val - a.val)

    let motivationMsg = 'さあ、新しい記録を作りましょう！'
    if (consistencyRate >= 70) motivationMsg = 'トップアスリート級の継続力です！🔥'
    else if (consistencyRate >= 50) motivationMsg = '素晴らしいペース！完全に習慣化しています👏'
    else if (workoutCount > 0) motivationMsg = '自分のペースで着実に進んでいます！🌱'

    return { workoutCount, restCount, totalCompletedSets, totalRepsOrSeconds, consistencyRate, categoryData, motivationMsg }
  }, [filteredRecords])

  const calendarDays = useMemo(buildCalendarDays, [])

  const getRecordForDate = (dateObj: Date): WorkoutRecord | undefined => {
    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
    return records.find(r => r.date === dateStr)
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

  return (
    <View style={styles.fill}>
      <View style={styles.filterHeader}>
        <View style={styles.filterToggle}>
          <TouchableOpacity
            style={[styles.filterButton, filterMode === 'month' && styles.filterButtonActive]}
            onPress={() => setFilterMode('month')}
          >
            <Text style={[styles.filterButtonText, filterMode === 'month' && styles.filterButtonTextActive]}>月単位</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterMode === 'year' && styles.filterButtonActive]}
            onPress={() => setFilterMode('year')}
          >
            <Text style={[styles.filterButtonText, filterMode === 'year' && styles.filterButtonTextActive]}>年単位</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => shiftDate(-1)} hitSlop={8}>
            <ChevronLeft size={24} color="#2563eb" />
          </TouchableOpacity>
          <Text style={styles.dateNavLabel}>
            {filterMode === 'month' ? `${currentDate.getFullYear()}年 ${currentDate.getMonth() + 1}月` : `${currentDate.getFullYear()}年`}
          </Text>
          <TouchableOpacity onPress={() => shiftDate(1)} hitSlop={8}>
            <ChevronRight size={24} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.motivationCard}>
          <Trophy size={96} color="rgba(255,255,255,0.08)" style={styles.motivationTrophy} />
          <Text style={styles.motivationLabel}>{filterMode === 'month' ? '今月' : 'この年'}の頑張り</Text>
          <Text style={styles.motivationMsg}>{stats.motivationMsg}</Text>
          <View style={styles.motivationGrid}>
            <View style={styles.motivationGridItem}>
              <View style={styles.motivationGridLabel}>
                <Zap size={12} color="#60a5fa" />
                <Text style={styles.motivationGridLabelText}>総レップ＆秒数</Text>
              </View>
              <Text style={styles.motivationGridValue}>{stats.totalRepsOrSeconds.toLocaleString()}</Text>
            </View>
            <View style={styles.motivationGridItem}>
              <View style={styles.motivationGridLabel}>
                <Target size={12} color="#4ade80" />
                <Text style={styles.motivationGridLabelText}>実行率 (トレ日数)</Text>
              </View>
              <Text style={styles.motivationGridValue}>{stats.consistencyRate}<Text style={styles.motivationGridUnit}>%</Text></Text>
            </View>
          </View>
          <View style={styles.motivationFooter}>
            <Text style={styles.motivationFooterItem}><Text style={styles.motivationFooterValue}>{stats.totalCompletedSets}</Text> Sets</Text>
            <Text style={styles.motivationFooterItem}><Text style={styles.motivationFooterValue}>{stats.workoutCount}</Text> Days</Text>
            <Text style={styles.motivationFooterItem}><Text style={styles.motivationFooterValue}>{stats.restCount}</Text> Rest</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <BarChart3 size={18} color="#6366f1" />
            <Text style={styles.cardTitle}>最も強化された部位</Text>
          </View>
          {stats.categoryData.length === 0 ? (
            <Text style={styles.emptyText}>データがありません</Text>
          ) : (
            <View style={styles.categoryList}>
              {stats.categoryData.map((item, i) => (
                <View key={item.name}>
                  <View style={styles.categoryRow}>
                    <View style={styles.categoryRowLeft}>
                      {i === 0 && <Trophy size={12} color="#eab308" />}
                      <Text style={styles.categoryName}>{item.name}</Text>
                    </View>
                    <Text style={styles.categoryCount}>{item.count}回 ({item.val}%)</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${item.val}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }]} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <CalendarDays size={18} color="#3b82f6" />
            <Text style={styles.cardTitle}>活動カレンダー (直近5週)</Text>
          </View>
          <View style={styles.calendarWeekRow}>
            {['日', '月', '火', '水', '木', '金', '土'].map(d => (
              <Text key={d} style={styles.calendarWeekLabel}>{d}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((dateObj, i) => {
              if (!dateObj) return <View key={i} style={styles.calendarCell} />
              const record = getRecordForDate(dateObj)
              const boxStyle = record
                ? (record.type === 'workout' ? styles.calendarBoxWorkout : styles.calendarBoxRest)
                : styles.calendarBoxNone
              return (
                <View key={i} style={styles.calendarCell}>
                  <TouchableOpacity
                    style={[styles.calendarBox, boxStyle]}
                    disabled={!record}
                    onPress={() => record && setSelectedRecord(record)}
                  >
                    {record && <Text style={styles.calendarCellText}>{dateObj.getDate()}</Text>}
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: '#2563eb' }]} />
              <Text style={styles.legendText}>トレ</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: '#d1d5db' }]} />
              <Text style={styles.legendText}>休養</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {selectedRecord && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedRecord(null)} hitSlop={8}>
              <X size={20} color="#4b5563" />
            </TouchableOpacity>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, selectedRecord.type === 'rest' ? styles.recordIconRest : styles.recordIconWorkout]}>
                {selectedRecord.type === 'rest'
                  ? <Moon size={20} color="#9ca3af" />
                  : <Trophy size={20} color="#2563eb" />}
              </View>
              <View>
                <Text style={styles.modalTitle}>{selectedRecord.date} ({selectedRecord.day})</Text>
                <Text style={styles.modalSubtitle}>{selectedRecord.category || '休養日'}</Text>
              </View>
            </View>
            {selectedRecord.type === 'rest' ? (
              <Text style={styles.restLabel}>休養日💤</Text>
            ) : (
              <View style={styles.exerciseList}>
                {selectedRecord.exercises.map((ex, idx) => {
                  const completedSets = ex.sets.filter(s => s.completed).length
                  const isComplete = completedSets === ex.targetSets
                  return (
                    <View key={idx} style={styles.exerciseRow}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      <Text style={[styles.exerciseCount, isComplete ? styles.exerciseCountDone : styles.exerciseCountPartial]}>
                        {completedSets} / {ex.targetSets}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#f9fafb' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24, gap: 12 },
  loadingText: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },
  errorText: { color: '#dc2626', fontSize: 13, textAlign: 'center' },

  filterHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterToggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 12 },
  filterButton: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  filterButtonActive: { backgroundColor: '#fff' },
  filterButtonText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  filterButtonTextActive: { color: '#111827' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  dateNavLabel: { fontSize: 17, fontWeight: '800', color: '#1f2937' },

  content: { padding: 16, paddingBottom: 48, gap: 16 },

  motivationCard: { backgroundColor: '#111827', borderRadius: 24, padding: 24, overflow: 'hidden' },
  motivationTrophy: { position: 'absolute', top: -12, right: -12 },
  motivationLabel: { color: '#d1d5db', fontSize: 13, marginBottom: 4 },
  motivationMsg: { color: '#facc15', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  motivationGrid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  motivationGridItem: { flex: 1 },
  motivationGridLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  motivationGridLabelText: { color: '#9ca3af', fontSize: 11 },
  motivationGridValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
  motivationGridUnit: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  motivationFooter: { flexDirection: 'row', gap: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  motivationFooterItem: { color: '#d1d5db', fontSize: 13 },
  motivationFooterValue: { color: '#fff', fontWeight: '800' },

  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#f3f4f6' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardTitle: { fontWeight: '700', color: '#1f2937', fontSize: 13 },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  categoryList: { gap: 14 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  categoryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryName: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  categoryCount: { fontSize: 12, color: '#4b5563' },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: '#f3f4f6', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },

  calendarWeekRow: { flexDirection: 'row', marginBottom: 8 },
  calendarWeekLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#9ca3af' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  calendarBox: { flex: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  calendarBoxNone: { backgroundColor: '#f3f4f6' },
  calendarBoxWorkout: { backgroundColor: '#2563eb' },
  calendarBoxRest: { backgroundColor: '#d1d5db' },
  calendarCellText: { fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: '700', textAlign: 'center' },
  calendarLegend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10, color: '#6b7280' },

  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,24,39,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalCloseButton: { position: 'absolute', top: 16, right: 16, backgroundColor: '#f3f4f6', borderRadius: 999, padding: 8, zIndex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingRight: 32 },
  modalIcon: { padding: 8, borderRadius: 12 },
  recordIconRest: { backgroundColor: '#f3f4f6' },
  recordIconWorkout: { backgroundColor: '#dbeafe' },
  modalTitle: { fontWeight: '700', fontSize: 16, color: '#111827' },
  modalSubtitle: { fontSize: 11, fontWeight: '700', color: '#6b7280' },

  restLabel: { color: '#9ca3af', fontSize: 13 },
  exerciseList: { gap: 6 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f9fafb', paddingBottom: 6 },
  exerciseName: { fontSize: 12, color: '#4b5563', flexShrink: 1, marginRight: 8 },
  exerciseCount: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  exerciseCountDone: { backgroundColor: '#dcfce7', color: '#15803d' },
  exerciseCountPartial: { backgroundColor: '#f3f4f6', color: '#6b7280' }
})
