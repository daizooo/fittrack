import { useEffect, useRef, useState } from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import {
  addTimerCompleteListener, addTimerUpdateListener, cancelTimer as nativeCancelTimer,
  startTabataTimer as nativeStartTabataTimer, startTimer as nativeStartTimer
} from '../../modules/tabata-timer'
import type { NativeTimerState, TimerCompleteEventPayload } from '../../modules/tabata-timer'
import { defaultTimerState } from './useJsWorkoutTimer'
import type { UseWorkoutTimerOptions } from './useJsWorkoutTimer'
import type { TimerState } from '../types'

// NativeTimerState（modules/tabata-timer/TabataTimer.types.ts）とTimerState（src/types.ts）は
// フィールドが完全に一致する設計（docs/tabata-foreground-service.md §2）。
const toTimerState = (native: NativeTimerState): TimerState => ({ ...native })

/**
 * ネイティブ（Android前面サービス、`modules/tabata-timer/`）委譲版。
 * 状態遷移のロジック自体はTimerEngine.kt（Kotlin）に1:1で移植済みなので、ここでは
 * 二重に持たず、ネイティブから来るイベントをそのままReact stateへ反映するだけの薄いアダプタ。
 */
export function useNativeWorkoutTimer({ onWorkComplete }: UseWorkoutTimerOptions) {
  const [activeTimer, setActiveTimer] = useState<TimerState>(defaultTimerState)

  const onWorkCompleteRef = useRef(onWorkComplete)
  useEffect(() => { onWorkCompleteRef.current = onWorkComplete }, [onWorkComplete])

  // onTimerCompleteイベントの時点でネイティブ側のstateは既にisActive=falseへリセット済みのため、
  // 完了直前のexIdx/setIdx/intervalはイベントのpayloadから、それ以外はここに保持した直前の
  // activeTimerから補ってonWorkCompleteへ渡す。
  const lastActiveTimerRef = useRef(activeTimer)
  useEffect(() => { lastActiveTimerRef.current = activeTimer }, [activeTimer])

  useEffect(() => {
    // Android 13+では通知の表示に実行時許可が必要。前面サービスの起動自体は許可が
    // 無くても失敗しないが、拒否されると通知（残り秒数の表示・中止ボタン）が出せなくなる。
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch((e) => {
        console.error('Failed to request notification permission:', e)
      })
    }
  }, [])

  useEffect(() => {
    const updateSubscription = addTimerUpdateListener((state) => {
      setActiveTimer(toTimerState(state))
    })
    const completeSubscription = addTimerCompleteListener((payload: TimerCompleteEventPayload) => {
      onWorkCompleteRef.current({
        ...lastActiveTimerRef.current,
        exIdx: payload.exIdx,
        setIdx: payload.setIdx,
        interval: payload.interval
      })
    })
    return () => {
      updateSubscription.remove()
      completeSubscription.remove()
    }
  }, [])

  const startTimer = (
    type: 'work' | 'rest', seconds: number,
    exIdx: number | null = null, setIdx: number | null = null, interval = 0
  ) => {
    nativeStartTimer(type, seconds, exIdx, setIdx, interval)
  }

  const startTabataTimer = (
    exIdx: number, setIdx: number, work: number, rest: number, cycles: number, interval: number
  ) => {
    nativeStartTabataTimer(exIdx, setIdx, work, rest, cycles, interval)
  }

  const cancelTimer = () => {
    nativeCancelTimer()
    setActiveTimer(defaultTimerState)
  }

  return { activeTimer, startTimer, startTabataTimer, cancelTimer }
}
