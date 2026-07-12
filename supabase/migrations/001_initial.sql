-- FitTrack initial schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day         text NOT NULL,
  category    text NOT NULL DEFAULT '',
  exercises   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, day)
);

CREATE TABLE IF NOT EXISTS records (
  id          bigint PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_date   timestamptz NOT NULL,
  date        text NOT NULL,
  day         text NOT NULL,
  type        text NOT NULL CHECK (type IN ('workout', 'rest')),
  category    text,
  exercises   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_full_date ON records(full_date DESC);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON plans;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Plans policies
CREATE POLICY "plans_select" ON plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "plans_insert" ON plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "plans_update" ON plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "plans_delete" ON plans FOR DELETE USING (auth.uid() = user_id);

-- Records policies
CREATE POLICY "records_select" ON records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "records_insert" ON records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "records_update" ON records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "records_delete" ON records FOR DELETE USING (auth.uid() = user_id);
