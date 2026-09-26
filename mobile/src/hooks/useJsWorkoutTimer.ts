import { useEffect, useRef, useState } from 'react'
import { useAudioPlayer, type AudioPlayer } from 'expo-audio'
import type { TimerState } from '../types'

import countdownTickSound from '../assets/sounds/countdown-tick.wav'
import tabataRestStartSound from '../assets/sounds/tabata-rest-start.wav'
import tabataWorkStartSound from '../assets/sounds/tabata-work-start.wav'
import timerCompleteSound from '../assets/sounds/timer-complete.wav'

export const defaultTimerState: TimerState = {
  isActive: false, type: null, endTime: 0, remaining: 0,
  exIdx: null, setIdx: null, interval: 0,
  tabataWork: 0, tabataRest: 0, tabataCycles: 0, currentCycle: 0
}

const playSound = (player: AudioPlayer) => {
  try {
    player.seekTo(0)
    player.play()
  } catch (e) {
    console.error('Sound play failed:', e)
  }
}

export interface UseWorkoutTimerOptions {
  /** work（またはタバタ全ラウンド）が終了した瞬間に一度だけ呼ばれる。セット完了フラグの更新はここで行う。 */
  onWorkComplete: (timerState: TimerState) => void
}

/**
 * Web版(FitTrack.tsx)のsetInterval(100ms)+Date.now()差分によるタイマー状態機械を移植したもの。
 * アプリがフォアグラウンドの間だけ正確に動く。
 *
 * ネイティブモジュール（Android前面サービス、`modules/tabata-timer/`）が使える環境では
 * `useWorkoutTimer`はこちらではなく`useNativeWorkoutTimer`に処理を委譲する。このフックは
 * Expo Go／ネイティブモジュール未リンク時（Android以外・開発中など）のフォールバックとして残す。
 */
export function useJsWorkoutTimer({ onWorkComplete }: UseWorkoutTimerOptions) {
  const [activeTimer, setActiveTimer] = useState<TimerState>(defaultTimerState)
  const activeTimerRef = useRef(activeTimer)
  useEffect(() => { activeTimerRef.current = activeTimer }, [activeTimer])

  const onWorkCompleteRef = useRef(onWorkComplete)
  useEffect(() => { onWorkCompleteRef.current = onWorkComplete }, [onWorkComplete])

  const tickPlayer = useAudioPlayer(countdownTickSound)
  const restStartPlayer = useAudioPlayer(tabataRestStartSound)
  const workStartPlayer = useAudioPlayer(tabataWorkStartSound)
  const completePlayer = useAudioPlayer(timerCompleteSound)

  const startTimer = (
    type: 'work' | 'rest', seconds: number,
    exIdx: number | null = null, setIdx: number | null = null, interval = 0
  ) => {
    if (!seconds || seconds <= 0) return
    const end = Date.now() + seconds * 1000
    setActiveTimer({
      isActive: true, type, endTime: end, remaining: seconds, exIdx, setIdx, interval,
      tabataWork: 0, tabataRest: 0, tabataCycles: 0, currentCycle: 0
    })
  }

  const startTabataTimer = (
    exIdx: number, setIdx: number, work: number, rest: number, cycles: number, interval: number
  ) => {
    if (!work || work <= 0) return
    const end = Date.now() + work * 1000
    setActiveTimer({
      isActive: true, type: 'tabata_work', endTime: end, remaining: work, exIdx, setIdx, interval,
      tabataWork: work, tabataRest: rest, tabataCycles: cycles, currentCycle: 1
    })
  }

  const cancelTimer = () => setActiveTimer(defaultTimerState)

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>
    if (activeTimer.isActive) {
      timerId = setInterval(() => {
        const now = Date.now()
        const timerState = activeTimerRef.current
        const timeLeft = Math.ceil((timerState.endTime - now) / 1000)

        if (timeLeft <= 0) {
          clearInterval(timerId)
          if (timerState.type === 'tabata_work') {
            if (timerState.currentCycle < timerState.tabataCycles) {
              playSound(restStartPlayer)
              const end = Date.now() + timerState.tabataRest * 1000
              setActiveTimer(prev => ({ ...prev, type: 'tabata_rest', endTime: end, remaining: prev.tabataRest }))
            } else {
              playSound(completePlayer)
              setActiveTimer(defaultTimerState)
              onWorkCompleteRef.current(timerState)
            }
          } else if (timerState.type === 'tabata_rest') {
            playSound(workStartPlayer)
            const end = Date.now() + timerState.tabataWork * 1000
            setActiveTimer(prev => ({ ...prev, type: 'tabata_work', endTime: end, remaining: prev.tabataWork, currentCycle: prev.currentCycle + 1 }))
          } else {
            playSound(completePlayer)
            setActiveTimer(defaultTimerState)
            if (timerState.type === 'work') onWorkCompleteRef.current(timerState)
          }
        } else if (timeLeft !== timerState.remaining) {
          if (timeLeft <= 5 && timeLeft > 0) playSound(tickPlayer)
          setActiveTimer(prev => ({ ...prev, remaining: timeLeft }))
        }
      }, 100)
    }
    return () => clearInterval(timerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimer.isActive, activeTimer.endTime])

  return { activeTimer, startTimer, startTabataTimer, cancelTimer }
}
