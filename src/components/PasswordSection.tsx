import { useState, useEffect, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

export const MIN_PASSWORD_LENGTH = 8

// Supabase Auth のエラーを利用者向けの日本語に置き換える
function toMessage(err: { code?: string; message: string }): string {
  switch (err.code) {
    case 'same_password': return '現在と同じパスワードです'
    case 'weak_password': return 'パスワードが弱すぎます。英数字を組み合わせて長くしてください'
    case 'reauthentication_needed': return '再認証が必要です。一度ログアウトして Google でログインし直してから設定してください'
    default: return err.message
  }
}

/**
 * ログイン用パスワードの設定・変更。
 * iPadOS のホーム画面アプリでは Google ログインが完了しないため、
 * ブラウザで Google ログインした状態でパスワードを設定し、
 * ホーム画面アプリではメールアドレス＋パスワードでログインしてもらう。
 */
export default function PasswordSection() {
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください`)
      return
    }
    if (password !== confirm) {
      setError('確認用のパスワードが一致しません')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setError(toMessage(error))
      return
    }
    setPassword('')
    setConfirm('')
    setDone(true)
  }

  return (
    <form onSubmit={submit} className="pt-4 space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        パスワードを設定すると、ホーム画面に追加したアプリでも
        {email ? <span className="font-bold text-gray-700"> {email} </span> : ' メールアドレス '}
        とパスワードでログインできます（Google ログインが使えない端末向け）。
      </p>
      {/* iOS のパスワード自動入力にメールアドレスを紐づけるための非表示項目 */}
      <input type="email" name="email" autoComplete="username" value={email ?? ''} readOnly hidden />
      <input
        type="password"
        aria-label="新しいパスワード"
        placeholder={`新しいパスワード（${MIN_PASSWORD_LENGTH}文字以上）`}
        autoComplete="new-password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
      />
      <input
        type="password"
        aria-label="新しいパスワード（確認）"
        placeholder="もう一度入力"
        autoComplete="new-password"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
      />
      {error && (
        <div role="alert" className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">{error}</div>
      )}
      {done && (
        <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-xs font-bold text-green-700 flex items-center gap-1.5">
          <Check size={14} />パスワードを設定しました
        </div>
      )}
      <button
        type="submit"
        disabled={saving || !password || !confirm}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50"
      >
        {saving ? '設定中...' : 'パスワードを設定'}
      </button>
    </form>
  )
}
