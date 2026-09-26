import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Minus, Plus } from 'lucide-react-native'

export const NumberStepper = ({ label, value, onChange, min = 0, max = 999, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number
}) => (
  <View style={styles.col}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.box}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={styles.arrow} hitSlop={6}>
        <Minus size={14} color="#6b7280" />
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => {
          if (t === '') return onChange(min)
          const n = Number(t)
          if (!Number.isNaN(n)) onChange(n)
        }}
        onBlur={() => onChange(Math.max(min, Math.min(max, value)))}
      />
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={styles.arrow} hitSlop={6}>
        <Plus size={14} color="#6b7280" />
      </TouchableOpacity>
    </View>
  </View>
)

export interface CyclePickerOption<T> { label: string; value: T }

/** RNには<select>相当が無いため、タップで選択肢を循環させる簡易ピッカー。 */
export function CyclePicker<T>({ label, value, options, onChange }: {
  label: string; value: T; options: CyclePickerOption<T>[]; onChange: (v: T) => void
}) {
  const idx = Math.max(0, options.findIndex(o => o.value === value))
  const cycle = (dir: number) => {
    if (options.length === 0) return
    const nextIdx = (idx + dir + options.length) % options.length
    onChange(options[nextIdx].value)
  }
  return (
    <View style={styles.col}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.box}>
        <TouchableOpacity onPress={() => cycle(-1)} style={styles.arrow} hitSlop={6}>
          <Minus size={14} color="#6b7280" />
        </TouchableOpacity>
        <Text style={styles.value} numberOfLines={1}>{options[idx]?.label ?? 'ー'}</Text>
        <TouchableOpacity onPress={() => cycle(1)} style={styles.arrow} hitSlop={6}>
          <Plus size={14} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  col: { alignItems: 'center' },
  label: { fontSize: 9, color: '#9ca3af', marginBottom: 4 },
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, height: 36, minWidth: 96, paddingHorizontal: 4 },
  arrow: { width: 24, height: '100%', alignItems: 'center', justifyContent: 'center' },
  value: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#1f2937' },
  input: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#1f2937', padding: 0 }
})
