# FITTRACK 開発ルール

## データベースの所在（事故防止）

- このプロジェクトは fittrack スキーマ専任です。同一プロジェクト内の他スキーマ（sukusuku/denken3/public）に対するテーブル作成・変更・データ削除は禁止します。
- マイグレーション時は必ず fittrack.テーブル名 の形式を使用してください。
- 接続先は統合 Supabase プロジェクト「Persol」（ref: `jmysgeulujggdmdthqkn`）。旧アカウントのプロジェクト（ref: `elypeacduoihmukyoanl`）は移行元で、新規の変更は加えない。
- `supabase/legacy-public-migrations/` は旧プロジェクト（public）の履歴。新プロジェクトへ適用しない。
- クライアントは `createClient(..., { db: { schema: 'fittrack' } })` で初期化済み。`.schema('public')` 等で別スキーマを参照するコードを書かない。
- `execute_sql` / `apply_migration` を使う前に、SQL が `fittrack.` 以外のスキーマに触れていないか確認する（`DROP` / `TRUNCATE` / `DELETE` は特に）。

## Supabase マイグレーション

- 新規テーブルを作るマイグレーションでは、**同じファイル内で GRANT を必ず書く**。
  独自スキーマ（fittrack）には既定の Data API（supabase-js / PostgREST / GraphQL）権限が無い。
  書き忘れると `permission denied` になる。
- 新しいスキーマを Data API で使うには Dashboard > Project Settings > Data API > Exposed schemas への追加も必要
  （fittrack は追加済みであること）。
- 全テーブル RLS 有効 + `auth.uid() = user_id` のポリシーが前提。権限は最小限にする。

```sql
ALTER TABLE fittrack.your_table ENABLE ROW LEVEL SECURITY;
-- ... CREATE POLICY ... ON fittrack.your_table ...

GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.your_table TO authenticated, service_role;
-- 未ログインで読ませる必要があるテーブルだけ: GRANT SELECT ON fittrack.your_table TO anon;
```

- 本番へ `apply_migration` する際も、GRANT を含めた同一 SQL をそのまま適用し、
  `supabase/migrations/` のファイルと内容を一致させる。
