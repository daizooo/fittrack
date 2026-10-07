import React, { useEffect, useMemo, useState } from 'react'
import {
  Play, Moon, CheckCircle, ChevronLeft, Minus, Plus, Timer, Sunrise, Sunset, Clock, Star, PlayCircle, Repeat, ChevronDown
} from 'lucide-react'
import { buildSession, estimatePlanMinutes, lastPerformedMap, recommendPlanId, segmentExercises } from '../lib/plans'
import { daysAgo, daysOfWeek, formatDaysAgo, isSameDay } from '../lib/dates'
import { EquipmentSelector, NumberField, NumberInputStepper } from './ui'
import type {
  EquipmentOption, SessionData, SessionExercise, SetData, StretchPhase, TimerState, WorkoutPlan, WorkoutRecord
} from '../types'

export interface TimerControls {
  activeTimer: TimerState
  startTimer: (type: 'work' | 'rest', seconds: number, exIdx?: number | null, setIdx?: number | null, interval?: number) => void
  startTabataTimer: (exIdx: number, setIdx: number, work: number, rest: number, cycles: number, interval: number) => void
  startStretchTimer: (phase: StretchPhase, idx: number, chain: boolean) => void
  stopTimer: () => void
  pauseTimer: () => void
  resumeTimer: () => void
}

interface WorkoutTabProps {
  plans: WorkoutPlan[]
  records: WorkoutRecord[]
  equipmentOptionsMap: Map<string, EquipmentOption[]>
  session: SessionData | null
  setSession: React.Dispatch<React.SetStateAction<SessionData | null>>
  timer: TimerControls
  onSaveWorkout: () => void
  onRest: () => void
  onCancel: () => void
  onGoToPlans: () => void
}

// ─── Stretch section (in session) ────────────────────────────────────────────

const StretchSection = ({ phase, session, setSession, timer }: {
  phase: StretchPhase
  session: SessionData
  setSession: WorkoutTabProps['setSession']
  timer: TimerControls
}) => {
  const items = session.stretches[phase]
  if (items.length === 0) return null
  const done = items.filter(s => s.completed).length
  const firstOpen = items.findIndex(s => !s.completed)
  const isWarmup = phase === 'warmup'
  const Icon = isWarmup ? Sunrise : Sunset
  const running = timer.activeTimer.isActive && timer.activeTimer.stretch?.phase === phase ? timer.activeTimer.stretch.idx : null

  const toggle = (idx: number) => setSession(prev => prev && ({
    ...prev,
    stretches: {
      ...prev.stretches,
      [phase]: prev.stretches[phase].map((s, i) => (i === idx ? { ...s, completed: !s.completed } : s))
    }
  }))

  return (
    <div className={`rounded-2xl border-2 mb-6 overflow-hidden ${isWarmup ? 'border-amber-200 bg-amber-50/50' : 'border-teal-200 bg-teal-50/50'}`}>
      <div className="p-3 flex items-center justify-between gap-2">
        <h3 className={`font-black text-sm flex items-center gap-1.5 ${isWarmup ? 'text-amber-700' : 'text-teal-700'}`}>
          <Icon size={16} />{isWarmup ? 'ウォームアップ' : 'クールダウン'}
          <span className="text-[10px] font-bold opacity-70">{done}/{items.length}</span>
        </h3>
        {firstOpen >= 0 && (
          <button
            onClick={() => timer.startStretchTimer(phase, firstOpen, true)}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 text-white active:scale-95 ${isWarmup ? 'bg-amber-500' : 'bg-teal-500'}`}
          >
            <PlayCircle size={14} />{done === 0 ? 'まとめて開始' : '続きから開始'}
          </button>
        )}
      </div>
      <div className="px-2 pb-2 space-y-1.5">
        {items.map((s, idx) => (
          <div key={s.id} className={`flex items-center gap-2 p-2 rounded-xl ${s.completed ? 'bg-green-50' : 'bg-white'} ${running === idx ? 'ring-2 ring-orange-400' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-bold truncate ${s.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{s.name}</div>
              <div className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5"><Timer size={10} />{s.seconds}秒</div>
            </div>
            <button
              onClick={() => timer.startStretchTimer(phase, idx, false)}
              disabled={s.completed}
              aria-label={`${s.name}のタイマーを開始`}
              className={`w-10 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all ${s.completed ? 'bg-gray-100 text-gray-300' : 'bg-orange-500 text-white active:scale-95'}`}
            >
              <Play size={16} fill="currentColor" className="ml-0.5" />
            </button>
            <button
              onClick={() => toggle(idx)}
              aria-label={`${s.name}を完了`}
              className={`w-10 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all ${s.completed ? 'text-white bg-green-500' : 'text-gray-400 bg-gray-100 active:bg-gray-200'}`}
            >
              <CheckCircle size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Circuit card (in session) ───────────────────────────────────────────────

/**
 * サーキットは「1周ごとに全種目を順にこなす」形で表示する。
 * セット数・休憩は種目ごとではなくサーキット共通（周回数・運動秒数・休憩秒数）として扱う。
 */
const CircuitSessionCard = ({ items, start, timer, onSetUpdate, onToggle, onRounds }: {
  items: SessionExercise[]
  start: number
  timer: TimerControls
  onSetUpdate: (exerciseIndex: number, setIndex: number, field: keyof SetData, value: number) => void
  onToggle: (exerciseIndex: number, setIndex: number) => void
  onRounds: (start: number, count: number, delta: number) => void
}) => {
  const rounds = items[0].sets.length
  const rest = items[0].interval
  const doneCount = items.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0)
  // 同じ種目が周回数ぶん並んで長くなるので、いま取り組む周だけを開き、ほかの周は1行に畳む（タップで開閉）
  const [toggled, setToggled] = useState<Record<number, boolean>>({})
  const currentRound = Array.from({ length: rounds }, (_, r) => r).find(r => items.some(ex => !ex.sets[r].completed)) ?? -1
  const isOpen = (r: number) => (r in toggled ? toggled[r] : r === currentRound)
  useEffect(() => { setToggled({}) }, [currentRound]) // 次の周へ進んだら、手動の開閉は忘れて「現在の周だけ開く」に戻す
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-emerald-200 mb-6">
      <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-black text-[15px] text-emerald-800 flex items-center gap-2 leading-tight">
          <Repeat size={16} />サーキット
          <span className="text-[10px] font-bold opacity-70">{doneCount}/{items.length * rounds}</span>
        </h3>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5"><Timer size={10} />休憩 {rest}秒</span>
          <div className="flex items-center gap-1 bg-white border border-emerald-200 rounded-md p-0.5 shadow-sm">
            <button onClick={() => onRounds(start, items.length, -1)} aria-label="周回を減らす" className="p-0.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"><Minus size={12} /></button>
            <span className="text-[10px] font-bold text-gray-600 px-1">{rounds} 周</span>
            <button onClick={() => onRounds(start, items.length, 1)} aria-label="周回を増やす" className="p-0.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"><Plus size={12} /></button>
          </div>
        </div>
      </div>
      <div className="p-2 space-y-3">
        {Array.from({ length: rounds }, (_, r) => {
          const roundDone = items.filter(ex => ex.sets[r].completed).length
          const allDone = roundDone === items.length
          const open = isOpen(r)
          return (
          <div key={r}>
            <button
              onClick={() => setToggled(prev => ({ ...prev, [r]: !open }))}
              aria-expanded={open} aria-label={`${r + 1}周目を${open ? '閉じる' : '開く'}`}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left active:scale-[0.99] transition-transform ${open ? 'mb-1' : allDone ? 'bg-green-50' : 'bg-gray-50'}`}
            >
              <span className={`text-[10px] font-black tracking-widest ${allDone ? 'text-green-600' : 'text-emerald-600'}`}>{r + 1}周目</span>
              {allDone && <CheckCircle size={14} className="text-green-500" />}
              <span className="text-[10px] font-bold text-gray-400">{roundDone}/{items.length}</span>
              {!open && <span className="text-[10px] text-gray-400 truncate flex-1 min-w-0">{items.map(ex => ex.name).join(' / ')}</span>}
              <ChevronDown size={14} className={`ml-auto flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="space-y-1.5">
              {items.map((ex, i) => {
                const set = ex.sets[r]
                const exIdx = start + i
                const hasWeight = ex.options.length > 1
                return (
                  <div key={ex.id} className={`flex items-center gap-2 p-2 rounded-xl ${set.completed ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold truncate ${set.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{ex.name}</div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold">
                        <NumberField value={set.reps} min={1} max={999} aria-label={`${ex.name} ${r + 1}周目の運動秒数`} onChange={v => onSetUpdate(exIdx, r, 'reps', v)} className="w-9 bg-white border border-gray-200 rounded text-center outline-none p-0.5" />秒
                      </div>
                    </div>
                    {hasWeight && (
                      <select
                        value={set.weight} aria-label={`${ex.name} ${r + 1}周目の負荷`}
                        onChange={e => onSetUpdate(exIdx, r, 'weight', Number(e.target.value))}
                        className="h-9 max-w-[92px] px-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-800 outline-none"
                      >
                        {ex.options.map((o, oi) => <option key={oi} value={o.weight}>{o.label}</option>)}
                      </select>
                    )}
                    <button
                      onClick={() => timer.startTimer('work', set.reps, exIdx, r, ex.interval)}
                      disabled={set.completed}
                      aria-label={`${ex.name} ${r + 1}周目のタイマーを開始`}
                      className={`w-10 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all ${set.completed ? 'bg-gray-100 text-gray-300' : 'bg-orange-500 text-white active:scale-95'}`}
                    >
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </button>
                    <button
                      data-testid="set-check" onClick={() => onToggle(exIdx, r)}
                      aria-label={`${ex.name} ${r + 1}周目を完了`}
                      className={`w-10 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all ${set.completed ? 'text-white bg-green-500' : 'text-gray-400 bg-gray-100 active:bg-gray-200'}`}
                    >
                      <CheckCircle size={22} />
                    </button>
                  </div>
                )
              })}
            </div>}
          </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Active session ──────────────────────────────────────────────────────────

const ActiveSession = ({ session, setSession, timer, onSaveWorkout, onCancel }: {
  session: SessionData
  setSession: WorkoutTabProps['setSession']
  timer: TimerControls
  onSaveWorkout: () => void
  onCancel: () => void
}) => {
  const handleSetUpdate = (exerciseIndex: number, setIndex: number, field: keyof SetData, value: number) => {
    setSession(prev => prev && ({
      ...prev,
      exercises: prev.exercises.map((ex, ei) => ei !== exerciseIndex ? ex : {
        ...ex,
        sets: ex.sets.map((s, si) => (si !== setIndex ? s : { ...s, [field]: Math.round(value * 100) / 100 }))
      })
    }))
  }

  const handleSetCountChange = (exerciseIndex: number, delta: number) => {
    setSession(prev => {
      if (!prev) return prev
      const currentSets = prev.exercises[exerciseIndex].sets
      const newCount = currentSets.length + delta
      if (newCount < 1) return prev
      const newSets = [...currentSets]
      if (delta > 0) {
        const last = currentSets[currentSets.length - 1] || { reps: 0, weight: 0, tabataWork: 0, tabataRest: 0, tabataCycles: 0 }
        newSets.push({ setNumber: newCount, reps: last.reps, weight: last.weight, completed: false, tabataWork: last.tabataWork, tabataRest: last.tabataRest, tabataCycles: last.tabataCycles })
      } else {
        newSets.pop()
      }
      return { ...prev, exercises: prev.exercises.map((ex, ei) => (ei === exerciseIndex ? { ...ex, sets: newSets, targetSets: newCount } : ex)) }
    })
  }

  // サーキットの周回数は全ステーション共通なので、まとめて増減する
  const handleRoundsChange = (start: number, count: number, delta: number) => {
    for (let i = 0; i < count; i++) handleSetCountChange(start + i, delta)
  }

  const handleExerciseUpdate = (exerciseIndex: number, field: keyof SessionExercise, value: number) => {
    setSession(prev => prev && ({
      ...prev,
      exercises: prev.exercises.map((ex, ei) => (ei === exerciseIndex ? { ...ex, [field]: value } : ex))
    }))
  }

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    const isCompletedNow = !session.exercises[exerciseIndex].sets[setIndex].completed
    setSession(prev => prev && ({
      ...prev,
      exercises: prev.exercises.map((ex, ei) => ei !== exerciseIndex ? ex : {
        ...ex, sets: ex.sets.map((s, si) => (si === setIndex ? { ...s, completed: isCompletedNow } : s))
      })
    }))

    if (isCompletedNow) {
      const ex = session.exercises[exerciseIndex]
      let shouldRest = true
      if (ex.supersetGroup && !ex.circuit) {
        // スーパーセットは、グループ最後の種目の後だけ休憩する（サーキットは各ステーションの後に休憩）
        const lastGroupIdx = session.exercises.reduce((last, e, i) => (e.supersetGroup === ex.supersetGroup ? i : last), -1)
        shouldRest = exerciseIndex === lastGroupIdx
      }
      if (shouldRest && ex.interval > 0) timer.startTimer('rest', ex.interval)
    }
  }

  return (
    <div className="pb-36 max-w-2xl mx-auto p-3 relative">
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg flex justify-between items-center sticky top-2 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onCancel} aria-label="トレーニングを中止" className="p-1 hover:bg-white/20 rounded-lg transition-colors active:scale-95">
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight truncate">{session.category}</h2>
            <p className="text-blue-100 text-[10px] font-medium">{session.date}</p>
          </div>
        </div>
        <button onClick={onSaveWorkout} className="bg-white text-blue-600 px-3 py-2 rounded-xl font-bold shadow-sm active:scale-95 transition-transform text-sm flex-shrink-0">完了して保存</button>
      </div>

      <StretchSection phase="warmup" session={session} setSession={setSession} timer={timer} />

      {segmentExercises(session.exercises).map(seg => {
        if (seg.kind === 'circuit') {
          return (
            <CircuitSessionCard
              key={seg.group} items={seg.items} start={seg.start} timer={timer}
              onSetUpdate={handleSetUpdate} onToggle={toggleSetComplete} onRounds={handleRoundsChange}
            />
          )
        }
        const exIdx = seg.start
        const ex = seg.items[0]
        const nextSessionEx = session.exercises[exIdx + 1]
        const isSessionInSuperset = !!ex.supersetGroup
        const isSessionLinkedToNext = isSessionInSuperset && nextSessionEx?.supersetGroup === ex.supersetGroup
        return (
          <React.Fragment key={exIdx}>
            <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isSessionInSuperset ? 'border-2 border-purple-200' : 'border border-gray-100'} ${isSessionLinkedToNext ? 'mb-0 rounded-b-lg' : 'mb-6'}`}>
              <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
                <h3 className="font-bold text-[15px] text-gray-800 flex items-center gap-2 leading-tight">
                  <span className="bg-blue-100 text-blue-600 w-6 h-6 flex justify-center items-center rounded-full text-xs flex-shrink-0">{exIdx + 1}</span>
                  {ex.name}
                  {ex.inherited && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-black tracking-wider ml-1">前回引継</span>}
                  {isSessionInSuperset && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-black tracking-wider ml-1">SS</span>}
                </h3>
                <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                  <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-md p-0.5 shadow-sm">
                    <button onClick={() => handleSetCountChange(exIdx, -1)} aria-label="セットを減らす" className="p-0.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"><Minus size={12} /></button>
                    <span className="text-[10px] font-bold text-gray-600 px-1">{ex.targetSets} Sets</span>
                    <button onClick={() => handleSetCountChange(exIdx, 1)} aria-label="セットを増やす" className="p-0.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"><Plus size={12} /></button>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-white border border-gray-200 pl-1.5 pr-0.5 py-0.5 rounded-md shadow-sm">
                    <Timer size={10} />
                    <select
                      value={ex.interval}
                      onChange={(e) => handleExerciseUpdate(exIdx, 'interval', Number(e.target.value))}
                      className="bg-transparent outline-none font-bold text-gray-700 cursor-pointer text-right appearance-none"
                    >
                      {Array.from(new Set([0, 30, 45, 60, 90, 120, 150, 180, ex.interval])).sort((a, b) => a - b).map(sec => <option key={sec} value={sec}>{sec}s</option>)}
                    </select>
                    <span className="text-[8px] opacity-50">▼</span>
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {ex.sets.map((set, setIdx) => (
                  <div key={setIdx} className={`flex items-center gap-2 p-2 rounded-xl transition-all ${set.completed ? 'bg-green-50' : ''}`}>
                    {ex.type === 'tabata' ? (
                      <>
                        <div className="w-8 font-black text-gray-400 text-[10px] flex-shrink-0 text-center tracking-widest leading-tight flex flex-col justify-center">
                          RND<br /><span className="text-sm">{set.setNumber}</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center mx-1 py-1 gap-1 bg-white border border-gray-200 rounded-xl shadow-inner">
                          <div className="flex justify-center items-center gap-1 text-[11px] font-bold tracking-tight">
                            <span className="flex items-center text-orange-500">
                              <NumberField value={set.tabataWork ?? 20} min={1} max={600} onChange={v => handleSetUpdate(exIdx, setIdx, 'tabataWork', v)} className="w-7 bg-transparent border-b border-orange-200 text-center outline-none p-0 focus:border-orange-500" />s
                            </span>
                            <span className="text-gray-300">/</span>
                            <span className="flex items-center text-blue-500">
                              <NumberField value={set.tabataRest ?? 10} min={1} max={600} onChange={v => handleSetUpdate(exIdx, setIdx, 'tabataRest', v)} className="w-7 bg-transparent border-b border-blue-200 text-center outline-none p-0 focus:border-blue-500" />s
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-gray-500 flex items-center">
                            <NumberField value={set.tabataCycles ?? 8} min={1} max={50} onChange={v => handleSetUpdate(exIdx, setIdx, 'tabataCycles', v)} className="w-6 bg-transparent border-b border-gray-300 text-center outline-none p-0 focus:border-gray-500" />
                            <span className="ml-1 opacity-70">Cycles</span>
                          </div>
                        </div>
                        <button
                          onClick={() => timer.startTabataTimer(exIdx, setIdx, set.tabataWork ?? 20, set.tabataRest ?? 10, set.tabataCycles ?? 8, ex.interval)}
                          className={`w-10 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all shadow-sm mr-1 ${set.completed ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'}`}
                          disabled={set.completed}
                        >
                          <Play size={18} fill="currentColor" className="ml-0.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-6 text-center font-bold text-gray-400 text-sm flex-shrink-0">{set.setNumber}</div>
                        <div className="flex gap-2 flex-1 justify-end min-w-0 pr-1">
                          <EquipmentSelector label="負荷/機材" value={set.weight} options={ex.options} onChange={(v) => handleSetUpdate(exIdx, setIdx, 'weight', v)} />
                          <NumberInputStepper label={ex.type === 'duration' ? '秒数' : '回数'} value={set.reps} step={1} min={0} max={999} onChange={(v) => handleSetUpdate(exIdx, setIdx, 'reps', v)} />
                        </div>
                        {ex.type === 'duration' && (
                          <button
                            onClick={() => timer.startTimer('work', set.reps, exIdx, setIdx, ex.interval)}
                            className={`w-10 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all shadow-sm mr-1 ${set.completed ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'}`}
                            disabled={set.completed}
                          >
                            <Play size={18} fill="currentColor" className="ml-0.5" />
                          </button>
                        )}
                      </>
                    )}
                    <button data-testid="set-check" onClick={() => toggleSetComplete(exIdx, setIdx)} className={`w-12 h-10 flex-shrink-0 flex justify-center items-center rounded-xl transition-all ${set.completed ? 'text-white bg-green-500 shadow-md shadow-green-500/30' : 'text-gray-400 bg-gray-100 active:bg-gray-200'}`}>
                      <CheckCircle size={24} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {isSessionLinkedToNext && (
              <div className="flex items-center justify-center h-8 bg-purple-50 border-x-2 border-purple-200 -mt-px">
                <span className="text-[9px] font-bold text-purple-500">⚡ 続けて実施（スーパーセット）</span>
              </div>
            )}
          </React.Fragment>
        )
      })}

      <StretchSection phase="cooldown" session={session} setSession={setSession} timer={timer} />
    </div>
  )
}

// ─── Plan picker (idle) ──────────────────────────────────────────────────────

export default function WorkoutTab(props: WorkoutTabProps) {
  const { plans, records, equipmentOptionsMap, session, setSession, timer, onSaveWorkout, onRest, onCancel, onGoToPlans } = props
  const recommendedId = useMemo(() => recommendPlanId(plans, records), [plans, records])
  const [selectedId, setSelectedId] = useState<string | null>(recommendedId)
  const lastPerformed = useMemo(() => lastPerformedMap(records), [records])

  if (session) {
    return <ActiveSession session={session} setSession={setSession} timer={timer} onSaveWorkout={onSaveWorkout} onCancel={onCancel} />
  }

  const now = new Date()
  const todayRecord = records.find(r => isSameDay(new Date(r.fullDate), now))
  const selected = plans.find(p => p.id === selectedId) ?? null

  return (
    <div className="pb-28 max-w-lg mx-auto p-5">
      <div className="mb-6 text-center mt-2">
        <p className="text-blue-500 font-bold text-xs tracking-wider mb-1">TODAY</p>
        <h2 className="text-3xl font-black text-gray-800 tracking-tight">
          {now.getMonth() + 1}/{now.getDate()} <span className="text-xl text-gray-400 font-bold">({daysOfWeek[now.getDay()]})</span>
        </h2>
        {todayRecord && (
          <p className="mt-2 text-xs font-bold text-green-600 bg-green-50 inline-block px-3 py-1 rounded-full">
            ✓ 今日は記録済み（{todayRecord.type === 'rest' ? '休養' : todayRecord.category}）
          </p>
        )}
      </div>

      <h3 className="text-sm font-black text-gray-700 mb-3">今日のプランを選ぶ</h3>

      {plans.length === 0 ? (
        <div className="bg-white rounded-3xl p-6 border border-dashed border-gray-200 text-center mb-4">
          <p className="text-gray-400 text-sm mb-4">プランがまだありません</p>
          <button onClick={onGoToPlans} className="px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm active:scale-95">プランを作成する</button>
        </div>
      ) : (
        <div className="space-y-2 mb-6" role="radiogroup" aria-label="今日のプラン">
          {plans.map(plan => {
            const isSelected = plan.id === selectedId
            const last = lastPerformed.get(plan.name)
            return (
              <button
                key={plan.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedId(plan.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${isSelected ? 'border-blue-600 bg-blue-50/60 shadow-sm' : 'border-gray-100 bg-white'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-gray-800 leading-tight">{plan.name}</span>
                  {plan.id === recommendedId && (
                    <span className="text-[9px] font-black bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0"><Star size={9} fill="currentColor" />おすすめ</span>
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-[11px] font-bold text-gray-500">
                  <span>{plan.exercises.length}種目</span>
                  <span className="flex items-center gap-0.5"><Clock size={10} />約{estimatePlanMinutes(plan)}分</span>
                  <span className="text-gray-400">{last ? `前回 ${formatDaysAgo(daysAgo(last))}` : '未実施'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4">
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-1">
            {selected.warmup.length > 0 && (
              <div className="text-xs text-amber-700 font-bold flex items-center gap-1 pb-1"><Sunrise size={12} />ウォームアップ {selected.warmup.length}項目</div>
            )}
            {selected.exercises.map((ex, i) => {
              if (ex.type === 'circuit') {
                return (
                  <div key={ex.id} className="text-sm text-gray-700 flex items-center justify-between py-0.5 border-l-2 border-emerald-400 pl-2 -ml-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1 rounded font-black flex-shrink-0">サーキット</span>
                      <span className="truncate">{(ex.stations ?? []).map(x => x.name).join(' → ')}</span>
                    </div>
                    <span className="text-gray-400 text-xs flex-shrink-0 ml-2">{ex.targetSets}周</span>
                  </div>
                )
              }
              const next = selected.exercises[i + 1]
              const inSS = !!ex.supersetGroup
              const linked = inSS && next?.supersetGroup === ex.supersetGroup
              return (
                <React.Fragment key={ex.id}>
                  <div className={`text-sm text-gray-700 flex items-center justify-between py-0.5 ${inSS ? 'border-l-2 border-purple-400 pl-2 -ml-2' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${inSS ? 'bg-purple-400' : 'bg-blue-500'}`}></span>
                      {ex.name}
                      {inSS && <span className="text-[8px] bg-purple-100 text-purple-600 px-1 rounded font-black">SS</span>}
                    </div>
                    <span className="text-gray-400 text-xs">{ex.targetSets}セット</span>
                  </div>
                  {linked && <div className="text-[9px] text-purple-400 font-bold pl-3 -my-0.5">↕ 続けて実施</div>}
                </React.Fragment>
              )
            })}
            {selected.cooldown.length > 0 && (
              <div className="text-xs text-teal-700 font-bold flex items-center gap-1 pt-1"><Sunset size={12} />クールダウン {selected.cooldown.length}項目</div>
            )}
          </div>
          {(selected.exercises.length > 0 || selected.warmup.length > 0 || selected.cooldown.length > 0) && (
            <button
              onClick={() => setSession(buildSession(selected, records, equipmentOptionsMap))}
              className="w-full mt-4 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/30 flex justify-center gap-2 active:scale-95 transition-transform"
            >
              <Play size={20} /> トレーニングを開始する
            </button>
          )}
        </div>
      )}

      <button onClick={onRest} className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl flex justify-center gap-2 active:scale-95 transition-transform">
        <Moon size={20} /> 今日は休養する
      </button>
    </div>
  )
}
