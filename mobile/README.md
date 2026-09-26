# mobile/（FITTRACK Androidネイティブ版）

設計の背景は `../docs/native-app-rewrite.md` を参照。フェーズ0（土台づくり）の内容。

## セットアップ

```bash
cd mobile
npm install
cp .env.local.example .env.local
# .env.local に既存Supabaseプロジェクトの URL と anon key を入れる
# （Web版 ../.env と同じプロジェクト。フェーズ0ではSupabaseは新規に作らない）
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
- `src/lib/` — ロジック層。`equipmentUtils.ts` と `workoutPlans.ts` は
  Web版（`../src/lib`, `../src/components/FitTrack.tsx`）からそのままコピーしたもの
- `src/types/` — 型定義。Web版 `../src/types` と同一

## 現状（フェーズ0）

- Supabase（Google OAuth）でのログイン／ログアウトのみ実装済み
- ワークアウト記録・タイマー等の画面はまだ無い（フェーズ1で着手）
