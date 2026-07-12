import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import FitTrack from './components/FitTrack'

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
)

function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) {
      setError(error.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-sm w-full text-center">
        <div className="mb-8">
          <div className="bg-blue-600 text-white w-14 h-14 flex items-center justify-center rounded-2xl text-2xl font-black mx-auto mb-4 shadow-lg shadow-blue-500/30">
            F
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-wider">FITTRACK</h1>
          <p className="text-gray-500 text-sm mt-2">あなたのトレーニングを記録・分析</p>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-blue-500">✓</span> ワークアウト記録と履歴管理
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-blue-500">✓</span> タバタ・HIIT タイマー内蔵
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-blue-500">✓</span> 進捗グラフと分析ダッシュボード
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          {isLoading ? 'ログイン中...' : 'Googleでログイン'}
        </button>

        <p className="text-[11px] text-gray-400 mt-4">
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
