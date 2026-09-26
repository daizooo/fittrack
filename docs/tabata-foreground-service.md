# Androidの前面サービス（タイマー精度）設計

`native-app-rewrite.md` フェーズ1の「タイマーだけネイティブで正確に回る」を実現する
ための詳細設計。JS側の記録画面・タイマーUI（`mobile/src/components/WorkoutRecordScreen.tsx`,
`mobile/src/hooks/useWorkoutTimer.ts`）は実装済み。ここではそれをアプリが
バックグラウンド／画面オフでも正確に動かすための、Kotlin側の設計を固める。

このドキュメントの時点ではコードは書いていない。この開発環境（Claude Code）には
Android SDKが無くビルド・実機検証が一切できないため、実装は次回（手元のAndroid SDK
がある環境、または少なくとも型チェックしか確認できないと割り切れるセッション）で行う。

## 0. 決めたこと

| 論点 | 結論 |
| --- | --- |
| ネイティブに持たせる範囲 | **全タイマー種別を統合**（work/rest/タバタのwork⇔rest）。plain work/restだけJSに残す非対称な実装にはしない |
| 実装方式 | Expo Modules API のローカルモジュール（`mobile/modules/tabata-timer/`）。CNG（`expo prebuild`）と相性が良く、autolinkingも効く |
| JS側の既存実装（`useWorkoutTimer.ts`）の扱い | 削除しない。Expo Go／ネイティブモジュール未リンク時のフォールバックとして残す |
| 音源 | 既存の4つのWAV（`mobile/src/assets/sounds/*.wav`、Web版`playBeep`と同じ周波数で生成済み）をAndroidの`res/raw`にコピーして流用。JS版とネイティブ版で音を作り分けない |
| 対象OS | Android専用（iOS側はno-opスタブ）。ストア非公開・自端末専用のため、Google Playの前面サービスポリシー審査は関係ない |

## 1. モジュール構成

```
mobile/
├ modules/
│  └ tabata-timer/                       ← Expo local module
│     ├ expo-module.config.json
│     ├ index.ts                          # TS: 型付きAPI + イベント購読
│     ├ TabataTimer.types.ts
│     ├ ios/                              # no-opスタブ（Android専用機能のため）
│     └ android/
│        ├ build.gradle
│        └ src/main/java/expo/modules/tabatatimer/
│           ├ TabataTimerModule.kt        # Expo Module定義（関数・イベント）
│           ├ TabataTimerService.kt       # 前面サービス本体（通知・ライフサイクル）
│           ├ TimerEngine.kt              # 状態機械（Androidフレームワーク非依存）
│           └ AlarmPlayer.kt              # SoundPoolでのビープ再生
├ plugins/
│  └ withTabataTimerService.js            # AndroidManifestへの権限・service宣言を追加するconfig plugin
└ src/
   └ hooks/
      ├ useWorkoutTimer.ts                # 差し替え: ネイティブ有無で下記2つを切り替える薄い層に
      ├ useNativeWorkoutTimer.ts          # 新規: ネイティブモジュールを叩く実装
      └ useJsWorkoutTimer.ts              # 現行useWorkoutTimer.tsの中身をリネームしただけ（フォールバック用、変更なし）
```

## 2. JS/ネイティブの境界（API契約）

`WorkoutRecordScreen.tsx` 側は一切変更しない。`useWorkoutTimer(...)` が返す
`{ activeTimer, startTimer, startTabataTimer, cancelTimer }` という現行の形を
維持したまま、中身だけをネイティブ委譲に差し替える。

```ts
// mobile/src/hooks/useWorkoutTimer.ts（差し替え後）
import { isNativeTimerAvailable } from '../../modules/tabata-timer'
import { useNativeWorkoutTimer } from './useNativeWorkoutTimer'
import { useJsWorkoutTimer } from './useJsWorkoutTimer'

export function useWorkoutTimer(options: UseWorkoutTimerOptions) {
  // ネイティブモジュールの有無はアプリの実行中に変わらないので、
  // レンダーごとの分岐ではなくマウント時に固定した値で切り替える
  // （Rules of Hooksの例外として許容されるパターン。呼び出し先フックの数・順序が
  //   実行中に変わらないことが保証されているため）
  const [useNative] = useState(() => isNativeTimerAvailable())
  return useNative ? useNativeWorkoutTimer(options) : useJsWorkoutTimer(options)
}
```

`modules/tabata-timer/index.ts` が公開するAPI（`TimerState`は既存の`src/types`のものをそのまま使う）:

```ts
export function isNativeTimerAvailable(): boolean

// 既存のuseWorkoutTimer.tsのstartTimer/startTabataTimerと同じ引数
export function startTimer(
  type: 'work' | 'rest', seconds: number,
  exIdx: number | null, setIdx: number | null, interval: number
): void
export function startTabataTimer(
  exIdx: number, setIdx: number, work: number, rest: number, cycles: number, interval: number
): void
export function cancelTimer(): void

// ネイティブ側からのイベント（EventEmitter）。ペイロードはTimerStateのサブセット
export function addTimerUpdateListener(cb: (state: TimerState) => void): EventSubscription
export function addTimerCompleteListener(cb: (payload: { exIdx: number|null; setIdx: number|null; interval: number }) => void): EventSubscription
```

`useNativeWorkoutTimer.ts` は、ネイティブから来る`TimerState`更新イベントを
そのまま`setActiveTimer`し、`TimerCompleteEvent`が来たら現行の`onWorkComplete`
コールバック（セット完了フラグを立てる／レストタイマーへ連鎖する）を呼ぶだけの
薄いアダプタになる。**現行のJS側の状態機械のロジック自体（work/rest/タバタの
遷移規則）はTimerEngine.ktへそのまま移植し、二重に設計しない。**

## 3. TimerEngine.kt（状態機械）

`useJsWorkoutTimer.ts`（旧`useWorkoutTimer.ts`）のreducerロジックを1:1で
Kotlinに移植する。Androidフレームワークに依存しない純粋なクラスにし、
`android/src/test/`でJVMユニットテストできる形にする（Espresso等の実機依存
テストではなく、素のJUnitで状態遷移だけ検証できるようにする）。

```kotlin
class TimerEngine(private val now: () -> Long = System::currentTimeMillis) {
  data class State(
    val isActive: Boolean, val type: TimerType?, val endTime: Long, val remaining: Int,
    val exIdx: Int?, val setIdx: Int?, val interval: Int,
    val tabataWork: Int, val tabataRest: Int, val tabataCycles: Int, val currentCycle: Int
  )

  fun start(type: TimerType, seconds: Int, exIdx: Int?, setIdx: Int?, interval: Int): State
  fun startTabata(exIdx: Int, setIdx: Int, work: Int, rest: Int, cycles: Int, interval: Int): State
  fun cancel(): State
  /** 呼び出し側(Service)が一定間隔でポーリングする。フェーズ境界を跨いだ場合は
   *  SoundCueを返す（Service側がAlarmPlayerで再生する）。 */
  fun tick(): TickResult
}

sealed class TickResult {
  data class Unchanged(val state: TimerEngine.State): TickResult()
  data class Updated(val state: TimerEngine.State, val cue: SoundCue?): TickResult()
  data class WorkCompleted(val exIdx: Int?, val setIdx: Int?, val interval: Int): TickResult()
}

enum class SoundCue { COUNTDOWN_TICK, TABATA_REST_START, TABATA_WORK_START, TIMER_COMPLETE }
```

Web版`playBeep`呼び出し４種類 → `SoundCue`の4値に対応（`countdown-tick` /
`tabata-rest-start` / `tabata-work-start` / `timer-complete`。ファイル名は
そのまま`AlarmPlayer`が引くリソースキーにする）。

## 4. TabataTimerService.kt（前面サービス）

- `Service`（前面サービス）。`TabataTimerModule.kt`の`start()`/`cancel()`から
  `ContextCompat.startForegroundService(...)` / `stopSelf()`で起動・停止する
  （**計測中だけ動かす**。§0のとおり）
- `onStartCommand`内で即座に`startForeground(NOTIFICATION_ID, notification)`
  を呼ぶ（Android の制約：起動から数秒以内に必須）
- ティック方式: `Handler(Looper.getMainLooper())`で250ms間隔の
  `postDelayed`ループ。前面サービスはOSにより優先度を保証されるため、
  Doze対策の`AlarmManager.setExactAndAllowWhileIdle`等は基本不要という想定
  だが、**これは机上の設計であり実機（特に一部Androidメーカーの独自省電力機能）
  での検証が必須**。フェーズ1の実機確認（`docs/native-app-rewrite.md` §5）で
  ここを重点的に見る
- 通知: フェーズ（WORK/REST）・残り秒数・ラウンド数（タバタ時）を表示し、
  「中止」アクション付き。`NotificationChannel`は`IMPORTANCE_LOW`
  （通知音はAlarmPlayer側で鳴らすので、通知自体の音は不要）
- `onDestroy`でSoundPool解放・Handlerコールバック解除・`stopForeground(true)`

## 5. AlarmPlayer.kt（音）

- `SoundPool` + `AudioAttributes.USAGE_ALARM`（`CONTENT_TYPE_SONIFICATION`）。
  マナーモードでも鳴らすという§1の動機に対応
- 音源は`mobile/src/assets/sounds/*.wav`をそのまま`res/raw/`にコピー
  （Androidのリソース名制約でハイフン不可のため、コピー時に
  `countdown_tick.wav`のようにアンダースコア化する）。JS側の生成スクリプト
  （python3、`countdown-tick`等4種、web版`playBeep`と同じ周波数・長さ）を
  そのまま使い回せる
- 既知の制約: `USAGE_ALARM`でもデバイスの`STREAM_ALARM`音量が0だと鳴らない。
  アプリ側で制御できないため、実機確認時に音量設定も合わせて確認する

## 6. config plugin（AndroidManifestへの追加）

`android/`はまだ生成していない（CNG）ため、直接編集せず
`mobile/plugins/withTabataTimerService.js`（`withAndroidManifest`）で以下を追加する。

- `<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />`
- `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />`
- `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`
  （Android 13+の通知許可。実行時許可のリクエストは`expo-notifications`を使う）
- `<service android:name=".TabataTimerService" android:exported="false" android:foregroundServiceType="mediaPlayback" />`

`foregroundServiceType`は`mediaPlayback`を採用（音を鳴らすことが本質的な機能
のため）。Google Playの前面サービスポリシー審査は自端末専用配布のため対象外。

`app.json`の`plugins`配列に`./plugins/withTabataTimerService`を追加する。

## 7. 検証の限界（この開発環境）

- `TimerEngine.kt`は純粋なKotlinなのでJVMユニットテスト
  （`./gradlew :modules:tabata-timer:test`）で検証できる**はず**だが、
  この環境にはAndroid SDK/Gradleが無く`android/`ディレクトリ自体が
  存在しないため、ここでは実行できない
- 実装は次回、`expo prebuild -p android`を実行できる環境（手元のWindows/Mac、
  または少なくとも型チェックしか確認できないと割り切れるセッション）で行う
- 実装後の受け入れ基準は`native-app-rewrite.md`のフェーズ1と同じ：
  実機に入れて、画面オフでもタバタのwork⇔rest切替とビープが正確に鳴ることを確認する

## 8. 移行手順（まとめ）

1. 本ドキュメントで設計を確定（今回はここまで）
2. `modules/tabata-timer/`一式・config plugin・`TimerEngine.kt`のユニット
   テストを実装
3. `useWorkoutTimer.ts`を§2のとおり分割・差し替え
4. `expo prebuild -p android`→実機ビルドで動作確認（画面オフ耐性を含む）
5. 安定を確認できたらフェーズ1完了。JSフォールバック実装は
   Expo Go／開発時の利便性のため残す（削除しない）
