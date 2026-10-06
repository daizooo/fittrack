-- FitTrack migration 003: 曜日固定プラン → 自由作成のワークアウトプラン
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- (Run after 002_profile_equipment.sql)
--
-- - workout_plans: 名前付きプラン（曜日に紐付かない）。前後ストレッチを含む
-- - 既存の plans（曜日別）の中身を、ユーザーごとに一度だけ workout_plans へコピーする
--   （plans テーブル自体は mobile/ 版がまだ参照しているため残す）
-- - records.stretches: セッションで実施したストレッチの記録

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_plans (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  exercises   jsonb NOT NULL DEFAULT '[]'::jsonb,
  warmup      jsonb NOT NULL DEFAULT '[]'::jsonb,
  cooldown    jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE records ADD COLUMN IF NOT EXISTS stretches jsonb;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workout_plans_user_id ON workout_plans(user_id, sort_order);

-- ─── Updated_at trigger ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_workout_plans_updated_at ON workout_plans;
CREATE TRIGGER set_workout_plans_updated_at
  BEFORE UPDATE ON workout_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_plans_select" ON workout_plans;
DROP POLICY IF EXISTS "workout_plans_insert" ON workout_plans;
DROP POLICY IF EXISTS "workout_plans_update" ON workout_plans;
DROP POLICY IF EXISTS "workout_plans_delete" ON workout_plans;
CREATE POLICY "workout_plans_select" ON workout_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "workout_plans_insert" ON workout_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workout_plans_update" ON workout_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "workout_plans_delete" ON workout_plans FOR DELETE USING (auth.uid() = user_id);

-- ─── Data migration: 曜日別プラン → 名前付きプラン ──────────────────────────
-- 種目が1つ以上ある曜日だけをコピー。プラン名はカテゴリ（空なら「◯曜日プラン」）。
-- まだ workout_plans を1件も持っていないユーザーだけが対象なので、再実行しても重複しない。

INSERT INTO workout_plans (user_id, name, exercises, sort_order)
SELECT
  p.user_id,
  COALESCE(NULLIF(p.category, ''), p.day || '曜日プラン'),
  p.exercises,
  COALESCE(array_position(ARRAY['月','火','水','木','金','土','日'], p.day), 99)
FROM plans p
WHERE jsonb_array_length(p.exercises) > 0
  AND NOT EXISTS (SELECT 1 FROM workout_plans w WHERE w.user_id = p.user_id);
