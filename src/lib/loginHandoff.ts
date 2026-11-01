import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

// ログイン引き継ぎコード（Edge Function: supabase/functions/fittrack-login-handoff）
// ログイン済みのブラウザで 8 桁の数字コードを発行し、
// 文字入力やGoogle画面への遷移が使えない環境（iPadOS のホーム画面アプリ等）で入力してログインする。

const FUNCTION_NAME = 'fittrack-login-handoff'
export const LOGIN_CODE_LENGTH = 8

const MESSAGES: Record<string, string> = {
  invalid_code: 'コードが違うか、有効期限（3分）が切れています。発行し直してください',
  too_many_attempts: '試行回数が多すぎます。10分ほど待ってからやり直してください',
  unauthorized: 'ログインが切れています。ログインし直してください',
}

async function errorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body?.error && MESSAGES[body.error]) return MESSAGES[body.error]
    } catch { /* 本文が JSON でない場合は下の汎用メッセージ */ }
  }
  return '通信に失敗しました。時間をおいてやり直してください'
}

export async function createLoginCode(): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { action: 'create' } })
  if (error || !data?.code) return { error: await errorMessage(error) }
  return { code: data.code as string, expiresAt: data.expires_at as string }
}

/** 成功時は null（セッションは onAuthStateChange で反映される） */
export async function redeemLoginCode(code: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { action: 'redeem', code } })
  if (error || !data?.token_hash) return errorMessage(error)
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' })
  return otpError ? `ログインに失敗しました（${otpError.message}）` : null
}
