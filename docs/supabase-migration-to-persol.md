# 旧 Supabase（別アカウント）→ 統合プロジェクト「Persol」fittrack スキーマ 移行手順

| | 旧（移行元） | 新（移行先） |
|---|---|---|
| プロジェクト | 別アカウントの FitTrack 用 | Persol（ref: `jmysgeulujggdmdthqkn`, ap-northeast-1） |
| スキーマ | `public` | `fittrack` |
| URL | `https://elypeacduoihmukyoanl.supabase.co` | `https://jmysgeulujggdmdthqkn.supabase.co` |

認証ユーザーはプロジェクトをまたいで移せない（別アカウント・別 `auth.users`）ため、
**データは旧UUIDのまま流し込み、同じトランザクション内で新UUIDへ付け替える**方式を取る。

## 1. スキーマ作成（新プロジェクト）

1. Dashboard（Persol）> Project Settings > **Data API** > Exposed schemas に `fittrack` を追加して保存
2. SQL Editor で [`supabase/migrations/001_fittrack_schema.sql`](../supabase/migrations/001_fittrack_schema.sql) を実行
   （`fittrack.*` のみ作成。他スキーマには触れない。再実行しても安全）

## 2. 認証の準備（新プロジェクト）

1. Authentication > Providers > **Google** を有効化（Client ID / Secret を設定）
2. Google Cloud Console の OAuth クライアントの「承認済みリダイレクト URI」に
   `https://jmysgeulujggdmdthqkn.supabase.co/auth/v1/callback` を追加
3. Authentication > URL Configuration
   - Site URL / Redirect URLs に Vercel の本番URL・`http://localhost:5173`（Vite）を追加
   - モバイル版を使う場合は `fittrack://**` も追加
4. 新プロジェクトのアプリ（手順5の設定後）で **一度 Google ログイン** し、`auth.users` に新アカウントを作る
   （Persol の他アプリで同じ Google アカウントを使っていれば、既にユーザーがいるのでそれを使う）

## 3. 旧データのエクスポート

接続文字列は各 Dashboard > **Connect** > Session pooler（IPv4 可）からコピー。
`pg_dump` はサーバー以上のメジャーバージョン（17 推奨）を使う。

```bash
export OLD_DB='postgresql://postgres.elypeacduoihmukyoanl:[旧DBパスワード]@[旧pooler host]:5432/postgres'
export NEW_DB='postgresql://postgres.jmysgeulujggdmdthqkn:[新DBパスワード]@[新pooler host]:5432/postgres'
```

```bash
pg_dump "$OLD_DB" --data-only --no-owner --no-privileges \
  -t public.plans -t public.records -t public.profiles -t public.body_logs \
  -t public.equipment -t public.workout_plans -t public.exercises \
  > fittrack_public_data.sql
```

スキーマ名を書き換える（`COPY` 行の先頭だけを対象にし、データ本体は変更しない）:

```bash
sed -E 's/^COPY public\./COPY fittrack./' fittrack_public_data.sql > fittrack_data.sql
```

```bash
grep -c '^COPY fittrack\.' fittrack_data.sql   # 7 になること
```

## 4. ユーザーIDの対応表を作る

旧プロジェクト SQL Editor:

```sql
SELECT id, email FROM auth.users ORDER BY created_at;
```

新プロジェクト（Persol）SQL Editor:

```sql
SELECT id, email FROM auth.users WHERE email = 'あなたのメールアドレス';
```

[`supabase/data-migration/remap_user_ids.sql`](../supabase/data-migration/remap_user_ids.sql) の
`INSERT INTO user_id_map ... VALUES` に `('旧UUID', '新UUID')` を書く（ユーザーが複数なら行を追加）。

## 5. 投入＋UUID付け替え（1トランザクション）

```bash
psql "$NEW_DB" --single-transaction -v ON_ERROR_STOP=1 \
  -c 'SET session_replication_role = replica' \
  -f fittrack_data.sql \
  -f supabase/data-migration/remap_user_ids.sql
```

- `session_replication_role = replica` で FK とトリガーを一時無効化 → 旧UUIDの行を入れてから付け替える。
  `updated_at` も元の値のまま残る
- 新UUIDが `auth.users` に無い／付け替え漏れの行が残る場合はエラーで **全体がロールバック** される（何も入らない）
- 2回目を流すと主キー重複で失敗する（＝二重投入は起きない）。やり直すときは
  `TRUNCATE fittrack.plans, fittrack.records, fittrack.profiles, fittrack.body_logs, fittrack.equipment, fittrack.workout_plans, fittrack.exercises;`
  （**fittrack 以外のテーブルを絶対に含めないこと**）

確認（Persol SQL Editor）:

```sql
SELECT 'records' t, count(*) FROM fittrack.records
UNION ALL SELECT 'workout_plans', count(*) FROM fittrack.workout_plans
UNION ALL SELECT 'exercises', count(*) FROM fittrack.exercises
UNION ALL SELECT 'equipment', count(*) FROM fittrack.equipment
UNION ALL SELECT 'profiles', count(*) FROM fittrack.profiles
UNION ALL SELECT 'body_logs', count(*) FROM fittrack.body_logs
UNION ALL SELECT 'plans', count(*) FROM fittrack.plans;
```

旧プロジェクトで同じ件数（`public.*`）になっていれば完了。

> `pg_dump` が使えない場合: 旧 Dashboard > Table Editor で各テーブルを CSV エクスポート →
> Persol の Table Editor（`fittrack` スキーマ）で同名テーブルへ CSV インポート。ただし FK により旧UUIDの行は入らないため、
> インポート前に CSV の `user_id` 列を新UUIDへ置換しておく。

## 6. 環境変数の更新

値の取得: Persol Dashboard > Project Settings > **API Keys**（anon / publishable キー）。URL は `https://jmysgeulujggdmdthqkn.supabase.co`。

### ローカル（`.env.local`、Git には入らない）

```bash
cp .env.example .env.local
```

`.env.local` を編集:

```
VITE_SUPABASE_URL=https://jmysgeulujggdmdthqkn.supabase.co
VITE_SUPABASE_ANON_KEY=（Persol の anon キー）
```

旧値が入った `.env` が残っていると紛らわしいので削除するか同じ値に揃える（`.env.local` が優先される）。

```bash
npm run dev
```

モバイル版は `mobile/.env.local` の `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` を同様に更新。

### Vercel

Dashboard: プロジェクト > Settings > **Environment Variables** で
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を編集（Production / Preview / Development すべて）→ 保存後、
Deployments から最新デプロイを **Redeploy**（Vite はビルド時に値を埋め込むため、再ビルドしないと反映されない）。

CLI の場合:

```bash
vercel env rm VITE_SUPABASE_URL production
```

```bash
vercel env add VITE_SUPABASE_URL production
```

```bash
vercel env rm VITE_SUPABASE_ANON_KEY production
```

```bash
vercel env add VITE_SUPABASE_ANON_KEY production
```

```bash
vercel --prod
```

（Preview / Development も同様に `preview` / `development` を指定）

## 7. 動作確認チェックリスト

- [ ] Google ログインでき、ログイン後にトップへ戻る
- [ ] 記録タブに旧データ（件数・日付）が表示される
- [ ] プラン・種目・器具・プロフィール・体重ログが表示される
- [ ] 新規記録の保存 → Persol の `fittrack.records` に行が増える（`public` には増えない）
- [ ] ブラウザの開発者ツール > Network で、REST リクエストのヘッダに `Accept-Profile: fittrack` / `Content-Profile: fittrack` が付いている
- [ ] エラー時の切り分け
  - `PGRST106` / `Invalid schema: fittrack` → Exposed schemas に `fittrack` が無い（手順1-1）
  - `permission denied for schema fittrack` / `for table ...` → GRANT 未適用（手順1-2 を再実行）
  - データが0件 → UUID 付け替え先が違う（手順4 の新UUIDとログイン中ユーザーを確認）

## 8. 後片付け（確認後）

- 旧プロジェクトはしばらく残し、問題が無ければ一時停止（Pause）→ 削除
- 手元の `fittrack_public_data.sql` / `fittrack_data.sql`（個人データを含む）を削除
