import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '../store/authStore'
import { Colors } from '../constants/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { isHydrated, user, hydrate } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    hydrate()
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    SplashScreen.hideAsync()

    const inAuthGroup = segments[0] === '(auth)'
    const inAppGroup = segments[0] === '(app)'

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      // Check if student needs onboarding first
      if (user.role === 'student' && !user.onboardingComplete) {
        router.replace('/(auth)/onboarding')
      } else if (user.role === 'mentor') {
        router.replace('/(app)/(mentor)/dashboard')
      } else if (user.role === 'admin') {
        router.replace('/(app)/(admin)/dashboard')
      } else {
        router.replace('/(app)/(student)/dashboard')
      }
    } else if (user && inAppGroup && user.role === 'student' && !user.onboardingComplete) {
      router.replace('/(auth)/onboarding')
    }
  }, [isHydrated, user])

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  )
}
