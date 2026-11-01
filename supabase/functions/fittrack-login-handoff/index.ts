// FitTrack ログイン引き継ぎコード
//
// POST { action: "create" }  (Authorization: Bearer <ログイン中ユーザーのアクセストークン>)
//   → { code, expires_at }   8 桁の数字コードを発行（同ユーザーの未使用コードは破棄）
// POST { action: "redeem", code }
//   → { token_hash }         クライアントは supabase.auth.verifyOtp({ token_hash, type: "email" }) でセッションを得る
//
// メール送信は行わない（auth.admin.generateLink はリンク生成のみ）。
// DB は fittrack スキーマのみを使用する。
import { createClient } from "jsr:@supabase/supabase-js@2";

const CODE_TTL_SECONDS = 180;
const FAILURE_WINDOW_MINUTES = 10;
const MAX_FAILURES_IN_WINDOW = 30;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "fittrack" },
});

async function hashCode(code: string): Promise<string> {
  // service_role キーを鍵にした HMAC。DB が漏れてもコードを総当たりで逆算しにくくする
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 先頭が 0 にならない 8 桁（10000000〜99999999）
function generateCode(): string {
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= 4_230_000_000); // 90,000,000 の倍数未満に限定して偏りをなくす
  return String(10_000_000 + (n % 90_000_000));
}

async function handleCreate(req: Request) {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return json({ error: "unauthorized" }, 401);
  const userId = data.user.id;

  await admin.from("login_handoffs").delete().eq("user_id", userId).is("used_at", null);

  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
  for (let i = 0; i < 3; i++) {
    const code = generateCode();
    const { error: insErr } = await admin
      .from("login_handoffs")
      .insert({ user_id: userId, code_hash: await hashCode(code), expires_at: expiresAt });
    if (!insErr) return json({ code, expires_at: expiresAt });
    if (insErr.code !== "23505") break; // 一意制約違反（偶然の重複）以外は中断
  }
  return json({ error: "server_error" }, 500);
}

async function handleRedeem(body: { code?: unknown }) {
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (code.length !== 8) return json({ error: "invalid_code" }, 400);

  const since = new Date(Date.now() - FAILURE_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from("login_handoff_failures")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_FAILURES_IN_WINDOW) return json({ error: "too_many_attempts" }, 429);

  // 未使用・期限内のものだけを原子的に使用済みにする（同じコードの二重使用を防ぐ）
  const { data: rows, error } = await admin
    .from("login_handoffs")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", await hashCode(code))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id");
  if (error) return json({ error: "server_error" }, 500);
  if (!rows || rows.length === 0) {
    await admin.from("login_handoff_failures").insert({});
    return json({ error: "invalid_code" }, 400);
  }

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(rows[0].user_id);
  const email = userData?.user?.email;
  if (userErr || !email) return json({ error: "server_error" }, 500);

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) return json({ error: "server_error" }, 500);

  // 古いレコードの掃除（失敗しても応答には影響させない）
  const old = new Date(Date.now() - 24 * 3600_000).toISOString();
  await admin.from("login_handoffs").delete().lt("expires_at", old);
  await admin.from("login_handoff_failures").delete().lt("created_at", old);

  return json({ token_hash: link.properties.hashed_token });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: { action?: string; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  try {
    if (body.action === "create") return await handleCreate(req);
    if (body.action === "redeem") return await handleRedeem(body);
    return json({ error: "bad_request" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
