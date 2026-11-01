import { useState, useEffect, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import FitTrack from './components/FitTrack'
import { redeemLoginCode, LOGIN_CODE_LENGTH } from './lib/loginHandoff'

const OTP_MAX_LENGTH = 10 // Supabase のメール OTP は既定 6 桁（設定で最大 10 桁）

const inputClass = 'w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm'
const primaryButtonClass =
  'w-full bg-gray-900 text-white font-bold py-3.5 px-4 rounded-xl active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed'

const Logo = () => (
  <div className="mb-8">
    <div className="bg-blue-600 text-white w-14 h-14 flex items-center justify-center rounded-2xl text-2xl font-black mx-auto mb-4 shadow-lg shadow-blue-500/30">
      F
    </div>
    <h1 className="text-2xl font-black text-gray-900 tracking-wider">FITTRACK</h1>
    <p className="text-gray-500 text-sm mt-2">あなたのトレーニングを記録・分析</p>
  </div>
)

type Step = 'email' | 'otp' | 'handoff'

/**
 * ログイン画面（メールアドレス → メールに届く確認コード）。
 * - Google ログインは廃止（iPadOS 27 のホーム画面アプリで外部ページ遷移が完了しないため）
 * - メールには確認コード（{{ .Token }}）とリンクの両方が載る（Persol の Magic Link テンプレート）
 *   ホーム画面アプリではコードを入力、ブラウザならリンクを押すだけでもログインできる
 * - iPadOS 27 の一部端末で type="email" / メール用キーボード / AutoFill 対象の欄に
 *   フォーカスすると Safari ごと落ちるため、メール欄は通常キーボードの type="text"、
 *   コード欄は落ちないことを確認済みの type="number" にしている
 * - 補助として、ログイン済み端末で発行する 8 桁の「ログインコード」でも入れる
 */
function LoginScreen() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const go = (next: Step) => {
    setStep(next)
    setCode('')
    setError(null)
    setInfo(null)
  }

  const sendOtp = async (e?: FormEvent) => {
    e?.preventDefault()
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('メールアドレスの形式が正しくありません')
      return
    }
    setIsLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setIsLoading(false)
    if (error) {
      setError(error.status === 429 ? '送信回数の上限に達しました。しばらく待ってからやり直してください' : error.message)
      return
    }
    go('otp')
    setInfo(`${address} に確認コードを送りました`)
  }

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
    if (error) {
      setError('コードが違うか、有効期限が切れています')
      setIsLoading(false)
    }
  }

  const redeemHandoff = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const message = await redeemLoginCode(code)
    if (message) {
      setError(message)
      setIsLoading(false)
    }
  }

  const codeInput = (label: string, maxLength: number) => (
    <input
      type="number"
      aria-label={label}
      placeholder={label}
      value={code}
      onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, maxLength))}
      className={`${inputClass} text-center tracking-widest`}
    />
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-sm w-full text-center">
        <Logo />

        {info && <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">{info}</div>}
        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={sendOtp} className="space-y-3">
            <input
              type="text"
              name="ft-mail"
              aria-label="メールアドレス"
              placeholder="メールアドレス"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClass}
            />
            <button type="submit" disabled={isLoading || !email.trim()} className={primaryButtonClass}>
              {isLoading ? '送信中...' : '確認コードを送る'}
            </button>
            <button type="button" onClick={() => go('handoff')} className="text-xs text-blue-600 font-bold pt-2">
              ほかの端末で発行したログインコードで入る
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-3">
            {codeInput('メールに届いた確認コード', OTP_MAX_LENGTH)}
            <button type="submit" disabled={isLoading || code.length < 6} className={primaryButtonClass}>
              {isLoading ? '確認中...' : 'ログイン'}
            </button>
            <div className="flex justify-between pt-2 text-xs font-bold">
              <button type="button" onClick={() => go('email')} className="text-gray-500">メールアドレスを変更</button>
              <button type="button" onClick={() => sendOtp()} disabled={isLoading} className="text-blue-600">コードを再送</button>
            </div>
          </form>
        )}

        {step === 'handoff' && (
          <form onSubmit={redeemHandoff} className="space-y-3">
            {codeInput(`ログインコード（${LOGIN_CODE_LENGTH}桁）`, LOGIN_CODE_LENGTH)}
            <button type="submit" disabled={isLoading || code.length !== LOGIN_CODE_LENGTH} className={primaryButtonClass}>
              {isLoading ? '確認中...' : 'コードでログイン'}
            </button>
            <p className="text-[11px] text-gray-500 leading-relaxed text-left">
              ログイン済みの端末で FitTrack を開き、「プロフィール」タブの「ログインコード」から発行できます（有効期限3分・1回限り）。
            </p>
            <button type="button" onClick={() => go('email')} className="text-xs text-gray-500 font-bold">
              メールアドレスでログインする
            </button>
          </form>
        )}

        <p className="text-[11px] text-gray-400 mt-6">
          ログインすることで利用規約およびプライバシーポリシーに同意したものとみなします
        </p>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="bg-blue-600 text-white w-14 h-14 flex items-center justify-center rounded-2xl text-2xl font-black mx-auto mb-4 animate-pulse">
          F
        </div>
        <p className="text-gray-400 text-sm font-medium">読み込み中...</p>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <LoadingScreen />
  if (!session) return <LoginScreen />
  return <FitTrack userId={session.user.id} />
}
