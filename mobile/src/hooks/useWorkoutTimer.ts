import { useState } from 'react'
import { isNativeTimerAvailable } from '../../modules/tabata-timer'
import { useJsWorkoutTimer } from './useJsWorkoutTimer'
import type { UseWorkoutTimerOptions } from './useJsWorkoutTimer'
import { useNativeWorkoutTimer } from './useNativeWorkoutTimer'

export { defaultTimerState } from './useJsWorkoutTimer'
export type { UseWorkoutTimerOptions } from './useJsWorkoutTimer'

/**
 * work/rest/タバタタイマーの入口。ネイティブモジュール（Android前面サービス）が
 * リンクされていればそちらへ委譲し、無ければJS側フォールバック（Expo Go・iOS・開発中等）
 * を使う。`WorkoutRecordScreen.tsx`側はこの切り替えを意識せず、常に同じ
 * `{ activeTimer, startTimer, startTabataTimer, cancelTimer }`の形を受け取る
 * （docs/tabata-foreground-service.md §2）。
 */
export function useWorkoutTimer(options: UseWorkoutTimerOptions) {
  // ネイティブモジュールの有無はアプリの実行中に変わらないので、レンダーごとの分岐ではなく
  // マウント時に固定した値で切り替える（呼び出し先フックの数・順序が実行中に変わらないことが
  // 保証されているため、Rules of Hooksの例外として許容されるパターン）。
  const [useNative] = useState(() => isNativeTimerAvailable())
  return useNative ? useNativeWorkoutTimer(options) : useJsWorkoutTimer(options)
}
