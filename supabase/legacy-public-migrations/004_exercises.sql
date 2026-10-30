-- FitTrack migration 004: 種目マスタ（exercises）
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- (Run after 003_workout_plans.sql)
--
-- - exercises: ユーザーが作成したカスタム種目。標準の種目（プッシュアップ等）はアプリ内の
--   固定カタログ（id は 'sys:' で始まる）で、このテーブルには入らない
-- - プラン（workout_plans.exercises）と記録（records.exercises）は、各種目に exerciseId を持つ。
--   どちらも jsonb なのでテーブル変更は不要。IDの無い既存データは、アプリが種目名から
--   種目を引き当てる（未登録の名前は初回読み込み時にカスタム種目として自動登録される）

CREATE TABLE IF NOT EXISTS exercises (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  muscle          text NOT NULL DEFAULT 'other'
                  CHECK (muscle IN ('chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes', 'cardio', 'other')),
  kind            text NOT NULL DEFAULT 'reps' CHECK (kind IN ('reps', 'duration', 'hiit')),
  equipment_type  text NOT NULL DEFAULT 'bodyweight',
  note            text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 同じユーザーの中で、種目名は重複させない（大文字小文字は区別しない）
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_user_name ON exercises(user_id, lower(name));

DROP TRIGGER IF EXISTS set_exercises_updated_at ON exercises;
CREATE TRIGGER set_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exercises_select" ON exercises;
DROP POLICY IF EXISTS "exercises_insert" ON exercises;
DROP POLICY IF EXISTS "exercises_update" ON exercises;
DROP POLICY IF EXISTS "exercises_delete" ON exercises;
CREATE POLICY "exercises_select" ON exercises FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "exercises_insert" ON exercises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exercises_update" ON exercises FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "exercises_delete" ON exercises FOR DELETE USING (auth.uid() = user_id);
