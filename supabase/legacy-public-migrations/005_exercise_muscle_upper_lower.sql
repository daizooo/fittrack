-- FitTrack migration 005: 種目の部位に「上半身」「下半身」を追加
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- (Run after 004_exercises.sql)

ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_muscle_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_muscle_check
  CHECK (muscle IN ('chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes', 'cardio', 'upper', 'lower', 'other'));
