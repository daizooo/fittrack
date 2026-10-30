-- FitTrack データ移管（ブラウザだけで完結する方法）
-- 旧プロジェクトの SQL Editor で実行する。旧データを読むだけで、何も変更しない。
--
-- 1. 下の m の (旧UUID, 新UUID) を書き換えて Run
-- 2. 結果の1セル（"sql" 列）をコピー
-- 3. 新プロジェクト「Persol」の SQL Editor に貼り付けて Run
--    → fittrack.* に、user_id を新UUIDへ付け替えた状態で INSERT される（FK もそのまま満たす）
--    → 主キー重複などで1件でも失敗すると全体が取り消される。2回流しても二重には入らない
-- 出力は fittrack.* への INSERT だけで、他のスキーマには触れない。

WITH m (old_id, new_id) AS (
  VALUES ('00000000-0000-0000-0000-000000000000'::uuid, '11111111-1111-1111-1111-111111111111'::uuid)  -- ← 旧UUID, 新UUID
),
t (name, rows) AS (
            SELECT 'plans',         jsonb_agg(to_jsonb(x) || jsonb_build_object('user_id', m.new_id)) FROM public.plans         x JOIN m ON x.user_id = m.old_id
  UNION ALL SELECT 'records',       jsonb_agg(to_jsonb(x) || jsonb_build_object('user_id', m.new_id)) FROM public.records       x JOIN m ON x.user_id = m.old_id
  UNION ALL SELECT 'profiles',      jsonb_agg(to_jsonb(x) || jsonb_build_object('user_id', m.new_id)) FROM public.profiles      x JOIN m ON x.user_id = m.old_id
  UNION ALL SELECT 'body_logs',     jsonb_agg(to_jsonb(x) || jsonb_build_object('user_id', m.new_id)) FROM public.body_logs     x JOIN m ON x.user_id = m.old_id
  UNION ALL SELECT 'equipment',     jsonb_agg(to_jsonb(x) || jsonb_build_object('user_id', m.new_id)) FROM public.equipment     x JOIN m ON x.user_id = m.old_id
  UNION ALL SELECT 'workout_plans', jsonb_agg(to_jsonb(x) || jsonb_build_object('user_id', m.new_id)) FROM public.workout_plans x JOIN m ON x.user_id = m.old_id
  UNION ALL SELECT 'exercises',     jsonb_agg(to_jsonb(x) || jsonb_build_object('user_id', m.new_id)) FROM public.exercises     x JOIN m ON x.user_id = m.old_id
)
SELECT
  'BEGIN;' || E'\n' ||
  string_agg(
    format('INSERT INTO fittrack.%I SELECT * FROM jsonb_populate_recordset(NULL::fittrack.%I, %L::jsonb);  -- %s 件',
           name, name, COALESCE(rows, '[]'::jsonb), COALESCE(jsonb_array_length(rows), 0)),
    E'\n') || E'\n' ||
  'COMMIT;' AS sql
FROM t;
