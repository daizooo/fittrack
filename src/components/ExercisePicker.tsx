import { useMemo, useState } from 'react'
import { Check, ChevronLeft, Plus, Search, X } from 'lucide-react'
import { MUSCLE_GROUPS, KIND_LABELS, matchesMuscle, muscleLabel, normName } from '../lib/exerciseLibrary'
import { formatDaysAgo, daysAgo } from '../lib/dates'
import type { EquipmentItem, ExerciseDef, ExerciseKind, MuscleGroup } from '../types'

/** 種目マスタの操作（FitTrack が提供する） */
export interface ExerciseActions {
  create: (input: ExerciseInput) => Promise<ExerciseDef | string>
  update: (id: string, input: ExerciseInput) => Promise<string | null>
  remove: (id: string) => Promise<string | null>
  /** 自作の種目 sourceId を targetId に統合する（記録・プランの参照を付け替え、sourceId を削除） */
  merge: (sourceId: string, targetId: string) => Promise<string | null>
}

export interface ExerciseInput {
  name: string
  muscle: MuscleGroup
  kind: ExerciseKind
  equipmentType: string
  note: string
}

/** 種目ごとの実施状況（記録から算出）。key は種目ID */
export type ExerciseUsage = Map<string, { sessions: number; lastDate: string }>

// ─── 一覧（ピッカーと「種目」タブで共通） ───────────────────────────────────────

export const filterExercises = (library: ExerciseDef[], query: string, muscle: MuscleGroup | 'all') => {
  const q = normName(query)
  return library.filter(d =>
    (muscle === 'all' || matchesMuscle(d.muscle, muscle)) &&
    (!q || [d.name, ...(d.aliases ?? [])].some(n => normName(n).includes(q)))
  )
}

/** 最近実施した順 → 未実施は名前順。自作の種目を先に */
export const sortExercises = (list: ExerciseDef[], usage: ExerciseUsage) =>
  [...list].sort((a, b) => {
    const ua = usage.get(a.id)?.lastDate
    const ub = usage.get(b.id)?.lastDate
    if (ua && ub) return ub.localeCompare(ua)
    if (ua) return -1
    if (ub) return 1
    if (a.builtin !== b.builtin) return a.builtin ? 1 : -1
    return a.name.localeCompare(b.name, 'ja')
  })

export const ExerciseMeta = ({ def, usage }: { def: ExerciseDef; usage: ExerciseUsage }) => {
  const u = usage.get(def.id)
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-gray-400 mt-0.5">
      <span className="text-gray-500">{muscleLabel(def.muscle)}</span>
      <span>{KIND_LABELS[def.kind]}</span>
      {!def.builtin && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-black">自作</span>}
      <span>{u ? `${u.sessions}回 · 前回 ${formatDaysAgo(daysAgo(u.lastDate))}` : '未実施'}</span>
    </div>
  )
}

export const ExerciseSearchBar = ({ query, setQuery, muscle, setMuscle }: {
  query: string
  setQuery: (q: string) => void
  muscle: MuscleGroup | 'all'
  setMuscle: (m: MuscleGroup | 'all') => void
}) => (
  <div className="space-y-2">
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="種目を検索" aria-label="種目を検索"
        className="w-full h-11 pl-9 pr-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400"
      />
    </div>
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1" role="group" aria-label="部位で絞り込み">
      {[{ id: 'all' as const, label: 'すべて' }, ...MUSCLE_GROUPS].map(g => (
        <button
          key={g.id} onClick={() => setMuscle(g.id)} aria-pressed={muscle === g.id}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${muscle === g.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          {g.label}
        </button>
      ))}
    </div>
  </div>
)

// ─── 種目の作成・編集フォーム ────────────────────────────────────────────────

export const ExerciseForm = ({ title, initial, equipment, submitLabel, onSubmit, onCancel }: {
  title: string
  initial: ExerciseInput
  equipment: EquipmentItem[]
  submitLabel: string
  onSubmit: (input: ExerciseInput) => Promise<string | null>
  onCancel: () => void
}) => {
  const [v, setV] = useState<ExerciseInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const loadItems = equipment.filter(e => e.category === 'load')

  const submit = async () => {
    const name = v.name.trim()
    if (!name) { setError('種目名を入力してください'); return }
    setSaving(true)
    setError(null)
    const err = await onSubmit({ ...v, name })
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={onCancel} aria-label="戻る" className="p-1 -ml-1 text-gray-500"><ChevronLeft size={22} /></button>
        <h2 className="text-lg font-black text-gray-800">{title}</h2>
      </div>
      {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4">
        <div>
          <label htmlFor="ex-name" className="text-xs font-bold text-gray-500 mb-1 block">種目名</label>
          <input
            id="ex-name" type="text" value={v.name} onChange={e => setV({ ...v, name: e.target.value })}
            placeholder="例：ダンベルカール"
            className="w-full font-bold text-lg border-b border-gray-300 pb-1 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <div className="text-xs font-bold text-gray-500 mb-1.5">主な部位</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="主な部位">
            {MUSCLE_GROUPS.map(g => (
              <button
                key={g.id} onClick={() => setV({ ...v, muscle: g.id })} aria-pressed={v.muscle === g.id}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${v.muscle === g.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-gray-500 mb-1.5">記録のしかた</div>
          <div className="flex gap-1.5" role="group" aria-label="記録のしかた">
            {(Object.keys(KIND_LABELS) as ExerciseKind[]).map(k => (
              <button
                key={k} onClick={() => setV({ ...v, kind: k })} aria-pressed={v.kind === k}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border ${v.kind === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="ex-equip" className="text-xs font-bold text-gray-500 mb-1 block">標準の負荷器具（プランに入れるときの初期値）</label>
          <select
            id="ex-equip" value={v.equipmentType} onChange={e => setV({ ...v, equipmentType: e.target.value })}
            className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-2 text-sm font-bold outline-none"
          >
            {loadItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ex-note" className="text-xs font-bold text-gray-500 mb-1 block">メモ（任意）</label>
          <textarea
            id="ex-note" value={v.note} onChange={e => setV({ ...v, note: e.target.value })} rows={2}
            placeholder="フォームの注意点など"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-blue-400"
          />
        </div>
      </div>
      <button
        onClick={submit} disabled={saving}
        className="w-full mt-5 py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-95 disabled:opacity-60"
      >
        {saving ? '保存中...' : submitLabel}
      </button>
    </div>
  )
}

export const emptyExerciseInput = (name = ''): ExerciseInput => ({ name, muscle: 'other', kind: 'reps', equipmentType: 'bodyweight', note: '' })

// ─── 種目ピッカー（プランに種目を追加する全画面の一覧） ──────────────────────────

/**
 * 「種目を追加」で開く一覧。検索・部位で絞り込み、タップで選択して「追加」で確定する。
 * 一覧に無ければ、その場でカスタム種目を作成して追加できる。
 * single=true のときは1つ選んだ時点で確定する（種目の差し替え用）。
 */
export const ExercisePicker = ({ library, usage, equipment, actions, single = false, allowCreate = true, title, onClose, onConfirm }: {
  library: ExerciseDef[]
  usage: ExerciseUsage
  equipment: EquipmentItem[]
  actions: ExerciseActions
  single?: boolean
  allowCreate?: boolean
  title?: string
  onClose: () => void
  onConfirm: (defs: ExerciseDef[]) => void
}) => {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => sortExercises(filterExercises(library, query, muscle), usage), [library, query, muscle, usage])

  const toggle = (def: ExerciseDef) => {
    if (single) { onConfirm([def]); return }
    setSelected(prev => (prev.includes(def.id) ? prev.filter(x => x !== def.id) : [...prev, def.id]))
  }
  const confirm = () => onConfirm(selected.map(id => library.find(d => d.id === id)).filter((d): d is ExerciseDef => !!d))

  return (
    <div role="dialog" aria-modal="true" aria-label="種目を選ぶ" className="fixed inset-0 z-[90] bg-gray-50 flex flex-col">
      {creating ? (
        <div className="flex-1 overflow-y-auto">
          <ExerciseForm
            title="新しい種目を作成" initial={emptyExerciseInput(query.trim())} equipment={equipment} submitLabel="作成して追加"
            onCancel={() => setCreating(false)}
            onSubmit={async input => {
              const res = await actions.create(input)
              if (typeof res === 'string') return res
              onConfirm([res])
              return null
            }}
          />
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-3 pb-3">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-black text-gray-800">{title ?? '種目を選ぶ'}</h2>
                <button onClick={onClose} aria-label="閉じる" className="p-2 -mr-2 text-gray-500"><X size={20} /></button>
              </div>
              <ExerciseSearchBar query={query} setQuery={setQuery} muscle={muscle} setMuscle={setMuscle} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-y-contain">
            <div className="max-w-2xl mx-auto p-4 pb-28 space-y-2">
              {allowCreate && (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full py-3.5 border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-2xl text-blue-600 font-bold flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  <Plus size={18} />{query.trim() ? `「${query.trim()}」を新しい種目として作成` : '新しい種目を作成'}
                </button>
              )}
              {list.map(def => {
                const on = selected.includes(def.id)
                return (
                  <button
                    key={def.id} onClick={() => toggle(def)} role={single ? undefined : 'checkbox'} aria-checked={single ? undefined : on}
                    className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-colors ${on ? 'border-blue-600 bg-blue-50/60' : 'border-gray-100 bg-white'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 truncate">{def.name}</div>
                      <ExerciseMeta def={def} usage={usage} />
                    </div>
                    {!single && (
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                )
              })}
              {list.length === 0 && <p className="text-center text-gray-400 text-sm py-8">該当する種目がありません</p>}
            </div>
          </div>

          {!single && (
            <div className="flex-shrink-0 bg-white border-t border-gray-200 p-3 pb-safe">
              <div className="max-w-2xl mx-auto">
                <button
                  onClick={confirm} disabled={selected.length === 0}
                  className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-95 disabled:opacity-40 disabled:shadow-none"
                >
                  {selected.length > 0 ? `${selected.length}件を追加` : '種目を選んでください'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
