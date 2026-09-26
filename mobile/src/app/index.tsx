import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { signInWithGoogle } from '../lib/auth'

export default function Index() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async () => {
    setSigningIn(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSigningIn(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>FITTRACK</Text>
        <Text style={styles.subtitle}>あなたのトレーニングを記録・分析</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={signingIn}>
          <Text style={styles.buttonText}>{signingIn ? 'ログイン中...' : 'Googleでログイン'}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // フェーズ0はログイン確認までがゴール。プラン・記録・タイマー等の画面は
  // フェーズ1（docs/native-app-rewrite.md）以降で作る。
  return (
    <View style={styles.center}>
      <Text style={styles.title}>FITTRACK</Text>
      <Text style={styles.subtitle}>ログイン済み: {session.user.email}</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>ログアウト</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24 },
  title: { fontSize: 28, fontWeight: '900', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 16, textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 }
})
