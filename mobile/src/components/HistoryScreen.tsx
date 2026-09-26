import { useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ChevronLeft, ChevronRight, Flame, Moon } from 'lucide-react-native'
import { useWorkoutData } from '../context/WorkoutDataContext'

type FilterMode = 'month' | 'year'

export default function HistoryScreen() {
  const { records, dataLoading, loadError } = useWorkoutData()
  const [filterMode, setFilterMode] = useState<FilterMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

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
        {filteredRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>記録はありません。</Text>
          </View>
        ) : (
          filteredRecords.map(record => (
            <View key={record.id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <View style={styles.recordHeaderLeft}>
                  <View style={[styles.recordIcon, record.type === 'rest' ? styles.recordIconRest : styles.recordIconWorkout]}>
                    {record.type === 'rest'
                      ? <Moon size={18} color="#9ca3af" />
                      : <Flame size={18} color="#2563eb" />}
                  </View>
                  <Text style={styles.recordDate}>{record.date} ({record.day})</Text>
                </View>
                {record.type === 'workout' && record.category && (
                  <Text style={styles.categoryBadge}>{record.category}</Text>
                )}
              </View>

              {record.type === 'rest' ? (
                <Text style={styles.restLabel}>休養日💤</Text>
              ) : (
                <View style={styles.exerciseList}>
                  {record.exercises.map((ex, idx) => {
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
          ))
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

  filterHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterToggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 12 },
  filterButton: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  filterButtonActive: { backgroundColor: '#fff' },
  filterButtonText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  filterButtonTextActive: { color: '#111827' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  dateNavLabel: { fontSize: 17, fontWeight: '800', color: '#1f2937' },

  content: { padding: 16, paddingBottom: 48, gap: 16 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5e7eb', padding: 32, alignItems: 'center' },
  emptyText: { color: '#9ca3af' },

  recordCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#f3f4f6' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recordHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  recordIcon: { padding: 6, borderRadius: 10 },
  recordIconRest: { backgroundColor: '#f3f4f6' },
  recordIconWorkout: { backgroundColor: '#dbeafe' },
  recordDate: { fontWeight: '700', fontSize: 16, color: '#1f2937' },
  categoryBadge: { fontSize: 10, fontWeight: '700', color: '#4b5563', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },

  restLabel: { color: '#9ca3af', fontSize: 13, marginLeft: 44 },
  exerciseList: { marginLeft: 44, gap: 6 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f9fafb', paddingBottom: 6 },
  exerciseName: { fontSize: 12, color: '#4b5563', flexShrink: 1, marginRight: 8 },
  exerciseCount: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  exerciseCountDone: { backgroundColor: '#dcfce7', color: '#15803d' },
  exerciseCountPartial: { backgroundColor: '#f3f4f6', color: '#6b7280' }
})
