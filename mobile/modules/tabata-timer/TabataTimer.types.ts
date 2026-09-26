export type NativeTimerType = 'work' | 'rest' | 'tabata_work' | 'tabata_rest'

/**
 * mobile/src/types.tsの`TimerState`のネイティブ版。フィールドは同一だが、
 * こちらはExpo Modulesのイベントペイロードとして送られてくる生の形。
 */
export interface NativeTimerState {
  isActive: boolean
  type: NativeTimerType | null
  endTime: number
  remaining: number
  exIdx: number | null
  setIdx: number | null
  interval: number
  tabataWork: number
  tabataRest: number
  tabataCycles: number
  currentCycle: number
}

export interface TimerCompleteEventPayload {
  exIdx: number | null
  setIdx: number | null
  interval: number
}

export type TabataTimerModuleEvents = {
  onTimerUpdate: (state: NativeTimerState) => void
  onTimerComplete: (payload: TimerCompleteEventPayload) => void
}
