import { Tabs } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { BarChart3, CalendarDays, Dumbbell, History, LogOut, User } from 'lucide-react-native'
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
        <Tabs.Screen
          name="history"
          options={{
            title: '履歴',
            tabBarIcon: ({ color, size }) => <History color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: '分析',
            tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'プロフィール',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />
          }}
        />
      </Tabs>
    </WorkoutDataProvider>
  )
}
