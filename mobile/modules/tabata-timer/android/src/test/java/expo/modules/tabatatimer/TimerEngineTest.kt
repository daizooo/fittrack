package expo.modules.tabatatimer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [TimerEngine]はAndroidフレームワークに依存しない純粋なKotlinクラスなので、
 * Robolectricや実機を使わずJVMだけでロジック（Web版`useWorkoutTimer.ts`からの
 * 移植箇所）を検証できる。`./gradlew :tabata-timer:testDebugUnitTest`で実行する。
 */
class TimerEngineTest {

  private class FakeClock(var now: Long = 1_000_000L) {
    fun advance(ms: Long) { now += ms }
  }

  @Test
  fun `work timer counts down and fires WorkCompleted at zero`() {
    val clock = FakeClock()
    val engine = TimerEngine(now = { clock.now })

    engine.start(TimerType.WORK, seconds = 3, exIdx = 0, setIdx = 1, interval = 60)
    assertTrue(engine.state.isActive)
    assertEquals(3, engine.state.remaining)

    clock.advance(1000)
    val tick1 = engine.tick() as TimerEngine.TickResult.Updated
    assertEquals(2, tick1.state.remaining)
    assertEquals(SoundCue.COUNTDOWN_TICK, tick1.cue)

    clock.advance(1000)
    engine.tick()
    clock.advance(1000)
    val done = engine.tick()
    assertTrue(done is TimerEngine.TickResult.WorkCompleted)
    done as TimerEngine.TickResult.WorkCompleted
    assertEquals(0, done.exIdx)
    assertEquals(1, done.setIdx)
    assertEquals(60, done.interval)
    assertFalse(engine.state.isActive)
  }

  @Test
  fun `rest timer completes without WorkCompleted`() {
    val clock = FakeClock()
    val engine = TimerEngine(now = { clock.now })

    engine.start(TimerType.REST, seconds = 1, exIdx = null, setIdx = null, interval = 0)
    clock.advance(1000)
    val result = engine.tick()

    assertTrue(result is TimerEngine.TickResult.Updated)
    result as TimerEngine.TickResult.Updated
    assertEquals(SoundCue.TIMER_COMPLETE, result.cue)
    assertFalse(result.state.isActive)
  }

  @Test
  fun `tabata alternates work and rest until the last cycle completes`() {
    val clock = FakeClock()
    val engine = TimerEngine(now = { clock.now })

    engine.startTabata(exIdx = 2, setIdx = 0, work = 2, rest = 1, cycles = 2, interval = 90)
    assertEquals(TimerType.TABATA_WORK, engine.state.type)
    assertEquals(1, engine.state.currentCycle)

    // 1本目のwork終了 → rest（まだ最終サイクルではない）
    clock.advance(2000)
    val toRest = engine.tick() as TimerEngine.TickResult.Updated
    assertEquals(TimerType.TABATA_REST, toRest.state.type)
    assertEquals(SoundCue.TABATA_REST_START, toRest.cue)

    // restが終わって2本目のworkへ（サイクルが進む）
    clock.advance(1000)
    val toWork = engine.tick() as TimerEngine.TickResult.Updated
    assertEquals(TimerType.TABATA_WORK, toWork.state.type)
    assertEquals(2, toWork.state.currentCycle)
    assertEquals(SoundCue.TABATA_WORK_START, toWork.cue)

    // 最終サイクルのworkが終わる → WorkCompleted（restには入らない）
    clock.advance(2000)
    val done = engine.tick()
    assertTrue(done is TimerEngine.TickResult.WorkCompleted)
    done as TimerEngine.TickResult.WorkCompleted
    assertEquals(2, done.exIdx)
    assertEquals(90, done.interval)
  }

  @Test
  fun `cancel resets state to inactive`() {
    val clock = FakeClock()
    val engine = TimerEngine(now = { clock.now })
    engine.start(TimerType.WORK, 10, 0, 0, 0)

    val result = engine.cancel()

    assertFalse(result.isActive)
    assertFalse(engine.state.isActive)
  }

  @Test
  fun `start with zero or negative seconds is a no-op`() {
    val clock = FakeClock()
    val engine = TimerEngine(now = { clock.now })

    val result = engine.start(TimerType.WORK, 0, 0, 0, 0)

    assertFalse(result.isActive)
  }

  @Test
  fun `tick on inactive engine returns Unchanged`() {
    val clock = FakeClock()
    val engine = TimerEngine(now = { clock.now })

    val result = engine.tick()

    assertTrue(result is TimerEngine.TickResult.Unchanged)
  }
}
