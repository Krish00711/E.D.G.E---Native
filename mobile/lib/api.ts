import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { NativeModules } from 'react-native'

// EXPO_PUBLIC_ vars are inlined at bundle time.
// If env vars are missing or stale, derive host from Metro bundle URL in Expo Go.
function getDevHostFromBundle(): string | null {
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL
  if (!scriptURL) return null

  const match = scriptURL.match(/^https?:\/\/([^/:]+)(?::\d+)?/)
  return match?.[1] ?? null
}

const devHost = getDevHostFromBundle()
const fallbackApi = devHost ? `http://${devHost}:5000/api` : 'http://localhost:5000/api'
const fallbackMl = devHost ? `http://${devHost}:5001` : 'http://localhost:5001'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || fallbackApi
const ML_URL = process.env.EXPO_PUBLIC_ML_URL || fallbackMl

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

export const mlApi = axios.create({
  baseURL: ML_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Auto-attach JWT token to every request
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {}
  return config
})

// Log requests in dev so we can see exactly what URL is being hit
if (__DEV__) {
  api.interceptors.request.use((config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
    return config
  })
}

// Global response error handler
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status
    const hasResponse = Boolean(error.response)
    if (__DEV__) {
      console.log(`[API] Error ${status}:`, error.message, error.config?.url)
    }
    // Only clear auth token on confirmed auth failures from server responses.
    if (hasResponse && status === 401) {
      SecureStore.deleteItemAsync('auth_token').catch(() => {})
    }
    return Promise.reject(error)
  }
)

export default api
