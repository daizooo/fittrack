import React, { useState, useEffect } from 'react'
import {
  Plus, Trash2, Save, Download, AlertTriangle, X,
  ChevronDown, ChevronUp, User, Weight, Dumbbell
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { generateEquipmentOptions } from '../lib/equipmentUtils'
import type {
  EquipmentItem, EquipmentWeightConfig, Profile, BodyLog, WorkoutPlan, WorkoutRecord
} from '../types'

// ─── Constants ───────────────────────────────────────────────────────────────

const GOAL_OPTIONS = ['筋肥大', '筋力向上', 'VO₂MAX向上', '体脂肪減少']
const DAYS = ['月', '火', '水', '木', '金', '土', '日']

const DEFAULT_SCHEDULE = Object.fromEntries(
  DAYS.map(d => [d, { enabled: false, minutes: 60 }])
)

const todayISODate = () => new Date().toISOString().split('T')[0]

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section = ({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) => {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2 font-black text-gray-800">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-5 border-t border-gray-50">{children}</div>}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TabProfileProps {
  userId: string
  equipment: EquipmentItem[]
  setEquipment: React.Dispatch<React.SetStateAction<EquipmentItem[]>>
  profile: Profile | null
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>
  bodyLogs: BodyLog[]
  setBodyLogs: React.Dispatch<React.SetStateAction<BodyLog[]>>
  plans: WorkoutPlan[]
  records: WorkoutRecord[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TabProfile({
  userId, equipment, setEquipment, profile, setProfile,
  bodyLogs, setBodyLogs, plans, records
}: TabProfileProps) {

  // ── Physical info state ──────────────────────────────────────────────────────
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [gender, setGender] = useState<'male' | 'female' | ''>(profile?.gender ?? '')
  const [height, setHeight] = useState(profile?.height?.toString() ?? '')
  const [physicalSaving, setPhysicalSaving] = useState(false)

  // Sync when profile loads
  useEffect(() => {
    if (!profile) return
    setBirthDate(profile.birth_date ?? '')
    setGender(profile.gender ?? '')
    setHeight(profile.height?.toString() ?? '')
    setGoals(profile.goals ?? [])
    setSchedule({ ...DEFAULT_SCHEDULE, ...profile.schedule })
  }, [profile])

  // ── Body log state ───────────────────────────────────────────────────────────
  const [logDate, setLogDate] = useState(todayISODate())
  const [logWeight, setLogWeight] = useState('')
  const [logBodyFat, setLogBodyFat] = useState('')
  const [logSaving, setLogSaving] = useState(false)

  // ── Load equipment form state ─────────────────────────────────────────────────
  const [loadFormOpen, setLoadFormOpen] = useState(false)
  const [newLoadName, setNewLoadName] = useState('')
  const [newLoadDirection, setNewLoadDirection] = useState<'+' | '-' | 'none'>('+')
  const [newLoadWeightType, setNewLoadWeightType] = useState<'fixed' | 'variable'>('fixed')
  const [newFixedWeightInput, setNewFixedWeightInput] = useState('')
  const [newFixedWeights, setNewFixedWeights] = useState<number[]>([])
  const [newVarMin, setNewVarMin] = useState('')
  const [newVarMax, setNewVarMax] = useState('')
  const [newVarStep, setNewVarStep] = useState('')

  // ── Data equipment form state ─────────────────────────────────────────────────
  const [newDataName, setNewDataName] = useState('')

  // ── Equipment deletion warning ────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string; name: string; affected: string[]
  } | null>(null)

  // ── Goals & schedule ──────────────────────────────────────────────────────────
  const [goals, setGoals] = useState<string[]>(profile?.goals ?? [])
  const [schedule, setSchedule] = useState<Record<string, { enabled: boolean; minutes: number }>>(
    { ...DEFAULT_SCHEDULE, ...profile?.schedule }
  )
  const [goalsSaving, setGoalsSaving] = useState(false)

  // ── Export ────────────────────────────────────────────────────────────────────
  const [exportPeriod, setExportPeriod] = useState<3 | 6>(3)

  // ── Save physical info ───────────────────────────────────────────────────────

  const savePhysical = async () => {
    setPhysicalSaving(true)
    const newProfile: Profile = {
      height: height ? Number(height) : null,
      birth_date: birthDate || null,
      gender: (gender as 'male' | 'female') || null,
      goals: profile?.goals ?? [],
      schedule: profile?.schedule ?? DEFAULT_SCHEDULE
    }
    const { error } = await supabase.from('profiles').upsert({
      user_id: userId,
      height: newProfile.height,
      birth_date: newProfile.birth_date,
      gender: newProfile.gender,
      goals: newProfile.goals,
      schedule: newProfile.schedule
    })
    if (!error) setProfile(newProfile)
    else console.error('Failed to save profile:', error)
    setPhysicalSaving(false)
  }

  // ── Add body log ─────────────────────────────────────────────────────────────

  const addBodyLog = async () => {
    if (!logDate) return
    setLogSaving(true)
    const { data, error } = await supabase.from('body_logs').insert({
      user_id: userId,
      date: logDate,
      weight: logWeight ? Number(logWeight) : null,
      body_fat: logBodyFat ? Number(logBodyFat) : null
    }).select().single()
    if (!error && data) {
      const newLog: BodyLog = {
        id: data.id as string,
        date: data.date as string,
        weight: data.weight as number | null,
        body_fat: data.body_fat as number | null
      }
      setBodyLogs(prev => [newLog, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
      setLogWeight('')
      setLogBodyFat('')
    } else if (error) {
      console.error('Failed to add body log:', error)
    }
    setLogSaving(false)
  }

  const deleteBodyLog = async (id: string) => {
    const { error } = await supabase.from('body_logs').delete().eq('id', id)
    if (!error) setBodyLogs(prev => prev.filter(l => l.id !== id))
  }

  // ── Add load equipment ───────────────────────────────────────────────────────

  const addFixedWeight = () => {
    const v = parseFloat(newFixedWeightInput)
    if (isNaN(v)) return
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
      if (isNaN(min) || isNaN(max) || isNaN(step)) return null
      return { type: 'variable', min, max, step }
    }
    // fixed
    const sign = newLoadDirection === '-' ? -1 : 1
    const options = [
      { label: 'ー', weight: 0 },
      ...newFixedWeights.map(w => ({
        label: `${newLoadDirection}${Math.abs(w)}kg`,
        weight: sign * Math.abs(w)
      }))
    ]
    return { type: 'fixed', options }
  }

  const submitLoadEquipment = async () => {
    if (!newLoadName.trim()) return
    const direction = newLoadDirection === 'none' ? null : newLoadDirection
    const weight = buildLoadEquipmentWeight()
    if (weight === null) return

    const { data, error } = await supabase.from('equipment').insert({
      user_id: userId,
      name: newLoadName.trim(),
      category: 'load',
      direction,
      weight
    }).select().single()

    if (!error && data) {
      const item: EquipmentItem = {
        id: data.id as string,
        name: data.name as string,
        category: 'load',
        direction: data.direction as '+' | '-' | null,
        weight: data.weight as EquipmentWeightConfig
      }
      setEquipment(prev => [...prev, item])
      setNewLoadName('')
      setNewLoadDirection('+')
      setNewLoadWeightType('fixed')
      setNewFixedWeights([])
      setNewVarMin('')
      setNewVarMax('')
      setNewVarStep('')
      setLoadFormOpen(false)
    } else {
      console.error('Failed to add equipment:', error)
    }
  }

  // ── Add data equipment ───────────────────────────────────────────────────────

  const submitDataEquipment = async () => {
    if (!newDataName.trim()) return
    const { data, error } = await supabase.from('equipment').insert({
      user_id: userId,
      name: newDataName.trim(),
      category: 'data',
      direction: null,
      weight: null
    }).select().single()

    if (!error && data) {
      const item: EquipmentItem = {
        id: data.id as string,
        name: data.name as string,
        category: 'data',
        direction: null,
        weight: null
      }
      setEquipment(prev => [...prev, item])
      setNewDataName('')
    } else {
      console.error('Failed to add data equipment:', error)
    }
  }

  // ── Delete equipment ─────────────────────────────────────────────────────────

  const requestDeleteEquipment = (equipId: string) => {
    const item = equipment.find(e => e.id === equipId)
    if (!item) return
    const affected: string[] = []
    plans.forEach(plan => {
      plan.exercises.forEach(ex => {
        if (ex.equipmentType === equipId) {
          affected.push(`${plan.day}曜: ${ex.name}`)
        }
      })
    })
    if (affected.length > 0) {
      setDeleteConfirm({ id: equipId, name: item.name, affected })
    } else {
      confirmDeleteEquipment(equipId)
    }
  }

  const confirmDeleteEquipment = async (equipId: string) => {
    const { error } = await supabase.from('equipment').delete().eq('id', equipId).eq('user_id', userId)
    if (!error) setEquipment(prev => prev.filter(e => e.id !== equipId))
    else console.error('Failed to delete equipment:', error)
    setDeleteConfirm(null)
  }

  // ── Save goals & schedule ────────────────────────────────────────────────────

  const saveGoalsSchedule = async () => {
    setGoalsSaving(true)
    const newProfile: Profile = {
      height: profile?.height ?? null,
      birth_date: profile?.birth_date ?? null,
      gender: profile?.gender ?? null,
      goals,
      schedule
    }
    const { error } = await supabase.from('profiles').upsert({
      user_id: userId,
      height: newProfile.height,
      birth_date: newProfile.birth_date,
      gender: newProfile.gender,
      goals,
      schedule
    })
    if (!error) setProfile(newProfile)
    else console.error('Failed to save goals:', error)
    setGoalsSaving(false)
  }

  // ── Export ────────────────────────────────────────────────────────────────────

  const handleExport = () => {
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
          id: e.id, name: e.name, direction: e.direction,
          options: generateEquipmentOptions(e)
        })),
        data: equipment.filter(e => e.category === 'data').map(e => ({
          id: e.id, name: e.name
        }))
      },
      body_logs: periodBodyLogs,
      records: periodRecords
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fittrack_${exportPeriod}m_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const loadEquipment = equipment.filter(e => e.category === 'load')
  const dataEquipment = equipment.filter(e => e.category === 'data')
  const recentBodyLogs = bodyLogs.slice(0, 20)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="pb-28 max-w-2xl mx-auto p-4 bg-gray-50 min-h-screen space-y-4">

      {/* ── 身体情報 ──────────────────────────────────────────────────────────── */}
      <Section title="身体情報" icon={<User size={18} className="text-blue-500" />}>
        <div className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">生年月日</label>
              <input
                type="date" value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 block mb-1">性別</label>
              <div className="flex gap-2 mt-1">
                {(['male', 'female'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(prev => prev === g ? '' : g)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${gender === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                  >
                    {g === 'male' ? '男' : '女'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 block mb-1">身長 (cm)</label>
            <input
              type="number" value={height} placeholder="170"
              onChange={e => setHeight(e.target.value)}
              className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-400 text-center"
            />
          </div>

          <button
            onClick={savePhysical} disabled={physicalSaving}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform disabled:opacity-60"
          >
            <Save size={16} />{physicalSaving ? '保存中...' : '身体情報を保存'}
          </button>
        </div>
      </Section>

      {/* ── 体重・体脂肪ログ ───────────────────────────────────────────────────── */}
      <Section title="体重・体脂肪ログ" icon={<Weight size={18} className="text-emerald-500" />}>
        <div className="pt-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 space-y-3">
            <p className="text-[11px] font-bold text-gray-500">新しい記録を追加</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">日付</label>
                <input
                  type="date" value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">体重 (kg)</label>
                <input
                  type="number" value={logWeight} placeholder="70.5"
                  onChange={e => setLogWeight(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none text-center"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">体脂肪率 (%)</label>
                <input
                  type="number" value={logBodyFat} placeholder="18.5"
                  onChange={e => setLogBodyFat(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none text-center"
                />
              </div>
            </div>
            <button
              onClick={addBodyLog} disabled={logSaving || !logDate}
              className="w-full py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-60"
            >
              <Plus size={14} />{logSaving ? '追加中...' : '記録を追加'}
            </button>
          </div>

          {recentBodyLogs.length === 0
            ? <p className="text-center text-gray-400 text-sm py-4">まだ記録がありません</p>
            : (
              <div className="space-y-2">
                {recentBodyLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className="text-xs font-bold text-gray-500 w-24">{log.date}</span>
                    <span className="text-sm font-bold text-gray-800 flex-1">
                      {log.weight != null ? `${log.weight} kg` : '—'}
                      {log.body_fat != null ? <span className="text-gray-400 text-xs ml-2">{log.body_fat}%</span> : null}
                    </span>
                    <button onClick={() => deleteBodyLog(log.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </Section>

      {/* ── 器具管理 ──────────────────────────────────────────────────────────── */}
      <Section title="器具管理" icon={<Dumbbell size={18} className="text-indigo-500" />}>
        <div className="pt-4 space-y-5">

          {/* 負荷器具 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black text-gray-700">① 負荷器具（ワークアウト連携）</p>
            </div>

            <div className="space-y-2 mb-3">
              {loadEquipment.map(item => {
                const opts = generateEquipmentOptions(item)
                const isDefault = ['bodyweight', 'tube', 'assist', 'vest'].includes(item.id)
                return (
                  <div key={item.id} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-gray-800">{item.name}</span>
                        {item.direction && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${item.direction === '+' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                            {item.direction}
                          </span>
                        )}
                        {isDefault && (
                          <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">デフォルト</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">
                        {opts.slice(1).map(o => o.label).join(' / ') || 'オプションなし'}
                      </p>
                    </div>
                    <button
                      onClick={() => requestDeleteEquipment(item.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0 mt-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
              {loadEquipment.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-3">器具が登録されていません</p>
              )}
            </div>

            {/* Load equipment add form */}
            {!loadFormOpen ? (
              <button
                onClick={() => setLoadFormOpen(true)}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Plus size={16} /> 負荷器具を追加
              </button>
            ) : (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-black text-blue-700">新しい負荷器具</p>
                  <button onClick={() => { setLoadFormOpen(false); setNewFixedWeights([]) }} className="text-blue-300 hover:text-blue-500">
                    <X size={16} />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-blue-600 block mb-1">器具名</label>
                  <input
                    type="text" value={newLoadName} placeholder="例: ダンベル"
                    onChange={e => setNewLoadName(e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-lg p-2 text-sm font-bold outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-blue-600 block mb-1">荷重方向</label>
                  <div className="flex gap-2">
                    {(['+', '-', 'none'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setNewLoadDirection(d)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${newLoadDirection === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {d === '+' ? '+ 加重' : d === '-' ? '－ 補助' : '自重'}
                      </button>
                    ))}
                  </div>
                </div>

                {newLoadDirection !== 'none' && (
                  <div>
                    <label className="text-[10px] font-bold text-blue-600 block mb-1">重量タイプ</label>
                    <div className="flex gap-2 mb-3">
                      {(['fixed', 'variable'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setNewLoadWeightType(t)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${newLoadWeightType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                        >
                          {t === 'fixed' ? '固定値' : '可変（最小〜最大）'}
                        </button>
                      ))}
                    </div>

                    {newLoadWeightType === 'fixed' ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="number" value={newFixedWeightInput} placeholder="重量 (kg)"
                            onChange={e => setNewFixedWeightInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addFixedWeight()}
                            className="flex-1 bg-white border border-blue-200 rounded-lg p-2 text-sm outline-none text-center"
                          />
                          <button
                            onClick={addFixedWeight}
                            className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold active:scale-95"
                          >
                            追加
                          </button>
                        </div>
                        {newFixedWeights.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {newFixedWeights.map((w, i) => (
                              <span key={i} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">
                                {newLoadDirection}{Math.abs(w)}kg
                                <button onClick={() => setNewFixedWeights(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {[['最小 (kg)', newVarMin, setNewVarMin], ['最大 (kg)', newVarMax, setNewVarMax], ['ステップ (kg)', newVarStep, setNewVarStep]].map(([label, val, setter]) => (
                          <div key={label as string}>
                            <label className="text-[10px] font-bold text-blue-600 block mb-1">{label as string}</label>
                            <input
                              type="number" value={val as string} placeholder="0"
                              onChange={e => (setter as (v: string) => void)(e.target.value)}
                              className="w-full bg-white border border-blue-200 rounded-lg p-2 text-sm outline-none text-center"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={submitLoadEquipment}
                  disabled={!newLoadName.trim()}
                  className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <Plus size={14} /> 器具を追加する
                </button>
              </div>
            )}
          </div>

          {/* データ器具 */}
          <div>
            <p className="text-sm font-black text-gray-700 mb-3">② データ器具（記録のみ）</p>

            <div className="space-y-2 mb-3">
              {dataEquipment.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className="font-bold text-sm text-gray-800">{item.name}</span>
                  <button onClick={() => requestDeleteEquipment(item.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {dataEquipment.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-2">未登録</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text" value={newDataName} placeholder="例: 心拍計"
                onChange={e => setNewDataName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitDataEquipment()}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-400"
              />
              <button
                onClick={submitDataEquipment} disabled={!newDataName.trim()}
                className="px-4 py-2.5 bg-gray-800 text-white text-sm font-bold rounded-xl flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-40"
              >
                <Plus size={14} /> 追加
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 目標・スケジュール ─────────────────────────────────────────────────── */}
      <Section title="目標・スケジュール" icon={<span className="text-orange-500 text-base">🎯</span>}>
        <div className="pt-4 space-y-5">

          {/* Goals */}
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-2">主目標（複数選択可）</p>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map(g => (
                <button
                  key={g}
                  onClick={() => setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                  className={`py-3 px-3 rounded-xl text-sm font-bold border transition-colors text-left flex items-center gap-2 ${goals.includes(g) ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                >
                  <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${goals.includes(g) ? 'bg-white/30 border-white/50' : 'border-gray-300'}`}>
                    {goals.includes(g) && <span className="text-white text-[10px]">✓</span>}
                  </span>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-2">曜日別スケジュール</p>
            <div className="space-y-1.5">
              {DAYS.map(day => {
                const s = schedule[day] ?? { enabled: false, minutes: 60 }
                return (
                  <div key={day} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                    <button
                      onClick={() => setSchedule(prev => ({ ...prev, [day]: { ...s, enabled: !s.enabled } }))}
                      className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${s.enabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${s.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className={`w-5 text-sm font-black ${s.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{day}</span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <input
                        type="number" value={s.minutes} disabled={!s.enabled}
                        onChange={e => setSchedule(prev => ({ ...prev, [day]: { ...s, minutes: Number(e.target.value) } }))}
                        className="w-16 bg-white border border-gray-200 rounded-lg p-1.5 text-xs font-bold outline-none text-center disabled:opacity-40"
                      />
                      <span className="text-xs text-gray-500">分</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button
            onClick={saveGoalsSchedule} disabled={goalsSaving}
            className="w-full py-3 bg-orange-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform disabled:opacity-60"
          >
            <Save size={16} />{goalsSaving ? '保存中...' : '目標・スケジュールを保存'}
          </button>
        </div>
      </Section>

      {/* ── エクスポート ──────────────────────────────────────────────────────── */}
      <Section title="データエクスポート" icon={<Download size={18} className="text-gray-500" />}>
        <div className="pt-4 space-y-4">
          <div>
            <p className="text-[11px] font-bold text-gray-500 mb-2">エクスポート期間</p>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {([3, 6] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setExportPeriod(m)}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${exportPeriod === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  直近 {m} ヶ月
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <p>以下をJSON形式でダウンロードします：</p>
            <ul className="space-y-0.5 ml-2">
              <li>• プロフィール（身体情報・目標・スケジュール）</li>
              <li>• 器具情報（負荷器具・データ器具）</li>
              <li>• 体重・体脂肪ログ（直近{exportPeriod}ヶ月）</li>
              <li>• トレーニング記録（直近{exportPeriod}ヶ月）</li>
            </ul>
          </div>

          <button
            onClick={handleExport}
            className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
          >
            <Download size={18} /> JSONをダウンロード
          </button>
        </div>
      </Section>

      {/* ── Equipment delete warning modal ────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="font-black text-gray-900">器具を削除しますか？</h3>
                <p className="text-xs text-gray-500">「{deleteConfirm.name}」</p>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-yellow-800 mb-2">以下の種目で使用中です：</p>
              <ul className="space-y-1">
                {deleteConfirm.affected.map((a, i) => (
                  <li key={i} className="text-xs text-yellow-700 flex items-center gap-1">
                    <span className="w-1 h-1 bg-yellow-500 rounded-full"></span>{a}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-yellow-700 mt-2">削除後、これらの種目の器具選択が空欄になります。</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold active:scale-95"
              >
                キャンセル
              </button>
              <button
                onClick={() => confirmDeleteEquipment(deleteConfirm.id)}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 active:scale-95"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
