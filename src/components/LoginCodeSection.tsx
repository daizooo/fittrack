import { useState, useEffect } from 'react'
import { createLoginCode } from '../lib/loginHandoff'

/**
 * ログインコードの発行。ここで発行した 8 桁の数字を、
 * ログインできない環境（iPadOS のホーム画面アプリ等）のログイン画面で入力するとログインできる。
 */
export default function LoginCodeSection() {
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!expiresAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [expiresAt])

  const remaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0
  const expired = code !== null && remaining === 0

  const issue = async () => {
    setLoading(true)
    setError(null)
    const result = await createLoginCode()
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCode(result.code)
    setExpiresAt(new Date(result.expiresAt).getTime())
    setNow(Date.now())
  }

  return (
    <div className="pt-4 space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        ホーム画面に追加したアプリなど、別の環境でログインするためのコードです。
        その環境のログイン画面の「ログインコード」欄に入力してください（有効期限3分・1回限り）。
      </p>
      {code && !expired && (
        <div className="text-center p-4 bg-blue-50 rounded-xl">
          <p className="text-3xl font-black tracking-[0.3em] text-blue-700 tabular-nums">{code}</p>
          <p className="text-xs text-blue-600 mt-1">
            残り {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </p>
        </div>
      )}
      {expired && <p className="text-xs font-bold text-gray-500 text-center">有効期限が切れました。発行し直してください</p>}
      {error && (
        <div role="alert" className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">{error}</div>
      )}
      <button
        type="button"
        onClick={issue}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50"
      >
        {loading ? '発行中...' : code ? 'コードを発行し直す' : 'ログインコードを発行'}
      </button>
    </div>
  )
}
