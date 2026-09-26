package expo.modules.tabatatimer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * 計測中だけ動く前面サービス。`docs/tabata-foreground-service.md` §4の設計に沿った実装。
 *
 * - [TimerEngine]（状態機械）と[AlarmPlayer]（ビープ再生）はどちらもこのサービスが所有する。
 * - JS側（[TabataTimerModule]）とはプロセス内の直接参照（[listener]）で連携する。
 *   同一プロセス内のService⇔Moduleの通信としては単純だが十分（別プロセス化していないため
 *   AIDL/Messengerのような重い仕組みは不要）。
 * - `onStartCommand`到達後、Androidの制約（起動から数秒以内が必須）を守るため即座に
 *   `startForeground`を呼ぶ。
 */
class TabataTimerService : Service() {

  companion object {
    private const val NOTIFICATION_CHANNEL_ID = "tabata_timer"
    private const val NOTIFICATION_ID = 4821
    private const val TICK_INTERVAL_MS = 250L

    private const val ACTION_START_TIMER = "expo.modules.tabatatimer.action.START_TIMER"
    private const val ACTION_START_TABATA = "expo.modules.tabatatimer.action.START_TABATA"
    private const val ACTION_CANCEL = "expo.modules.tabatatimer.action.CANCEL"

    /** 通知の「中止」タップから飛んでくるアクション。ACTION_CANCELと同じ扱いにする。 */
    private const val ACTION_STOP_REQUESTED = "expo.modules.tabatatimer.action.STOP_REQUESTED"

    private const val EXTRA_TYPE = "type"
    private const val EXTRA_SECONDS = "seconds"
    private const val EXTRA_EX_IDX = "exIdx"
    private const val EXTRA_SET_IDX = "setIdx"
    private const val EXTRA_INTERVAL = "interval"
    private const val EXTRA_WORK = "work"
    private const val EXTRA_REST = "rest"
    private const val EXTRA_CYCLES = "cycles"

    /**
     * Moduleが自身をリスナーとして登録する（同一プロセス内なのでシンプルな参照で十分）。
     * Moduleより先にServiceが生きている状態は無い前提（起動は必ずModule経由）。
     */
    var listener: Listener? = null

    fun startTimer(
      context: Context, type: TimerType, seconds: Int, exIdx: Int?, setIdx: Int?, interval: Int
    ) {
      val intent = Intent(context, TabataTimerService::class.java).apply {
        action = ACTION_START_TIMER
        putExtra(EXTRA_TYPE, type.name)
        putExtra(EXTRA_SECONDS, seconds)
        putExtra(EXTRA_EX_IDX, exIdx ?: -1)
        putExtra(EXTRA_SET_IDX, setIdx ?: -1)
        putExtra(EXTRA_INTERVAL, interval)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    fun startTabataTimer(
      context: Context, exIdx: Int, setIdx: Int, work: Int, rest: Int, cycles: Int, interval: Int
    ) {
      val intent = Intent(context, TabataTimerService::class.java).apply {
        action = ACTION_START_TABATA
        putExtra(EXTRA_EX_IDX, exIdx)
        putExtra(EXTRA_SET_IDX, setIdx)
        putExtra(EXTRA_WORK, work)
        putExtra(EXTRA_REST, rest)
        putExtra(EXTRA_CYCLES, cycles)
        putExtra(EXTRA_INTERVAL, interval)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    fun cancelTimer(context: Context) {
      val intent = Intent(context, TabataTimerService::class.java).apply { action = ACTION_CANCEL }
      ContextCompat.startForegroundService(context, intent)
    }
  }

  interface Listener {
    fun onTimerUpdate(state: TimerEngine.State)
    fun onTimerComplete(exIdx: Int?, setIdx: Int?, interval: Int)
  }

  private val engine = TimerEngine()
  private lateinit var alarmPlayer: AlarmPlayer
  private val handler = Handler(Looper.getMainLooper())
  private var ticking = false

  private val tickRunnable = object : Runnable {
    override fun run() {
      handleTick()
      if (ticking) handler.postDelayed(this, TICK_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    alarmPlayer = AlarmPlayer(this)
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, buildNotification(engine.state))

    when (intent?.action) {
      ACTION_START_TIMER -> {
        val type = TimerType.entries.firstOrNull { it.name == intent.getStringExtra(EXTRA_TYPE) } ?: TimerType.WORK
        val seconds = intent.getIntExtra(EXTRA_SECONDS, 0)
        val exIdx = intent.getIntExtra(EXTRA_EX_IDX, -1).takeIf { it >= 0 }
        val setIdx = intent.getIntExtra(EXTRA_SET_IDX, -1).takeIf { it >= 0 }
        val interval = intent.getIntExtra(EXTRA_INTERVAL, 0)
        val state = engine.start(type, seconds, exIdx, setIdx, interval)
        onEngineStateChanged(state)
      }
      ACTION_START_TABATA -> {
        val exIdx = intent.getIntExtra(EXTRA_EX_IDX, 0)
        val setIdx = intent.getIntExtra(EXTRA_SET_IDX, 0)
        val work = intent.getIntExtra(EXTRA_WORK, 0)
        val rest = intent.getIntExtra(EXTRA_REST, 0)
        val cycles = intent.getIntExtra(EXTRA_CYCLES, 0)
        val interval = intent.getIntExtra(EXTRA_INTERVAL, 0)
        val state = engine.startTabata(exIdx, setIdx, work, rest, cycles, interval)
        onEngineStateChanged(state)
      }
      ACTION_CANCEL, ACTION_STOP_REQUESTED -> {
        val state = engine.cancel()
        listener?.onTimerUpdate(state)
        stopTimerService()
      }
      else -> { /* action無しでの再送（システムによる再起動等）。既存の通知のみ維持する */ }
    }

    return START_NOT_STICKY
  }

  private fun onEngineStateChanged(state: TimerEngine.State) {
    listener?.onTimerUpdate(state)
    updateNotification(state)
    if (state.isActive) startTicking() else stopTimerService()
  }

  private fun startTicking() {
    if (ticking) return
    ticking = true
    handler.post(tickRunnable)
  }

  private fun stopTicking() {
    ticking = false
    handler.removeCallbacks(tickRunnable)
  }

  private fun stopTimerService() {
    stopTicking()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun handleTick() {
    when (val result = engine.tick()) {
      is TimerEngine.TickResult.Unchanged -> { /* 秒単位の変化なし */ }
      is TimerEngine.TickResult.Updated -> {
        result.cue?.let { alarmPlayer.play(it) }
        listener?.onTimerUpdate(result.state)
        updateNotification(result.state)
        // restタイマーの自然終了はWorkCompletedを伴わないので、ここでサービスを止める
        if (!result.state.isActive) stopTimerService()
      }
      is TimerEngine.TickResult.WorkCompleted -> {
        alarmPlayer.play(SoundCue.TIMER_COMPLETE)
        listener?.onTimerUpdate(engine.state)
        listener?.onTimerComplete(result.exIdx, result.setIdx, result.interval)
        stopTimerService()
      }
    }
  }

  override fun onDestroy() {
    stopTicking()
    alarmPlayer.release()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID) != null) return
    // 通知自体の音は不要（ビープはAlarmPlayerがSTREAM_ALARMで別途鳴らす）
    val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, "タイマー", NotificationManager.IMPORTANCE_LOW).apply {
      setSound(null, null)
    }
    manager.createNotificationChannel(channel)
  }

  private fun updateNotification(state: TimerEngine.State) {
    val manager = getSystemService(NotificationManager::class.java) ?: return
    manager.notify(NOTIFICATION_ID, buildNotification(state))
  }

  private fun buildNotification(state: TimerEngine.State): Notification {
    val (title, text) = notificationContent(state)

    val cancelIntent = Intent(this, TabataTimerService::class.java).apply { action = ACTION_STOP_REQUESTED }
    val cancelPendingIntent = PendingIntent.getService(
      this, 0, cancelIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      // TODO: 専用アイコンに置き換える。現状はプレースホルダーとしてシステム標準のアラームアイコンを使用。
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .addAction(0, "中止", cancelPendingIntent)
      .build()
  }

  private fun notificationContent(state: TimerEngine.State): Pair<String, String> = when (state.type) {
    TimerType.WORK -> "計測中" to "残り${state.remaining}秒"
    TimerType.REST -> "レスト中" to "残り${state.remaining}秒"
    TimerType.TABATA_WORK -> "タバタ：稼働中（${state.currentCycle}/${state.tabataCycles}）" to "残り${state.remaining}秒"
    TimerType.TABATA_REST -> "タバタ：休憩中（${state.currentCycle}/${state.tabataCycles}）" to "残り${state.remaining}秒"
    null -> "FITTRACK" to "タイマー"
  }
}
