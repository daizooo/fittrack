# mobile/（FITTRACK Androidネイティブ版）

設計の背景は `../docs/native-app-rewrite.md` を参照。フェーズ0（土台づくり）は完了し、
現在はフェーズ1（Tabataタイマー）に着手中。

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

- `src/app/` — 画面（Expo Router。ファイル1つ＝1画面）
- `src/components/` — `WorkoutRecordScreen.tsx`（ワークアウト記録画面本体）、
  `TimerBar.tsx`（画面下部のフローティングタイマー表示）
- `src/hooks/useWorkoutTimer.ts` — Web版の`setInterval`+`Date.now()`方式のタイマー
  状態機械（work/rest/tabata_work/tabata_rest）をそのまま移植したもの
- `src/lib/` — ロジック層。`equipmentUtils.ts` と `workoutPlans.ts` は
  Web版（`../src/lib`, `../src/components/FitTrack.tsx`）からそのままコピーしたもの。
  `plans.ts` / `equipment.ts` / `records.ts` はSupabaseとの読み書き（初回シード含む）
- `src/assets/sounds/` — タイマーのビープ音（`.wav`）。Web版`playBeep`と同じ周波数・
  長さで生成したもの（Web Audioのオシレータ合成はネイティブに無いため、音源ファイルに
  置き換え。`expo-audio`で再生）
- `src/types/` — 型定義。Web版 `../src/types` と同一（`assets.d.ts`は`.wav`インポート用の追加分）

## 現状（フェーズ1・進行中）

- フェーズ0: Supabase（Google OAuth）でのログイン／ログアウト — 完了
- フェーズ1でここまで実装したもの（JS側のみ、`docs/native-app-rewrite.md`の
  「ワークアウト記録画面」部分）
  - 曜日ごとのプラン表示、トレーニング開始／休養日として記録
  - セットごとの重量・回数（またはduration種目の秒数）入力、前回記録の引き継ぎ
  - work / rest / タバタ(work⇔rest サイクル) タイマーとビープ音
  - 記録の保存（`records`テーブル）
- まだ実装していないもの（フェーズ1の残り、`docs/native-app-rewrite.md` §5参照）
  - Androidの前面サービス（Kotlin）。現状のタイマーは**アプリがフォアグラウンドの
    間だけ**正確に動く。バックグラウンド・画面オフでは止まる（Web版と同じ制約）
  - 前面サービス側での鳴らし分けの本実装
  - 簡易オフライン対応（§4）
  - プラン編集・履歴・分析・プロフィール画面（フェーズ2）

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
