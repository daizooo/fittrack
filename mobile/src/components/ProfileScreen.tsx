import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View
} from 'react-native'
import {
  ChevronDown, ChevronUp, Dumbbell, Download, Plus, Save, Trash2,
  Triangle, User, Weight, X
} from 'lucide-react-native'
import { useWorkoutData } from '../context/WorkoutDataContext'
import { generateEquipmentOptions } from '../lib/equipmentUtils'
import type { EquipmentWeightConfig, Profile } from '../types'

const GOAL_OPTIONS = ['筋肥大', '筋力向上', 'VO₂MAX向上', '体脂肪減少']
const SCHEDULE_DAYS = ['月', '火', '水', '木', '金', '土', '日']
const DEFAULT_SCHEDULE: Profile['schedule'] = Object.fromEntries(
  SCHEDULE_DAYS.map(d => [d, { enabled: false, minutes: 60 }])
)

const todayISODate = () => new Date().toISOString().split('T')[0]

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen(o => !o)}>
        <View style={styles.sectionHeaderLeft}>
          {icon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {open ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  )
}

export default function ProfileScreen() {
  const {
    userId, equipment, profile, bodyLogs, plans, records, dataLoading, loadError,
    saveProfile, addBodyLog, deleteBodyLog, addLoadEquipmentItem, addDataEquipmentItem, removeEquipmentItem
  } = useWorkoutData()

  // ── 身体情報 ────────────────────────────────────────────────────────────────
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [gender, setGender] = useState<'male' | 'female' | ''>(profile?.gender ?? '')
  const [height, setHeight] = useState(profile?.height?.toString() ?? '')
  const [physicalSaving, setPhysicalSaving] = useState(false)

  // ── 目標・スケジュール ────────────────────────────────────────────────────────
  const [goals, setGoals] = useState<string[]>(profile?.goals ?? [])
  const [schedule, setSchedule] = useState<Profile['schedule']>({ ...DEFAULT_SCHEDULE, ...profile?.schedule })
  const [goalsSaving, setGoalsSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setBirthDate(profile.birth_date ?? '')
    setGender(profile.gender ?? '')
    setHeight(profile.height?.toString() ?? '')
    setGoals(profile.goals ?? [])
    setSchedule({ ...DEFAULT_SCHEDULE, ...profile.schedule })
  }, [profile])

  // ── 体重・体脂肪ログ ───────────────────────────────────────────────────────────
  const [logDate, setLogDate] = useState(todayISODate())
  const [logWeight, setLogWeight] = useState('')
  const [logBodyFat, setLogBodyFat] = useState('')
  const [logSaving, setLogSaving] = useState(false)

  // ── 負荷器具の追加フォーム ─────────────────────────────────────────────────────
  const [loadFormOpen, setLoadFormOpen] = useState(false)
  const [newLoadName, setNewLoadName] = useState('')
  const [newLoadDirection, setNewLoadDirection] = useState<'+' | '-' | 'none'>('+')
  const [newLoadWeightType, setNewLoadWeightType] = useState<'fixed' | 'variable'>('fixed')
  const [newFixedWeightInput, setNewFixedWeightInput] = useState('')
  const [newFixedWeights, setNewFixedWeights] = useState<number[]>([])
  const [newVarMin, setNewVarMin] = useState('')
  const [newVarMax, setNewVarMax] = useState('')
  const [newVarStep, setNewVarStep] = useState('')
  const [loadSubmitting, setLoadSubmitting] = useState(false)

  // ── データ器具の追加フォーム ───────────────────────────────────────────────────
  const [newDataName, setNewDataName] = useState('')
  const [dataSubmitting, setDataSubmitting] = useState(false)

  // ── 器具削除の確認 ────────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; affected: string[] } | null>(null)

  // ── エクスポート ──────────────────────────────────────────────────────────────
  const [exportPeriod, setExportPeriod] = useState<3 | 6>(3)

  const savePhysical = async () => {
    setPhysicalSaving(true)
    try {
      await saveProfile({
        height: height ? Number(height) : null,
        birth_date: birthDate || null,
        gender: (gender as 'male' | 'female') || null,
        goals: profile?.goals ?? [],
        schedule: profile?.schedule ?? DEFAULT_SCHEDULE
      })
    } catch (err) {
      console.error('Failed to save profile:', err)
      Alert.alert('保存に失敗しました', err instanceof Error ? err.message : String(err))
    } finally {
      setPhysicalSaving(false)
    }
  }

  const saveGoalsSchedule = async () => {
    setGoalsSaving(true)
    try {
      await saveProfile({
        height: profile?.height ?? null,
        birth_date: profile?.birth_date ?? null,
        gender: profile?.gender ?? null,
        goals,
        schedule
      })
    } catch (err) {
      console.error('Failed to save goals/schedule:', err)
      Alert.alert('保存に失敗しました', err instanceof Error ? err.message : String(err))
    } finally {
      setGoalsSaving(false)
    }
  }

  const submitBodyLog = async () => {
    if (!logDate) return
    setLogSaving(true)
    try {
      await addBodyLog({
        date: logDate,
        weight: logWeight ? Number(logWeight) : null,
        body_fat: logBodyFat ? Number(logBodyFat) : null
      })
      setLogWeight('')
      setLogBodyFat('')
    } catch (err) {
      console.error('Failed to add body log:', err)
      Alert.alert('追加に失敗しました', err instanceof Error ? err.message : String(err))
    } finally {
      setLogSaving(false)
    }
  }

  const addFixedWeight = () => {
    const v = parseFloat(newFixedWeightInput)
    if (Number.isNaN(v)) return
    setNewFixedWeights(prev => [...prev, v])
    setNewFixedWeightInput('')
  }

  const buildLoadEquipmentWeight = (): EquipmentWeightConfig | null => {
    if (newLoadDirection === 'none') {
      return { type: 'fixed', options: [{ label: 'ー', weight: 0 }] }
    }
    if (newLoadWeightType === 'variable') {
      const min = parseFloat(newVarMin)
      const max = parseFloat(newVarMax)
      const step = parseFloat(newVarStep)
      if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(step)) return null
      return { type: 'variable', min, max, step }
    }
    const sign = newLoadDirection === '-' ? -1 : 1
    const options = [
      { label: 'ー', weight: 0 },
      ...newFixedWeights.map(w => ({ label: `${newLoadDirection}${Math.abs(w)}kg`, weight: sign * Math.abs(w) }))
    ]
    return { type: 'fixed', options }
  }

  const submitLoadEquipment = async () => {
    if (!newLoadName.trim()) return
    const direction = newLoadDirection === 'none' ? null : newLoadDirection
    const weight = buildLoadEquipmentWeight()
    if (weight === null) {
      Alert.alert('入力内容を確認してください', '重量の項目に数値以外が入っています。')
      return
    }
    setLoadSubmitting(true)
    try {
      await addLoadEquipmentItem(newLoadName.trim(), direction, weight)
      setNewLoadName('')
      setNewLoadDirection('+')
      setNewLoadWeightType('fixed')
      setNewFixedWeights([])
      setNewVarMin('')
      setNewVarMax('')
      setNewVarStep('')
      setLoadFormOpen(false)
    } catch (err) {
      console.error('Failed to add equipment:', err)
      Alert.alert('追加に失敗しました', err instanceof Error ? err.message : String(err))
    } finally {
      setLoadSubmitting(false)
    }
  }

  const submitDataEquipment = async () => {
    if (!newDataName.trim()) return
    setDataSubmitting(true)
    try {
      await addDataEquipmentItem(newDataName.trim())
      setNewDataName('')
    } catch (err) {
      console.error('Failed to add data equipment:', err)
      Alert.alert('追加に失敗しました', err instanceof Error ? err.message : String(err))
    } finally {
      setDataSubmitting(false)
    }
  }

  const requestDeleteEquipment = (equipId: string) => {
    const item = equipment.find(e => e.id === equipId)
    if (!item) return
    const affected: string[] = []
    plans.forEach(plan => {
      plan.exercises.forEach(ex => {
        if (ex.equipmentType === equipId) affected.push(`${plan.day}曜: ${ex.name}`)
      })
    })
    if (affected.length > 0) {
      setDeleteConfirm({ id: equipId, name: item.name, affected })
    } else {
      confirmDeleteEquipment(equipId)
    }
  }

  const confirmDeleteEquipment = async (equipId: string) => {
    try {
      await removeEquipmentItem(equipId)
    } catch (err) {
      console.error('Failed to delete equipment:', err)
      Alert.alert('削除に失敗しました', err instanceof Error ? err.message : String(err))
    } finally {
      setDeleteConfirm(null)
    }
  }

  const handleExport = async () => {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - exportPeriod)
    cutoff.setHours(0, 0, 0, 0)

    const periodRecords = records.filter(r => new Date(r.fullDate) >= cutoff)
    const periodBodyLogs = bodyLogs.filter(l => new Date(l.date) >= cutoff)

    const exportData = {
      exported_at: new Date().toISOString(),
      period: `${exportPeriod}ヶ月`,
      profile: {
        height: profile?.height ?? null,
        birth_date: profile?.birth_date ?? null,
        gender: profile?.gender ?? null,
        goals: profile?.goals ?? [],
        schedule: profile?.schedule ?? {}
      },
      equipment: {
        load: equipment.filter(e => e.category === 'load').map(e => ({
          id: e.id, name: e.name, direction: e.direction, options: generateEquipmentOptions(e)
        })),
        data: equipment.filter(e => e.category === 'data').map(e => ({ id: e.id, name: e.name }))
      },
      body_logs: periodBodyLogs,
      records: periodRecords
    }

    try {
      await Share.share({
        title: `fittrack_${exportPeriod}m_${todayISODate()}.json`,
        message: JSON.stringify(exportData, null, 2)
      })
    } catch (err) {
      console.error('Failed to share export:', err)
      Alert.alert('共有に失敗しました', err instanceof Error ? err.message : String(err))
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

  const loadEquipment = equipment.filter(e => e.category === 'load')
  const dataEquipment = equipment.filter(e => e.category === 'data')
  const recentBodyLogs = bodyLogs.slice(0, 20)

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* 身体情報 */}
        <Section title="身体情報" icon={<User size={18} color="#3b82f6" />}>
          <View style={styles.row2}>
            <View style={styles.col2}>
              <Text style={styles.fieldLabel}>生年月日 (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                value={birthDate}
                onChangeText={setBirthDate}
                placeholder="1990-01-01"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.col2}>
              <Text style={styles.fieldLabel}>性別</Text>
              <View style={styles.toggleRow}>
                {(['male', 'female'] as const).map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.toggleButton, gender === g && styles.toggleButtonActive]}
                    onPress={() => setGender(prev => prev === g ? '' : g)}
                  >
                    <Text style={[styles.toggleButtonText, gender === g && styles.toggleButtonTextActive]}>
                      {g === 'male' ? '男' : '女'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.fieldLabel}>身長 (cm)</Text>
          <TextInput
            style={[styles.textInput, styles.halfInput]}
            value={height}
            onChangeText={setHeight}
            placeholder="170"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.primaryButton} onPress={savePhysical} disabled={physicalSaving}>
            <Save size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>{physicalSaving ? '保存中...' : '身体情報を保存'}</Text>
          </TouchableOpacity>
        </Section>

        {/* 体重・体脂肪ログ */}
        <Section title="体重・体脂肪ログ" icon={<Weight size={18} color="#10b981" />}>
          <View style={styles.logForm}>
            <Text style={styles.logFormLabel}>新しい記録を追加</Text>
            <View style={styles.logFormRow}>
              <View style={styles.logFormCol}>
                <Text style={styles.fieldLabelSm}>日付</Text>
                <TextInput style={styles.textInputSm} value={logDate} onChangeText={setLogDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" />
              </View>
              <View style={styles.logFormCol}>
                <Text style={styles.fieldLabelSm}>体重 (kg)</Text>
                <TextInput style={styles.textInputSm} value={logWeight} onChangeText={setLogWeight} placeholder="70.5" placeholderTextColor="#9ca3af" keyboardType="numeric" />
              </View>
              <View style={styles.logFormCol}>
                <Text style={styles.fieldLabelSm}>体脂肪率 (%)</Text>
                <TextInput style={styles.textInputSm} value={logBodyFat} onChangeText={setLogBodyFat} placeholder="18.5" placeholderTextColor="#9ca3af" keyboardType="numeric" />
              </View>
            </View>
            <TouchableOpacity style={styles.addLogButton} onPress={submitBodyLog} disabled={logSaving || !logDate}>
              <Plus size={14} color="#fff" />
              <Text style={styles.addLogButtonText}>{logSaving ? '追加中...' : '記録を追加'}</Text>
            </TouchableOpacity>
          </View>

          {recentBodyLogs.length === 0 ? (
            <Text style={styles.emptyText}>まだ記録がありません</Text>
          ) : (
            recentBodyLogs.map(log => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logDate}>{log.date}</Text>
                <Text style={styles.logValue}>
                  {log.weight != null ? `${log.weight} kg` : '—'}
                  {log.body_fat != null ? <Text style={styles.logValueSub}>  {log.body_fat}%</Text> : null}
                </Text>
                <TouchableOpacity onPress={() => deleteBodyLog(log.id)} hitSlop={8}>
                  <Trash2 size={14} color="#d1d5db" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Section>

        {/* 器具管理 */}
        <Section title="器具管理" icon={<Dumbbell size={18} color="#6366f1" />}>
          <Text style={styles.subTitle}>① 負荷器具（ワークアウト連携）</Text>

          {loadEquipment.map(item => {
            const opts = generateEquipmentOptions(item)
            const isDefault = ['bodyweight', 'tube', 'assist', 'vest'].includes(item.id)
            return (
              <View key={item.id} style={styles.equipmentRow}>
                <View style={styles.equipmentInfo}>
                  <View style={styles.equipmentNameRow}>
                    <Text style={styles.equipmentName}>{item.name}</Text>
                    {item.direction && (
                      <Text style={[styles.directionBadge, item.direction === '-' && styles.directionBadgeMinus]}>
                        {item.direction}
                      </Text>
                    )}
                    {isDefault && <Text style={styles.defaultBadge}>デフォルト</Text>}
                  </View>
                  <Text style={styles.equipmentOptions} numberOfLines={1}>
                    {opts.slice(1).map(o => o.label).join(' / ') || 'オプションなし'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => requestDeleteEquipment(item.id)} hitSlop={8}>
                  <Trash2 size={14} color="#d1d5db" />
                </TouchableOpacity>
              </View>
            )
          })}
          {loadEquipment.length === 0 && <Text style={styles.emptyText}>器具が登録されていません</Text>}

          {!loadFormOpen ? (
            <TouchableOpacity style={styles.dashedButton} onPress={() => setLoadFormOpen(true)}>
              <Plus size={16} color="#6b7280" />
              <Text style={styles.dashedButtonText}>負荷器具を追加</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.loadForm}>
              <View style={styles.loadFormHeader}>
                <Text style={styles.loadFormTitle}>新しい負荷器具</Text>
                <TouchableOpacity onPress={() => { setLoadFormOpen(false); setNewFixedWeights([]) }} hitSlop={8}>
                  <X size={16} color="#93c5fd" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabelSm}>器具名</Text>
              <TextInput
                style={styles.textInputSm}
                value={newLoadName}
                onChangeText={setNewLoadName}
                placeholder="例: ダンベル"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabelSm}>荷重方向</Text>
              <View style={styles.toggleRow}>
                {(['+', '-', 'none'] as const).map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.toggleButton, styles.toggleButtonFlex, newLoadDirection === d && styles.toggleButtonActive]}
                    onPress={() => setNewLoadDirection(d)}
                  >
                    <Text style={[styles.toggleButtonText, newLoadDirection === d && styles.toggleButtonTextActive]}>
                      {d === '+' ? '+ 加重' : d === '-' ? '－ 補助' : '自重'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {newLoadDirection !== 'none' && (
                <>
                  <Text style={styles.fieldLabelSm}>重量タイプ</Text>
                  <View style={styles.toggleRow}>
                    {(['fixed', 'variable'] as const).map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.toggleButton, styles.toggleButtonFlex, newLoadWeightType === t && styles.toggleButtonActive]}
                        onPress={() => setNewLoadWeightType(t)}
                      >
                        <Text style={[styles.toggleButtonTextSm, newLoadWeightType === t && styles.toggleButtonTextActive]}>
                          {t === 'fixed' ? '固定値' : '可変（最小〜最大）'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {newLoadWeightType === 'fixed' ? (
                    <>
                      <View style={styles.fixedWeightInputRow}>
                        <TextInput
                          style={[styles.textInputSm, styles.fixedWeightInput]}
                          value={newFixedWeightInput}
                          onChangeText={setNewFixedWeightInput}
                          placeholder="重量 (kg)"
                          placeholderTextColor="#9ca3af"
                          keyboardType="numeric"
                          onSubmitEditing={addFixedWeight}
                        />
                        <TouchableOpacity style={styles.smallAddButton} onPress={addFixedWeight}>
                          <Text style={styles.smallAddButtonText}>追加</Text>
                        </TouchableOpacity>
                      </View>
                      {newFixedWeights.length > 0 && (
                        <View style={styles.chipsRow}>
                          {newFixedWeights.map((w, i) => (
                            <View key={i} style={styles.chip}>
                              <Text style={styles.chipText}>{newLoadDirection}{Math.abs(w)}kg</Text>
                              <TouchableOpacity onPress={() => setNewFixedWeights(prev => prev.filter((_, j) => j !== i))} hitSlop={4}>
                                <X size={10} color="#3b82f6" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.varWeightRow}>
                      {([['最小(kg)', newVarMin, setNewVarMin], ['最大(kg)', newVarMax, setNewVarMax], ['ステップ(kg)', newVarStep, setNewVarStep]] as const).map(([label, val, setter]) => (
                        <View key={label} style={styles.varWeightCol}>
                          <Text style={styles.fieldLabelSm}>{label}</Text>
                          <TextInput
                            style={styles.textInputSm}
                            value={val}
                            onChangeText={setter}
                            placeholder="0"
                            placeholderTextColor="#9ca3af"
                            keyboardType="numeric"
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, !newLoadName.trim() && styles.buttonDisabled]}
                onPress={submitLoadEquipment}
                disabled={!newLoadName.trim() || loadSubmitting}
              >
                <Plus size={14} color="#fff" />
                <Text style={styles.primaryButtonText}>{loadSubmitting ? '追加中...' : '器具を追加する'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.subTitle, styles.subTitleSpaced]}>② データ器具（記録のみ）</Text>
          {dataEquipment.map(item => (
            <View key={item.id} style={styles.equipmentRow}>
              <Text style={styles.equipmentName}>{item.name}</Text>
              <TouchableOpacity onPress={() => requestDeleteEquipment(item.id)} hitSlop={8}>
                <Trash2 size={14} color="#d1d5db" />
              </TouchableOpacity>
            </View>
          ))}
          {dataEquipment.length === 0 && <Text style={styles.emptyText}>未登録</Text>}

          <View style={styles.dataEquipmentAddRow}>
            <TextInput
              style={[styles.textInput, styles.dataEquipmentInput]}
              value={newDataName}
              onChangeText={setNewDataName}
              placeholder="例: 心拍計"
              placeholderTextColor="#9ca3af"
              onSubmitEditing={submitDataEquipment}
            />
            <TouchableOpacity
              style={[styles.darkButton, !newDataName.trim() && styles.buttonDisabled]}
              onPress={submitDataEquipment}
              disabled={!newDataName.trim() || dataSubmitting}
            >
              <Plus size={14} color="#fff" />
              <Text style={styles.darkButtonText}>追加</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* 目標・スケジュール */}
        <Section title="目標・スケジュール" icon={<Triangle size={16} color="#f97316" fill="#f97316" />}>
          <Text style={styles.fieldLabelSm}>主目標（複数選択可）</Text>
          <View style={styles.goalsGrid}>
            {GOAL_OPTIONS.map(g => {
              const active = goals.includes(g)
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.goalButton, active && styles.goalButtonActive]}
                  onPress={() => setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                >
                  <Text style={[styles.goalButtonText, active && styles.goalButtonTextActive]}>{g}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={[styles.fieldLabelSm, styles.scheduleLabel]}>曜日別スケジュール</Text>
          {SCHEDULE_DAYS.map(day => {
            const s = schedule[day] ?? { enabled: false, minutes: 60 }
            return (
              <View key={day} style={styles.scheduleRow}>
                <Switch
                  value={s.enabled}
                  onValueChange={(v) => setSchedule(prev => ({ ...prev, [day]: { ...s, enabled: v } }))}
                  trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                />
                <Text style={[styles.scheduleDay, s.enabled && styles.scheduleDayActive]}>{day}</Text>
                <View style={styles.scheduleMinutesWrap}>
                  <TextInput
                    style={styles.scheduleMinutesInput}
                    value={String(s.minutes)}
                    editable={s.enabled}
                    keyboardType="number-pad"
                    onChangeText={(t) => {
                      const n = Number(t)
                      setSchedule(prev => ({ ...prev, [day]: { ...s, minutes: Number.isNaN(n) ? 0 : n } }))
                    }}
                  />
                  <Text style={styles.scheduleMinutesLabel}>分</Text>
                </View>
              </View>
            )
          })}

          <TouchableOpacity style={[styles.primaryButton, styles.orangeButton]} onPress={saveGoalsSchedule} disabled={goalsSaving}>
            <Save size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>{goalsSaving ? '保存中...' : '目標・スケジュールを保存'}</Text>
          </TouchableOpacity>
        </Section>

        {/* データエクスポート */}
        <Section title="データエクスポート" icon={<Download size={18} color="#6b7280" />}>
          <Text style={styles.fieldLabelSm}>エクスポート期間</Text>
          <View style={styles.periodTabs}>
            {([3, 6] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.periodTab, exportPeriod === m && styles.periodTabActive]}
                onPress={() => setExportPeriod(m)}
              >
                <Text style={[styles.periodTabText, exportPeriod === m && styles.periodTabTextActive]}>直近 {m} ヶ月</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.exportInfoBox}>
            <Text style={styles.exportInfoText}>以下をJSON形式で共有します：</Text>
            <Text style={styles.exportInfoItem}>・プロフィール（身体情報・目標・スケジュール）</Text>
            <Text style={styles.exportInfoItem}>・器具情報（負荷器具・データ器具）</Text>
            <Text style={styles.exportInfoItem}>・体重・体脂肪ログ（直近{exportPeriod}ヶ月）</Text>
            <Text style={styles.exportInfoItem}>・トレーニング記録（直近{exportPeriod}ヶ月）</Text>
          </View>

          <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
            <Download size={18} color="#fff" />
            <Text style={styles.exportButtonText}>JSONを共有</Text>
          </TouchableOpacity>
        </Section>

        <Text style={styles.userIdHint}>ユーザーID: {userId}</Text>
      </ScrollView>

      {deleteConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>器具を削除しますか？</Text>
            <Text style={styles.modalSubtitle}>「{deleteConfirm.name}」</Text>
            <View style={styles.modalWarningBox}>
              <Text style={styles.modalWarningTitle}>以下の種目で使用中です：</Text>
              {deleteConfirm.affected.map((a, i) => (
                <Text key={i} style={styles.modalWarningItem}>・{a}</Text>
              ))}
              <Text style={styles.modalWarningNote}>削除後、これらの種目の器具選択が空欄になります。</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setDeleteConfirm(null)}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={() => confirmDeleteEquipment(deleteConfirm.id)}>
                <Text style={styles.modalConfirmText}>削除する</Text>
              </TouchableOpacity>
            </View>
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

  content: { padding: 16, paddingBottom: 48, gap: 14 },

  section: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '900', color: '#1f2937', fontSize: 14 },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 16, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#f9fafb', gap: 10 },

  row2: { flexDirection: 'row', gap: 12 },
  col2: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 4 },
  fieldLabelSm: { fontSize: 10, fontWeight: '700', color: '#6b7280', marginBottom: 4 },
  textInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: '700', color: '#1f2937' },
  textInputSm: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 8, fontSize: 12, fontWeight: '700', color: '#1f2937' },
  halfInput: { width: '48%' },

  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleButton: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', alignItems: 'center' },
  toggleButtonFlex: { flex: 1 },
  toggleButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  toggleButtonText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  toggleButtonTextSm: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  toggleButtonTextActive: { color: '#fff' },

  primaryButton: { flexDirection: 'row', gap: 8, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  orangeButton: { backgroundColor: '#f97316' },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  buttonDisabled: { opacity: 0.5 },

  logForm: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 10, gap: 8 },
  logFormLabel: { fontSize: 10, fontWeight: '700', color: '#6b7280' },
  logFormRow: { flexDirection: 'row', gap: 8 },
  logFormCol: { flex: 1 },
  addLogButton: { flexDirection: 'row', gap: 6, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addLogButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  logDate: { width: 88, fontSize: 11, fontWeight: '700', color: '#6b7280' },
  logValue: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1f2937' },
  logValueSub: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },

  emptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 12, paddingVertical: 8 },

  subTitle: { fontSize: 12, fontWeight: '900', color: '#374151' },
  subTitleSpaced: { marginTop: 8 },

  equipmentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f9fafb', borderRadius: 12, padding: 10 },
  equipmentInfo: { flex: 1 },
  equipmentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  equipmentName: { fontWeight: '700', fontSize: 13, color: '#1f2937', flex: 1 },
  equipmentOptions: { fontSize: 10, color: '#9ca3af' },
  directionBadge: { fontSize: 9, fontWeight: '900', color: '#2563eb', backgroundColor: '#dbeafe', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  directionBadgeMinus: { color: '#dc2626', backgroundColor: '#fee2e2' },
  defaultBadge: { fontSize: 9, fontWeight: '700', color: '#9ca3af', backgroundColor: '#e5e7eb', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },

  dashedButton: { flexDirection: 'row', gap: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  dashedButtonText: { color: '#6b7280', fontWeight: '700', fontSize: 12 },

  loadForm: { backgroundColor: '#eff6ff', borderRadius: 14, borderWidth: 1, borderColor: '#dbeafe', padding: 12, gap: 8 },
  loadFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loadFormTitle: { fontWeight: '900', color: '#1d4ed8', fontSize: 12 },

  fixedWeightInputRow: { flexDirection: 'row', gap: 8 },
  fixedWeightInput: { flex: 1, textAlign: 'center' },
  smallAddButton: { backgroundColor: '#3b82f6', paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallAddButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },

  varWeightRow: { flexDirection: 'row', gap: 8 },
  varWeightCol: { flex: 1 },

  dataEquipmentAddRow: { flexDirection: 'row', gap: 8 },
  dataEquipmentInput: { flex: 1 },
  darkButton: { flexDirection: 'row', gap: 4, backgroundColor: '#1f2937', paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  darkButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalButton: { flexBasis: '47%', flexGrow: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  goalButtonActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  goalButtonText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  goalButtonTextActive: { color: '#fff' },

  scheduleLabel: { marginTop: 6 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  scheduleDay: { width: 18, fontSize: 13, fontWeight: '900', color: '#9ca3af' },
  scheduleDayActive: { color: '#1f2937' },
  scheduleMinutesWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  scheduleMinutesInput: { width: 56, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 6, fontSize: 12, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  scheduleMinutesLabel: { fontSize: 11, color: '#6b7280' },

  periodTabs: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4 },
  periodTab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  periodTabActive: { backgroundColor: '#fff' },
  periodTabText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  periodTabTextActive: { color: '#111827' },

  exportInfoBox: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 10, gap: 2 },
  exportInfoText: { fontSize: 11, color: '#6b7280' },
  exportInfoItem: { fontSize: 11, color: '#6b7280' },

  exportButton: { flexDirection: 'row', gap: 8, backgroundColor: '#111827', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  exportButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  userIdHint: { textAlign: 'center', fontSize: 10, color: '#d1d5db', marginTop: 4 },

  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,24,39,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#1f2937', textAlign: 'center' },
  modalSubtitle: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 2, marginBottom: 12 },
  modalWarningBox: { backgroundColor: '#fefce8', borderRadius: 12, padding: 10, marginBottom: 16 },
  modalWarningTitle: { fontSize: 11, fontWeight: '800', color: '#854d0e', marginBottom: 4 },
  modalWarningItem: { fontSize: 11, color: '#a16207', marginBottom: 2 },
  modalWarningNote: { fontSize: 11, color: '#a16207', marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelButton: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelText: { fontWeight: '700', color: '#374151' },
  modalConfirmButton: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#ef4444', alignItems: 'center' },
  modalConfirmText: { fontWeight: '700', color: '#fff' }
})
