import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LogOut } from 'lucide-react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { signInWithGoogle } from '../lib/auth'
import WorkoutRecordScreen from '../components/WorkoutRecordScreen'

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

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FITTRACK</Text>
        <TouchableOpacity onPress={handleLogout} hitSlop={8}>
          <LogOut size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>
      <WorkoutRecordScreen userId={session.user.id} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24 },
  title: { fontSize: 28, fontWeight: '900', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 16, textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 52, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6'
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#111827', letterSpacing: 1 }
})
