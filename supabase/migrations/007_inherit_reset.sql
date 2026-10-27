-- FitTrack migration 007: 前回引継ぎのリセット
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- (Run after 006_data_api_grants.sql)
--
-- - profiles.inherit_reset_at: 「設定 > 前回引継ぎ > リセット」を押した日時。
--   この日時より前の記録は、セッション開始時の「前回引継」（負荷の引き継ぎ）の対象から外れる。
--   記録そのものは消さない（履歴・分析はそのまま）。NULL = リセットしていない
-- - 新しいテーブルは作らないので GRANT は不要（profiles には 006 で付与済み。列の追加は同じ権限に含まれる）

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS inherit_reset_at timestamptz;
