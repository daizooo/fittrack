import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { signInWithGoogle } from '../lib/auth'

export default function Login() {
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setSigningIn(true)
    setError(null)
    try {
      await signInWithGoogle()
      // ログイン成功後の画面遷移はSessionProviderのonAuthStateChangeを受けた
      // RootNavigatorのStack.Protectedガードが自動で行う
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSigningIn(false)
    }
  }

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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24 },
  title: { fontSize: 28, fontWeight: '900', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 16, textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 }
})
