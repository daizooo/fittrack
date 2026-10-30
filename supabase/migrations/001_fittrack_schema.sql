-- FitTrack: 統合プロジェクト「Persol」の fittrack スキーマ（旧プロジェクト public の 001〜007 を統合）
-- 旧 public 向けマイグレーションは supabase/legacy-public-migrations/ に保管（新プロジェクトには適用しない）
--
-- 適用前に: Dashboard > Project Settings > Data API > Exposed schemas に `fittrack` を追加すること
--           （未追加だと PostgREST が PGRST106 "The schema must be one of the following" を返す）
-- このファイルは fittrack スキーマ以外（public / sukusuku / denken3）に一切触れない。

CREATE SCHEMA IF NOT EXISTS fittrack;

-- ─── updated_at trigger function ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fittrack.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- 曜日別プラン（mobile/ 版（凍結中）が参照）
CREATE TABLE IF NOT EXISTS fittrack.plans (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day         text NOT NULL,
  category    text NOT NULL DEFAULT '',
  exercises   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, day)
);

CREATE TABLE IF NOT EXISTS fittrack.records (
  id          bigint PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_date   timestamptz NOT NULL,
  date        text NOT NULL,
  day         text NOT NULL,
  type        text NOT NULL CHECK (type IN ('workout', 'rest')),
  category    text,
  exercises   jsonb NOT NULL DEFAULT '[]'::jsonb,
  stretches   jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fittrack.profiles (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height            numeric,
  birth_date        date,
  gender            text CHECK (gender IN ('male', 'female')),
  goals             jsonb NOT NULL DEFAULT '[]'::jsonb,
  schedule          jsonb NOT NULL DEFAULT '{}'::jsonb,
  inherit_reset_at  timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fittrack.body_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date       date NOT NULL,
  weight     numeric,
  body_fat   numeric,
  created_at timestamptz DEFAULT now()
);

-- text PK: 既定の器具は旧来の文字列ID（'bodyweight','tube',…）、カスタムは gen_random_uuid()::text
CREATE TABLE IF NOT EXISTS fittrack.equipment (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  category   text NOT NULL CHECK (category IN ('load', 'data')),
  direction  text CHECK (direction IN ('+', '-')),
  weight     jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fittrack.workout_plans (
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

-- ユーザー作成のカスタム種目（標準種目は 'sys:' で始まるアプリ内カタログで、ここには入らない）
CREATE TABLE IF NOT EXISTS fittrack.exercises (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  muscle          text NOT NULL DEFAULT 'other',
  kind            text NOT NULL DEFAULT 'reps' CHECK (kind IN ('reps', 'duration', 'hiit')),
  equipment_type  text NOT NULL DEFAULT 'bodyweight',
  note            text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  CONSTRAINT exercises_muscle_check
    CHECK (muscle IN ('chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes', 'cardio', 'upper', 'lower', 'other'))
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON fittrack.plans(user_id);
CREATE INDEX IF NOT EXISTS idx_records_user_id ON fittrack.records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_full_date ON fittrack.records(full_date DESC);
CREATE INDEX IF NOT EXISTS idx_body_logs_user_id_date ON fittrack.body_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_user_id ON fittrack.equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_user_id ON fittrack.workout_plans(user_id, sort_order);
-- 同じユーザーの中で種目名は重複させない（大文字小文字は区別しない）
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_user_name ON fittrack.exercises(user_id, lower(name));

-- ─── updated_at triggers ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_updated_at ON fittrack.plans;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON fittrack.plans
  FOR EACH ROW EXECUTE FUNCTION fittrack.update_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON fittrack.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON fittrack.profiles
  FOR EACH ROW EXECUTE FUNCTION fittrack.update_updated_at();

DROP TRIGGER IF EXISTS set_workout_plans_updated_at ON fittrack.workout_plans;
CREATE TRIGGER set_workout_plans_updated_at BEFORE UPDATE ON fittrack.workout_plans
  FOR EACH ROW EXECUTE FUNCTION fittrack.update_updated_at();

DROP TRIGGER IF EXISTS set_exercises_updated_at ON fittrack.exercises;
CREATE TRIGGER set_exercises_updated_at BEFORE UPDATE ON fittrack.exercises
  FOR EACH ROW EXECUTE FUNCTION fittrack.update_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- 全テーブル: 本人の行だけ（auth.uid() = user_id）。(select auth.uid()) は行ごとの再評価を避けるため

ALTER TABLE fittrack.plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fittrack.records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fittrack.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fittrack.body_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fittrack.equipment     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fittrack.workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fittrack.exercises     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plans', 'records', 'profiles', 'body_logs', 'equipment', 'workout_plans', 'exercises']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON fittrack.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON fittrack.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON fittrack.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON fittrack.%I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON fittrack.%I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON fittrack.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON fittrack.%I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON fittrack.%I FOR DELETE TO authenticated USING ((select auth.uid()) = user_id)', t || '_delete', t);
  END LOOP;
END $$;

-- ─── Grants（Data API）───────────────────────────────────────────────────────
-- 独自スキーマは public と違い既定の権限が一切無いので、スキーマの USAGE とテーブル権限の両方が必要。
-- アプリは常にログイン後にアクセスするため、テーブル権限は anon に付与しない（RLS に加えた最小権限）。

GRANT USAGE ON SCHEMA fittrack TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.plans         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.records       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.profiles      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.body_logs     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.equipment     TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.workout_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.exercises     TO authenticated, service_role;
-- 未ログインで読ませる必要が出たテーブルだけ: GRANT SELECT ON fittrack.your_table TO anon;
