import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle, ChevronRight, Dumbbell, Flame, Moon, Target, Trophy, X, Zap, Sunrise, Sunset } from 'lucide-react'
import { computeStats, filterRecordsByPeriod, monthCalendarCells, workoutDaysByMonth, type PeriodMode } from '../lib/stats'
import { amountUnit, exerciseHistory, loadLabel, setLabel, summarizeExercises } from '../lib/exerciseStats'
import { isSameDay } from '../lib/dates'
import { PeriodFilter } from './ui'
import type { WorkoutRecord } from '../types'

const ModalFrame = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-5" onClick={onClose}>
    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
      <button onClick={onClose} aria-label="閉じる" className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-600" /></button>
      {children}
      <button onClick={onClose} className="mt-6 w-full py-3 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-transform">閉じる</button>
    </div>
  </div>
)

// ─── Record detail modal ─────────────────────────────────────────────────────

export const RecordDetailModal = ({ record, onClose, onOpenExercise }: {
  record: WorkoutRecord
  onClose: () => void
  onOpenExercise?: (name: string) => void
}) => {
  const stretchLine = (label: string, list: { completed: boolean }[] | undefined, Icon: typeof Sunrise, cls: string) =>
    list && list.length > 0 ? (
      <div className={`flex items-center justify-between text-xs font-bold px-3 py-2 rounded-xl ${cls}`}>
        <span className="flex items-center gap-1"><Icon size={12} />{label}</span>
        <span>{list.filter(s => s.completed).length} / {list.length}</span>
      </div>
    ) : null

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex items-center gap-2 mb-4 pr-8">
        {record.type === 'rest'
          ? <div className="p-2 bg-gray-100 rounded-xl"><Moon size={20} className="text-gray-400" /></div>
          : <div className="p-2 bg-blue-100 rounded-xl"><Flame size={20} className="text-blue-600" /></div>}
        <div>
          <h3 className="font-bold text-gray-900 text-lg">{record.date} ({record.day})</h3>
          <p className="text-xs text-gray-500 font-bold">{record.category || '休養日'}</p>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-3">
        {record.type === 'rest' ? (
          <p className="text-gray-500 py-4 text-center">この日は休養日でした💤</p>
        ) : (
          <>
            {stretchLine('ウォームアップ', record.stretches?.warmup, Sunrise, 'bg-amber-50 text-amber-700')}
            {record.exercises.map((ex, idx) => {
              const completedSets = ex.sets.filter(s => s.completed).length
              return (
                <div key={idx} className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    {onOpenExercise && completedSets > 0 ? (
                      <button onClick={() => onOpenExercise(ex.name)} className="font-bold text-sm text-blue-700 flex items-center gap-0.5 text-left">
                        {ex.name}<ChevronRight size={14} />
                      </button>
                    ) : (
                      <div className="font-bold text-sm text-gray-800">{ex.name}</div>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${completedSets === ex.sets.length ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-200 text-gray-600'}`}>{completedSets} / {ex.sets.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {ex.sets.map((s, si) => (
                      <div key={si} className={`text-[11px] flex items-center gap-2 ${s.completed ? 'text-gray-700' : 'text-gray-300'}`}>
                        <span className="w-4 text-right font-bold">{s.setNumber}</span>
                        <span className="flex-1">{setLabel(ex, s)}</span>
                        {s.completed && <CheckCircle size={11} className="text-green-500" />}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {stretchLine('クールダウン', record.stretches?.cooldown, Sunset, 'bg-teal-50 text-teal-700')}
          </>
        )}
      </div>
    </ModalFrame>
  )
}

// ─── Exercise detail modal（種目ごとの推移と自己ベスト） ───────────────────────

export const ExerciseDetailModal = ({ name, records, onClose, onOpenRecord }: {
  name: string
  records: WorkoutRecord[]
  onClose: () => void
  onOpenRecord: (record: WorkoutRecord) => void
}) => {
  const history = useMemo(() => exerciseHistory(records, name), [records, name])
  const latest = history[0]
  if (!latest) return null
  const unit = amountUnit(latest.exercise.type)
  const bestAmount = Math.max(...history.map(h => h.bestAmount))
  const weights = history.map(h => h.maxWeight).filter((w): w is number => w !== null)
  const maxWeight = weights.length > 0 ? Math.max(...weights) : null
  const trend = history.slice(0, 12).reverse()
  const maxTrend = Math.max(1, ...trend.map(h => h.amount))
  const diff = history.length > 1 ? latest.amount - history[1].amount : null

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex items-center gap-2 mb-4 pr-8">
        <div className="p-2 bg-indigo-100 rounded-xl"><Dumbbell size={20} className="text-indigo-600" /></div>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-lg truncate">{name}</h3>
          <p className="text-xs text-gray-500 font-bold">これまで {history.length} 回実施</p>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-yellow-50 rounded-2xl p-2">
            <div className="text-[10px] font-bold text-yellow-700">1セット最高</div>
            <div className="font-black text-gray-900">{bestAmount}<span className="text-xs font-bold text-gray-500">{unit}</span></div>
          </div>
          <div className="bg-yellow-50 rounded-2xl p-2">
            <div className="text-[10px] font-bold text-yellow-700">最大負荷</div>
            <div className="font-black text-gray-900 text-sm leading-6 truncate">{maxWeight === null ? 'ー' : loadLabel(latest.exercise, maxWeight)}</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-2">
            <div className="text-[10px] font-bold text-gray-500">前回比（合計）</div>
            <div className={`font-black ${diff === null ? 'text-gray-400' : diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {diff === null ? 'ー' : `${diff > 0 ? '+' : ''}${diff}`}<span className="text-xs font-bold text-gray-500">{diff === null ? '' : unit}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-gray-500 mb-2">完了セットの合計{unit === '回' ? '回数' : '秒数'}（直近{trend.length}回）</div>
          <div className="flex items-end gap-1 h-24" aria-label="推移グラフ">
            {trend.map(h => (
              <div key={`${h.recordId}-${h.exercise.id}`} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
                <span className="text-[9px] font-bold text-gray-500">{h.amount}</span>
                <div className={`w-full rounded-t ${h.prAmount || h.prWeight ? 'bg-yellow-400' : 'bg-indigo-500'}`} style={{ height: `${(h.amount / maxTrend) * 70}%`, minHeight: 4 }} />
                <span className="text-[8px] text-gray-400">{h.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-gray-500">実施履歴</div>
          {history.map(h => (
            <button
              key={`${h.recordId}-${h.exercise.id}`}
              onClick={() => { const r = records.find(x => x.id === h.recordId); if (r) onOpenRecord(r) }}
              className="w-full text-left bg-gray-50 p-3 rounded-2xl border border-gray-100 active:bg-gray-100"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-gray-800">{h.date} ({h.day})</span>
                <span className="flex items-center gap-1">
                  {(h.prAmount || h.prWeight) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-100 text-yellow-700 flex items-center gap-0.5"><Trophy size={10} />自己ベスト</span>}
                  <span className="text-[10px] font-bold text-gray-500">{h.completedSets.length}/{h.totalSets}セット · 計{h.amount}{unit}</span>
                </span>
              </div>
              <div className="text-[11px] text-gray-600 leading-relaxed">
                {h.completedSets.map(s => setLabel(h.exercise, s)).join('　/　')}
              </div>
              {h.planName && <div className="text-[10px] text-gray-400 mt-1">{h.planName}</div>}
            </button>
          ))}
        </div>
      </div>
    </ModalFrame>
  )
}

// ─── Records tab (履歴＋分析) ────────────────────────────────────────────────

export default function RecordsTab({ records }: { records: WorkoutRecord[] }) {
  const [mode, setMode] = useState<PeriodMode>('month')
  const [anchor, setAnchor] = useState(new Date())
  const [detail, setDetail] = useState<WorkoutRecord | null>(null)
  const [exerciseName, setExerciseName] = useState<string | null>(null)

  const periodRecords = useMemo(() => filterRecordsByPeriod(records, mode, anchor), [records, mode, anchor])
  const stats = useMemo(() => computeStats(periodRecords), [periodRecords])
  const exercises = useMemo(() => summarizeExercises(periodRecords), [periodRecords])
  const cells = useMemo(() => monthCalendarCells(anchor), [anchor])
  const byMonth = useMemo(() => workoutDaysByMonth(periodRecords), [periodRecords])
  const maxMonth = Math.max(1, ...byMonth)

  const shift = (dir: number) => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    if (mode === 'month') d.setMonth(d.getMonth() + dir)
    else d.setFullYear(d.getFullYear() + dir)
    setAnchor(d)
  }

  let motivationMsg = 'さあ、新しい記録を作りましょう！'
  if (stats.consistencyRate >= 70) motivationMsg = 'トップアスリート級の継続力です！🔥'
  else if (stats.consistencyRate >= 50) motivationMsg = '素晴らしいペース！完全に習慣化しています👏'
  else if (stats.workoutDays > 0) motivationMsg = '自分のペースで着実に進んでいます！🌱'

  const today = new Date()

  return (
    <div className="pb-28 max-w-2xl mx-auto bg-gray-50 min-h-screen">
      <PeriodFilter mode={mode} setMode={setMode} anchor={anchor} shift={shift} />

      <div className="p-5 space-y-5">
        {/* サマリー */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4"><Trophy size={120} /></div>
          <p className="text-lg font-bold text-yellow-400 mb-4">{motivationMsg}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Zap size={12} className="text-blue-400" />総レップ＆秒数</div>
              <div className="text-3xl font-black">{stats.totalRepsOrSeconds.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Target size={12} className="text-green-400" />実行率 (記録日中)</div>
              <div className="text-3xl font-black">{stats.consistencyRate}<span className="text-lg font-medium text-gray-400">%</span></div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700/50 flex gap-4 text-sm text-gray-300">
            <div><span className="font-bold text-white">{stats.completedSets}</span> Sets</div>
            <div><span className="font-bold text-white">{stats.workoutDays}</span> Days</div>
            <div><span className="font-bold text-white">{stats.restDays}</span> Rest</div>
          </div>
        </div>

        {/* カレンダー（月）／月別グラフ（年） */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
            <CalendarDays size={18} className="text-blue-500" />{mode === 'month' ? '活動カレンダー' : '月別トレーニング日数'}
          </h3>
          {mode === 'month' ? (
            <>
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                  <div key={d} className="text-center text-[10px] text-gray-400 font-bold">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {cells.map((dateObj, i) => {
                  if (!dateObj) return <div key={i} className="aspect-square"></div>
                  const record = periodRecords.find(r => isSameDay(new Date(r.fullDate), dateObj))
                  let bgClass = 'bg-gray-100 text-gray-400'
                  if (record?.type === 'workout') bgClass = 'bg-blue-600 text-white shadow-sm'
                  else if (record?.type === 'rest') bgClass = 'bg-gray-300 text-white'
                  const isToday = isSameDay(dateObj, today)
                  return (
                    <button
                      key={i}
                      onClick={() => record && setDetail(record)}
                      disabled={!record}
                      className={`aspect-square rounded-md ${bgClass} ${isToday ? 'ring-2 ring-blue-300' : ''} ${record ? 'active:scale-95 transition-all' : 'cursor-default'} flex items-center justify-center`}
                      title={dateObj.toLocaleDateString('ja-JP')}
                    >
                      <span className="text-[10px] font-bold">{dateObj.getDate()}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-4 text-[10px] text-gray-500 justify-end items-center">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div>トレ</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-300 rounded-sm"></div>休養</div>
              </div>
            </>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {byMonth.map((count, m) => (
                <button
                  key={m}
                  onClick={() => { setMode('month'); setAnchor(new Date(anchor.getFullYear(), m, 1)) }}
                  className="flex-1 flex flex-col items-center justify-end h-full gap-1"
                  aria-label={`${m + 1}月を表示`}
                >
                  <span className="text-[9px] font-bold text-gray-500">{count || ''}</span>
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(count / maxMonth) * 80}%`, minHeight: count ? 4 : 0 }} />
                  <span className="text-[9px] text-gray-400 font-bold">{m + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 種目別 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2 text-sm">
            <Dumbbell size={18} className="text-indigo-500" /> 種目別の記録
          </h3>
          <p className="text-[11px] text-gray-400 mb-3">タップで推移・自己ベスト・全履歴を表示</p>
          {exercises.length === 0 ? (
            <div className="text-center text-gray-400 py-4 text-sm">データがありません</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {exercises.map(ex => {
                const unit = amountUnit(ex.type)
                return (
                  <button key={ex.name} onClick={() => setExerciseName(ex.name)} className="w-full flex items-center gap-3 py-2.5 text-left active:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 text-sm truncate">{ex.name}</div>
                      <div className="text-[11px] text-gray-500">{ex.sessions}回 · {ex.completedSets}セット · 計{ex.amount.toLocaleString()}{unit}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-gray-400 font-bold">最高</div>
                      <div className="text-xs font-bold text-gray-700">
                        {ex.maxWeight !== null && <span className="mr-1">{loadLabel(ex.exercise, ex.maxWeight)}</span>}{ex.bestAmount}{unit}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 記録一覧 */}
        <div>
          <h3 className="font-bold text-gray-800 mb-3 text-sm px-1">記録一覧</h3>
          {periodRecords.length === 0 ? (
            <div className="text-center text-gray-400 py-12 bg-white rounded-3xl border border-dashed border-gray-200">記録はありません。</div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              {periodRecords.map(record => {
                const sets = record.exercises.reduce((n, ex) => n + ex.sets.length, 0)
                const done = record.exercises.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0)
                const names = record.exercises.filter(ex => ex.sets.some(s => s.completed)).map(ex => ex.name)
                return (
                  <button key={record.id} onClick={() => setDetail(record)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                    {record.type === 'rest'
                      ? <div className="p-1.5 bg-gray-100 rounded-lg"><Moon size={16} className="text-gray-400" /></div>
                      : <div className="p-1.5 bg-blue-100 rounded-lg"><Flame size={16} className="text-blue-600" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 text-sm">{record.date} ({record.day})</div>
                      <div className="text-[11px] text-gray-500 truncate">{record.type === 'rest' ? '休養日' : names.length > 0 ? names.join('・') : record.category}</div>
                    </div>
                    {record.type === 'workout' && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${done === sets ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{done}/{sets} sets</span>
                    )}
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <RecordDetailModal
          record={detail}
          onClose={() => setDetail(null)}
          onOpenExercise={name => { setDetail(null); setExerciseName(name) }}
        />
      )}
      {exerciseName && (
        <ExerciseDetailModal
          name={exerciseName}
          records={records}
          onClose={() => setExerciseName(null)}
          onOpenRecord={r => { setExerciseName(null); setDetail(r) }}
        />
      )}
    </div>
  )
}
