import React, { useEffect, useState } from 'react'
import {
  Plus, Trash2, Save, Edit3, Copy, Timer, Flame, Link2, Unlink2, ChevronLeft,
  ChevronUp, ChevronDown, Clock, ListChecks, Sunrise, Sunset, AlertTriangle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createEmptyPlan, estimatePlanMinutes, lastPerformedMap, newId, planToRow, uuid } from '../lib/plans'
import { daysAgo, formatDaysAgo } from '../lib/dates'
import { NumberField } from './ui'
import type { EquipmentItem, Exercise, Stretch, StretchPhase, WorkoutPlan, WorkoutRecord } from '../types'

// ─── Stretch presets ─────────────────────────────────────────────────────────

const STRETCH_PRESETS: Record<StretchPhase, Omit<Stretch, 'id'>[]> = {
  warmup: [
    { name: 'アームサークル', seconds: 30 },
    { name: '肩甲骨まわし', seconds: 30 },
    { name: 'キャット＆カウ', seconds: 30 },
    { name: 'ワールドグレイテストストレッチ', seconds: 30, bilateral: true },
    { name: 'レッグスイング', seconds: 20, bilateral: true },
    { name: '股関節まわし', seconds: 30 },
    { name: '自重スクワット（軽め）', seconds: 30 }
  ],
  cooldown: [
    { name: '胸のストレッチ', seconds: 30, bilateral: true },
    { name: '広背筋ストレッチ', seconds: 30, bilateral: true },
    { name: '上腕三頭筋ストレッチ', seconds: 20, bilateral: true },
    { name: '肩のストレッチ', seconds: 20, bilateral: true },
    { name: 'ハムストリング', seconds: 30, bilateral: true },
    { name: '大腿四頭筋', seconds: 30, bilateral: true },
    { name: '腸腰筋', seconds: 30, bilateral: true },
    { name: 'チャイルドポーズ', seconds: 45 }
  ]
}

const phaseLabel: Record<StretchPhase, string> = { warmup: 'ウォームアップ', cooldown: 'クールダウン' }

const moveItem = <T,>(list: T[], idx: number, dir: -1 | 1): T[] => {
  const to = idx + dir
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  ;[next[idx], next[to]] = [next[to], next[idx]]
  return next
}

// ─── Stretch editor ──────────────────────────────────────────────────────────

const StretchListEditor = ({ phase, items, onChange }: {
  phase: StretchPhase
  items: Stretch[]
  onChange: (items: Stretch[]) => void
}) => {
  const update = (id: string, patch: Partial<Stretch>) =>
    onChange(items.map(s => (s.id === id ? { ...s, ...patch } : s)))
  const add = (base: Omit<Stretch, 'id'>) => onChange([...items, { ...base, id: newId('st') }])
  const Icon = phase === 'warmup' ? Sunrise : Sunset
  const color = phase === 'warmup' ? 'text-amber-500' : 'text-teal-500'

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-gray-800 text-sm flex items-center gap-1.5">
          <Icon size={16} className={color} />{phaseLabel[phase]}ストレッチ
        </h3>
        <span className="text-[10px] text-gray-400">{items.length}項目</span>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2 mb-2">ストレッチは未設定です（任意）</p>
      )}

      <div className="space-y-2 mb-3">
        {items.map((s, i) => (
          <div key={s.id} className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
            <div className="flex items-center gap-1.5">
              <input
                type="text" value={s.name} placeholder="ストレッチ名"
                aria-label={`${phaseLabel[phase]}ストレッチ名`}
                onChange={e => update(s.id, { name: e.target.value })}
                className="flex-1 min-w-0 bg-transparent font-bold text-sm text-gray-800 border-b border-gray-200 pb-0.5 outline-none focus:border-blue-500"
              />
              <button onClick={() => onChange(moveItem(items, i, -1))} disabled={i === 0} aria-label="上へ" className="p-1 text-gray-400 disabled:opacity-30"><ChevronUp size={16} /></button>
              <button onClick={() => onChange(moveItem(items, i, 1))} disabled={i === items.length - 1} aria-label="下へ" className="p-1 text-gray-400 disabled:opacity-30"><ChevronDown size={16} /></button>
              <button onClick={() => onChange(items.filter(x => x.id !== s.id))} aria-label="削除" className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-1 text-[11px] text-gray-500 font-bold">
                <Timer size={11} />
                <NumberField
                  value={s.seconds} min={5} max={600}
                  onChange={v => update(s.id, { seconds: v })}
                  aria-label="秒数"
                  className="w-14 bg-white border border-gray-200 rounded-lg p-1 text-xs font-bold outline-none text-center"
                />
                秒
              </label>
              <button
                onClick={() => update(s.id, { bilateral: !s.bilateral })}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${s.bilateral ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
              >
                左右それぞれ
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => add({ name: '', seconds: 30 })}
          className="w-24 flex-shrink-0 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
        >
          <Plus size={14} /> 追加
        </button>
        <select
          value=""
          aria-label={`${phaseLabel[phase]}の定番から追加`}
          onChange={e => {
            const preset = STRETCH_PRESETS[phase][Number(e.target.value)]
            if (preset) add(preset)
          }}
          className="flex-1 min-w-0 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-xs font-bold outline-none text-center"
        >
          <option value="" disabled>定番から追加…</option>
          {STRETCH_PRESETS[phase].map((p, i) => (
            <option key={p.name} value={i}>{p.name}（{p.seconds}秒{p.bilateral ? '×左右' : ''}）</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── Plan editor ─────────────────────────────────────────────────────────────

const PlanEditor = ({ initial, isNew, equipment, existingNames, onCancel, onSave }: {
  initial: WorkoutPlan
  isNew: boolean
  equipment: EquipmentItem[]
  existingNames: string[]
  onCancel: () => void
  onSave: (plan: WorkoutPlan) => Promise<string | null>
}) => {
  const [draft, setDraft] = useState<WorkoutPlan>(() => JSON.parse(JSON.stringify(initial)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateExercise = (exId: string, field: keyof Exercise, value: string | number) =>
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map(ex => (ex.id === exId ? { ...ex, [field]: value } : ex)) }))

  const addExercise = () => setDraft(prev => ({
    ...prev,
    exercises: [...prev.exercises, {
      id: newId('ex'), name: '', type: 'normal', targetSets: 3,
      defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight'
    }]
  }))

  const linkSuperset = (exId1: string, exId2: string) => setDraft(prev => {
    const ex1 = prev.exercises.find(e => e.id === exId1)
    const ex2 = prev.exercises.find(e => e.id === exId2)
    if (!ex1 || !ex2) return prev
    const groupId = ex1.supersetGroup || ex2.supersetGroup || newId('ss')
    return { ...prev, exercises: prev.exercises.map(e => (e.id === exId1 || e.id === exId2 ? { ...e, supersetGroup: groupId } : e)) }
  })

  const unlinkSuperset = (exId1: string, exId2: string) => setDraft(prev => {
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
    const newGroupAfter = afterIdxs.length >= 2 ? newId('ss') : undefined
    return {
      ...prev,
      exercises: exercises.map((e, i) => {
        if (beforeIdxs.includes(i)) return { ...e, supersetGroup: newGroupBefore }
        if (afterIdxs.includes(i)) return { ...e, supersetGroup: newGroupAfter }
        return e
      })
    }
  })

  const handleSave = async () => {
    const name = draft.name.trim()
    if (!name) { setError('プラン名を入力してください'); return }
    if (existingNames.includes(name)) { setError('同じ名前のプランが既にあります'); return }
    if (draft.exercises.some(ex => !ex.name.trim())) { setError('種目名が空の種目があります'); return }
    const cleaned: WorkoutPlan = {
      ...draft,
      name,
      exercises: draft.exercises.map(ex => ({ ...ex, name: ex.name.trim() })),
      warmup: draft.warmup.filter(s => s.name.trim()).map(s => ({ ...s, name: s.name.trim() })),
      cooldown: draft.cooldown.filter(s => s.name.trim()).map(s => ({ ...s, name: s.name.trim() }))
    }
    setSaving(true)
    setError(null)
    const err = await onSave(cleaned)
    setSaving(false)
    if (err) setError(err)
  }

  const numCls = 'w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none text-center'

  return (
    <div className="pb-28 max-w-2xl mx-auto p-5 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6 sticky top-14 z-30 bg-gray-50/95 backdrop-blur -mx-5 px-5 py-3">
        <h2 className="text-xl font-black text-gray-800">{isNew ? '新しいプラン' : 'プランの編集'}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-bold rounded-lg active:scale-95">キャンセル</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg flex items-center gap-1 shadow-md active:scale-95 disabled:opacity-60">
            <Save size={16} />{saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle size={16} />{error}
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <label htmlFor="plan-name" className="text-xs font-bold text-gray-500 mb-1 block">プラン名</label>
        <input
          id="plan-name"
          type="text" value={draft.name}
          onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
          className="w-full font-bold text-lg border-b border-gray-300 pb-1 outline-none focus:border-blue-500 transition-colors"
          placeholder="例：上半身・引く"
        />
      </div>

      <StretchListEditor phase="warmup" items={draft.warmup} onChange={warmup => setDraft(prev => ({ ...prev, warmup }))} />

      <h3 className="font-black text-gray-800 text-sm flex items-center gap-1.5 mb-3 px-1"><ListChecks size={16} className="text-blue-500" />種目</h3>
      <div className="space-y-0 mb-6">
        {draft.exercises.map((ex, idx) => {
          const nextEx = draft.exercises[idx + 1]
          const isLinkedToNext = !!ex.supersetGroup && ex.supersetGroup === nextEx?.supersetGroup
          const isInSuperset = !!ex.supersetGroup
          return (
            <React.Fragment key={ex.id}>
              <div className={`bg-white p-4 rounded-2xl shadow-sm border relative ${isInSuperset ? 'border-purple-300' : 'border-gray-200'} ${isLinkedToNext ? 'rounded-b-xl' : 'mb-4'}`}>
                <div className="flex items-center gap-1 mb-4">
                  <span className="text-blue-500 opacity-50 font-bold text-sm w-5">{idx + 1}.</span>
                  {isInSuperset && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-black tracking-wider">SS</span>}
                  <input
                    type="text" value={ex.name}
                    aria-label="種目名"
                    onChange={e => updateExercise(ex.id, 'name', e.target.value)}
                    className="flex-1 min-w-0 font-bold text-gray-800 text-lg border-b border-gray-200 pb-1 outline-none focus:border-blue-500"
                    placeholder="種目名"
                  />
                  <button onClick={() => setDraft(prev => ({ ...prev, exercises: moveItem(prev.exercises, idx, -1) }))} disabled={idx === 0} aria-label="上へ" className="p-1 text-gray-400 disabled:opacity-30"><ChevronUp size={18} /></button>
                  <button onClick={() => setDraft(prev => ({ ...prev, exercises: moveItem(prev.exercises, idx, 1) }))} disabled={idx === draft.exercises.length - 1} aria-label="下へ" className="p-1 text-gray-400 disabled:opacity-30"><ChevronDown size={18} /></button>
                  <button onClick={() => setDraft(prev => ({ ...prev, exercises: prev.exercises.filter(e => e.id !== ex.id) }))} aria-label="種目を削除" className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">種目タイプ</label>
                    <select value={ex.type} onChange={e => updateExercise(ex.id, 'type', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none">
                      <option value="normal">通常（回数）</option>
                      <option value="duration">秒数（デュレーション）</option>
                      <option value="tabata">ラウンド（HIIT等）</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">使用する機材 (初期負荷)</label>
                    <select value={ex.equipmentType} onChange={e => updateExercise(ex.id, 'equipmentType', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none">
                      {equipment.filter(e => e.category === 'load').map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">セット数</label>
                    <NumberField value={ex.targetSets} min={1} max={20} onChange={v => updateExercise(ex.id, 'targetSets', v)} className={numCls} />
                  </div>
                  {ex.type !== 'tabata' && (
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">{ex.type === 'duration' ? '秒数' : '回数'}</label>
                      <NumberField value={ex.defaultReps} min={0} max={999} onChange={v => updateExercise(ex.id, 'defaultReps', v)} className={numCls} />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1 flex items-center gap-1"><Timer size={10} />休憩 (秒)</label>
                    <NumberField value={ex.interval} min={0} max={600} onChange={v => updateExercise(ex.id, 'interval', v)} className={numCls} />
                  </div>
                </div>

                {ex.type === 'tabata' && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <div>
                      <label className="text-[10px] font-bold text-orange-600 block mb-1">稼働 (秒)</label>
                      <NumberField value={ex.tabataWork ?? 20} min={1} max={600} onChange={v => updateExercise(ex.id, 'tabataWork', v)} className="w-full bg-white border border-orange-200 rounded-lg p-2 text-sm font-bold outline-none text-center text-orange-600" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-blue-600 block mb-1">休憩 (秒)</label>
                      <NumberField value={ex.tabataRest ?? 10} min={1} max={600} onChange={v => updateExercise(ex.id, 'tabataRest', v)} className="w-full bg-white border border-blue-200 rounded-lg p-2 text-sm font-bold outline-none text-center text-blue-600" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 block mb-1">サイクル数</label>
                      <NumberField value={ex.tabataCycles ?? 8} min={1} max={50} onChange={v => updateExercise(ex.id, 'tabataCycles', v)} className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm font-bold outline-none text-center text-gray-700" />
                    </div>
                  </div>
                )}
              </div>
              {nextEx && (
                <div className="flex items-center justify-center py-1.5">
                  {isLinkedToNext ? (
                    <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
                      <span className="text-[10px] font-bold text-purple-600">⚡ スーパーセット接続中</span>
                      <button onClick={() => unlinkSuperset(ex.id, nextEx.id)} className="flex items-center gap-0.5 text-[10px] text-purple-400 hover:text-red-500 font-bold active:scale-95 transition-colors ml-1">
                        <Unlink2 size={11} /> 解除
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => linkSuperset(ex.id, nextEx.id)} className="flex items-center gap-1 text-[10px] text-gray-400 bg-white border border-dashed border-gray-300 px-3 py-1 rounded-full font-medium hover:border-purple-300 hover:text-purple-500 hover:bg-purple-50 active:scale-95 transition-colors">
                      <Link2 size={11} /> スーパーセット接続
                    </button>
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}

        <button onClick={addExercise} className="w-full mt-2 py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-bold flex items-center justify-center gap-2 hover:bg-gray-100 hover:border-gray-400 transition-colors active:scale-95">
          <Plus size={18} /> 種目を追加
        </button>
      </div>

      <StretchListEditor phase="cooldown" items={draft.cooldown} onChange={cooldown => setDraft(prev => ({ ...prev, cooldown }))} />
    </div>
  )
}

// ─── Read-only plan detail ───────────────────────────────────────────────────

const StretchSummary = ({ phase, items }: { phase: StretchPhase; items: Stretch[] }) => {
  if (items.length === 0) return null
  const Icon = phase === 'warmup' ? Sunrise : Sunset
  return (
    <div className={`p-4 rounded-2xl border mb-4 ${phase === 'warmup' ? 'bg-amber-50 border-amber-100' : 'bg-teal-50 border-teal-100'}`}>
      <h3 className={`text-xs font-black mb-2 flex items-center gap-1 ${phase === 'warmup' ? 'text-amber-700' : 'text-teal-700'}`}>
        <Icon size={14} />{phaseLabel[phase]}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map(s => (
          <span key={s.id} className="bg-white text-gray-700 text-xs font-bold rounded-lg px-2.5 py-1">
            {s.name} <span className="text-gray-400 font-medium">{s.seconds}秒{s.bilateral ? '×左右' : ''}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export const ExerciseList = ({ exercises }: { exercises: Exercise[] }) => (
  <div className="space-y-0">
    {exercises.map((ex, idx) => {
      const nextEx = exercises[idx + 1]
      const isInSuperset = !!ex.supersetGroup
      const isLinkedToNext = isInSuperset && nextEx?.supersetGroup === ex.supersetGroup
      return (
        <React.Fragment key={ex.id}>
          <div className={`bg-white p-5 rounded-3xl shadow-sm border ${isInSuperset ? 'border-purple-200' : 'border-gray-100'} ${isLinkedToNext ? 'mb-0 rounded-b-xl' : 'mb-4'}`}>
            <div className="font-bold text-gray-800 mb-3 flex gap-2 text-lg items-center">
              <span className="text-blue-500 opacity-50">{idx + 1}.</span>
              {ex.name}
              {isInSuperset && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-black tracking-wider">SS</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="bg-gray-100 text-gray-600 text-xs font-bold rounded-lg px-3 py-1.5">🎯 {ex.targetSets} Sets × {ex.type !== 'tabata' ? (ex.type === 'duration' ? `${ex.defaultReps}秒` : `${ex.defaultReps}回`) : 'HIIT'}</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold rounded-lg px-3 py-1.5 flex items-center gap-1"><Timer size={12} /> {ex.interval}s</span>
              {ex.type === 'tabata' && <span className="bg-orange-50 text-orange-600 text-xs font-bold rounded-lg px-3 py-1.5 flex items-center gap-1"><Flame size={12} /> {ex.tabataWork}s / {ex.tabataRest}s × {ex.tabataCycles}回</span>}
            </div>
          </div>
          {isLinkedToNext && (
            <div className="flex items-center justify-center h-7 bg-purple-50 border-x border-purple-200 -mt-px mb-0">
              <span className="text-[9px] font-bold text-purple-500">⚡ 続けて実施（スーパーセット）</span>
            </div>
          )}
        </React.Fragment>
      )
    })}
    {exercises.length === 0 && (
      <div className="text-center text-gray-400 py-10 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">種目がまだありません</div>
    )}
  </div>
)

// ─── Plan tab ────────────────────────────────────────────────────────────────

type View = { mode: 'list' } | { mode: 'detail'; id: string } | { mode: 'edit'; plan: WorkoutPlan; isNew: boolean }

export default function PlanTab({ userId, plans, setPlans, equipment, records }: {
  userId: string
  plans: WorkoutPlan[]
  setPlans: React.Dispatch<React.SetStateAction<WorkoutPlan[]>>
  equipment: EquipmentItem[]
  records: WorkoutRecord[]
}) {
  const [view, setView] = useState<View>({ mode: 'list' })
  useEffect(() => { window.scrollTo?.(0, 0) }, [view.mode, view.mode === 'detail' ? view.id : null])
  const [confirmDelete, setConfirmDelete] = useState<WorkoutPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastPerformed = lastPerformedMap(records)
  const nextSortOrder = plans.reduce((m, p) => Math.max(m, p.sortOrder), 0) + 1

  const savePlan = async (plan: WorkoutPlan): Promise<string | null> => {
    const { error } = await supabase.from('workout_plans').upsert(planToRow(plan, userId))
    if (error) {
      console.error('Failed to save plan:', error)
      return `保存に失敗しました: ${error.message}`
    }
    setPlans(prev => {
      const exists = prev.some(p => p.id === plan.id)
      const next = exists ? prev.map(p => (p.id === plan.id ? plan : p)) : [...prev, plan]
      return next.sort((a, b) => a.sortOrder - b.sortOrder)
    })
    setView({ mode: 'detail', id: plan.id })
    return null
  }

  const deletePlan = async (plan: WorkoutPlan) => {
    setConfirmDelete(null)
    const { error } = await supabase.from('workout_plans').delete().eq('id', plan.id).eq('user_id', userId)
    if (error) {
      console.error('Failed to delete plan:', error)
      setError(`削除に失敗しました: ${error.message}`)
      return
    }
    setPlans(prev => prev.filter(p => p.id !== plan.id))
    setView({ mode: 'list' })
  }

  const duplicatePlan = (plan: WorkoutPlan) => {
    let name = `${plan.name}（コピー）`
    for (let i = 2; plans.some(p => p.name === name); i++) name = `${plan.name}（コピー${i}）`
    setView({ mode: 'edit', isNew: true, plan: { ...JSON.parse(JSON.stringify(plan)), id: uuid(), name, sortOrder: nextSortOrder } })
  }

  if (view.mode === 'edit') {
    return (
      <PlanEditor
        initial={view.plan}
        isNew={view.isNew}
        equipment={equipment}
        existingNames={plans.filter(p => p.id !== view.plan.id).map(p => p.name)}
        onCancel={() => setView(view.isNew ? { mode: 'list' } : { mode: 'detail', id: view.plan.id })}
        onSave={savePlan}
      />
    )
  }

  const detail = view.mode === 'detail' ? plans.find(p => p.id === view.id) : undefined

  return (
    <div className="pb-28 max-w-2xl mx-auto p-5 bg-gray-50 min-h-screen">
      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {detail ? (
        <>
          <button onClick={() => setView({ mode: 'list' })} className="flex items-center gap-1 text-sm font-bold text-gray-500 mb-4 active:scale-95">
            <ChevronLeft size={18} /> プラン一覧
          </button>
          <div className="mb-6 flex justify-between items-end gap-3 border-l-4 border-blue-500 pl-2">
            <div className="min-w-0">
              <h2 className="text-2xl font-black text-gray-800 leading-tight break-words">{detail.name}</h2>
              <p className="text-gray-500 text-xs font-medium mt-1 flex items-center gap-1">
                <Clock size={12} /> 目安 約{estimatePlanMinutes(detail)}分・{detail.exercises.length}種目
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => duplicatePlan(detail)} aria-label="複製" className="text-gray-500 bg-white border border-gray-200 p-2 rounded-lg active:scale-95"><Copy size={16} /></button>
              <button onClick={() => setConfirmDelete(detail)} aria-label="プランを削除" className="text-gray-500 bg-white border border-gray-200 p-2 rounded-lg active:scale-95 hover:text-red-500"><Trash2 size={16} /></button>
              <button onClick={() => setView({ mode: 'edit', plan: detail, isNew: false })} className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors active:scale-95">
                <Edit3 size={16} /> 編集
              </button>
            </div>
          </div>
          <StretchSummary phase="warmup" items={detail.warmup} />
          <ExerciseList exercises={detail.exercises} />
          <StretchSummary phase="cooldown" items={detail.cooldown} />
        </>
      ) : (
        <>
          <div className="mb-5 flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-black text-gray-800 leading-tight">マイプラン</h2>
              <p className="text-gray-500 text-xs font-medium mt-1">作ったプランから、毎日ワークアウトタブで選んで実施します</p>
            </div>
          </div>
          <div className="space-y-3">
            {plans.map(plan => {
              const last = lastPerformed.get(plan.name)
              return (
                <button
                  key={plan.id}
                  onClick={() => setView({ mode: 'detail', id: plan.id })}
                  className="w-full text-left bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
                >
                  <div className="font-black text-gray-800 text-lg leading-tight">{plan.name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] font-bold text-gray-500">
                    <span>{plan.exercises.length}種目</span>
                    <span>約{estimatePlanMinutes(plan)}分</span>
                    {(plan.warmup.length > 0 || plan.cooldown.length > 0) && <span>ストレッチ {plan.warmup.length + plan.cooldown.length}</span>}
                    <span className="text-gray-400">{last ? `前回 ${formatDaysAgo(daysAgo(last))}` : '未実施'}</span>
                  </div>
                </button>
              )
            })}
            {plans.length === 0 && (
              <div className="text-center text-gray-400 py-10 bg-white rounded-3xl border border-dashed border-gray-200 text-sm">プランがありません。最初のプランを作りましょう。</div>
            )}
            <button
              onClick={() => setView({ mode: 'edit', isNew: true, plan: createEmptyPlan(nextSortOrder) })}
              className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors active:scale-95"
            >
              <Plus size={18} /> 新しいプランを作成
            </button>
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center">
            <h3 className="text-lg font-bold text-gray-800 mb-2">「{confirmDelete.name}」を削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-6">過去のトレーニング記録は残ります。</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold active:scale-95">キャンセル</button>
              <button onClick={() => deletePlan(confirmDelete)} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 active:scale-95">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
