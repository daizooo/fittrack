package expo.modules.tabatatimer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS側（`modules/tabata-timer/index.ts`）から呼ばれるExpo Module本体。
 * 実処理は[TabataTimerService]（前面サービス）に委譲し、このModuleは
 * 「Intentで指示を送る」「Serviceからの状態変化をJSイベントへ中継する」薄い層。
 */
class TabataTimerModule : Module(), TabataTimerService.Listener {

  override fun definition() = ModuleDefinition {
    Name("TabataTimer")

    Events("onTimerUpdate", "onTimerComplete")

    OnCreate {
      TabataTimerService.listener = this@TabataTimerModule
    }

    OnDestroy {
      if (TabataTimerService.listener === this@TabataTimerModule) {
        TabataTimerService.listener = null
      }
    }

    Function("startTimer") { type: String, seconds: Int, exIdx: Int?, setIdx: Int?, interval: Int ->
      val context = appContext.reactContext ?: return@Function
      val timerType = when (type) {
        "work" -> TimerType.WORK
        "rest" -> TimerType.REST
        else -> return@Function
      }
      TabataTimerService.startTimer(context, timerType, seconds, exIdx, setIdx, interval)
    }

    Function("startTabataTimer") { exIdx: Int, setIdx: Int, work: Int, rest: Int, cycles: Int, interval: Int ->
      val context = appContext.reactContext ?: return@Function
      TabataTimerService.startTabataTimer(context, exIdx, setIdx, work, rest, cycles, interval)
    }

    Function("cancelTimer") {
      val context = appContext.reactContext ?: return@Function
      TabataTimerService.cancelTimer(context)
    }
  }

  override fun onTimerUpdate(state: TimerEngine.State) {
    sendEvent("onTimerUpdate", stateToMap(state))
  }

  override fun onTimerComplete(exIdx: Int?, setIdx: Int?, interval: Int) {
    sendEvent("onTimerComplete", mapOf("exIdx" to exIdx, "setIdx" to setIdx, "interval" to interval))
  }

  private fun stateToMap(state: TimerEngine.State): Map<String, Any?> = mapOf(
    "isActive" to state.isActive,
    "type" to state.type?.toJsType(),
    "endTime" to state.endTime,
    "remaining" to state.remaining,
    "exIdx" to state.exIdx,
    "setIdx" to state.setIdx,
    "interval" to state.interval,
    "tabataWork" to state.tabataWork,
    "tabataRest" to state.tabataRest,
    "tabataCycles" to state.tabataCycles,
    "currentCycle" to state.currentCycle
  )

  private fun TimerType.toJsType(): String = when (this) {
    TimerType.WORK -> "work"
    TimerType.REST -> "rest"
    TimerType.TABATA_WORK -> "tabata_work"
    TimerType.TABATA_REST -> "tabata_rest"
  }
}
