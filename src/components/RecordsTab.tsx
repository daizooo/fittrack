import { useMemo, useState } from 'react'
import { BarChart3, CalendarDays, CheckCircle, ChevronRight, Flame, Moon, Target, Trophy, X, Zap, Sunrise, Sunset } from 'lucide-react'
import { computeStats, filterRecordsByPeriod, monthCalendarCells, workoutDaysByMonth, type PeriodMode } from '../lib/stats'
import { isSameDay } from '../lib/dates'
import { PeriodFilter } from './ui'
import type { SessionExercise, WorkoutRecord } from '../types'

const barColors = ['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500']

const setLabel = (ex: SessionExercise, s: SessionExercise['sets'][number]) => {
  if (ex.type === 'tabata') return `${s.tabataWork}s/${s.tabataRest}s × ${s.tabataCycles}`
  const load = s.weight ? (ex.options?.find(o => o.weight === s.weight)?.label ?? `${s.weight > 0 ? '+' : ''}${s.weight}kg`) : null
  const amount = ex.type === 'duration' ? `${s.reps}秒` : `${s.reps}回`
  return load ? `${load} × ${amount}` : amount
}

// ─── Record detail modal ─────────────────────────────────────────────────────

export const RecordDetailModal = ({ record, onClose }: { record: WorkoutRecord; onClose: () => void }) => {
  const stretchLine = (label: string, list: { completed: boolean }[] | undefined, Icon: typeof Sunrise, cls: string) =>
    list && list.length > 0 ? (
      <div className={`flex items-center justify-between text-xs font-bold px-3 py-2 rounded-xl ${cls}`}>
        <span className="flex items-center gap-1"><Icon size={12} />{label}</span>
        <span>{list.filter(s => s.completed).length} / {list.length}</span>
      </div>
    ) : null

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-5" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="閉じる" className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-600" /></button>
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
                      <div className="font-bold text-sm text-gray-800">{ex.name}</div>
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
        <button onClick={onClose} className="mt-6 w-full py-3 bg-gray-900 text-white font-bold rounded-xl active:scale-95 transition-transform">閉じる</button>
      </div>
    </div>
  )
}

// ─── Records tab (履歴＋分析) ────────────────────────────────────────────────

export default function RecordsTab({ records }: { records: WorkoutRecord[] }) {
  const [mode, setMode] = useState<PeriodMode>('month')
  const [anchor, setAnchor] = useState(new Date())
  const [detail, setDetail] = useState<WorkoutRecord | null>(null)

  const periodRecords = useMemo(() => filterRecordsByPeriod(records, mode, anchor), [records, mode, anchor])
  const stats = useMemo(() => computeStats(periodRecords), [periodRecords])
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

        {/* プラン別内訳 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
            <BarChart3 size={18} className="text-indigo-500" /> プラン別の実施回数
          </h3>
          {stats.planBreakdown.length === 0 ? (
            <div className="text-center text-gray-400 py-4 text-sm">データがありません</div>
          ) : (
            <div className="space-y-4">
              {stats.planBreakdown.map((item, i) => (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-1 font-medium text-gray-600">
                    <span className="flex items-center gap-1">{i === 0 && <Trophy size={12} className="text-yellow-500" />}{item.name}</span>
                    <span>{item.count}回 ({item.pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className={`${barColors[i % barColors.length]} h-2.5 rounded-full`} style={{ width: `${item.pct}%` }}></div>
                  </div>
                </div>
              ))}
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
                return (
                  <button key={record.id} onClick={() => setDetail(record)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                    {record.type === 'rest'
                      ? <div className="p-1.5 bg-gray-100 rounded-lg"><Moon size={16} className="text-gray-400" /></div>
                      : <div className="p-1.5 bg-blue-100 rounded-lg"><Flame size={16} className="text-blue-600" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 text-sm">{record.date} ({record.day})</div>
                      <div className="text-[11px] text-gray-500 truncate">{record.type === 'rest' ? '休養日' : record.category}</div>
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

      {detail && <RecordDetailModal record={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
