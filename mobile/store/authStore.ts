import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { io } from 'socket.io-client'
import api from '../lib/api'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000'
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '')

let socket: ReturnType<typeof io> | null = null

function connectSocket(user: AuthUser | null) {
  if (!user) return

  if (socket) {
    socket.disconnect()
    socket = null
  }

  socket = io(SOCKET_URL, { transports: ['websocket'] })

  socket.on('connect', () => {
    if (user.studentId) {
      socket?.emit('join', user.studentId)
    }
  })

  socket.on('prediction_updated', (data: any) => {
    AsyncStorage.setItem('latest_prediction', JSON.stringify(data?.prediction ?? null)).catch(() => {})
  })
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

async function registerPushToken() {
  try {
    // Expo Go (SDK 53+) does not support remote push notifications APIs.
    if (Constants.appOwnership === 'expo') return

    if (!Device.isDevice) return

    const Notifications = await import('expo-notifications')

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') return

    const token = await Notifications.getExpoPushTokenAsync()
    if (!token?.data) return

    await api.post('/sync/push-token', { token: token.data })
  } catch {
    // Skip silently; push registration is best-effort.
  }
}

export type UserRole = 'student' | 'mentor' | 'admin'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  studentId: string | null
  instructorId: string | null
  onboardingComplete?: boolean
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isHydrated: boolean

  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  role?: UserRole
  major?: string
  program?: string
  year?: number
  cohortId?: string
  consented?: boolean
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token')
      if (!token) {
        set({ isHydrated: true })
        return
      }

      // Mark app as hydrated immediately so splash never blocks on network.
      set({ token, isHydrated: true })

      const authMePromise = api.get('/auth/me')
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Hydration timeout')), 8000)
      })

      const res = await Promise.race([authMePromise, timeoutPromise])
      set({ user: res.data, token, isHydrated: true })
      connectSocket(res.data)
      await registerPushToken()
    } catch {
      await SecureStore.deleteItemAsync('auth_token')
      disconnectSocket()
      set({ user: null, token: null, isHydrated: true })
    }
  },

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const res = await api.post('/auth/login', { email, password })
      const { token, user } = res.data
      await SecureStore.setItemAsync('auth_token', token)
      set({ user, token, isLoading: false })
      connectSocket(user)
      await registerPushToken()
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  register: async (data) => {
    set({ isLoading: true })
    try {
      const res = await api.post('/auth/register', data)
      const { token, user } = res.data
      await SecureStore.setItemAsync('auth_token', token)
      set({ user, token, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token')
    disconnectSocket()
    set({ user: null, token: null })
  },
}))
