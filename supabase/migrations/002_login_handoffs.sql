-- ログイン引き継ぎコード
-- ログイン済みの端末（ブラウザ）で 8 桁の数字コードを発行し、
-- 別の環境（iPadOS のホーム画面アプリ等）でコードを入力してログインする。
-- メールアドレス／パスワード入力や外部サイトへの遷移が使えない端末向け。
-- アクセスは Edge Function `fittrack-login-handoff`（service_role）経由のみ。

CREATE TABLE IF NOT EXISTS fittrack.login_handoffs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_handoffs_user_id_idx ON fittrack.login_handoffs (user_id);

-- 総当たり対策：コード照合の失敗記録（直近の失敗数で引き換えを一時停止する）
CREATE TABLE IF NOT EXISTS fittrack.login_handoff_failures (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_handoff_failures_created_at_idx ON fittrack.login_handoff_failures (created_at);

ALTER TABLE fittrack.login_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fittrack.login_handoff_failures ENABLE ROW LEVEL SECURITY;

-- クライアント（anon / authenticated）には一切公開しない。ポリシーも作らない。
GRANT SELECT, INSERT, UPDATE, DELETE ON fittrack.login_handoffs TO service_role;
GRANT SELECT, INSERT, DELETE ON fittrack.login_handoff_failures TO service_role;
