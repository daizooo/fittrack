package expo.modules.tabatatimer

enum class TimerType { WORK, REST, TABATA_WORK, TABATA_REST }

/** Web版`playBeep`呼び出し4種類に対応するサウンドキュー。ファイル名（`res/raw`のリソースキー）と1対1。 */
enum class SoundCue { COUNTDOWN_TICK, TABATA_REST_START, TABATA_WORK_START, TIMER_COMPLETE }

/**
 * `mobile/src/hooks/useJsWorkoutTimer.ts`（旧`useWorkoutTimer.ts`）のreducerロジックを
 * 1:1で移植した状態機械。Androidフレームワーク（Service, Handler等）に一切依存しない
 * 純粋なKotlinクラスなので、`android/src/test/`でJVMだけを使ったユニットテストができる
 * （Robolectricや実機は不要）。呼び出し側（[expo.modules.tabatatimer.TabataTimerService]）が
 * 一定間隔で[tick]をポーリングし、返ってきた[TickResult]に応じて通知の更新・音の再生・
 * JSへのイベント送出を行う。
 */
class TimerEngine(private val now: () -> Long = System::currentTimeMillis) {

  data class State(
    val isActive: Boolean = false,
    val type: TimerType? = null,
    val endTime: Long = 0L,
    val remaining: Int = 0,
    val exIdx: Int? = null,
    val setIdx: Int? = null,
    val interval: Int = 0,
    val tabataWork: Int = 0,
    val tabataRest: Int = 0,
    val tabataCycles: Int = 0,
    val currentCycle: Int = 0
  )

  sealed class TickResult {
    /** このtickでは秒単位の変化が無かった（次のtickも同じ状態を送り直す必要はない）。 */
    data class Unchanged(val state: State) : TickResult()

    /** 残り秒数が変わった、またはフェーズが切り替わった（tabata work⇔rest等）。 */
    data class Updated(val state: State, val cue: SoundCue?) : TickResult()

    /**
     * work（またはタバタ全ラウンド）が終了した。呼び出し側は[SoundCue.TIMER_COMPLETE]を
     * 再生した上で、JS側へonTimerCompleteイベントを送出する（レスト連鎖の開始判断はJS側の責務）。
     */
    data class WorkCompleted(val exIdx: Int?, val setIdx: Int?, val interval: Int) : TickResult()
  }

  var state: State = State()
    private set

  fun start(type: TimerType, seconds: Int, exIdx: Int?, setIdx: Int?, interval: Int): State {
    if (seconds <= 0) return state
    state = State(
      isActive = true,
      type = type,
      endTime = now() + seconds * 1000L,
      remaining = seconds,
      exIdx = exIdx,
      setIdx = setIdx,
      interval = interval,
      tabataWork = 0,
      tabataRest = 0,
      tabataCycles = 0,
      currentCycle = 0
    )
    return state
  }

  fun startTabata(exIdx: Int, setIdx: Int, work: Int, rest: Int, cycles: Int, interval: Int): State {
    if (work <= 0) return state
    state = State(
      isActive = true,
      type = TimerType.TABATA_WORK,
      endTime = now() + work * 1000L,
      remaining = work,
      exIdx = exIdx,
      setIdx = setIdx,
      interval = interval,
      tabataWork = work,
      tabataRest = rest,
      tabataCycles = cycles,
      currentCycle = 1
    )
    return state
  }

  fun cancel(): State {
    state = State()
    return state
  }

  fun tick(): TickResult {
    val current = state
    if (!current.isActive) return TickResult.Unchanged(current)

    val timeLeft = Math.ceil((current.endTime - now()) / 1000.0).toInt()

    if (timeLeft <= 0) {
      return when (current.type) {
        TimerType.TABATA_WORK -> {
          if (current.currentCycle < current.tabataCycles) {
            state = current.copy(
              type = TimerType.TABATA_REST,
              endTime = now() + current.tabataRest * 1000L,
              remaining = current.tabataRest
            )
            TickResult.Updated(state, SoundCue.TABATA_REST_START)
          } else {
            state = State()
            TickResult.WorkCompleted(current.exIdx, current.setIdx, current.interval)
          }
        }
        TimerType.TABATA_REST -> {
          state = current.copy(
            type = TimerType.TABATA_WORK,
            endTime = now() + current.tabataWork * 1000L,
            remaining = current.tabataWork,
            currentCycle = current.currentCycle + 1
          )
          TickResult.Updated(state, SoundCue.TABATA_WORK_START)
        }
        TimerType.WORK -> {
          state = State()
          TickResult.WorkCompleted(current.exIdx, current.setIdx, current.interval)
        }
        // 'rest'（インターバル）の終了はセット完了フラグに影響しないため、WorkCompletedではなく
        // 単なる完了音のUpdatedとして扱う（Web版のonWorkComplete呼び出し条件と一致させる）。
        TimerType.REST, null -> {
          state = State()
          TickResult.Updated(state, SoundCue.TIMER_COMPLETE)
        }
      }
    }

    if (timeLeft != current.remaining) {
      val cue = if (timeLeft in 1..5) SoundCue.COUNTDOWN_TICK else null
      state = current.copy(remaining = timeLeft)
      return TickResult.Updated(state, cue)
    }

    return TickResult.Unchanged(current)
  }
}
