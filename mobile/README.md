# mobile/（FITTRACK Androidネイティブ版）

設計の背景は `../docs/native-app-rewrite.md` を参照。フェーズ0（土台づくり）・
フェーズ2（プラン／履歴／分析／プロフィールの各タブ）は完了。フェーズ1は
JS側実装＋簡易オフライン対応が完了、Android前面サービス（Kotlin）もコードとしては
実装済みだが、この開発環境にはAndroid SDKが無いため実機ビルド・検証はまだ
（詳細は`../docs/tabata-foreground-service.md`「実装状況」を参照）。

## セットアップ

```bash
cd mobile
npm install
cp .env.local.example .env.local
# .env.local に Supabase プロジェクトの URL と anon key を入れる
# （Web版 ../.env と同じプロジェクト。どのプロジェクトかは下記「Supabaseプロジェクトの
#   移行について」を参照）
```

Google OAuthでネイティブからログインするには、Supabase Dashboard の
Authentication > URL Configuration > Redirect URLs に `fittrack://**` を
追加しておく必要がある（手元でしかできない）。これが無いと、ブラウザでの
認証後にアプリへ戻ってこられない。

## 開発

```bash
npm run typecheck   # tsc --noEmit
npm start           # Expo開発サーバー
```

**この開発環境（Claude Code）にはAndroid SDKが無いため、実機／エミュレータでの
動作確認はできない。** 型チェックまでがここでの確認範囲。実機確認は手元の
Windows/Mac環境で行う（sukusukuの `docs/mobile-local-build.md` と同じ分担）。

## 構成

- `src/app/` — 画面（Expo Router。ファイル1つ＝1画面）。`login.tsx`が未ログイン時、
  `(app)/`グループがログイン後のタブ画面（`_layout.tsx`がタブ定義、`index.tsx`が
  ワークアウトタブ、`plan.tsx`がプランタブ、`history.tsx`が履歴タブ、`analytics.tsx`が
  分析タブ、`profile.tsx`がプロフィールタブ）。ルートの`_layout.tsx`が
  `Stack.Protected`でセッション有無により両者を出し分ける
- `src/context/` — `SessionContext.tsx`（supabaseセッション）、
  `WorkoutDataContext.tsx`（plans/equipment/records/profile/bodyLogsを画面間で共有し、
  `savePlan`/`recordWorkout`/`recordRest`/`saveProfile`/`addBodyLog`等で更新する。
  オフライン時に一時保存した記録の再送信・件数管理もここが担う）
- `src/components/` — `WorkoutRecordScreen.tsx`（ワークアウト記録画面本体。未送信
  記録があれば再送信バナーを表示）、`PlanScreen.tsx`（プラン閲覧・編集画面）、
  `HistoryScreen.tsx`（履歴一覧・月/年フィルタ）、`AnalyticsScreen.tsx`（頑張り
  サマリー・部位別内訳・活動カレンダー）、`ProfileScreen.tsx`（身体情報・体重体脂肪
  ログ・器具管理・目標スケジュール・データエクスポート）、`TimerBar.tsx`（画面下部の
  フローティングタイマー表示）、`shared/`（`DayTabs`・`NumberStepper`・`CyclePicker`
  などの共通UIパーツ）
- `src/hooks/` — `useWorkoutTimer.ts`（ネイティブモジュールの有無で下記2つを切り替える
  薄い層）、`useJsWorkoutTimer.ts`（Web版の`setInterval`+`Date.now()`方式のタイマー
  状態機械をそのまま移植したもの。フォールバック用）、`useNativeWorkoutTimer.ts`
  （`modules/tabata-timer/`＝Android前面サービスに委譲する版）
- `src/lib/` — ロジック層。`equipmentUtils.ts` と `workoutPlans.ts` は
  Web版（`../src/lib`, `../src/components/FitTrack.tsx`）からそのままコピーしたもの。
  `plans.ts` / `equipment.ts` / `records.ts` / `profile.ts` / `bodyLogs.ts` は
  Supabaseとの読み書き（初回シード含む）。`offlineRecords.ts`は記録の送信に失敗した
  場合のAsyncStorageへの一時保存・再送信（`docs/native-app-rewrite.md` §4の簡易オフライン対応）
- `src/assets/sounds/` — タイマーのビープ音（`.wav`）。Web版`playBeep`と同じ周波数・
  長さで生成したもの（Web Audioのオシレータ合成はネイティブに無いため、音源ファイルに
  置き換え。JS側は`expo-audio`で再生、ネイティブ側は同じ音源を`modules/tabata-timer/`の
  `res/raw/`にコピーして`SoundPool`で再生）
- `src/types/` — 型定義。Web版 `../src/types` と同一（`assets.d.ts`は`.wav`インポート用の追加分）
- `modules/tabata-timer/` — ローカルExpo Module。Android前面サービスでの高精度タイマー
  （詳細設計・実装状況は`../docs/tabata-foreground-service.md`参照）

## 現状

- フェーズ0: Supabase（Google OAuth）でのログイン／ログアウト — 完了
- フェーズ1: ワークアウト記録画面＋タイマーUI（JS側）・簡易オフライン対応 — 完了。
  Androidの前面サービス（Kotlin、`modules/tabata-timer/`）はコードとして実装済みだが、
  この開発環境にはAndroid SDKが無いため実機ビルド・検証はまだ（`docs/tabata-foreground-service.md`
  「実装状況」参照）。ネイティブモジュール未リンク時（Expo Go等）はJS側フォールバックが
  自動的に使われ、その場合タイマーは**アプリがフォアグラウンドの間だけ**正確に動く
- フェーズ2: プラン／履歴／分析／プロフィールの各タブ — 完了
  - タブナビゲーション（ワークアウト／プラン／履歴／分析／プロフィール）と、各画面で
    plans/equipment/records/profile/bodyLogsを共有する`WorkoutDataContext`
  - プラン画面: 曜日ごとの閲覧、カテゴリ・種目（名前／タイプ／セット数／回数or秒数／
    機材／インターバル／タバタ設定）の編集、種目の追加・削除、スーパーセットの
    接続・解除、保存
  - 履歴画面: 月/年単位のフィルタ切替、前後の月・年への移動、記録一覧
    （種目ごとの完了セット数／目標セット数、休養日の表示）
  - 分析画面: 月/年単位の頑張りサマリー（総レップ＆秒数・実行率・セット数等）、
    部位別カテゴリ内訳、直近5週の活動カレンダー（タップで記録詳細を表示）
  - プロフィール画面: 身体情報（生年月日・性別・身長）、体重・体脂肪ログの追加／削除、
    器具管理（負荷器具・データ器具の追加／削除）、目標・曜日別スケジュール、
    データエクスポート（JSON、`Share.share`で共有）

## Supabaseプロジェクトの移行について（2026-09-26）

当初の設計（`docs/native-app-rewrite.md`）ではSupabaseは既存プロジェクトをそのまま
使う方針だったが、フェーズ0の作業中に以下の理由で別プロジェクトへ移行した。

- Supabase Freeプランは「同一アカウントがOwner/Adminとして参加する組織を横断して、
  アクティブなプロジェクトは2つまで」という制限がある（pause中のプロジェクトは
  カウントされない）
- 既存アカウント（daizoooo、GitHub連携）は`denken3`・`sukusuku`の2プロジェクトで
  既に枠が埋まっており、`fittrack`が7日間の低活動で自動pauseされていた
- 別メールアドレスで新規Supabaseアカウントを作成して移行した。Google OAuthで
  ログインすると同じGitHubアカウントに戻ってしまうため、**メール＋パスワードでの
  新規登録**を使う必要がある
- 旧`fittrack`プロジェクト（daizoooo組織側）にはワークアウト記録がほとんど
  入っていなかったため、Project Transferではなく「新規プロジェクトを作り、
  Web版・mobile版の接続先を切り替え、マイグレーションを再適用する」形で移行し、
  旧プロジェクトは削除済み

移行に伴い、以下も新プロジェクト向けに設定し直している。

- `supabase/migrations/*.sql` の再適用（SQL Editorで手動実行）
- Google OAuth（Google Cloud Console側のクライアントに新プロジェクトのコールバック
  URLを追加し、Supabase側にClient ID/Secretを再登録）
- Authentication > URL Configuration の Redirect URLs（`fittrack://**`含む）
- Vercel側の環境変数（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）と
  本番デプロイの再ビルド（環境変数はビルド時に静的に埋め込まれるため、
  「Promote to Production」のような再ビルドを伴わない昇格では反映されない点に注意）

現在Web版・mobile版とも同じ新プロジェクトを参照している。今後Supabase側の設定
（Auth Provider、Redirect URLsなど）を変更する際は、このプロジェクトに対して行う。
