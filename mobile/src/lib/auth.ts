import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from './supabase'

WebBrowser.maybeCompleteAuthSession()

const redirectTo = Linking.createURL('/auth/callback')

function parseSessionParamsFromUrl(url: string): Record<string, string> {
  const fragment = url.split('#')[1]
  if (!fragment) return {}
  return Object.fromEntries(new URLSearchParams(fragment))
}

/**
 * SupabaseのGoogle OAuthをネイティブで行う。認証URLをシステムブラウザで開き、
 * ディープリンク(redirectTo)へ戻ってきたfragmentのトークンでセッションを張る。
 * PWA版(src/App.tsx)のsignInWithOAuthはリダイレクトで戻れる前提なので、
 * このコールバック処理はネイティブ固有の作り直し。
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true }
  })
  if (error) throw error
  if (!data?.url) throw new Error('認証URLを取得できませんでした')

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (result.type !== 'success') return null

  const params = parseSessionParamsFromUrl(result.url)
  if (params.error) throw new Error(params.error_description ?? params.error)
  if (!params.access_token || !params.refresh_token) {
    throw new Error('認証コールバックにトークンが含まれていません')
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token
  })
  if (sessionError) throw sessionError
  return sessionData.session
}
