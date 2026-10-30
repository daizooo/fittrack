-- FitTrack データ移管: 旧プロジェクトのユーザーID → 新プロジェクト「Persol」のユーザーID に付け替える
-- ターミナルで pg_dump を使う場合の方法（docs/supabase-migration-to-persol.md の付録）。
-- ブラウザだけで移行する場合は export_from_old.sql を使う（こちらは不要）。
--
-- 前提: 旧データを session_replication_role = replica で fittrack.* に流し込み済み
--       （FK を一時的に無効化しているため、旧UUIDの行もそのまま入っている）
-- 使い方: 下の VALUES に (旧UUID, 新UUID) を書き、データ投入と同じ psql --single-transaction で実行する
--        （どこかで失敗したらデータ投入ごと全てロールバックされる）。
--        replica のままなので updated_at トリガーも動かず、元の更新日時が保たれる。
-- fittrack スキーマ以外には触れない。


CREATE TEMP TABLE user_id_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;

INSERT INTO user_id_map (old_id, new_id) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111');  -- ← 旧UUID, 新UUID に置き換え

-- 新UUIDが新プロジェクトの auth.users に存在すること（先に新プロジェクトでログインしておく）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_id_map m WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.new_id)) THEN
    RAISE EXCEPTION 'user_id_map の new_id が auth.users にありません。新プロジェクトで先にログインしてください';
  END IF;
END $$;

UPDATE fittrack.plans         t SET user_id = m.new_id FROM user_id_map m WHERE t.user_id = m.old_id;
UPDATE fittrack.records       t SET user_id = m.new_id FROM user_id_map m WHERE t.user_id = m.old_id;
UPDATE fittrack.profiles      t SET user_id = m.new_id FROM user_id_map m WHERE t.user_id = m.old_id;
UPDATE fittrack.body_logs     t SET user_id = m.new_id FROM user_id_map m WHERE t.user_id = m.old_id;
UPDATE fittrack.equipment     t SET user_id = m.new_id FROM user_id_map m WHERE t.user_id = m.old_id;
UPDATE fittrack.workout_plans t SET user_id = m.new_id FROM user_id_map m WHERE t.user_id = m.old_id;
UPDATE fittrack.exercises     t SET user_id = m.new_id FROM user_id_map m WHERE t.user_id = m.old_id;

-- 付け替え漏れ（auth.users に存在しない user_id）が1件でもあれば全体を取り消す
DO $$
DECLARE
  orphans bigint;
BEGIN
  SELECT sum(n) INTO orphans FROM (
              SELECT count(*) AS n FROM fittrack.plans         t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
    UNION ALL SELECT count(*)      FROM fittrack.records       t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
    UNION ALL SELECT count(*)      FROM fittrack.profiles      t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
    UNION ALL SELECT count(*)      FROM fittrack.body_logs     t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
    UNION ALL SELECT count(*)      FROM fittrack.equipment     t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
    UNION ALL SELECT count(*)      FROM fittrack.workout_plans t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
    UNION ALL SELECT count(*)      FROM fittrack.exercises     t WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.user_id)
  ) s;
  IF orphans > 0 THEN
    RAISE EXCEPTION '付け替えされていない行が % 件あります（user_id_map に旧UUIDを追加してください）', orphans;
  END IF;
END $$;

