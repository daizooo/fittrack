import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Edit3, History, Plus, Trash2 } from 'lucide-react'
import { KIND_LABELS, muscleLabel } from '../lib/exerciseLibrary'
import {
  ExerciseForm, ExerciseMeta, ExerciseSearchBar, emptyExerciseInput, filterExercises, sortExercises,
  type ExerciseActions, type ExerciseUsage
} from './ExercisePicker'
import { ExerciseDetailModal } from './RecordsTab'
import { DiscardDialog } from './ui'
import type { EquipmentItem, ExerciseDef, MuscleGroup, WorkoutPlan, WorkoutRecord } from '../types'

type View = { mode: 'list' } | { mode: 'detail'; id: string } | { mode: 'create' } | { mode: 'edit'; id: string }

/** 種目タブ: 標準＋自作の種目の一覧。タップで詳細（部位・実施履歴）、自作はここで編集・削除できる */
export default function ExercisesTab({ library, usage, records, plans, equipment, actions }: {
  library: ExerciseDef[]
  usage: ExerciseUsage
  records: WorkoutRecord[]
  plans: WorkoutPlan[]
  equipment: EquipmentItem[]
  actions: ExerciseActions
}) {
  const [view, setView] = useState<View>({ mode: 'list' })
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [showHistory, setShowHistory] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = useMemo(() => sortExercises(filterExercises(library, query, muscle), usage), [library, query, muscle, usage])
  const def = view.mode === 'detail' || view.mode === 'edit' ? library.find(d => d.id === view.id) : undefined

  if (view.mode === 'create') {
    return (
      <ExerciseForm
        title="新しい種目を作成" initial={emptyExerciseInput()} equipment={equipment} submitLabel="作成"
        onCancel={() => setView({ mode: 'list' })}
        onSubmit={async input => {
          const res = await actions.create(input)
          if (typeof res === 'string') return res
          setView({ mode: 'detail', id: res.id })
          return null
        }}
      />
    )
  }

  if (view.mode === 'edit' && def && !def.builtin) {
    return (
      <ExerciseForm
        title="種目を編集" submitLabel="保存" equipment={equipment}
        initial={{ name: def.name, muscle: def.muscle, kind: def.kind, equipmentType: def.equipmentType, note: def.note }}
        onCancel={() => setView({ mode: 'detail', id: def.id })}
        onSubmit={async input => {
          const err = await actions.update(def.id, input)
          if (err) return err
          setView({ mode: 'detail', id: def.id })
          return null
        }}
      />
    )
  }

  if (view.mode === 'detail' && def) {
    const u = usage.get(def.id)
    const usedIn = plans.filter(p => p.exercises.some(ex => ex.exerciseId === def.id || (ex.stations ?? []).some(st => st.exerciseId === def.id)))
    return (
      <div className="p-5 max-w-2xl mx-auto pb-28">
        <button onClick={() => { setView({ mode: 'list' }); setError(null) }} className="flex items-center gap-1 text-sm font-bold text-gray-500 mb-4 active:scale-95">
          <ChevronLeft size={18} /> 種目一覧
        </button>
        {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

        <div className="mb-4 flex justify-between items-start gap-3 border-l-4 border-indigo-500 pl-2">
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-gray-800 leading-tight break-words">{def.name}</h2>
            <ExerciseMeta def={def} usage={usage} />
          </div>
          {!def.builtin && (
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => setConfirmDelete(true)} aria-label="種目を削除" className="text-gray-500 bg-white border border-gray-200 p-2 rounded-lg active:scale-95 hover:text-red-500"><Trash2 size={16} /></button>
              <button onClick={() => setView({ mode: 'edit', id: def.id })} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 active:scale-95"><Edit3 size={16} /> 編集</button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-4">
          <div className="flex justify-between px-4 py-3 text-sm"><span className="text-gray-500 font-bold">主な部位</span><span className="font-bold text-gray-800">{muscleLabel(def.muscle)}</span></div>
          <div className="flex justify-between px-4 py-3 text-sm"><span className="text-gray-500 font-bold">記録のしかた</span><span className="font-bold text-gray-800">{KIND_LABELS[def.kind]}</span></div>
          <div className="flex justify-between px-4 py-3 text-sm"><span className="text-gray-500 font-bold">種類</span><span className="font-bold text-gray-800">{def.builtin ? '標準の種目' : '自作の種目'}</span></div>
          {def.note && <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{def.note}</div>}
        </div>

        <button
          onClick={() => setShowHistory(true)} disabled={!u}
          className="w-full mb-4 py-3.5 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 flex items-center justify-center gap-2 active:scale-[0.99] disabled:text-gray-300"
        >
          <History size={18} />{u ? `実施履歴・推移を見る（${u.sessions}回）` : 'まだ実施記録がありません'}
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-xs font-black text-gray-500 mb-2">使っているプラン</h3>
          {usedIn.length === 0
            ? <p className="text-sm text-gray-400">どのプランにも入っていません</p>
            : <ul className="space-y-1">{usedIn.map(p => <li key={p.id} className="text-sm font-bold text-gray-800">{p.name}</li>)}</ul>}
        </div>

        {showHistory && <ExerciseDetailModal exerciseKey={def.id} records={records} onClose={() => setShowHistory(false)} />}
        {confirmDelete && (
          <DiscardDialog
            title={`「${def.name}」を削除しますか？`} discardLabel="削除する" onKeep={() => setConfirmDelete(false)}
            onDiscard={async () => {
              setConfirmDelete(false)
              const err = await actions.remove(def.id)
              if (err) setError(err)
              else setView({ mode: 'list' })
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-5 max-w-2xl mx-auto pb-28">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-gray-800 leading-tight">種目</h2>
        <p className="text-gray-500 text-xs font-medium mt-1">プランに入れる種目の一覧です。記録は種目ごとに蓄積されます</p>
      </div>
      <div className="mb-4"><ExerciseSearchBar query={query} setQuery={setQuery} muscle={muscle} setMuscle={setMuscle} /></div>
      <div className="space-y-2">
        <button
          onClick={() => setView({ mode: 'create' })}
          className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-bold flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          <Plus size={18} /> 新しい種目を作成
        </button>
        {list.map(d => (
          <button key={d.id} onClick={() => setView({ mode: 'detail', id: d.id })} className="w-full text-left flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 active:bg-gray-50">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-800 truncate">{d.name}</div>
              <ExerciseMeta def={d} usage={usage} />
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
        {list.length === 0 && <p className="text-center text-gray-400 text-sm py-8">該当する種目がありません</p>}
      </div>
    </div>
  )
}
