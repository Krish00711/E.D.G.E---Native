import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontSize } from '../../../constants/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : `${name}-outline` as IoniconsName}
      size={22}
      color={focused ? Colors.teal : Colors.textMuted}
    />
  )
}

export default function StudentTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#101010EE',
          borderTopColor: '#8C6A1D55',
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.teal,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          title: 'Check-in',
          tabBarIcon: ({ focused }) => <TabIcon name="pulse" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="academics"
        options={{
          title: 'Academics',
          tabBarIcon: ({ focused }) => <TabIcon name="school" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="burnout"
        options={{
          title: 'Burnout',
          tabBarIcon: ({ focused }) => <TabIcon name="analytics" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
      {/* Hidden tabs — accessible via navigation, not shown in tab bar */}
      <Tabs.Screen name="recovery" options={{ href: null }} />
      <Tabs.Screen name="peerpulse" options={{ href: null }} />
      <Tabs.Screen name="whatif" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="forums" options={{ href: null }} />
      <Tabs.Screen name="resources" options={{ href: null }} />
      <Tabs.Screen name="anomaly" options={{ href: null }} />
    </Tabs>
  )
}
