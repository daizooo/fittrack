import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Play, Timer, X } from 'lucide-react-native'
import type { TimerState } from '../types'

interface TimerBarProps {
  timer: TimerState
  onCancel: () => void
}

/** アクティブなタイマーを画面下部に浮かせて表示する。Web版の下部フローティングピルと同等。 */
export default function TimerBar({ timer, onCancel }: TimerBarProps) {
  if (!timer.isActive) return null

  const isWork = timer.type === 'work' || timer.type === 'tabata_work'
  const isTabata = timer.type === 'tabata_work' || timer.type === 'tabata_rest'
  const label = isWork ? 'WORK' : 'REST'

  return (
    <View style={[styles.bar, isWork ? styles.barWork : isTabata ? styles.barTabataRest : styles.barRest]}>
      {isWork
        ? <Play size={20} color="#fff" fill="#fff" />
        : <Timer size={20} color={timer.remaining <= 5 ? '#f87171' : '#93c5fd'} />}
      <Text style={[styles.remaining, !isWork && timer.remaining <= 5 ? styles.remainingUrgent : null]}>
        {timer.remaining}
      </Text>
      <View style={styles.labelCol}>
        <Text style={styles.label}>{label}</Text>
        {isTabata && <Text style={styles.round}>RND {timer.currentCycle}/{timer.tabataCycles}</Text>}
      </View>
      <TouchableOpacity onPress={onCancel} style={styles.closeButton} hitSlop={8}>
        <X size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: '50%',
    bottom: 24,
    transform: [{ translateX: -110 }],
    width: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
  },
  barWork: { backgroundColor: '#ea580c' },
  barRest: { backgroundColor: '#111827' },
  barTabataRest: { backgroundColor: '#2563eb' },
  remaining: { color: '#fff', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'center' },
  remainingUrgent: { color: '#f87171' },
  labelCol: { flex: 1 },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  round: { color: '#fff', fontSize: 9, fontWeight: '700', marginTop: 2 },
  closeButton: { padding: 4 }
})
