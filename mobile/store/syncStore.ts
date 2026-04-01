import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import api from '../lib/api'

const LAST_SYNC_KEY = 'last_synced_at'

interface SyncState {
  lastSyncedAt: string | null
  isSyncing: boolean
  syncData: Record<string, any>
  sync: () => Promise<void>
  loadCache: () => Promise<void>
}

export const useSyncStore = create<SyncState>((set, get) => ({
  lastSyncedAt: null,
  isSyncing: false,
  syncData: {},

  loadCache: async () => {
    try {
      const cached = await AsyncStorage.getItem('sync_data')
      const lastSyncedAt = await AsyncStorage.getItem(LAST_SYNC_KEY)
      if (cached) set({ syncData: JSON.parse(cached), lastSyncedAt })
    } catch {}
  },

  sync: async () => {
    if (get().isSyncing) return
    set({ isSyncing: true })
    try {
      const lastSyncedAt = get().lastSyncedAt
      const params = lastSyncedAt ? { lastSyncedAt } : {}
      const res = await api.get('/sync/delta', { params })
      const data = res.data
      const now = data.syncedAt || new Date().toISOString()

      await AsyncStorage.setItem('sync_data', JSON.stringify(data))
      await AsyncStorage.setItem(LAST_SYNC_KEY, now)

      set({ syncData: data, lastSyncedAt: now, isSyncing: false })
    } catch {
      set({ isSyncing: false })
    }
  },
}))
