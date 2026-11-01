import { useState, useEffect, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, openedFromEmailLink } from './lib/supabase'
import FitTrack from './components/FitTrack'
import LoginCodeSection from './components/LoginCodeSection'
import { redeemLoginCode, LOGIN_CODE_LENGTH } from './lib/loginHandoff'

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

/**
 * ログイン画面（メールのログインリンク＋8桁ログインコード）。
 * - Google ログインは廃止（iPadOS 27 のホーム画面アプリで外部ページ遷移が完了しないため）
 * - メールのリンクは既定のブラウザで開く。開いた先でログインし、8 桁のログインコードを表示する
 *   → ホーム画面アプリではそのコードを入力してログインする（ホーム画面アプリとブラウザはログイン状態を共有しないため）
 * - iPadOS 27 の一部端末で type="email" / メール用キーボード / AutoFill 対象の欄に
 *   フォーカスすると Safari ごと落ちるため、メール欄は通常キーボードの type="text"、
 *   コード欄は落ちないことを確認済みの type="number" にしている
 */
function LoginScreen() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const sendLink = async (e: FormEvent) => {
    e.preventDefault()
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('メールアドレスの形式が正しくありません')
      return
    }
    setSending(true)
    setError(null)
    setInfo(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setSending(false)
    if (error) {
      setError(error.status === 429 ? '送信回数の上限に達しました。しばらく待ってからやり直してください' : error.message)
      return
    }
    setInfo(`${address} にログイン用のメールを送りました。メールのリンクを開くと 8 桁のログインコードが表示されるので、下の欄に入力してください。`)
  }

  const redeem = async (e: FormEvent) => {
    e.preventDefault()
    setVerifying(true)
    setError(null)
    const message = await redeemLoginCode(code)
    if (message) {
      setError(message)
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-sm w-full text-center">
        <Logo />

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={sendLink} className="space-y-3">
          <p className="text-xs font-bold text-gray-500 text-left">① ログイン用のメールを受け取る</p>
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
          <button type="submit" disabled={sending || !email.trim()} className={primaryButtonClass}>
            {sending ? '送信中...' : 'ログイン用メールを送る'}
          </button>
        </form>

        {info && <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 text-left leading-relaxed">{info}</div>}

        <form onSubmit={redeem} className="space-y-3 mt-6">
          <p className="text-xs font-bold text-gray-500 text-left">② ログインコード（{LOGIN_CODE_LENGTH}桁）を入力</p>
          <input
            type="number"
            aria-label="ログインコード"
            placeholder={`${LOGIN_CODE_LENGTH}桁の数字`}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, LOGIN_CODE_LENGTH))}
            className={`${inputClass} text-center tracking-widest`}
          />
          <button type="submit" disabled={verifying || code.length !== LOGIN_CODE_LENGTH} className={primaryButtonClass}>
            {verifying ? '確認中...' : 'ログイン'}
          </button>
          <p className="text-[11px] text-gray-500 leading-relaxed text-left">
            コードは、メールのリンクを開いた画面か、ログイン済みの端末の「プロフィール」タブ →「ログインコード」で表示されます（有効期限3分・1回限り）。
          </p>
        </form>

        <p className="text-[11px] text-gray-400 mt-6">
          ログインすることで利用規約およびプライバシーポリシーに同意したものとみなします
        </p>
      </div>
    </div>
  )
}

/** メールのリンクから開いた直後に表示する。ここで出たコードをホーム画面アプリ等に入力する */
function EmailLinkLandingScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-sm w-full text-center">
        <Logo />
        <p className="text-sm font-bold text-gray-800">ログインしました</p>
        <p className="text-xs text-gray-500 mt-1">ホーム画面のアプリで使う場合は、下のコードをアプリのログイン画面に入力してください。</p>
        <LoginCodeSection autoIssue />
        <button type="button" onClick={onContinue} className="mt-6 text-sm font-bold text-gray-600 underline">
          このブラウザでこのまま使う
        </button>
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
  const [showLinkLanding, setShowLinkLanding] = useState(openedFromEmailLink)

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
  if (showLinkLanding) return <EmailLinkLandingScreen onContinue={() => setShowLinkLanding(false)} />
  return <FitTrack userId={session.user.id} />
}
