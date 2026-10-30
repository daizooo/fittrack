# 旧 Supabase（別アカウント）→ 統合プロジェクト「Persol」fittrack スキーマ 移行手順

ローカル環境は使わず、**ブラウザ（Supabase / Vercel のダッシュボード）だけ**で完結する手順。

| | 旧（移行元） | 新（移行先） |
|---|---|---|
| プロジェクト | 別アカウントの FitTrack 用 | Persol（ref: `jmysgeulujggdmdthqkn`, ap-northeast-1） |
| スキーマ | `public` | `fittrack` |
| URL | `https://elypeacduoihmukyoanl.supabase.co` | `https://jmysgeulujggdmdthqkn.supabase.co` |
| アプリ本番 | `https://fittrack-alpha-eight.vercel.app` | （同じ） |

Persol は sukusuku / denken3 と共用。**他アプリに影響する設定（Site URL など）は変更しない。**

## 1. Google ログインの確認（Persol）

Authentication > Sign In / Providers > **Google** が Enabled であることを確認（他アプリで設定済みなら何もしない）。

無効の場合のみ:
1. Google Cloud Console > API とサービス > 認証情報 > OAuth 2.0 クライアント ID（ウェブアプリケーション）の
   「承認済みのリダイレクト URI」に `https://jmysgeulujggdmdthqkn.supabase.co/auth/v1/callback` を追加
2. そのクライアント ID / シークレットを Supabase の Google 設定に入力して有効化

## 2. ログイン後の戻り先を許可（Persol）

Authentication > **URL Configuration** > Redirect URLs に追加（**Site URL は変更しない**）:

```
https://fittrack-alpha-eight.vercel.app/**
```

```
https://fittrack-*-daizooos-projects.vercel.app/**
```

アプリは `redirectTo: window.location.origin`（`src/App.tsx`）でログインする。一覧に無い URL だと
Site URL（他アプリ）へ戻されてしまう。モバイル版を使う場合は `fittrack://**` も追加。

## 3. スキーマ作成（Persol）

1. Project Settings > **Data API** > Exposed schemas に `fittrack` を追加して保存
2. SQL Editor で [`supabase/migrations/001_fittrack_schema.sql`](../supabase/migrations/001_fittrack_schema.sql) を実行
3. 確認: `select table_name from information_schema.tables where table_schema = 'fittrack' order by 1;` で 7 テーブル

## 4. 新プロジェクトでログイン（Vercel プレビュー）

Vercel > fittrack > Settings > **Environment Variables** で、既存の変数（Production + Preview 共通）は
**触らず**、このブランチ専用の Preview 変数を「Add Environment Variable」で 2 つ追加する
（本番は手順7まで旧DBのまま動き続ける）:

| Key | Value | Environments |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://jmysgeulujggdmdthqkn.supabase.co` | Preview のみ、Branch に `claude/youthful-allen-75vair` |
| `VITE_SUPABASE_ANON_KEY` | Persol > Project Settings > API Keys の anon（publishable）キー | 同上 |

ブランチ指定の値は共通値より優先される。保存後、Deployments でこのブランチの最新デプロイを
「…」> **Redeploy**（Vite はビルド時に値を埋め込むため必須）。

プレビュー URL（PR の Vercel コメント内の「Preview」）を開き、Google でログインする。
初回はオンボーディング（身体情報の登録）が出るが **入力しない**（移行データと重複するため）。
なお初回ログイン時に、アプリが既定の器具 4 件（`bodyweight` / `tube` / `assist` / `vest`）を `fittrack.equipment` に
自動作成する。旧データの同じIDと主キーが衝突して手順6が失敗するので、手順6の前に Persol で削除しておく:

```sql
DELETE FROM fittrack.equipment WHERE user_id = '新UUID';
```

> Persol に同じ Google アカウントが既にある（他アプリで使用済み）なら、ログインは同じユーザーになる。

## 5. ユーザーIDの確認

旧プロジェクト SQL Editor:

```sql
SELECT id, email FROM auth.users;
```

Persol SQL Editor:

```sql
SELECT id, email FROM auth.users WHERE email = 'あなたのGmailアドレス';
```

## 6. データ移行（SQL Editor のコピー＆ペーストだけ）

1. **旧プロジェクト** SQL Editor に [`supabase/data-migration/export_from_old.sql`](../supabase/data-migration/export_from_old.sql) を貼り付け、
   `VALUES ('旧UUID', '新UUID')` を手順5の値に書き換えて Run（旧データは読むだけで変更しない）
2. 結果の `sql` 列（1セル）をコピー
   - `BEGIN;` で始まり `COMMIT;` で終わる 9 行。各行末の `-- n 件` で件数が分かる
3. **Persol** SQL Editor に貼り付けて Run
   - user_id は新UUIDに付け替え済みで、元の作成・更新日時も保たれる
   - 1件でも失敗すると全体が取り消される。2回流しても主キー重複で失敗するので二重には入らない
4. 確認（Persol）:

```sql
SELECT 'records' t, count(*) FROM fittrack.records
UNION ALL SELECT 'workout_plans', count(*) FROM fittrack.workout_plans
UNION ALL SELECT 'exercises', count(*) FROM fittrack.exercises
UNION ALL SELECT 'equipment', count(*) FROM fittrack.equipment
UNION ALL SELECT 'profiles', count(*) FROM fittrack.profiles
UNION ALL SELECT 'body_logs', count(*) FROM fittrack.body_logs
UNION ALL SELECT 'plans', count(*) FROM fittrack.plans;
```

手順2の `-- n 件` と一致すれば完了。プレビュー URL を再読み込みし、過去の記録が出ることを確認。

> オンボーディングで入力してしまい `profiles` などが重複エラーになる場合は、Persol で
> `DELETE FROM fittrack.profiles WHERE user_id = '新UUID';`（同様に equipment / workout_plans）を実行してから再度流す。
> **fittrack 以外のテーブルは絶対に対象にしないこと。**

## 7. 本番切り替え（Vercel）

1. Vercel > Settings > Environment Variables で、既存（Production + Preview 共通）の `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` を「…」> Edit で手順4と同じ値に変更（手順4で追加したブランチ専用の2つは削除してよい）
2. 直後に PR を main にマージ（本番が自動で再デプロイされる）
   - 新しい環境変数と新しいコード（`fittrack` 参照）は同時に揃っている必要がある。片方だけだと本番がDBに繋がらない

## 8. 動作確認

- [ ] 本番 URL で Google ログイン → fittrack に戻る（他アプリに飛ばされない）
- [ ] 記録・プラン・種目・器具・プロフィール・体重ログが表示される
- [ ] 新規記録の保存 → Persol の Table Editor（schema: fittrack）で `records` に行が増える

| 症状 | 原因 | 対処 |
|---|---|---|
| ログイン後に別アプリが開く | Redirect URLs 不足 | 手順2 |
| `PGRST106` / `Invalid schema` | Exposed schemas 未追加 | 手順3-1 |
| `permission denied` | GRANT 未適用 | 手順3-2 を再実行 |
| ログインできるがデータ0件 | UUID 付け替え先の誤り | 手順5 |

## 9. 後片付け

問題が無ければ旧プロジェクトを Pause → しばらく後に削除。

---

### 付録: ターミナルが使える場合（pg_dump 方式）

```bash
pg_dump "$OLD_DB" --data-only --no-owner --no-privileges -t public.plans -t public.records -t public.profiles -t public.body_logs -t public.equipment -t public.workout_plans -t public.exercises > fittrack_public_data.sql
```

```bash
sed -E 's/^COPY public\./COPY fittrack./' fittrack_public_data.sql > fittrack_data.sql
```

[`remap_user_ids.sql`](../supabase/data-migration/remap_user_ids.sql) に (旧UUID, 新UUID) を書いてから:

```bash
psql "$NEW_DB" --single-transaction -v ON_ERROR_STOP=1 -c 'SET session_replication_role = replica' -f fittrack_data.sql -f supabase/data-migration/remap_user_ids.sql
```
