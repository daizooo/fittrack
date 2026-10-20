# FITTRACK 開発ルール

## Supabase マイグレーション

- `public` に新規テーブルを作るマイグレーションでは、**同じファイル内で GRANT を必ず書く**。
  Supabase は 2026-10-30 以降、新規テーブルへ Data API（supabase-js / PostgREST / GraphQL）の
  権限を自動付与しない。書き忘れると `permission denied` になる。
- 全テーブル RLS 有効 + `auth.uid() = user_id` のポリシーが前提。権限は最小限にする。

```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
-- ... CREATE POLICY ...

GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated, service_role;
-- 未ログインで読ませる必要があるテーブルだけ: GRANT SELECT ON public.your_table TO anon;
```

- 本番へ `apply_migration` する際も、GRANT を含めた同一 SQL をそのまま適用し、
  `supabase/migrations/` のファイルと内容を一致させる。
