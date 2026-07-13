-- FitTrack migration 002: profiles, body_logs, equipment tables
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- (Run after 001_initial.sql)

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height     numeric,
  birth_date date,
  gender     text CHECK (gender IN ('male', 'female')),
  goals      jsonb NOT NULL DEFAULT '[]'::jsonb,
  schedule   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS body_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date       date NOT NULL,
  weight     numeric,
  body_fat   numeric,
  created_at timestamptz DEFAULT now()
);

-- Equipment uses text PK so defaults can use legacy string IDs ('bodyweight','tube',…)
-- Custom equipment inserted with gen_random_uuid()::text
CREATE TABLE IF NOT EXISTS equipment (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  category   text NOT NULL CHECK (category IN ('load', 'data')),
  direction  text CHECK (direction IN ('+', '-')),
  weight     jsonb,
  created_at timestamptz DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_body_logs_user_id_date ON body_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_user_id ON equipment(user_id);

-- ─── Updated_at trigger for profiles ─────────────────────────────────────────

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = user_id);

-- body_logs
CREATE POLICY "body_logs_select" ON body_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "body_logs_insert" ON body_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "body_logs_update" ON body_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "body_logs_delete" ON body_logs FOR DELETE USING (auth.uid() = user_id);

-- equipment
CREATE POLICY "equipment_select" ON equipment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "equipment_insert" ON equipment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "equipment_update" ON equipment FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "equipment_delete" ON equipment FOR DELETE USING (auth.uid() = user_id);
