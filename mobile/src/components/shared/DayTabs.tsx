import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { displayDaysOfWeek } from '../../lib/workoutPlans'

interface DayTabsProps {
  selectedDay: string
  onSelect: (day: string) => void
}

export default function DayTabs({ selectedDay, onSelect }: DayTabsProps) {
  return (
    <View style={styles.tabs}>
      {displayDaysOfWeek.map(day => (
        <TouchableOpacity
          key={day}
          onPress={() => onSelect(day)}
          style={[styles.tab, selectedDay === day && styles.tabActive]}
        >
          <Text style={[styles.tabText, selectedDay === day && styles.tabTextActive]}>{day}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: '#f3f4f6' },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#111827' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  tabTextActive: { color: '#fff' }
})
