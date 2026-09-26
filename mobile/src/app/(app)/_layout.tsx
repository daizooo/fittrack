import { Tabs } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { CalendarDays, Dumbbell, LogOut } from 'lucide-react-native'
import { useSession } from '../../context/SessionContext'
import { WorkoutDataProvider } from '../../context/WorkoutDataContext'
import { supabase } from '../../lib/supabase'

export default function AppLayout() {
  const { session } = useSession()
  // ルートのStack.Protectedがガードしているため、ここに到達する時点でsessionは必ず存在する
  if (!session) return null

  const handleLogout = () => {
    supabase.auth.signOut()
  }

  return (
    <WorkoutDataProvider userId={session.user.id}>
      <Tabs
        screenOptions={{
          headerTitleStyle: { fontWeight: '900' },
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }} hitSlop={8}>
              <LogOut size={20} color="#9ca3af" />
            </TouchableOpacity>
          ),
          tabBarActiveTintColor: '#2563eb'
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'ワークアウト',
            tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'プラン',
            tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />
          }}
        />
      </Tabs>
    </WorkoutDataProvider>
  )
}
