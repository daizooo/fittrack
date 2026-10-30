-- Supabase は 2026-10-30 以降、public スキーマの新規テーブルに Data API 権限を自動付与しない。
-- マイグレーションだけで schema を再作成する場面（新規プロジェクト / プレビューブランチ /
-- `supabase db reset`）でも動くよう、既存テーブルへの GRANT を明示する。
-- 本番DBは既に同等の権限を持つため適用しても変化しない（GRANT は冪等）。
--
-- アプリは常にログイン後にアクセスするので anon には付与しない（RLS に加えた最小権限）。
-- 今後テーブルを追加するときは、同じマイグレーション内で同様の GRANT を書くこと。

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.records       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_logs     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises     TO authenticated, service_role;
