import { requireOptionalNativeModule } from 'expo-modules-core'
import type { EventSubscription } from 'expo-modules-core'
import type {
  NativeTimerState, TabataTimerModuleEvents, TimerCompleteEventPayload
} from './TabataTimer.types'

interface TabataTimerNativeModule {
  addListener<EventName extends keyof TabataTimerModuleEvents>(
    eventName: EventName, listener: TabataTimerModuleEvents[EventName]
  ): EventSubscription
  startTimer(type: 'work' | 'rest', seconds: number, exIdx: number | null, setIdx: number | null, interval: number): void
  startTabataTimer(exIdx: number, setIdx: number, work: number, rest: number, cycles: number, interval: number): void
  cancelTimer(): void
}

// Android専用機能（前面サービス）のため、iOS/Web/Expo Goではモジュール自体が存在しない。
// requireOptionalNativeModuleはその場合throwせずnullを返す。
const nativeModule = requireOptionalNativeModule<TabataTimerNativeModule>('TabataTimer')

/** ネイティブタイマー（Android前面サービス）が使えるかどうか。実行中に変わることはない。 */
export function isNativeTimerAvailable(): boolean {
  return nativeModule !== null
}

function requireModule(): TabataTimerNativeModule {
  if (!nativeModule) {
    throw new Error('TabataTimer native module is not available. Call isNativeTimerAvailable() before using it.')
  }
  return nativeModule
}

export function startTimer(
  type: 'work' | 'rest', seconds: number,
  exIdx: number | null = null, setIdx: number | null = null, interval = 0
): void {
  requireModule().startTimer(type, seconds, exIdx, setIdx, interval)
}

export function startTabataTimer(
  exIdx: number, setIdx: number, work: number, rest: number, cycles: number, interval: number
): void {
  requireModule().startTabataTimer(exIdx, setIdx, work, rest, cycles, interval)
}

export function cancelTimer(): void {
  requireModule().cancelTimer()
}

export function addTimerUpdateListener(callback: (state: NativeTimerState) => void): EventSubscription {
  return requireModule().addListener('onTimerUpdate', callback)
}

export function addTimerCompleteListener(callback: (payload: TimerCompleteEventPayload) => void): EventSubscription {
  return requireModule().addListener('onTimerComplete', callback)
}

export type { NativeTimerState, TimerCompleteEventPayload } from './TabataTimer.types'
