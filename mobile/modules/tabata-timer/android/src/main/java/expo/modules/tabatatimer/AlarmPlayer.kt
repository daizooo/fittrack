package expo.modules.tabatatimer

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool

/**
 * [SoundCue]をビープ音として再生する。`USAGE_ALARM` + `CONTENT_TYPE_SONIFICATION`で
 * マナーモードでも鳴らす（設計の動機：Web版はタブ切替やスリープでタイマー音が止まる問題の解消）。
 * 音源は`mobile/src/assets/sounds/*.wav`（Web版`playBeep`と同じ周波数・長さで生成済み）を
 * このモジュールの`res/raw/`へコピーし、Androidのリソース名制約に合わせてハイフンを
 * アンダースコアに置き換えたもの。
 *
 * 既知の制約：`USAGE_ALARM`でも端末の`STREAM_ALARM`音量が0だと鳴らない。アプリからは
 * 制御できないため、実機確認時に音量設定も合わせて確認する（`docs/tabata-foreground-service.md` §5）。
 */
class AlarmPlayer(context: Context) {
  private val appContext = context.applicationContext

  private val audioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_ALARM)
    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
    .build()

  private val soundPool = SoundPool.Builder()
    .setMaxStreams(2)
    .setAudioAttributes(audioAttributes)
    .build()

  private val soundIds = mutableMapOf<SoundCue, Int>()
  private val loadedSoundIds = mutableSetOf<Int>()

  init {
    soundPool.setOnLoadCompleteListener { _, sampleId, status ->
      if (status == 0) loadedSoundIds.add(sampleId)
    }
    soundIds[SoundCue.COUNTDOWN_TICK] = load(R.raw.countdown_tick)
    soundIds[SoundCue.TABATA_REST_START] = load(R.raw.tabata_rest_start)
    soundIds[SoundCue.TABATA_WORK_START] = load(R.raw.tabata_work_start)
    soundIds[SoundCue.TIMER_COMPLETE] = load(R.raw.timer_complete)
  }

  private fun load(resId: Int): Int = soundPool.load(appContext, resId, 1)

  fun play(cue: SoundCue) {
    val soundId = soundIds[cue] ?: return
    if (soundId !in loadedSoundIds) return // ロード未完了の取りこぼしは許容（次のキューで鳴らせば十分）
    soundPool.play(soundId, 1f, 1f, 1, 0, 1f)
  }

  fun release() {
    soundPool.release()
  }
}
